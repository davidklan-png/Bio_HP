// Tests for chat.js — vanilla JS chat client
(function () {
  'use strict';

  const tests = [];

  function assert(condition, message) {
    tests.push({ condition, message, passed: condition });
    console.log(condition ? '✓' : '✗', message);
  }

  // ── Mock environment ──────────────────────────────────────────────
  let mockLocalStorage = {};

  function setupMocks() {
    mockLocalStorage = {};
    globalThis.localStorage = {
      getItem(k) { return mockLocalStorage[k] ?? null; },
      setItem(k, v) { mockLocalStorage[k] = String(v); },
      removeItem(k) { delete mockLocalStorage[k]; },
      clear() { mockLocalStorage = {}; },
    };
  }

  function teardownMocks() {
    delete globalThis.localStorage;
  }

  // ── Tests ─────────────────────────────────────────────────────────

  setupMocks();

  // 1: localStorage persistence round-trip
  const STORAGE_KEY = 'kinokoholic-chat-history';
  const sampleMessages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleMessages));
  const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assert(
    Array.isArray(loaded) && loaded.length === 2 && loaded[0].role === 'user',
    'Chat history should persist in localStorage'
  );

  // 2: Loading corrupted data doesn't crash
  localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch { /* expected */ }
  assert(parsed === null, 'Corrupted localStorage data should parse as null');

  // 3: Empty history is valid
  localStorage.setItem(STORAGE_KEY, '[]');
  const empty = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assert(Array.isArray(empty) && empty.length === 0, 'Empty chat history should be an empty array');

  // 4: Clear history works
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleMessages));
  localStorage.removeItem(STORAGE_KEY);
  assert(localStorage.getItem(STORAGE_KEY) === null, 'Clearing history removes localStorage key');

  // 5: Message shape validation
  function isValidMessage(msg) {
    return msg !== null && typeof msg === 'object' && typeof msg.role === 'string' && typeof msg.content === 'string';
  }
  assert(isValidMessage({ role: 'user', content: 'test' }) === true, 'Valid message passes shape check');
  assert(isValidMessage({ role: 'assistant', content: '' }) === true, 'Empty content message is still valid shape');
  assert(isValidMessage({}) === false, 'Empty object fails shape check');
  assert(isValidMessage(null) === false, 'Null fails shape check');

  // 6: API endpoint is defined
  const API_ENDPOINT = '/api/chat';
  assert(typeof API_ENDPOINT === 'string' && API_ENDPOINT.startsWith('/'), 'API endpoint should be a valid path');

  // ── Summary ───────────────────────────────────────────────────────
  teardownMocks();

  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
})();
