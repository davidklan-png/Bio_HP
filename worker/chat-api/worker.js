/**
 * kinokoholic-chat-api — Cloudflare Worker
 *
 * Streams portfolio Q&A responses via Claude Sonnet.
 * Env vars: ANTHROPIC_API_KEY (secret), ALLOWED_ORIGIN(S), MAX_MESSAGES,
 * MAX_MESSAGE_CHARS, MAX_BODY_BYTES, RATE_LIMIT_PER_HOUR, PROMPT_CACHE_TTL
 */

// ── System prompt (David Klan portfolio assistant) ──────────────────────────
const SYSTEM_PROMPT = `You are a portfolio assistant for David Klan, an AI/ML Engineer and IT PM based in Tokyo. You answer questions about his work, projects, career, and capabilities with direct, candid responses. No filler, no "great question" padding.

## About David Klan
- 20+ years spanning infrastructure delivery, PMO/program management, and AI/ML engineering
- Currently independent at Kinokoholic Labs, Tokyo
- Core positioning: "The interface between human intent and machine intelligence"
- Ships LLM systems that know their own limits — citation-first RAG, governed agents, reporting pipelines

## Skills
Python, TypeScript, LLM application architecture, RAG, Prompt engineering, Evaluation & observability, Infrastructure transformation, Data migration, Program governance, Change management, Enterprise delivery, Stakeholder management, DR/BCP delivery, PMO reporting, PMP certified (2012)

## Named Recipes (How he works)
1. **Citation-First RAG** — Tax/legal answers must be auditable. Every claim links to official NTA/e-Gov source; fail-closed when citation can't be verified. Used in JTES.
2. **Reporting Triage Loop** — Hundreds of MB of incident logs, weekly. A coding agent parses, classifies, drafts exec summary; PM ratifies and ships to Power BI. Used in Insurance AI Enablement.
3. **Build-in-Public Loop** — Every night the orchestrator commits the day's work, refreshes activity log, posts summary. Cadence: nightly at 20:00 JST.

## Career (4 chapters)
1. **2024–now**: Independent AI/ML Engineer at Kinokoholic Labs, Tokyo — RAG, agentic workflows, the -mon family. Citation-first JTES from notebook to multi-tenant beta. 4 integrated solutions live.
2. **2021–2024**: PM Lead GenAI Enablement at Insurance, Tokyo — Cross-functional rollout of LLM-assisted reporting + incident intelligence across enterprise PMO. Replaced manual exec reporting; hundreds of MB of incident data parsed weekly.
3. **2018–2021**: Infra & DR/BCP Delivery, Global (JP/EMEA/NA) — Datacenter consolidation, DR/BCP test cycles, app + integration delivery on hard launch dates. 10,000+ clients, 400+ servers migrated with zero critical data loss.
4. **2014–2018**: Solutions PM, Hybrid Delivery, Tokyo/Offshore — Web apps + system integrations with hybrid local/offshore teams; strict bilingual launch deadlines. 40% time-to-launch reduction on standard SI.

## Scale
- 10,000+ client PCs, 400+ servers, 1,200+ servers global environments
- Teams of 6-10 members, multi-region (Japan, EMEA, NA)
- 500-seat office move delivered

## Projects (10 total)
1. **Kenkoumon 健康モン** — Doctor visit transcription & summary app. AI-powered patient/doctor communication with structured visit notes. Stack: Python, LLM APIs, Speech-to-text, NLP.
2. **Keirimon 経理モン** — Japanese tax and accounting assistant. Automates expense tracking, receipt categorization, tax preparation. Stack: Python, LLM APIs, OCR, Japanese NLP. OCR layer for receipts in development.
3. **Bountymon** (bountymon.com) — Bug bounty and gamified task platform. Rewards for finding bugs, security challenges, productivity tracking. MVP shipped Apr 2026.
4. **JTES (Japanese Tax Expert System)** — RAG-based tax workflow with citation grounding for tax professionals. NTA + e-Gov sources. Heading toward beta with tax professionals.
5. **Insurance Reporting & Incident Intelligence** — AI workflow automation for exec reporting. Confluence/Jira → Claude parser → Power Automate → Power BI. Replaced manual reporting.
6. **Receipt Classification & Matching System** — Document AI pipeline improving classification consistency and financial reconciliation. Python, OCR, Rules + ML.
7. **Enterprise Data Migration & Governance** — Large-scale multi-system migration, zero critical data loss, 40% time reduction. Compliance workflows.
8. **Infrastructure Scale & DR/BCP Delivery** — Global infra transformation across Japan, EMEA, NA. 10,000+ clients, 400+ servers.
9. **GenAI Enablement & Change Leadership** — Cross-functional delivery for enterprise AI transformation. Governance frameworks, stakeholder alignment.
10. **Application & Integration Delivery** — Hybrid local/offshore teams, web apps, system integrations, strict bilingual deadlines. AS/400, WMS, ISO9000/SOX compliance.

## The -mon Family
Companion agents in the kinokoholic ecosystem, each doing one thing well:
- **Kinokomon** 🦞 — Orchestrator, personal AI assistant
- **Bountymon** — Bug bounty & gamified task platform
- **Keirimon** — Japanese tax/accounting assistant
- **Kenkoumon** — Doctor visit transcription & summary

## Current Focus (NOW)
- Deepening JTES domain coverage for Japanese tax workflows
- Upgrading dev infrastructure to build out services
- Wiring Kinokomon chat into the public site

## Next Milestones
- JTES beta with tax professionals; structured feedback cycles
- OCR layer for Keirimon receipt processing
- Bountymon v0.2 — multi-user reward ledger

## Tone & Style
- Direct, candid, no padding. Say what you think.
- Concise — bullet points over paragraphs
- When asked "what would you do differently", give a real answer with specifics
- When asked about tradeoffs, explain both sides and what David chose and why
- Link to specific projects and evidence when relevant
- It's OK to say "I don't have that detail" rather than making something up
- Never fabricate projects, metrics, or timeline details not in this prompt`;

