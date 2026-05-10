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

// ── Starter questions data ──────────────────────────────────────────
// Mirrors STARTER_GROUPS in assets/js/chat.js — update both together.
const STARTER_GROUPS = [
  {
    label: 'Recruiter',
    questions: [
      "What's David's current availability and the type of roles he's open to?",
      "What's his strongest end-to-end project — from problem to production?",
      "How does his PM background change the way he builds AI systems?",
    ],
  },
  {
    label: 'Business partner',
    questions: [
      "What kind of engagements does David take on?",
      "How would he scope and approach a RAG or agentic workflow project?",
      "What's a realistic timeline and process for an AI-powered product MVP?",
    ],
  },
  {
    label: 'Startup founder',
    questions: [
      "Can you walk me through the -mon product family and what it's building toward?",
      "What would David build differently if he were starting the JTES project over?",
      "How does he decide when to ship vs. keep iterating?",
    ],
  },
];

test('starter groups have 3 personas each with at least 3 non-empty questions', () => {
  assert.equal(STARTER_GROUPS.length, 3);
  for (const group of STARTER_GROUPS) {
    assert.ok(typeof group.label === 'string' && group.label.length > 0, `${group.label} has a label`);
    assert.ok(group.questions.length >= 3, `${group.label} has at least 3 questions`);
    for (const q of group.questions) {
      assert.ok(typeof q === 'string' && q.trim().length > 0, `question is non-empty string`);
    }
  }
});

test('starter group labels cover the expected personas', () => {
  const labels = STARTER_GROUPS.map(g => g.label);
  assert.ok(labels.includes('Recruiter'));
  assert.ok(labels.includes('Business partner'));
  assert.ok(labels.includes('Startup founder'));
});
