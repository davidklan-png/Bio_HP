#!/usr/bin/env node
/**
 * Unit tests for assets/js/fungi-dashboard.js (the /kinokomon/ Japan fungi dashboard).
 * The module exports its pure helpers via module.exports when loaded outside a browser.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

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

describe('fungi-dashboard: habitat column', () => {
  it('prefers habitat notes, then locality, and appends elevation', () => {
    assert.strictEqual(fd.whereText({ h: ['In Pinus forest'], l: ['Oku'], el: [70, 320] }, 'en'), 'In Pinus forest · 70–320 m');
    assert.strictEqual(fd.whereText({ h: [], l: ['Oku', 'Yonaha'], el: null }, 'en'), 'Oku / Yonaha');
    assert.strictEqual(fd.whereText({ h: [], l: [], el: [500, 500] }, 'ja'), '標高500 m');
  });
});

describe('fungi-dashboard: review fixes', () => {
  it('limits long tables but reports what is hidden', () => {
    const list = Array.from({ length: 944 }, (_, i) => i);
    assert.deepStrictEqual(fd.visibleRows(list, 300, false).hidden, 644);
    assert.strictEqual(fd.visibleRows(list, 300, false).rows.length, 300);
    assert.strictEqual(fd.visibleRows(list, 300, true).rows.length, 944);
    assert.strictEqual(fd.visibleRows(list.slice(0, 12), 300, false).hidden, 0);
  });
  it('draws no bar for a month without records', () => {
    assert.strictEqual(fd.monthBarHeight(0, 50), 0);
    assert.strictEqual(fd.monthBarHeight(1, 5000), 2);
    assert.strictEqual(fd.monthBarHeight(50, 50), 100);
    assert.strictEqual(fd.monthBarHeight(0, 0), 0);
  });
  it('only applies the newest area request', () => {
    const tracker = fd.latestOnly();
    const first = tracker.start('okinawa-honto');
    const second = tracker.start('ishigaki');
    assert.strictEqual(tracker.isCurrent(first), false);
    assert.strictEqual(tracker.isCurrent(second), true);
  });
});

describe('fungi-dashboard: tap inspect/open flow', () => {
  const cell = { cell: '318:1042', areaId: 'okinawa-honto' };
  it('previews on a first tap and opens on a second tap of the same cell', () => {
    const first = fd.tapTransition(null, cell);
    assert.deepStrictEqual(first, { next: cell, action: 'preview' });
    const second = fd.tapTransition(first.next, cell);
    assert.strictEqual(second.action, 'open');
  });
  it('previews a different cell instead of opening', () => {
    const after = fd.tapTransition(fd.tapTransition(null, cell).next, { cell: '319:1043', areaId: 'okinawa-honto' });
    assert.strictEqual(after.action, 'preview');
    assert.strictEqual(after.next.cell, '319:1043');
  });
  it('clears the preview when an empty spot is tapped, and does nothing from idle', () => {
    assert.deepStrictEqual(fd.tapTransition(null, null), { next: null, action: 'none' });
    const cleared = fd.tapTransition(fd.tapTransition(null, cell).next, null);
    assert.deepStrictEqual(cleared, { next: null, action: 'clear' });
  });
  it('never opens a cell that no area owns', () => {
    const orphan = { cell: '318:1042', areaId: null };
    assert.strictEqual(fd.tapTransition(fd.tapTransition(null, orphan).next, orphan).action, 'preview');
  });
  it('can open an area previewed without a recorded cell (island water)', () => {
    const water = { cell: null, areaId: 'okinawa-honto' };
    assert.strictEqual(fd.tapTransition(null, water).action, 'preview');
    assert.strictEqual(fd.tapTransition(fd.tapTransition(null, water).next, water).action, 'open');
  });
});

describe('fungi-dashboard: tap gesture guard', () => {
  it('accepts a pointer that lands and lifts in place', () => {
    const g = fd.tapGuard();
    g.down({ x: 100, y: 100 });
    assert.strictEqual(g.up({ x: 104, y: 103 }), true);
  });
  it('rejects a pointer that moved before lifting (scroll or drag)', () => {
    const g = fd.tapGuard();
    g.down({ x: 100, y: 100 });
    assert.strictEqual(g.up({ x: 122, y: 118 }), false);
  });
  it('rejects a pointer cancelled by scrolling', () => {
    const g = fd.tapGuard();
    g.down({ x: 100, y: 100 });
    g.cancel();
    assert.strictEqual(g.up({ x: 100, y: 100 }), false);
  });
  it('ignores moves and lifts without a press', () => {
    const g = fd.tapGuard();
    g.move({ x: 1, y: 1 });
    assert.strictEqual(g.up({ x: 1, y: 1 }), false);
  });
});

describe('fungi-dashboard: bucket classes and palette', () => {
  it('maps record counts to bucket classes at the boundaries', () => {
    const expect = [
      [1, 'fd-map__b0'], [9, 'fd-map__b0'], [10, 'fd-map__b1'], [99, 'fd-map__b1'], [100, 'fd-map__b2'],
      [999, 'fd-map__b2'], [1000, 'fd-map__b3'], [9999, 'fd-map__b3'], [10000, 'fd-map__b4']
    ];
    for (const [n, cls] of expect) assert.strictEqual(fd.bucketClass(n), cls, 'n=' + n);
  });
  const css = readFileSync(new URL('../assets/css/fungi-dashboard.css', import.meta.url), 'utf8');
  const block = (sel) => css.slice(css.indexOf(sel)).slice(0, css.slice(css.indexOf(sel)).indexOf('}'));
  const hexVar = (b, name) => b.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'))[1];
  const softVar = (b) => b.match(/--brand-soft:\s*rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/).slice(1).map(Number);
  const lum = (hex) => {
    const c = hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const themes = [['dark', block('.fd {')], ['light', block(':root[data-theme="light"] .fd {')]];
  it('gives each theme five distinct bucket colours holding 3:1 against panel and water', () => {
    for (const [name, b] of themes) {
      const colors = [0, 1, 2, 3, 4].map((i) => hexVar(b, 'fd-b' + i));
      assert.strictEqual(new Set(colors).size, 5, name + ' buckets must be distinct');
      const panel = hexVar(b, 'panel');
      const [r, g, bl, a] = softVar(b); // the map's radial tint over the panel is the "water"
      const pc = panel.slice(1).match(/../g).map((x) => parseInt(x, 16));
      const waterBlend = '#' + [r, g, bl].map((v, i) => Math.round(a * v + (1 - a) * pc[i]).toString(16).padStart(2, '0')).join('');
      for (let i = 0; i < 5; i++) {
        assert.ok(contrast(colors[i], panel) >= 3, name + ' b' + i + ' vs panel ' + contrast(colors[i], panel).toFixed(2));
        assert.ok(contrast(colors[i], waterBlend) >= 3, name + ' b' + i + ' vs water ' + contrast(colors[i], waterBlend).toFixed(2));
      }
    }
  });
  it('keeps bucket palettes theme-local with a two-tone selection outline', () => {
    const palettes = themes.map(([, b]) => [0, 1, 2, 3, 4].map((i) => hexVar(b, 'fd-b' + i)));
    assert.notDeepStrictEqual(palettes[0], palettes[1]);
    for (const [name, b] of themes) {
      assert.notStrictEqual(hexVar(b, 'fd-sel-halo'), hexVar(b, 'fd-sel-core'), name + ' outline must be two-tone');
    }
  });
});
