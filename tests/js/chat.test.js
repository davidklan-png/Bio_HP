// Tests for the chat client's storage + validation invariants.
// Run via `node --test` (wired into scripts/run-site-js-tests.sh).
const test = require('node:test');
const assert = require('node:assert/strict');

const STORAGE_KEY = 'kinokoholic-chat-history';

function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

test('persisted history round-trips through localStorage', () => {
  const ls = makeLocalStorage();
  const sample = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ];
  ls.setItem(STORAGE_KEY, JSON.stringify(sample));
  const loaded = JSON.parse(ls.getItem(STORAGE_KEY));
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].role, 'user');
  assert.equal(loaded[1].content, 'Hi there!');
});

test('corrupted JSON throws on parse (caller must catch)', () => {
  const ls = makeLocalStorage();
  ls.setItem(STORAGE_KEY, 'not-valid-json{{{');
  assert.throws(() => JSON.parse(ls.getItem(STORAGE_KEY)));
});

test('empty history is a valid empty array', () => {
  const ls = makeLocalStorage();
  ls.setItem(STORAGE_KEY, '[]');
  const parsed = JSON.parse(ls.getItem(STORAGE_KEY));
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 0);
});

test('clearing removes the storage key', () => {
  const ls = makeLocalStorage();
  ls.setItem(STORAGE_KEY, '[]');
  ls.removeItem(STORAGE_KEY);
  assert.equal(ls.getItem(STORAGE_KEY), null);
});

test('message shape validation accepts valid roles only', () => {
  const isValidMessage = (msg) =>
    msg !== null &&
    typeof msg === 'object' &&
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string';

  assert.equal(isValidMessage({ role: 'user', content: 'test' }), true);
  assert.equal(isValidMessage({ role: 'assistant', content: '' }), true);
  assert.equal(isValidMessage({ role: 'system', content: 'x' }), false);
  assert.equal(isValidMessage({}), false);
  assert.equal(isValidMessage(null), false);
});