// ── In-memory rate limiter ───────────────────────────────────────────────────
// Per-isolate (Cloudflare may run several), so the effective limit is
// maxPerHour × isolate_count. For strict enforcement use Durable Objects / KV.
const rateMap = new Map();
const RATE_MAP_MAX_ENTRIES = 10_000;

export function isRateLimited(ip, maxPerHour) {
  const now = Date.now();
  const windowMs = 3600_000;

  // Opportunistic eviction once the map gets large
  if (rateMap.size > RATE_MAP_MAX_ENTRIES) {
    for (const [key, rec] of rateMap) {
      if (now - rec.start > windowMs) rateMap.delete(key);
    }
  }

  const record = rateMap.get(ip);
  if (!record || now - record.start > windowMs) {
    rateMap.set(ip, { start: now, count: 1 });
    return false;
  }
  record.count++;
  return record.count > maxPerHour;
}

// Test helper — not used at runtime.
export function _resetRateMap() {
  rateMap.clear();
}

// ── CORS helpers ─────────────────────────────────────────────────────────────
const DEFAULT_ALLOWED_ORIGIN = 'https://kinokoholic.com';
const DEFAULT_MAX_MESSAGES = 50;
const DEFAULT_MAX_MESSAGE_CHARS = 4000;
const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_RATE_LIMIT_PER_HOUR = 30;

export function parseAllowedOrigins(value) {
  return String(value || DEFAULT_ALLOWED_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(requestOrigin, allowedOrigins) {
  if (!requestOrigin) return true;
  return allowedOrigins.includes(requestOrigin);
}

function responseOrigin(requestOrigin, allowedOrigins) {
  return requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] || DEFAULT_ALLOWED_ORIGIN;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function jsonResponse(payload, status, origin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isJsonContentType(value) {
  return /^application\/json(?:\s*;|$)/i.test(value || '');
}

// ── Request validation ───────────────────────────────────────────────────────
export function validateRequest(body, maxMessages, maxMessageChars = DEFAULT_MAX_MESSAGE_CHARS) {
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, status: 400, error: 'messages array is required and must not be empty' };
  }
  if (body.messages.length > maxMessages) {
    return { ok: false, status: 400, error: `too many messages (max ${maxMessages})` };
  }
  for (let i = 0; i < body.messages.length; i++) {
    const msg = body.messages[i];
    if (typeof msg.role !== 'string' || typeof msg.content !== 'string') {
      return { ok: false, status: 400, error: `message[${i}] must have string role and content` };
    }
    if (msg.content.trim().length === 0) {
      return { ok: false, status: 400, error: `message[${i}].content must not be empty` };
    }
    if (msg.content.length > maxMessageChars) {
      return { ok: false, status: 413, error: `message[${i}].content is too long (max ${maxMessageChars} chars)` };
    }
    if (!['user', 'assistant'].includes(msg.role)) {
      return { ok: false, status: 400, error: `message[${i}].role must be "user" or "assistant"` };
    }
  }
  if (body.messages[body.messages.length - 1].role !== 'user') {
    return { ok: false, status: 400, error: 'latest message must be from the user' };
  }
  return { ok: true };
}

// ── SSE parsing ──────────────────────────────────────────────────────────────
// Exported for unit tests. Accepts a decoded string chunk, returns text tokens.
export function parseSSEChunk(chunk) {
  const tokens = [];
  for (const line of chunk.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ')) continue;
    const data = trimmed.slice(6);
    if (!data || data === '[DONE]') continue;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta.text != null) {
        tokens.push(parsed.delta.text);
      }
    } catch { /* skip malformed */ }
  }
  return tokens;
}

