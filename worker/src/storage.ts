import type { AnalyzeResponse, Confidence } from "./analysis";

export const SCORER_VERSION = "1.2.0";

export interface Env {
  DB: D1Database;
}

export interface SubmissionRecord {
  request_id: string;
  created_at: string;
  jd_text: string;
  jd_text_len: number;
  jd_sha256: string;
  origin: string | null;
  user_agent_hash: string | null;
  scorer_version: string;
  score: number;
  confidence: Confidence;
  evidence_count: number;
  response_json: string;
  latency_ms: number;
  rate_limited: number;
  validation_error: string | null;
}

export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const hex = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex;
}

export async function insertSubmission(
  env: Env,
  record: SubmissionRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const stmt = env.DB.prepare(
      "INSERT INTO submissions (request_id, created_at, jd_text, jd_text_len, jd_sha256, origin, user_agent_hash, scorer_version, score, confidence, evidence_count, response_json, latency_ms, rate_limited, validation_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const boundStmt = stmt.bind(
      record.request_id,
      record.created_at,
      record.jd_text,
      record.jd_text_len,
      record.jd_sha256,
      record.origin,
      record.user_agent_hash,
      record.scorer_version,
      record.score,
      record.confidence,
      record.evidence_count,
      record.response_json,
      record.latency_ms,
      record.rate_limited,
      record.validation_error
    );
    const result = await boundStmt.run();
    if (!result.success) {
      throw new Error("D1 insert failed: " + JSON.stringify(result));
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: "db_insert_failed",
      request_id: record.request_id,
      error: message
    }));
    return { success: false, error: message };
  }
}

export async function insertValidationError(
  env: Env,
  requestId: string,
  jdText: string,
  jdSha256: string,
  origin: string | null,
  userAgentHash: string | null,
  latencyMs: number,
  validationError: string,
  errorPayload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  return insertSubmission(env, {
    request_id: requestId,
    created_at: new Date().toISOString(),
    jd_text: jdText,
    jd_text_len: jdText.length,
    jd_sha256: jdSha256,
    origin,
    user_agent_hash: userAgentHash,
    scorer_version: SCORER_VERSION,
    score: 0,
    confidence: "Low",
    evidence_count: 0,
    response_json: JSON.stringify(errorPayload),
    latency_ms: latencyMs,
    rate_limited: 0,
    validation_error: validationError
  });
}

export async function insertRateLimitRecord(
  env: Env,
  requestId: string,
  origin: string | null,
  userAgentHash: string | null,
  latencyMs: number,
  rateLimitPayload: { request_id: string; error: string; retry_after_seconds: number }
): Promise<{ success: boolean; error?: string }> {
  return insertSubmission(env, {
    request_id: requestId,
    created_at: new Date().toISOString(),
    jd_text: "",
    jd_text_len: 0,
    jd_sha256: "",
    origin,
    user_agent_hash: userAgentHash,
    scorer_version: SCORER_VERSION,
    score: 0,
    confidence: "Low",
    evidence_count: 0,
    response_json: JSON.stringify(rateLimitPayload),
    latency_ms: latencyMs,
    rate_limited: 1,
    validation_error: "rate_limited"
  });
}

export function buildSubmissionRecord(
  requestId: string,
  jdText: string,
  jdSha256: string,
  origin: string | null,
  userAgentHash: string | null,
  latencyMs: number,
  response: AnalyzeResponse
): SubmissionRecord {
  return {
    request_id: requestId,
    created_at: new Date().toISOString(),
    jd_text: jdText,
    jd_text_len: jdText.length,
    jd_sha256: jdSha256,
    origin,
    user_agent_hash: userAgentHash,
    scorer_version: SCORER_VERSION,
    score: response.score,
    confidence: response.confidence,
    evidence_count: response.strengths.length,
    response_json: JSON.stringify(response),
    latency_ms: latencyMs,
    rate_limited: 0,
    validation_error: null
  };
}
