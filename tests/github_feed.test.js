#!/usr/bin/env node
/**
 * Unit tests for assets/js/github-feed.js helpers.
 * The helpers are reimplemented here so they can be tested in isolation
 * (the source file is an IIFE that runs against the DOM).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

function timeAgo(iso, now) {
  const then = new Date(iso).getTime();
  if (!then) return '';
  const diff = (now ?? Date.now()) - then;
  const d = Math.floor(diff / 86400000);
  if (d < 1) return 'today';
  if (d < 2) return 'yesterday';
  if (d < 30) return d + 'd ago';
  if (d < 365) return Math.floor(d / 30) + 'mo ago';
  return Math.floor(d / 365) + 'y ago';
}

function langClass(l) {
  if (!l) return '';
  return ({
    'Python': 'py', 'TypeScript': 'ts', 'JavaScript': 'js',
    'HTML': 'html', 'Go': 'go', 'Rust': 'rust', 'Shell': 'shell',
    'Markdown': 'markdown'
  })[l] || '';
}

describe('github-feed: timeAgo', () => {
  const NOW = new Date('2026-05-09T12:00:00Z').getTime();

  it('returns empty string for invalid date', () => {
    assert.strictEqual(timeAgo('not-a-date', NOW), '');
  });

  it('returns "today" for under one day ago', () => {
    const iso = new Date(NOW - 3 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(timeAgo(iso, NOW), 'today');
  });

  it('returns "yesterday" for ~1 day ago', () => {
    const iso = new Date(NOW - 26 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(timeAgo(iso, NOW), 'yesterday');
  });

  it('returns Nd ago for sub-month ranges', () => {
    const iso = new Date(NOW - 5 * 86400000).toISOString();
    assert.strictEqual(timeAgo(iso, NOW), '5d ago');
  });

  it('returns Nmo ago for sub-year ranges', () => {
    const iso = new Date(NOW - 90 * 86400000).toISOString();
    assert.strictEqual(timeAgo(iso, NOW), '3mo ago');
  });

  it('returns Ny ago for year+ ranges', () => {
    const iso = new Date(NOW - 400 * 86400000).toISOString();
    assert.strictEqual(timeAgo(iso, NOW), '1y ago');
  });
});

describe('github-feed: langClass', () => {
  it('returns empty string for falsy input', () => {
    assert.strictEqual(langClass(null), '');
    assert.strictEqual(langClass(undefined), '');
    assert.strictEqual(langClass(''), '');
  });

  it('maps known languages to their slug', () => {
    assert.strictEqual(langClass('Python'), 'py');
    assert.strictEqual(langClass('TypeScript'), 'ts');
    assert.strictEqual(langClass('JavaScript'), 'js');
    assert.strictEqual(langClass('HTML'), 'html');
    assert.strictEqual(langClass('Shell'), 'shell');
  });

  it('returns empty string for unknown languages', () => {
    assert.strictEqual(langClass('Brainfuck'), '');
  });
});