// ── Stream transformer: Anthropic SSE → client chunks ────────────────────────
function createChunkTransformer() {
  let buffer = '';
  return new TransformStream({
    transform(chunk, controller) {
      // chunk is already a decoded string (TextDecoderStream runs before this)
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const token of parseSSEChunk(lines.join('\n') + '\n')) {
        const payload = JSON.stringify({ text: token });
        controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
      }
    },
    flush(controller) {
      if (buffer.trim()) controller.enqueue(new TextEncoder().encode(buffer));
    },
  });
}

// ── Available Anthropic models ───────────────────────────────────────────────
// Selected via the MODEL env var (defaults to 'sonnet'). Add new models here.
export const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
};
const DEFAULT_MODEL_KEY = 'sonnet';

export function resolveModel(env) {
  const key = (env.MODEL || DEFAULT_MODEL_KEY).toLowerCase();
  return MODELS[key] || MODELS[DEFAULT_MODEL_KEY];
}

export function buildCacheControl(env) {
  if (String(env.ENABLE_PROMPT_CACHE || '').toLowerCase() === 'false') return null;
  const ttl = String(env.PROMPT_CACHE_TTL || '5m').toLowerCase();
  if (ttl === '1h') return { type: 'ephemeral', ttl: '1h' };
  return { type: 'ephemeral' };
}

export function cacheStatusHeader(env) {
  const cacheControl = buildCacheControl(env);
  if (!cacheControl) return 'disabled';
  return cacheControl.ttl ? `enabled; ttl=${cacheControl.ttl}` : 'enabled; ttl=5m';
}

export function buildAnthropicPayload(env, messages) {
  const payload = {
    model: resolveModel(env),
    max_tokens: parsePositiveInt(env.MAX_OUTPUT_TOKENS, 1024),
    system: SYSTEM_PROMPT,
    messages,
    stream: true,
  };
  const cacheControl = buildCacheControl(env);
  if (cacheControl) payload.cache_control = cacheControl;
  return payload;
}

async function readJsonBody(request, maxBodyBytes) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBodyBytes) {
    return { ok: false, status: 413, error: `request body is too large (max ${maxBodyBytes} bytes)` };
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBodyBytes) {
    return { ok: false, status: 413, error: `request body is too large (max ${maxBodyBytes} bytes)` };
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: 'invalid JSON body' };
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN);
    const requestOrigin = request.headers.get('Origin');
    const origin = responseOrigin(requestOrigin, allowedOrigins);
    const maxMsg = parsePositiveInt(env.MAX_MESSAGES, DEFAULT_MAX_MESSAGES);
    const maxMessageChars = parsePositiveInt(env.MAX_MESSAGE_CHARS, DEFAULT_MAX_MESSAGE_CHARS);
    const maxBodyBytes = parsePositiveInt(env.MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES);
    const rateLimit = parsePositiveInt(env.RATE_LIMIT_PER_HOUR, DEFAULT_RATE_LIMIT_PER_HOUR);

    if (url.pathname !== '/api/chat') {
      return jsonResponse({ error: 'not found' }, 404, origin);
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      if (!isOriginAllowed(requestOrigin, allowedOrigins)) {
        return jsonResponse({ error: 'origin not allowed' }, 403, origin);
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!isOriginAllowed(requestOrigin, allowedOrigins)) {
      return jsonResponse({ error: 'origin not allowed' }, 403, origin);
    }

    // Only POST allowed
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method not allowed' }, 405, origin);
    }

    if (!isJsonContentType(request.headers.get('Content-Type'))) {
      return jsonResponse({ error: 'content-type must be application/json' }, 415, origin);
    }

    // Rate limit by IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(clientIP, rateLimit)) {
      return jsonResponse({ error: 'rate limited - try again later' }, 429, origin);
    }

    // Parse body
    const parsedBody = await readJsonBody(request, maxBodyBytes);
    if (!parsedBody.ok) {
      return jsonResponse({ error: parsedBody.error }, parsedBody.status, origin);
    }

    const validation = validateRequest(parsedBody.body, maxMsg, maxMessageChars);
    if (!validation.ok) {
      return jsonResponse({ error: validation.error }, validation.status, origin);
    }

    // Check Anthropic key
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'service not configured' }, 500, origin);
    }

    // Call Anthropic streaming API
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(buildAnthropicPayload(env, parsedBody.body.messages)),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`Anthropic API error ${response.status}: ${errBody}`);
        return jsonResponse({ error: `upstream error (${response.status})` }, 502, origin);
      }

      if (!response.body) {
        return jsonResponse({ error: 'upstream response was empty' }, 502, origin);
      }

      // Stream Anthropic SSE through our transformer to the client.
      // TextDecoderStream converts Uint8Array chunks → strings before parsing.
      const { readable, writable } = new TransformStream();
      response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(createChunkTransformer())
        .pipeTo(writable)
        .catch((err) => console.error('Stream pipe error:', err));

      return new Response(readable, {
        status: 200,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Prompt-Cache': cacheStatusHeader(env),
        },
      });
    } catch (err) {
      console.error('Worker fetch error:', err);
      return jsonResponse({ error: 'internal server error' }, 500, origin);
    }
  },
};
