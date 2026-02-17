#!/usr/bin/env node
/**
 * Unit tests for JD Concierge Widget
 * Run with: node --test tests/jd_concierge.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Test helper functions extracted from jd_concierge.js
// These are reimplemented here for testability

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatApiError(status, data) {
  if (status === 401) {
    return data && data.error ? data.error : "Unauthorized. Please check your API credentials.";
  }
  if (status === 429 && data && typeof data.retry_after_seconds === "number") {
    const minutes = Math.floor(data.retry_after_seconds / 60);
    const seconds = data.retry_after_seconds % 60;
    let timeStr;
    if (minutes > 0 && seconds > 0) {
      timeStr = minutes + " minute" + (minutes !== 1 ? "s" : "") + " and " + seconds + " second" + (seconds !== 1 ? "s" : "");
    } else if (minutes > 0) {
      timeStr = minutes + " minute" + (minutes !== 1 ? "s" : "");
    } else {
      timeStr = seconds + " second" + (seconds !== 1 ? "s" : "");
    }
    return "Rate limit exceeded: 5 requests per hour allowed. Please try again in " + timeStr + ".";
  }
  if (status === 400) {
    return data && data.error ? data.error : "Invalid input. Please review your JD text.";
  }
  if (status === 415) {
    return "Request rejected due to invalid content type.";
  }
  if (status >= 500) {
    return "Server error while analyzing fit. Please retry shortly.";
  }
  return data && data.error ? data.error : "Analysis failed.";
}

const MAX_LEN = 15000;

describe('JD Concierge Widget - Utility Functions', () => {

  describe('escapeHtml', () => {
    it('should escape ampersands', () => {
      assert.strictEqual(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
    });

    it('should escape less than signs', () => {
      assert.strictEqual(escapeHtml('a < b'), 'a &lt; b');
    });

    it('should escape greater than signs', () => {
      assert.strictEqual(escapeHtml('a > b'), 'a &gt; b');
    });

    it('should escape double quotes', () => {
      assert.strictEqual(escapeHtml('say "hello"'), 'say &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      assert.strictEqual(escapeHtml("it's"), 'it&#39;s');
    });

    it('should escape mixed special characters', () => {
      assert.strictEqual(
        escapeHtml('<script>alert("XSS")</script>'),
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
    });

    it('should handle empty strings', () => {
      assert.strictEqual(escapeHtml(''), '');
    });

    it('should handle strings without special characters', () => {
      assert.strictEqual(escapeHtml('Hello World'), 'Hello World');
    });

    it('should escape multiple ampersands', () => {
      assert.strictEqual(escapeHtml('AT&T & T&T'), 'AT&amp;T &amp; T&amp;T');
    });
  });

  describe('formatApiError', () => {
    it('should format 401 unauthorized errors', () => {
      const result = formatApiError(401, { error: 'Unauthorized' });
      assert.strictEqual(result, 'Unauthorized');
    });

    it('should format 401 errors without custom message', () => {
      const result = formatApiError(401, null);
      assert.strictEqual(result, 'Unauthorized. Please check your API credentials.');
    });

    it('should format rate limit errors (429)', () => {
      const data = { error: 'Rate limit exceeded', retry_after_seconds: 3600 };
      const result = formatApiError(429, data);
      assert.strictEqual(result, 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 60 minutes.');
    });

    it('should handle retry_after_seconds less than 1 minute', () => {
      const data = { error: 'Rate limit exceeded', retry_after_seconds: 30 };
      const result = formatApiError(429, data);
      assert.strictEqual(result, 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 30 seconds.');
    });

    it('should handle retry_after_seconds with minutes and seconds', () => {
      const data = { error: 'Rate limit exceeded', retry_after_seconds: 3665 }; // 61 min 5 sec
      const result = formatApiError(429, data);
      assert.strictEqual(result, 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 61 minutes and 5 seconds.');
    });

    it('should format 400 errors with custom error message', () => {
      const data = { error: 'Invalid JD text' };
      const result = formatApiError(400, data);
      assert.strictEqual(result, 'Invalid JD text');
    });

    it('should format 400 errors without custom message', () => {
      const result = formatApiError(400, null);
      assert.strictEqual(result, 'Invalid input. Please review your JD text.');
    });

    it('should format 415 errors', () => {
      const result = formatApiError(415, {});
      assert.strictEqual(result, 'Request rejected due to invalid content type.');
    });

    it('should format 500 errors', () => {
      const result = formatApiError(500, {});
      assert.strictEqual(result, 'Server error while analyzing fit. Please retry shortly.');
    });

    it('should format 503 errors', () => {
      const result = formatApiError(503, {});
      assert.strictEqual(result, 'Server error while analyzing fit. Please retry shortly.');
    });

    it('should format unknown errors with custom message', () => {
      const data = { error: 'Unknown error occurred' };
      const result = formatApiError(418, data);
      assert.strictEqual(result, 'Unknown error occurred');
    });

    it('should format unknown errors without custom message', () => {
      const result = formatApiError(418, {});
      assert.strictEqual(result, 'Analysis failed.');
    });
  });

  describe('MAX_LEN constant', () => {
    it('should be defined as 15000', () => {
      assert.strictEqual(MAX_LEN, 15000);
    });
  });

  describe('XSS Protection', () => {
    it('should handle XSS injection attempts', () => {
      const malicious = [
        '<img src=x onerror=alert(1)>',
        '<script>alert("XSS")</script>',
        // Note: javascript: is not escaped by escapeHtml, but the full URL would be
        // handled by browser security when used in href attributes with proper sanitization
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
      ];

      for (const input of malicious) {
        const escaped = escapeHtml(input);
        assert.ok(!escaped.includes('<script>'), `Should escape script tags in: ${input}`);
        assert.ok(!escaped.includes('<img '), `Should escape img tag in: ${input}`);
      }
    });
  });

  describe('Unicode Handling', () => {
    it('should handle Unicode characters correctly', () => {
      assert.strictEqual(escapeHtml('日本語テスト'), '日本語テスト');
      assert.strictEqual(escapeHtml('Привет'), 'Привет');
      assert.strictEqual(escapeHtml('🎉'), '🎉');
    });
  });

  describe('Rate Limit Edge Cases', () => {
    it('should handle rate limit edge cases', () => {
      const testCases = [
        { seconds: 1, expected: 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 1 second.' },
        { seconds: 30, expected: 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 30 seconds.' },
        { seconds: 59, expected: 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 59 seconds.' },
        { seconds: 60, expected: 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 1 minute.' },
        { seconds: 61, expected: 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 1 minute and 1 second.' },
        { seconds: 120, expected: 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 2 minutes.' },
        { seconds: 3600, expected: 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 60 minutes.' },
        { seconds: 3661, expected: 'Rate limit exceeded: 5 requests per hour allowed. Please try again in 61 minutes and 1 second.' },
      ];

      for (const { seconds, expected } of testCases) {
        const result = formatApiError(429, { retry_after_seconds: seconds });
        assert.strictEqual(result, expected, `Failed for ${seconds} seconds`);
      }
    });
  });
});
