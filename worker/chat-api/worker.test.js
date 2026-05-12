import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELS,
  _resetRateMap,
  buildAnthropicPayload,
  buildCacheControl,
  cacheStatusHeader,
  default as worker,
  isOriginAllowed,
  isRateLimited,
  parseAllowedOrigins,
  parseSSEChunk,
  resolveModel,
  validateRequest,
} from './worker.js';

test('validateRequest rejects missing/empty messages', () => {
  assert.equal(validateRequest({}, 50).ok, false);
  assert.equal(validateRequest({ messages: [] }, 50).ok, false);
  assert.equal(validateRequest(null, 50).ok, false);
});

test('validateRequest enforces max length', () => {
  const msgs = Array.from({ length: 51 }, () => ({ role: 'user', content: 'x' }));
  const r = validateRequest({ messages: msgs }, 50);
  assert.equal(r.ok, false);
  assert.match(r.error, /too many messages/);
});

test('validateRequest rejects bad roles and non-string content', () => {
  assert.equal(
    validateRequest({ messages: [{ role: 'system', content: 'x' }] }, 50).ok,
    false,
  );
  assert.equal(
    validateRequest({ messages: [{ role: 'user', content: 42 }] }, 50).ok,
    false,
  );
});

test('validateRequest rejects empty and oversized content', () => {
  assert.equal(
    validateRequest({ messages: [{ role: 'user', content: '   ' }] }, 50, 10).ok,
    false,
  );
  assert.equal(
    validateRequest({ messages: [{ role: 'user', content: 'x'.repeat(11) }] }, 50, 10).ok,
    false,
  );
});

test('validateRequest requires the latest message to come from the user', () => {
  assert.equal(
    validateRequest({ messages: [{ role: 'assistant', content: 'hi' }] }, 50).ok,
    false,
  );
  assert.equal(
    validateRequest(
      { messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }] },
      50,
    ).ok,
    false,
  );
});

test('validateRequest accepts well-formed payload', () => {
  const r = validateRequest(
    { messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }] },
    50,
  );
  assert.equal(r.ok, false);
  assert.equal(validateRequest({ messages: [{ role: 'user', content: 'hi' }] }, 50).ok, true);
});

test('isRateLimited blocks after maxPerHour', () => {
  _resetRateMap();
  const ip = '1.2.3.4';
  for (let i = 0; i < 3; i++) assert.equal(isRateLimited(ip, 3), false);
  assert.equal(isRateLimited(ip, 3), true);
});

test('isRateLimited treats different IPs independently', () => {
  _resetRateMap();
  assert.equal(isRateLimited('a', 1), false);
  assert.equal(isRateLimited('a', 1), true);
  assert.equal(isRateLimited('b', 1), false);
});

test('resolveModel defaults to sonnet when MODEL is unset', () => {
  assert.equal(resolveModel({}), MODELS.sonnet);
});

test('resolveModel selects haiku when MODEL=haiku', () => {
  assert.equal(resolveModel({ MODEL: 'haiku' }), MODELS.haiku);
  assert.equal(resolveModel({ MODEL: 'HAIKU' }), MODELS.haiku);
});

test('resolveModel falls back to sonnet for unknown keys', () => {
  assert.equal(resolveModel({ MODEL: 'opus' }), MODELS.sonnet);
});

test('MODELS contains the latest Haiku 4.5 ID', () => {
  assert.equal(MODELS.haiku, 'claude-haiku-4-5-20251001');
});

test('parseSSEChunk extracts text_delta text from Anthropic streaming event', () => {
  const event = JSON.stringify({
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: 'Hello' },
  });
  const result = parseSSEChunk(`data: ${event}\n`);
  assert.deepEqual(result, ['Hello']);
});

test('parseSSEChunk skips non-text_delta events', () => {
  const event = JSON.stringify({ type: 'message_start', message: {} });
  const result = parseSSEChunk(`data: ${event}\n`);
  assert.deepEqual(result, []);
});

