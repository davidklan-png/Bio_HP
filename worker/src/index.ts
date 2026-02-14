import profileData from "../../shared/profile.json";
import {
  MAX_CONTENT_LENGTH,
  analyzeJobDescription,
  buildRateLimitErrorPayload,
  parseAndValidateProfile,
  type Confidence,
  type Profile,
  validateAnalyzeBody
} from "./analysis";

interface Env {
  ALLOWED_ORIGINS?: string;
  ANALYTICS_SAMPLE_RATE?: string;
  RATE_LIMITER: DurableObjectNamespace;
}

interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface RequestMetrics {
  requestId: string;
  jdLength: number;
  score: number | null;
  confidence: Confidence | null;
  rateLimited: boolean;
}

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const CACHE_CONTROL_HEADER = "no-store";

const PROFILE: Profile = parseAndValidateProfile(profileData);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const isAnalyzePath = url.pathname === "/analyze" || url.pathname === "/api/analyze";
    if (!isAnalyzePath) {
      logRequestLifecycle(env, {
        requestId,
        jdLength: 0,
        score: null,
        confidence: null,
        rateLimited: false
      });
      return jsonError(404, "Not found", {}, requestId);
    }

    const origin = request.headers.get("Origin");
    const cors = resolveCors(origin, env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") {
      if (origin && !cors.isAllowed) {
        logRequestLifecycle(env, {
          requestId,
          jdLength: 0,
          score: null,
          confidence: null,
          rateLimited: false
        });
        return jsonError(403, "Origin is not allowed", cors.headers, requestId);
      }

      logRequestLifecycle(env, {
        requestId,
        jdLength: 0,
        score: null,
        confidence: null,
        rateLimited: false
      });
      return new Response(null, {
        status: 204,
        headers: {
          ...cors.headers,
          "cache-control": CACHE_CONTROL_HEADER,
          "content-length": "0"
        }
      });
    }

    if (origin && !cors.isAllowed) {
      logRequestLifecycle(env, {
        requestId,
        jdLength: 0,
        score: null,
        confidence: null,
        rateLimited: false
      });
      return jsonError(403, "Origin is not allowed", cors.headers, requestId);
    }

    if (request.method !== "POST") {
      logRequestLifecycle(env, {
        requestId,
        jdLength: 0,
        score: null,
        confidence: null,
        rateLimited: false
      });
      return jsonError(405, "Method not allowed", cors.headers, requestId);
    }

    const ip = getClientIp(request);
    let rate: RateLimitDecision;
    try {
      rate = await applyRateLimit(env.RATE_LIMITER, ip);
    } catch {
      logRequestLifecycle(env, {
        requestId,
        jdLength: 0,
        score: null,
        confidence: null,
        rateLimited: false
      });
      return jsonError(503, "Rate limiter unavailable. Try again shortly.", cors.headers, requestId);
    }
    const rateHeaders = buildRateHeaders(rate.remaining, rate.resetAt);

    if (!rate.allowed) {
      logRequestLifecycle(env, {
        requestId,
        jdLength: 0,
        score: null,
        confidence: null,
        rateLimited: true
      });

      return jsonResponse(
        429,
        buildRateLimitErrorPayload(requestId, rate.retryAfterSeconds),
        {
          ...cors.headers,
          ...rateHeaders,
          "Retry-After": String(rate.retryAfterSeconds)
        }
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      logRequestLifecycle(env, {
        requestId,
        jdLength: 0,
        score: null,
        confidence: null,
        rateLimited: false
      });
      return jsonError(
        415,
        "Content-Type must be application/json",
        {
          ...cors.headers,
          ...rateHeaders
        },
        requestId
      );
    }

    const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
      logRequestLifecycle(env, {
        requestId,
        jdLength: 0,
        score: null,
        confidence: null,
        rateLimited: false
      });
      return jsonError(
        413,
        `Payload too large. Max ${MAX_CONTENT_LENGTH} bytes.`,
        {
          ...cors.headers,
          ...rateHeaders
        },
        requestId
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logRequestLifecycle(env, {
        requestId,
        jdLength: 0,
        score: null,
        confidence: null,
        rateLimited: false
      });
      return jsonError(400, "Malformed JSON body", { ...cors.headers, ...rateHeaders }, requestId);
    }

    const validationError = validateAnalyzeBody(body);
    if (validationError) {
      const jdLength =
        typeof (body as { jd_text?: unknown }).jd_text === "string"
          ? (body as { jd_text: string }).jd_text.length
          : 0;
      logRequestLifecycle(env, {
        requestId,
        jdLength,
        score: null,
        confidence: null,
        rateLimited: false
      });
      return jsonError(400, validationError, { ...cors.headers, ...rateHeaders }, requestId);
    }

    const jdText = (body as { jd_text: string }).jd_text.trim();
    const analysis = analyzeJobDescription(jdText, PROFILE, requestId);
    logRequestLifecycle(env, {
      requestId,
      jdLength: jdText.length,
      score: analysis.score,
      confidence: analysis.confidence,
      rateLimited: false
    });

    return jsonResponse(200, analysis, { ...cors.headers, ...rateHeaders });
  }
};

