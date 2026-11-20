#!/usr/bin/env node
/**
 * Unit tests for assets/js/fungi-dashboard.js (the /kinokomon/ Japan fungi dashboard).
 * The module exports its pure helpers via module.exports when loaded outside a browser.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fd = require('../assets/js/fungi-dashboard.js');

describe('fungi-dashboard: number formatting', () => {
  it('groups thousands', () => {
    assert.strictEqual(fd.fmtInt(345509), '345,509');
  });
  it('rounds percentages and guards zero denominators', () => {
    assert.strictEqual(fd.pct(148207, 345509), '43%');
    assert.strictEqual(fd.pct(5, 0), '–');
  });
});

describe('fungi-dashboard: labels', () => {
  it('translates evidence types to Japanese', () => {
    assert.strictEqual(fd.label('PRESERVED_SPECIMEN', 'ja'), '標本');
    assert.strictEqual(fd.label('PRESERVED_SPECIMEN', 'en'), 'Preserved specimen');
  });
  it('falls back to a readable form of unknown keys', () => {
    assert.strictEqual(fd.label('SOMETHING_NEW', 'en'), 'Something new');
  });
  it('maps triage hints to short codes and both languages', () => {
    assert.strictEqual(fd.triage('Japanese genus-only records exist: check them', 'en'), 'Check Japanese genus-only records');
    assert.strictEqual(fd.triage('genus unrecorded in Japan', 'ja'), '属も国内未記録');
  });
});

describe('fungi-dashboard: map helpers', () => {
  const box = fd.JAPAN_BOX;
  it('projects the north-west corner to the origin', () => {
    const p = fd.project(box.latMax, box.lonMin, 600, 600);
    assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.y) < 1e-9);
  });
  it('keeps the map aspect ratio (longitudes shrink by cos(latitude))', () => {
    const size = fd.mapSize(800);
    assert.strictEqual(size.width, 800);
    assert.ok(size.height > 600 && size.height < 900, `height ${size.height}`);
  });
  it('puts Tokyo in the right part of the map', () => {
    const size = fd.mapSize(800);
    const p = fd.project(35.68, 139.69, size.width, size.height);
    assert.ok(p.x > size.width * 0.45 && p.x < size.width * 0.65, `x ${p.x}`);
    assert.ok(p.y > size.height * 0.35 && p.y < size.height * 0.6, `y ${p.y}`);
  });
  it('buckets record counts on a log scale', () => {
    assert.strictEqual(fd.bucket(1), 0);
    assert.strictEqual(fd.bucket(9), 0);
    assert.strictEqual(fd.bucket(10), 1);
    assert.strictEqual(fd.bucket(150), 2);
    assert.strictEqual(fd.bucket(2000), 3);
    assert.strictEqual(fd.bucket(50000), 4);
  });
});

describe('fungi-dashboard: data guards', () => {
  it('rejects data without the fields the page needs', () => {
    assert.strictEqual(fd.isValid({}), false);
    assert.strictEqual(fd.isValid({ totals: { records: 1 }, mesh: [], leads: [], sources: [] }), true);
  });
  it('escapes HTML in names coming from data', () => {
    assert.strictEqual(fd.esc('<b>Amanita</b> & co'), '&lt;b&gt;Amanita&lt;/b&gt; &amp; co');
  });
});
