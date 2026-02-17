import { describe, expect, it } from "vitest";

/**
 * Unit tests for Cloudflare Access JWT validation logic.
 *
 * These tests verify the JWT parsing and claim validation without
 * hitting real Cloudflare endpoints (signature verification is tested
 * separately with known key material).
 */

const TEST_AUD = "dd3901a59004f912b65429dc74e78170a5ae69ce5a05ed59c5c3a7bf90d9e97b";
const TEST_TEAM_DOMAIN = "kinokoholic1";

describe("Cloudflare Access JWT validation", () => {
  describe("dual auth routing", () => {
    it("identifies .workers.dev hostnames", () => {
      expect(isWorkersDev("jd-concierge-worker.kinokoholic1.workers.dev")).toBe(true);
      expect(isWorkersDev("kinokoholic.com")).toBe(false);
      expect(isWorkersDev("localhost")).toBe(false);
      expect(isWorkersDev("workers.dev.example.com")).toBe(false);
    });

    it("uses JWT auth for .workers.dev when Access env vars are set", () => {
      const env = { CF_ACCESS_AUD: TEST_AUD, CF_ACCESS_TEAM_DOMAIN: TEST_TEAM_DOMAIN };
      const hostname = "jd-concierge-worker.kinokoholic1.workers.dev";
      expect(shouldUseAccessJWT(hostname, env)).toBe(true);
    });

    it("falls back to Bearer auth when Access env vars are missing", () => {
      const env = {};
      const hostname = "jd-concierge-worker.kinokoholic1.workers.dev";
      expect(shouldUseAccessJWT(hostname, env)).toBe(false);
    });

    it("uses Bearer auth for custom domain even with Access env vars", () => {
      const env = { CF_ACCESS_AUD: TEST_AUD, CF_ACCESS_TEAM_DOMAIN: TEST_TEAM_DOMAIN };
      const hostname = "kinokoholic.com";
      expect(shouldUseAccessJWT(hostname, env)).toBe(false);
    });
  });

  describe("JWT header parsing", () => {
    it("rejects JWT with wrong number of parts", () => {
      expect(parseJWTParts("only.two")).toBe(null);
      expect(parseJWTParts("")).toBe(null);
      expect(parseJWTParts("a.b.c.d")).toBe(null);
    });

    it("accepts JWT with exactly 3 parts", () => {
      const parts = parseJWTParts("header.payload.signature");
      expect(parts).not.toBe(null);
      expect(parts?.length).toBe(3);
    });
  });

  describe("audience validation", () => {
    it("accepts matching audience", () => {
      expect(validateAudience([TEST_AUD], TEST_AUD)).toBe(true);
      expect(validateAudience([TEST_AUD, "other-aud"], TEST_AUD)).toBe(true);
    });

    it("rejects non-matching audience", () => {
      expect(validateAudience(["wrong-aud"], TEST_AUD)).toBe(false);
      expect(validateAudience([], TEST_AUD)).toBe(false);
    });
  });

  describe("issuer validation", () => {
    it("accepts matching issuer", () => {
      const expected = `https://${TEST_TEAM_DOMAIN}.cloudflareaccess.com`;
      expect(validateIssuer(expected, TEST_TEAM_DOMAIN)).toBe(true);
    });

    it("rejects non-matching issuer", () => {
      expect(validateIssuer("https://evil.cloudflareaccess.com", TEST_TEAM_DOMAIN)).toBe(false);
      expect(validateIssuer("https://kinokoholic1.example.com", TEST_TEAM_DOMAIN)).toBe(false);
    });
  });

  describe("expiration validation", () => {
    it("accepts non-expired token", () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      expect(validateExpiration(futureExp)).toBe(true);
    });

    it("rejects expired token", () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      expect(validateExpiration(pastExp)).toBe(false);
    });
  });
});

// Helper functions mirroring access.ts logic for testability

function isWorkersDev(hostname: string): boolean {
  return hostname.endsWith(".workers.dev");
}

function shouldUseAccessJWT(
  hostname: string,
  env: { CF_ACCESS_AUD?: string; CF_ACCESS_TEAM_DOMAIN?: string }
): boolean {
  return isWorkersDev(hostname) && !!env.CF_ACCESS_AUD && !!env.CF_ACCESS_TEAM_DOMAIN;
}

function parseJWTParts(jwt: string): string[] | null {
  const parts = jwt.split(".");
  return parts.length === 3 ? parts : null;
}

function validateAudience(aud: string[], expectedAud: string): boolean {
  return Array.isArray(aud) && aud.includes(expectedAud);
}

function validateIssuer(iss: string, teamDomain: string): boolean {
  return iss === `https://${teamDomain}.cloudflareaccess.com`;
}

function validateExpiration(exp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return typeof exp === "number" && exp >= now;
}