function logRequestLifecycle(env: Env, metrics: RequestMetrics): void {
  logRequestEvent(metrics);
  maybeLogAnalyticsSample(env, metrics);
}

function logRequestEvent(input: RequestMetrics): void {
  console.log(
    JSON.stringify({
      request_id: input.requestId,
      timestamp: new Date().toISOString(),
      jd_text_length: input.jdLength,
      score: input.score,
      confidence: input.confidence,
      rate_limited: input.rateLimited
    })
  );
}

function maybeLogAnalyticsSample(env: Env, input: RequestMetrics): void {
  const sampleRate = parseSampleRate(env.ANALYTICS_SAMPLE_RATE);
  if (sampleRate <= 0) {
    return;
  }

  if (Math.random() > sampleRate) {
    return;
  }

  console.log(
    JSON.stringify({
      event: "analytics_sample",
      request_id: input.requestId,
      score: input.score,
      confidence: input.confidence,
      length: input.jdLength,
      timestamp: new Date().toISOString()
    })
  );
}

function parseSampleRate(raw: string | undefined): number {
  if (!raw) {
    return 0;
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (parsed <= 0) {
    return 0;
  }

  if (parsed >= 1) {
    return 1;
  }

  return parsed;
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) {
    return cfIp;
  }

  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return "unknown-ip";
}

async function applyRateLimit(
  rateLimiterNamespace: DurableObjectNamespace,
  ip: string
): Promise<RateLimitDecision> {
  const id = rateLimiterNamespace.idFromName(ip);
  const stub = rateLimiterNamespace.get(id);
  const response = await stub.fetch("https://rate-limiter.internal/check", {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Rate limiter failure: ${response.status}`);
  }

  return (await response.json()) as RateLimitDecision;
}

function buildRateHeaders(remaining: number, resetAt: number): HeadersInit {
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
    "X-RateLimit-Remaining": String(Math.max(remaining, 0)),
    "X-RateLimit-Reset": String(Math.floor(resetAt / 1000))
  };
}

function resolveCors(origin: string | null, allowedOriginsRaw?: string): {
  isAllowed: boolean;
  headers: HeadersInit;
} {
  const allowedOrigins = (allowedOriginsRaw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const isAllowed = origin === null ? true : allowedOrigins.includes(origin);
  const allowOriginHeader = origin !== null && isAllowed ? origin : "";

  const headers: HeadersInit = {
    ...(allowOriginHeader ? { "Access-Control-Allow-Origin": allowOriginHeader } : {}),
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };

  return { isAllowed, headers };
}

function jsonError(
  status: number,
  error: string,
  headers: HeadersInit,
  requestId: string,
  extras?: Record<string, unknown>
): Response {
  return jsonResponse(
    status,
    {
      request_id: requestId,
      error,
      ...(extras ?? {})
    },
    headers
  );
}

function jsonResponse(status: number, payload: unknown, headers: HeadersInit): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": CACHE_CONTROL_HEADER,
      ...headers
    }
  });
}

export class RateLimiterDO {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const existingHits = ((await this.state.storage.get<number[]>("hits")) ?? []).filter(
      (timestamp) => timestamp > windowStart
    );
    await this.state.storage.put("hits", existingHits);

    let allowed = true;
    if (existingHits.length >= RATE_LIMIT_MAX_REQUESTS) {
      allowed = false;
    } else {
      existingHits.push(now);
      await this.state.storage.put("hits", existingHits);
    }

    const oldestInWindow = existingHits[0] ?? now;
    const resetAt = oldestInWindow + RATE_LIMIT_WINDOW_MS;
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - existingHits.length);
    const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000));

    const decision: RateLimitDecision = {
      allowed,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining,
      resetAt,
      retryAfterSeconds
    };

    return new Response(JSON.stringify(decision), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}
