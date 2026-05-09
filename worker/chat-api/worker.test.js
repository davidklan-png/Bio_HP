import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, isRateLimited, _resetRateMap } from './worker.js';

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

test('validateRequest accepts well-formed payload', () => {
  const r = validateRequest(
    { messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }] },
    50,
  );
  assert.equal(r.ok, true);
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
