import { describe, expect, it } from "vitest";

describe("Authorization", () => {
  const TEST_API_KEY = "test-api-key-123";

  describe("Bearer token validation", () => {
    it("accepts valid Bearer token with correct API key", () => {
      const authHeader = `Bearer ${TEST_API_KEY}`;
      const isValid = validateAuthHeader(authHeader, TEST_API_KEY);
      expect(isValid).toBe(true);
    });

    it("rejects missing Authorization header", () => {
      const authHeader = null;
      const isValid = validateAuthHeader(authHeader, TEST_API_KEY);
      expect(isValid).toBe(false);
    });

    it("rejects malformed Bearer token (wrong key)", () => {
      const authHeader = "Bearer wrong-api-key";
      const isValid = validateAuthHeader(authHeader, TEST_API_KEY);
      expect(isValid).toBe(false);
    });

    it("rejects Authorization header without Bearer prefix", () => {
      const authHeader = TEST_API_KEY;
      const isValid = validateAuthHeader(authHeader, TEST_API_KEY);
      expect(isValid).toBe(false);
    });

    it("rejects Bearer token with missing key value", () => {
      const authHeader = "Bearer ";
      const isValid = validateAuthHeader(authHeader, TEST_API_KEY);
      expect(isValid).toBe(false);
    });

    it("rejects empty string Authorization header", () => {
      const authHeader = "";
      const isValid = validateAuthHeader(authHeader, TEST_API_KEY);
      expect(isValid).toBe(false);
    });

    it("is case-sensitive for Bearer prefix", () => {
      const authHeader = `bearer ${TEST_API_KEY}`; // lowercase 'bearer'
      const isValid = validateAuthHeader(authHeader, TEST_API_KEY);
      expect(isValid).toBe(false);
    });
  });
});

/**
 * Validates the Authorization header against the expected API key.
 * This function mirrors the logic in the worker's fetch handler.
 */
function validateAuthHeader(
  authHeader: string | null,
  apiKey: string
): boolean {
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    return false;
  }
  return true;
}
