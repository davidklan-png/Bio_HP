import { describe, expect, it, beforeEach } from "vitest";
import {
  buildSubmissionRecord,
  insertRateLimitRecord,
  insertSubmission,
  insertValidationError,
  SCORER_VERSION,
  sha256Hex
} from "./storage";

class MockD1Database {
  private shouldFail: boolean = false;
  private lastError?: string;

  prepare(_sql: string) {
    const stmt = {
      bind: (..._args: unknown[]) => ({
        run: async () => {
          if (this.shouldFail) {
            throw new Error(this.lastError || "DB connection failed");
          }
          return { success: true };
        }
      })
    };
    return stmt;
  }

  setFail(enabled: boolean, error?: string) {
    this.shouldFail = enabled;
    this.lastError = error;
  }

  reset() {
    this.shouldFail = false;
    this.lastError = undefined;
  }
}

const mockEnv = {
  DB: new MockD1Database() as unknown as D1Database
};

describe("storage helpers", () => {
  beforeEach(() => {
    (mockEnv.DB as MockD1Database).reset();
  });

  describe("sha256Hex", () => {
    it("returns stable SHA-256 hash for same input", async () => {
      const input = "test input";
      const hash1 = await sha256Hex(input);
      const hash2 = await sha256Hex(input);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("returns different hashes for different inputs", async () => {
      const hash1 = await sha256Hex("input 1");
      const hash2 = await sha256Hex("input 2");
      expect(hash1).not.toBe(hash2);
    });

    it("returns hash for empty string", async () => {
      const hash = await sha256Hex("");
      expect(hash).toHaveLength(64);
    });
  });

  describe("buildSubmissionRecord", () => {
    it("builds complete record from analysis response", () => {
      const mockResponse = {
        request_id: "req-123",
        score: 75,
        confidence: "Medium" as const,
        fit_summary: "Good fit",
        strengths: [
          {
            area: "Responsibilities",
            evidence_title: "Project A",
            evidence_url: "https://example.com/a",
            rationale: "Matched"
          }
        ],
        gaps: [],
        risk_flags: [],
        rubric_breakdown: []
      };

      const record = buildSubmissionRecord(
        "req-123",
        "Sample JD text",
        "abc123hash",
        "https://example.com",
        "ua-hash-123",
        150,
        mockResponse
      );

      expect(record).toEqual({
        request_id: "req-123",
        created_at: expect.any(String),
        jd_text: "Sample JD text",
        jd_text_len: 14,
        jd_sha256: "abc123hash",
        origin: "https://example.com",
        user_agent_hash: "ua-hash-123",
        scorer_version: SCORER_VERSION,
        score: 75,
        confidence: "Medium",
        evidence_count: 1,
        response_json: JSON.stringify(mockResponse),
        latency_ms: 150,
        rate_limited: 0,
        validation_error: null
      });
    });

    it("handles null origin and user_agent_hash", () => {
      const mockResponse = {
        request_id: "req-456",
        score: 50,
        confidence: "Low" as const,
        fit_summary: "Low fit",
        strengths: [],
        gaps: [],
        risk_flags: [],
        rubric_breakdown: []
      };

      const record = buildSubmissionRecord(
        "req-456",
        "JD",
        "hash",
        null,
        null,
        100,
        mockResponse
      );

      expect(record.origin).toBeNull();
      expect(record.user_agent_hash).toBeNull();
    });
  });

  describe("insertSubmission", () => {
    it("returns success when DB insert succeeds", async () => {
      const record = {
        request_id: "req-1",
        created_at: "2026-02-14T12:00:00Z",
        jd_text: "test",
        jd_text_len: 4,
        jd_sha256: "hash",
        origin: null,
        user_agent_hash: null,
        scorer_version: SCORER_VERSION,
        score: 80,
        confidence: "High" as const,
        evidence_count: 5,
        response_json: "{}",
        latency_ms: 100,
        rate_limited: 0,
        validation_error: null
      };

      const result = await insertSubmission(mockEnv, record);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("catches DB errors and returns failure without throwing", async () => {
      (mockEnv.DB as MockD1Database).setFail(true, "Connection timeout");

      const record = {
        request_id: "req-2",
        created_at: "2026-02-14T12:00:00Z",
        jd_text: "test",
        jd_text_len: 4,
        jd_sha256: "hash",
        origin: null,
        user_agent_hash: null,
        scorer_version: SCORER_VERSION,
        score: 80,
        confidence: "High" as const,
        evidence_count: 5,
        response_json: "{}",
        latency_ms: 100,
        rate_limited: 0,
        validation_error: null
      };

      const result = await insertSubmission(mockEnv, record);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection timeout");
    });
  });

  describe("insertValidationError", () => {
    it("inserts record with sentinel values for validation errors", async () => {
      const result = await insertValidationError(
        mockEnv,
        "req-3",
        "Too long JD text...",
        "jd-hash",
        "https://example.com",
        "ua-hash",
        50,
        "exceeds max length",
        { request_id: "req-3", error: "exceeds max length" }
      );

      expect(result.success).toBe(true);
    });
  });

  describe("insertRateLimitRecord", () => {
    it("inserts record for rate-limited requests", async () => {
      const result = await insertRateLimitRecord(
        mockEnv,
        "req-4",
        "https://example.com",
        "ua-hash",
        25,
        {
          request_id: "req-4",
          error: "Rate limit exceeded",
          retry_after_seconds: 3600
        }
      );

      expect(result.success).toBe(true);
    });

    it("stores rate_limited=1 in the record", async () => {
      const result = await insertRateLimitRecord(
        mockEnv,
        "req-5",
        null,
        null,
        30,
        {
          request_id: "req-5",
          error: "Rate limit exceeded",
          retry_after_seconds: 60
        }
      );

      expect(result.success).toBe(true);
    });
  });

  describe("SCORER_VERSION", () => {
    it("is a valid semantic version string", () => {
      expect(SCORER_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });
  });
});