test('parseSSEChunk handles empty string delta without crashing', () => {
  const event = JSON.stringify({
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: '' },
  });
  const result = parseSSEChunk(`data: ${event}\n`);
  assert.deepEqual(result, ['']);
});

test('parseAllowedOrigins handles comma-separated origins', () => {
  assert.deepEqual(parseAllowedOrigins('https://a.test, https://b.test'), [
    'https://a.test',
    'https://b.test',
  ]);
});

test('isOriginAllowed allows missing origin but rejects unknown origins', () => {
  const allowed = ['https://kinokoholic.com'];
  assert.equal(isOriginAllowed(null, allowed), true);
  assert.equal(isOriginAllowed('https://kinokoholic.com', allowed), true);
  assert.equal(isOriginAllowed('https://evil.example', allowed), false);
});

test('buildCacheControl defaults to 5-minute automatic caching', () => {
  assert.deepEqual(buildCacheControl({}), { type: 'ephemeral' });
});

test('buildCacheControl supports opt-out and 1-hour ttl', () => {
  assert.equal(buildCacheControl({ ENABLE_PROMPT_CACHE: 'false' }), null);
  assert.deepEqual(buildCacheControl({ PROMPT_CACHE_TTL: '1h' }), { type: 'ephemeral', ttl: '1h' });
});

test('cacheStatusHeader exposes cache state without usage details', () => {
  assert.equal(cacheStatusHeader({}), 'enabled; ttl=5m');
  assert.equal(cacheStatusHeader({ PROMPT_CACHE_TTL: '1h' }), 'enabled; ttl=1h');
  assert.equal(cacheStatusHeader({ ENABLE_PROMPT_CACHE: 'false' }), 'disabled');
});

test('buildAnthropicPayload includes automatic prompt caching when enabled', () => {
  const payload = buildAnthropicPayload(
    { MODEL: 'haiku', PROMPT_CACHE_TTL: '5m' },
    [{ role: 'user', content: 'What did David build?' }],
  );
  assert.equal(payload.model, MODELS.haiku);
  assert.deepEqual(payload.cache_control, { type: 'ephemeral' });
  assert.equal(payload.stream, true);
});

test('fetch rejects disallowed browser origins before upstream call', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('should not call upstream');
  };
  try {
    const response = await worker.fetch(
      new Request('https://kinokoholic.com/api/chat', {
        method: 'POST',
        headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      }),
      { ALLOWED_ORIGIN: 'https://kinokoholic.com', ANTHROPIC_API_KEY: 'test-key' },
    );
    assert.equal(response.status, 403);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetch rejects non-json content types', async () => {
  const response = await worker.fetch(
    new Request('https://kinokoholic.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    }),
    { ANTHROPIC_API_KEY: 'test-key' },
  );
  assert.equal(response.status, 415);
});

test('fetch rejects oversized request bodies', async () => {
  const response = await worker.fetch(
    new Request('https://kinokoholic.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(20) }] }),
    }),
    { ANTHROPIC_API_KEY: 'test-key', MAX_BODY_BYTES: '10' },
  );
  assert.equal(response.status, 413);
});

test('fetch sends cached Anthropic payload upstream', async () => {
  const originalFetch = globalThis.fetch;
  let upstreamPayload = null;
  globalThis.fetch = async (_url, init) => {
    upstreamPayload = JSON.parse(init.body);
    const upstream = [
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
    ].join('');
    return new Response(upstream, { status: 200 });
  };
  try {
    const response = await worker.fetch(
      new Request('https://kinokoholic.com/api/chat', {
        method: 'POST',
        headers: { Origin: 'https://kinokoholic.com', 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      }),
      {
        ALLOWED_ORIGIN: 'https://kinokoholic.com',
        ANTHROPIC_API_KEY: 'test-key',
        PROMPT_CACHE_TTL: '1h',
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(upstreamPayload.cache_control, { type: 'ephemeral', ttl: '1h' });
    assert.equal(upstreamPayload.messages[0].content, 'hi');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
