/**
 * Cloudflare Access JWT validation.
 *
 * When Access is enabled for the .workers.dev domain, incoming requests include
 * a signed JWT in the Cf-Access-Jwt-Assertion header. This module validates that
 * JWT against the Cloudflare Access JWKs endpoint and verifies the audience claim.
 *
 * @see https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */

interface JWK {
  kty: string;
  kid: string;
  n: string;
  e: string;
  alg?: string;
}

interface JWKSResponse {
  keys: JWK[];
}

interface JWTHeader {
  kid: string;
  alg: string;
}

interface JWTPayload {
  aud: string[];
  iss: string;
  exp: number;
  iat: number;
  sub?: string;
  email?: string;
}

// Cache JWKs for 1 hour (in-memory, per isolate)
let cachedKeys: { keys: JWK[]; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Validate a Cloudflare Access JWT from the Cf-Access-Jwt-Assertion header.
 *
 * Returns null on success, or an error message string on failure.
 */
export async function validateAccessJWT(
  request: Request,
  expectedAud: string,
  teamDomain: string
): Promise<string | null> {
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) {
    return "Missing Cf-Access-Jwt-Assertion header";
  }

  const parts = jwt.split(".");
  if (parts.length !== 3) {
    return "Malformed JWT: expected 3 parts";
  }
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  let header: JWTHeader;
  let payload: JWTPayload;
  try {
    header = JSON.parse(base64UrlDecode(headerB64)) as JWTHeader;
    payload = JSON.parse(base64UrlDecode(payloadB64)) as JWTPayload;
  } catch {
    return "Malformed JWT: failed to decode header or payload";
  }

  if (!header.kid || !header.alg) {
    return "Malformed JWT: missing kid or alg in header";
  }

  // Verify audience
  if (!Array.isArray(payload.aud) || !payload.aud.includes(expectedAud)) {
    return "JWT audience mismatch";
  }

  // Verify issuer
  const expectedIssuer = `https://${teamDomain}.cloudflareaccess.com`;
  if (payload.iss !== expectedIssuer) {
    return "JWT issuer mismatch";
  }

  // Verify expiration
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) {
    return "JWT has expired";
  }

  // Fetch and cache JWKs
  const keys = await fetchJWKs(teamDomain);
  if (!keys) {
    return "Failed to fetch JWKs from Cloudflare Access";
  }

  const matchingKey = keys.find((k) => k.kid === header.kid);
  if (!matchingKey) {
    // Invalidate cache and retry once (key may have rotated)
    cachedKeys = null;
    const freshKeys = await fetchJWKs(teamDomain);
    const retryKey = freshKeys?.find((k) => k.kid === header.kid);
    if (!retryKey) {
      return "No matching JWK found for kid: " + header.kid;
    }
    return verifySignature(headerB64, payloadB64, signatureB64, retryKey);
  }

  return verifySignature(headerB64, payloadB64, signatureB64, matchingKey);
}

async function fetchJWKs(teamDomain: string): Promise<JWK[] | null> {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cachedKeys.keys;
  }

  try {
    const response = await fetch(
      `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as JWKSResponse;
    if (!data.keys || !Array.isArray(data.keys)) {
      return null;
    }
    cachedKeys = { keys: data.keys, fetchedAt: Date.now() };
    return data.keys;
  } catch {
    return null;
  }
}

async function verifySignature(
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
  jwk: JWK
): Promise<string | null> {
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256" },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signedContent = new TextEncoder().encode(headerB64 + "." + payloadB64);
    const signature = base64UrlToArrayBuffer(signatureB64);

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      signedContent
    );

    return valid ? null : "JWT signature verification failed";
  } catch {
    return "JWT signature verification error";
  }
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  return atob(padded + padding);
}

function base64UrlToArrayBuffer(input: string): ArrayBuffer {
  const binary = base64UrlDecode(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
