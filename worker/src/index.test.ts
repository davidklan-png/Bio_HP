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

describe("Security: Referer validation", () => {
  describe("validateReferer", () => {
    it("allows null referer (browser privacy, same-origin)", () => {
      const result = validateReferer(null);
      expect(result).toBeNull();
    });

    it("allows referer from https://kinokoholic.com", () => {
      const result = validateReferer("https://kinokoholic.com/page");
      expect(result).toBeNull();
    });

    it("allows referer from http://localhost:4000", () => {
      const result = validateReferer("http://localhost:4000/page");
      expect(result).toBeNull();
    });

    it("allows referer from http://127.0.0.1:4000", () => {
      const result = validateReferer("http://127.0.0.1:4000/page");
      expect(result).toBeNull();
    });

    it("allows referer from http://localhost:4001", () => {
      const result = validateReferer("http://localhost:4001/page");
      expect(result).toBeNull();
    });

    it("rejects referer from unauthorized domain", () => {
      const result = validateReferer("https://evil.com/page");
      expect(result).toBe("Unauthorized referer: evil.com");
    });

    it("rejects referer from subdomain of unauthorized domain", () => {
      const result = validateReferer("https://subdomain.evil.com/page");
      expect(result).toBe("Unauthorized referer: subdomain.evil.com");
    });

    it("rejects malformed referer URL", () => {
      const result = validateReferer("not-a-url");
      expect(result).toBe("Invalid referer header");
    });
  });
});

describe("Security: User-Agent validation", () => {
  describe("validateUserAgent", () => {
    it("rejects null User-Agent", () => {
      const result = validateUserAgent(null);
      expect(result).toBe("User-Agent header required");
    });

    it("blocks bot user agents", () => {
      expect(validateUserAgent("Googlebot/2.1")).toBe("Access denied for automated client");
      expect(validateUserAgent("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe("Access denied for automated client");
    });

    it("blocks crawler user agents", () => {
      expect(validateUserAgent("MyCrawler/1.0")).toBe("Access denied for automated client");
      expect(validateUserAgent("EvilScraper/1.0")).toBe("Access denied for automated client");
    });

    it("blocks spider user agents", () => {
      expect(validateUserAgent("MySpider/1.0")).toBe("Access denied for automated client");
    });

    it("blocks curl user agent", () => {
      expect(validateUserAgent("curl/7.68.0")).toBe("Access denied for automated client");
    });

    it("blocks wget user agent", () => {
      expect(validateUserAgent("Wget/1.20.3")).toBe("Access denied for automated client");
    });

    it("blocks python user agent", () => {
      expect(validateUserAgent("python-requests/2.28.0")).toBe("Access denied for automated client");
    });

    it("blocks go http client", () => {
      expect(validateUserAgent("Go-http-client/1.1")).toBe("Access denied for automated client");
    });

    it("blocks java user agent", () => {
      expect(validateUserAgent("Java/1.8.0")).toBe("Access denied for automated client");
    });

    it("allows Chrome user agent", () => {
      const result = validateUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
      expect(result).toBeNull();
    });

    it("allows Firefox user agent", () => {
      const result = validateUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0");
      expect(result).toBeNull();
    });

    it("allows Safari user agent", () => {
      const result = validateUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15");
      expect(result).toBeNull();
    });

    it("allows Edge user agent", () => {
      const result = validateUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0");
      expect(result).toBeNull();
    });

    it("allows health check script user agent", () => {
      const result = validateUserAgent("Mozilla/5.0 (compatible; HealthCheck/1.0; +https://kinokoholic.com)");
      expect(result).toBeNull();
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

/**
 * Security: Validate Referer header to prevent CSRF from unauthorized sites.
 * Mirrors the logic in the worker's fetch handler.
 */
function validateReferer(referer: string | null): string | null {
  if (!referer) {
    return null;
  }

  try {
    const refererUrl = new URL(referer);
    const refererHost = refererUrl.hostname;

    const ALLOWED_REFERERS = [
      "https://kinokoholic.com",
      "http://localhost:4000",
      "http://127.0.0.1:4000",
      "http://localhost:4001"
    ];

    for (const allowed of ALLOWED_REFERERS) {
      const allowedUrl = new URL(allowed);
      if (refererHost === allowedUrl.hostname || refererHost.endsWith(`.${allowedUrl.hostname}`)) {
        return null;
      }
    }

    return `Unauthorized referer: ${refererHost}`;
  } catch {
    return "Invalid referer header";
  }
}

/**
 * Security: Validate User-Agent to block obvious bots and scrapers.
 * Mirrors the logic in the worker's fetch handler.
 */
function validateUserAgent(userAgent: string | null): string | null {
  if (!userAgent) {
    return "User-Agent header required";
  }

  const ua = userAgent.toLowerCase();

  const SUSPICIOUS_UA_PATTERNS = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python/i, /requests/i,
    /go-http-client/i, /java/i
  ];

  for (const pattern of SUSPICIOUS_UA_PATTERNS) {
    if (pattern.test(ua)) {
      return `Access denied for automated client`;
    }
  }

  const hasBrowserIndicator = /mozilla|chrome|safari|firefox|edge|opera|edg|msie|trident/i.test(ua);
  if (!hasBrowserIndicator) {
    return "Access denied: browser required";
  }

  return null;
}
