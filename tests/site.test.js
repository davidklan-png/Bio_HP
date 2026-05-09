#!/usr/bin/env node
/**
 * Unit tests for assets/js/site.js helpers.
 * The helpers are reimplemented here so they can be tested in isolation
 * (the source file is an IIFE that runs against the DOM).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

function normalizePath(p) {
  return p.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
}

function pickThemeIcon(theme) {
  return theme === 'dark' ? 'sun' : 'moon';
}

describe('site.js: normalizePath', () => {
  it('treats /index.html as /', () => {
    assert.strictEqual(normalizePath('/index.html'), '/');
  });

  it('strips trailing slash on nested paths', () => {
    assert.strictEqual(normalizePath('/projects/'), '/projects');
  });

  it('treats projects/index.html as /projects', () => {
    assert.strictEqual(normalizePath('/projects/index.html'), '/projects');
  });

  it('returns / for the empty / root case', () => {
    assert.strictEqual(normalizePath('/'), '/');
  });

  it('leaves bare paths untouched', () => {
    assert.strictEqual(normalizePath('/kinokomon'), '/kinokomon');
  });
});

describe('site.js: theme button icon selection', () => {
  it('shows the sun icon when current theme is dark (offers light)', () => {
    assert.strictEqual(pickThemeIcon('dark'), 'sun');
  });

  it('shows the moon icon when current theme is light (offers dark)', () => {
    assert.strictEqual(pickThemeIcon('light'), 'moon');
  });
});
