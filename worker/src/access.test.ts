import { describe, expect, it } from "vitest";
import { validateAccessJWT } from "./access";

const TEST_AUD = "dd3901a59004f912b65429dc74e78170a5ae69ce5a05ed59c5c3a7bf90d9e97b";
const TEST_TEAM_DOMAIN = "kinokoholic1";

/** Encode a JSON object as a base64url string (no padding). */
function b64url(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  const b64 = btoa(json);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build a structurally valid (but unsigned) JWT from header + payload parts. */
function fakeJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>
): string {
  return `${b64url(header)}.${b64url(payload)}.fake-signature`;
}

function makeRequest(jwt?: string): Request {
  const headers: Record<string, string> = {};
  if (jwt !== undefined) {
    headers["Cf-Access-Jwt-Assertion"] = jwt;
  }
  return new Request("https://example.com/analyze", { method: "POST", headers });
}

// ---------------------------------------------------------------------------
// Tests for the actual validateAccessJWT function
// ---------------------------------------------------------------------------

describe("validateAccessJWT (integration)", () => {
  it("rejects request without Cf-Access-Jwt-Assertion header", async () => {
    const result = await validateAccessJWT(makeRequest(), TEST_AUD, TEST_TEAM_DOMAIN);
    expect(result).toBe("Missing Cf-Access-Jwt-Assertion header");
  });

  it("rejects malformed JWT (wrong part count)", async () => {
    const result = await validateAccessJWT(makeRequest("only.two"), TEST_AUD, TEST_TEAM_DOMAIN);
    expect(result).toBe("Malformed JWT: expected 3 parts");
  });

  it("rejects JWT with non-base64 header", async () => {
    const result = await validateAccessJWT(makeRequest("!!!.!!!.!!!"), TEST_AUD, TEST_TEAM_DOMAIN);
    expect(result).toBe("Malformed JWT: failed to decode header or payload");
  });

  it("rejects JWT with missing kid in header", async () => {
    const jwt = fakeJwt(
      { alg: "RS256" },
      { aud: [TEST_AUD], iss: `https://${TEST_TEAM_DOMAIN}.cloudflareaccess.com`, exp: Math.floor(Date.now() / 1000) + 3600 }
    );
    const result = await validateAccessJWT(makeRequest(jwt), TEST_AUD, TEST_TEAM_DOMAIN);
    expect(result).toBe("Malformed JWT: missing kid or alg in header");
  });

  it("rejects JWT with unsupported algorithm", async () => {
    const jwt = fakeJwt(
      { kid: "key-1", alg: "HS256" },
      { aud: [TEST_AUD], iss: `https://${TEST_TEAM_DOMAIN}.cloudflareaccess.com`, exp: Math.floor(Date.now() / 1000) + 3600 }
    );
    const result = await validateAccessJWT(makeRequest(jwt), TEST_AUD, TEST_TEAM_DOMAIN);
    expect(result).toBe("Unsupported JWT algorithm: HS256 (expected RS256)");
  });

  it("rejects JWT with wrong audience", async () => {
    const jwt = fakeJwt(
      { kid: "key-1", alg: "RS256" },
      { aud: ["wrong-aud"], iss: `https://${TEST_TEAM_DOMAIN}.cloudflareaccess.com`, exp: Math.floor(Date.now() / 1000) + 3600 }
    );
    const result = await validateAccessJWT(makeRequest(jwt), TEST_AUD, TEST_TEAM_DOMAIN);
    expect(result).toBe("JWT audience mismatch");
  });

  it("rejects JWT with wrong issuer", async () => {
    const jwt = fakeJwt(
      { kid: "key-1", alg: "RS256" },
      { aud: [TEST_AUD], iss: "https://evil.cloudflareaccess.com", exp: Math.floor(Date.now() / 1000) + 3600 }
    );
    const result = await validateAccessJWT(makeRequest(jwt), TEST_AUD, TEST_TEAM_DOMAIN);
    expect(result).toBe("JWT issuer mismatch");
  });

  it("rejects expired JWT (beyond clock skew tolerance)", async () => {
    const jwt = fakeJwt(
      { kid: "key-1", alg: "RS256" },
      { aud: [TEST_AUD], iss: `https://${TEST_TEAM_DOMAIN}.cloudflareaccess.com`, exp: Math.floor(Date.now() / 1000) - 60 }
    );
    const result = await validateAccessJWT(makeRequest(jwt), TEST_AUD, TEST_TEAM_DOMAIN);
    expect(result).toBe("JWT has expired");
  });

  it("accepts JWT within clock skew tolerance (expired < 30s ago)", async () => {
    // Token expired 10 seconds ago but within 30s skew window; should pass claim checks
    // but will fail at JWKs fetch (no real endpoint), proving claims passed
    const jwt = fakeJwt(
      { kid: "key-1", alg: "RS256" },
      { aud: [TEST_AUD], iss: `https://${TEST_TEAM_DOMAIN}.cloudflareaccess.com`, exp: Math.floor(Date.now() / 1000) - 10 }
    );
    const result = await validateAccessJWT(makeRequest(jwt), TEST_AUD, TEST_TEAM_DOMAIN);
    // Passes all claim checks, fails at JWKs fetch (expected in test env)
    expect(result).toBe("Failed to fetch JWKs from Cloudflare Access");
  });
});

