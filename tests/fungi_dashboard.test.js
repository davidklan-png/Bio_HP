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

describe('fungi-dashboard: mesh keys', () => {
  const data = require('../assets/data/shroomhunt/dashboard.json');
  it('gives every published mesh square its own key', () => {
    const keys = new Set(data.mesh.map((m) => fd.meshKey(m[0], m[1])));
    assert.strictEqual(keys.size, data.mesh.length);
  });
  it('maps any point inside a square to that square', () => {
    for (const m of data.mesh.slice(0, 300)) {
      const k = fd.meshKey(m[0], m[1]);
      assert.strictEqual(fd.meshKey(m[0] + 0.04, m[1] - 0.06), k);
      assert.strictEqual(fd.meshKey(m[0] - 0.04, m[1] + 0.06), k);
    }
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

describe('fungi-dashboard: drill-down helpers', () => {
  const index = {
    areas: [
      { id: 'okinawa-honto', kind: 'island', bbox: [26.07, 26.88, 127.63, 128.33] },
      { id: 'g-okinawa-prefecture', kind: 'group', bbox: [24.2, 27.1, 122.9, 131.4] },
      { id: 't5339', kind: 'tile', bbox: [35.33, 36.0, 139, 140] }
    ],
    cells: { '427:1118': 't5339' }
  };
  it('finds the island under a point before any square', () => {
    assert.strictEqual(fd.areaAt(26.5, 128.0, index), 'okinawa-honto');
  });
  it('never returns a group from a map click', () => {
    assert.strictEqual(fd.areaAt(25.0, 125.0, index), null);
  });
  it('falls back to the area of the ~10 km square', () => {
    assert.strictEqual(fd.areaAt(35.6, 139.8, index), 't5339');
  });
  it('pads small areas so a zoomed map is never a speck', () => {
    const b = fd.zoomBox([26.07, 26.88, 127.63, 128.33]);
    assert.ok(b.latMax - b.latMin >= 1.2 && b.lonMax - b.lonMin >= 1.2);
    assert.ok(b.latMin < 26.07 && b.latMax > 26.88);
  });
  it('projects inside a zoom box', () => {
    const box = fd.zoomBox([26.07, 26.88, 127.63, 128.33]);
    const size = fd.mapSize(600, box);
    const p = fd.project(26.48, 127.98, size.width, size.height, box);
    assert.ok(p.x > 0.3 * size.width && p.x < 0.7 * size.width);
    assert.ok(p.y > 0.3 * size.height && p.y < 0.7 * size.height);
  });
  const list = [
    { n: 'Suillus granulatus', k: 'm', m: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 25] },
    { n: 'Parmotrema tinctorum', k: 'l', m: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0] },
    { n: 'Aspergillus niger', k: 'o', m: [0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 5, 0] }
  ];
  it('filters species by kind and month', () => {
    assert.deepStrictEqual(fd.filterSpecies(list, 'm', 0).map((x) => x.n), ['Suillus granulatus']);
    assert.deepStrictEqual(fd.filterSpecies(list, 'all', 11).map((x) => x.n), ['Suillus granulatus', 'Aspergillus niger']);
    assert.deepStrictEqual(fd.filterSpecies(list, 'l', 12), []);
  });
  it('flags areas where one site dominates the records', () => {
    assert.deepStrictEqual(fd.samplingNote([['Oku', 3596], ['Yonaha Blue', 3321]], 11416), { name: 'Oku', share: 31 });
    assert.strictEqual(fd.samplingNote([['Naha', 10]], 1000), null);
  });
  it('names months in both languages', () => {
    assert.strictEqual(fd.monthName(1, 'en'), 'Jan');
    assert.strictEqual(fd.monthName(12, 'ja'), '12月');
  });
});
