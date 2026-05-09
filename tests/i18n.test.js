#!/usr/bin/env node
/**
 * Unit tests for assets/js/i18n.js helpers.
 * Helpers are reimplemented here so they can be tested without a DOM
 * (the source file is an IIFE that wires window.kkI18n on boot).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

function lookup(strings, ns, key) {
  if (!strings) return undefined;
  if (ns && strings[ns] && strings[ns][key] !== undefined) return strings[ns][key];
  if (strings._global && strings._global[key] !== undefined) return strings._global[key];
  return undefined;
}

function isHtmlKey(key) {
  return /\.html$/.test(key);
}

function parseAttrSpec(spec) {
  return spec.split(',').map(function (pair) {
    var parts = pair.split(':');
    return { attr: (parts[0] || '').trim(), key: (parts[1] || '').trim() };
  }).filter(function (p) { return p.attr && p.key; });
}

function resolveStringsUrl(pathname) {
  var path = pathname.replace(/\/[^/]*$/, '/');
  var depth = (path.match(/\//g) || []).length - 1;
  var prefix = depth > 0 ? new Array(depth + 1).join('../') : '';
  return prefix + 'i18n/strings.ja.json';
}

const STRINGS = {
  _global: {
    'nav.home': 'ホーム',
    'footer.copyright': '© 2026',
  },
  'page.home': {
    'hero.eyebrow': '// IT PM × AI/ML',
    'hero.h1.html': '<em>意図</em>と<em>知能</em>',
  },
};

describe('i18n: lookup', () => {
  it('finds page-namespaced keys first', () => {
    assert.strictEqual(lookup(STRINGS, 'page.home', 'hero.eyebrow'), '// IT PM × AI/ML');
  });

  it('falls back to _global when not in page namespace', () => {
    assert.strictEqual(lookup(STRINGS, 'page.home', 'nav.home'), 'ホーム');
  });

  it('returns undefined for unknown keys', () => {
    assert.strictEqual(lookup(STRINGS, 'page.home', 'nope.nope'), undefined);
  });

  it('returns undefined when strings table is null', () => {
    assert.strictEqual(lookup(null, 'page.home', 'hero.eyebrow'), undefined);
  });

  it('handles empty namespace by going straight to _global', () => {
    assert.strictEqual(lookup(STRINGS, '', 'nav.home'), 'ホーム');
  });
});

describe('i18n: isHtmlKey', () => {
  it('flags keys ending in .html', () => {
    assert.strictEqual(isHtmlKey('hero.h1.html'), true);
    assert.strictEqual(isHtmlKey('career.r1.win.html'), true);
  });

  it('returns false for plain keys', () => {
    assert.strictEqual(isHtmlKey('hero.summary'), false);
    assert.strictEqual(isHtmlKey('html.body'), false);
    assert.strictEqual(isHtmlKey(''), false);
  });
});

describe('i18n: parseAttrSpec', () => {
  it('parses a single attr:key pair', () => {
    assert.deepStrictEqual(
      parseAttrSpec('placeholder:chat.input.placeholder'),
      [{ attr: 'placeholder', key: 'chat.input.placeholder' }]
    );
  });

  it('parses multiple comma-separated pairs', () => {
    assert.deepStrictEqual(
      parseAttrSpec('placeholder:foo,aria-label:bar'),
      [
        { attr: 'placeholder', key: 'foo' },
        { attr: 'aria-label', key: 'bar' },
      ]
    );
  });

  it('trims whitespace inside pairs', () => {
    assert.deepStrictEqual(
      parseAttrSpec(' content : meta.description '),
      [{ attr: 'content', key: 'meta.description' }]
    );
  });

  it('drops malformed pairs', () => {
    assert.deepStrictEqual(parseAttrSpec('placeholder:,bad'), []);
  });
});

describe('i18n: resolveStringsUrl', () => {
  it('resolves to i18n/ from site root', () => {
    assert.strictEqual(resolveStringsUrl('/'), 'i18n/strings.ja.json');
    assert.strictEqual(resolveStringsUrl('/index.html'), 'i18n/strings.ja.json');
  });

  it('walks up one level from /projects/', () => {
    assert.strictEqual(resolveStringsUrl('/projects/index.html'), '../i18n/strings.ja.json');
    assert.strictEqual(resolveStringsUrl('/projects/jtes.html'), '../i18n/strings.ja.json');
  });

  it('walks up two levels from /a/b/page.html', () => {
    assert.strictEqual(resolveStringsUrl('/a/b/page.html'), '../../i18n/strings.ja.json');
  });
});

describe('i18n: strings.ja.json shape', () => {
  it('loads and exposes _global + page.home', async () => {
    const fs = await import('node:fs/promises');
    const data = JSON.parse(await fs.readFile(new URL('../i18n/strings.ja.json', import.meta.url), 'utf8'));
    assert.ok(data._global, '_global namespace exists');
    assert.ok(data['page.home'], 'page.home namespace exists');
    assert.ok(data['page.home']['title'], 'page.home.title exists');
    assert.ok(data['page.home']['hero.h1.html'], 'page.home.hero.h1.html exists');
  });
});