// ---------------------------------------------------------------------------
// Tests for dual auth routing logic (mirroring index.ts)
// ---------------------------------------------------------------------------

describe("Dual auth routing", () => {
  it("identifies .workers.dev hostnames", () => {
    expect(isWorkersDev("jd-concierge-worker.kinokoholic1.workers.dev")).toBe(true);
    expect(isWorkersDev("kinokoholic.com")).toBe(false);
    expect(isWorkersDev("localhost")).toBe(false);
    expect(isWorkersDev("workers.dev.example.com")).toBe(false);
  });

  it("uses JWT auth for .workers.dev when Access env vars are set", () => {
    const env = { CF_ACCESS_AUD: TEST_AUD, CF_ACCESS_TEAM_DOMAIN: TEST_TEAM_DOMAIN };
    expect(shouldUseAccessJWT("jd-concierge-worker.kinokoholic1.workers.dev", env)).toBe(true);
  });

  it("falls back to Bearer auth when Access env vars are missing", () => {
    expect(shouldUseAccessJWT("jd-concierge-worker.kinokoholic1.workers.dev", {})).toBe(false);
  });

  it("uses Bearer auth for custom domain even with Access env vars", () => {
    const env = { CF_ACCESS_AUD: TEST_AUD, CF_ACCESS_TEAM_DOMAIN: TEST_TEAM_DOMAIN };
    expect(shouldUseAccessJWT("kinokoholic.com", env)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Claim validation helpers (mirror access.ts logic for isolated testing)
// ---------------------------------------------------------------------------

describe("Claim validation helpers", () => {
  it("validates audience matching", () => {
    expect(validateAudience([TEST_AUD], TEST_AUD)).toBe(true);
    expect(validateAudience([TEST_AUD, "other-aud"], TEST_AUD)).toBe(true);
    expect(validateAudience(["wrong-aud"], TEST_AUD)).toBe(false);
    expect(validateAudience([], TEST_AUD)).toBe(false);
  });

  it("validates issuer matching", () => {
    expect(validateIssuer(`https://${TEST_TEAM_DOMAIN}.cloudflareaccess.com`, TEST_TEAM_DOMAIN)).toBe(true);
    expect(validateIssuer("https://evil.cloudflareaccess.com", TEST_TEAM_DOMAIN)).toBe(false);
  });

  it("validates algorithm", () => {
    expect(validateAlgorithm("RS256")).toBe(true);
    expect(validateAlgorithm("HS256")).toBe(false);
    expect(validateAlgorithm("ES256")).toBe(false);
  });
});

// Helper functions

function isWorkersDev(hostname: string): boolean {
  return hostname.endsWith(".workers.dev");
}

function shouldUseAccessJWT(
  hostname: string,
  env: { CF_ACCESS_AUD?: string; CF_ACCESS_TEAM_DOMAIN?: string }
): boolean {
  return isWorkersDev(hostname) && !!env.CF_ACCESS_AUD && !!env.CF_ACCESS_TEAM_DOMAIN;
}

function validateAudience(aud: string[], expectedAud: string): boolean {
  return Array.isArray(aud) && aud.includes(expectedAud);
}

function validateIssuer(iss: string, teamDomain: string): boolean {
  return iss === `https://${teamDomain}.cloudflareaccess.com`;
}

function validateAlgorithm(alg: string): boolean {
  return alg === "RS256";
}
