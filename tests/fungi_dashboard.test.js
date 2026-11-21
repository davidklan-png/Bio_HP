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

describe('fungi-dashboard: shared mesh math (locate + parity)', () => {
  // Expected keys computed with ShroomHunt pipeline/build_areas.py mesh_key(), verbatim.
  const parity = [
    [26.2125, 127.6809, '314:1021'],   // Naha
    [35.6812, 139.7671, '428:1118'],   // Tokyo
    [43.0618, 141.3545, '516:1130'],   // Sapporo
    [24.0, 123.0, '288:984'],
    [20.0, 122.0, '240:976'],          // envelope corner: half-open lower edge is inside
    [45.9999, 153.9999, '551:1231'],   // just inside the top-right
    [26.25, 127.681, '315:1021'],      // exactly on a row edge
    [33.5, 130.125, '402:1041'],       // exactly on a column edge
    [20.0417, 122.0417, '240:976'],    // first cell centre, rounded to 4 decimals
    [45.9583, 153.9583, '551:1231']
  ];
  it('matches the Python mesh_key() on the parity fixture', () => {
    for (const [lat, lon, key] of parity) assert.strictEqual(fd.meshKey(lat, lon), key);
  });
  it('keeps the envelope [20,46) × [122,154) half-open', () => {
    const corner = fd.meshCell(20, 122);
    assert.deepStrictEqual({ row: corner.row, col: corner.col, key: corner.key }, { row: 240, col: 976, key: '240:976' });
    assert.strictEqual(fd.meshCell(45.9999, 153.9999).key, '551:1231');
    assert.strictEqual(fd.meshCell(19.9999, 130), null);
    assert.strictEqual(fd.meshCell(46, 130), null);
    assert.strictEqual(fd.meshCell(30, 121.9999), null);
    assert.strictEqual(fd.meshCell(30, 154), null);
    assert.strictEqual(fd.meshCell(NaN, 130), null);
    assert.strictEqual(fd.meshCell(30, Infinity), null);
  });
  it('round trips a point through cell, centre and exact rectangle edges', () => {
    for (const [lat, lon, key] of parity) {
      const cell = fd.meshCell(lat, lon);
      assert.strictEqual(cell.key, key);
      const [latMin, latMax, lonMin, lonMax] = fd.cellEdges(cell.row, cell.col);
      assert.ok(latMin <= lat && lat < latMax && lonMin <= lon && lon < lonMax, key);
      assert.strictEqual(latMin, cell.row / 12);
      assert.strictEqual(latMax, (cell.row + 1) / 12);
      assert.strictEqual(lonMin, cell.col / 8);
      assert.strictEqual(lonMax, (cell.col + 1) / 8);
      const c = fd.cellCenter(cell.row, cell.col);
      assert.ok(Math.abs(c.lat - (latMin + latMax) / 2) < 1e-12);
      assert.ok(Math.abs(c.lon - (lonMin + lonMax) / 2) < 1e-12);
      assert.strictEqual(fd.meshCell(c.lat, c.lon).key, key); // centre maps back to its own cell
    }
  });
});

describe('fungi-dashboard: v1 contract readers', () => {
  const snap = 'a'.repeat(64);
  const dash0 = { totals: { records: 1 }, mesh: [], leads: [], sources: [] };
  it('accepts legacy v0 files without schema_version (staging window)', () => {
    for (const r of [fd.readDashboard(dash0), fd.readIndex(realIndex()), fd.readArea(realArea())]) {
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.version, 0);
      assert.strictEqual(r.snapshot, null);
    }
  });
  it('accepts v1 files carrying a 64-hex snapshot', () => {
    const r = fd.readDashboard({ ...dash0, schema_version: 1, snapshot: snap });
    assert.deepStrictEqual([r.ok, r.version, r.snapshot], [true, 1, snap]);
    const i = fd.readIndex({ ...realIndex(), schema_version: 1, snapshot: snap });
    assert.deepStrictEqual([i.ok, i.version, i.snapshot], [true, 1, snap]);
    const a = fd.readArea({ ...realArea(), schema_version: 1, snapshot: snap });
    assert.deepStrictEqual([a.ok, a.version, a.snapshot], [true, 1, snap]);
  });
  it('rejects unknown versions as unavailable', () => {
    assert.strictEqual(fd.readDashboard({ ...dash0, schema_version: 2 }).ok, false);
    assert.strictEqual(fd.readDashboard({ ...dash0, schema_version: '1' }).ok, false);
    assert.strictEqual(fd.readIndex({ ...realIndex(), schema_version: 0 }).ok, false);
    assert.strictEqual(fd.readArea({ ...realArea(), schema_version: 3 }).ok, false);
  });
  it('rejects v1 without a valid snapshot, and invalid shapes in any version', () => {
    assert.strictEqual(fd.readDashboard({ ...dash0, schema_version: 1, snapshot: 'nope' }).ok, false);
    assert.strictEqual(fd.readDashboard({ ...dash0, schema_version: 1 }).ok, false);
    assert.strictEqual(fd.readDashboard({}).ok, false);
    assert.strictEqual(fd.readIndex({ schema_version: 1, snapshot: snap, areas: 'x', cells: {} }).ok, false);
    assert.strictEqual(fd.readIndex({ schema_version: 1, snapshot: snap, areas: [{ id: 'a', kind: 'island', bbox: [1, 2, 3, 4], name_en: 'A', name_ja: 'A' }], cells: [] }).ok, false);
    assert.strictEqual(fd.readArea({ schema_version: 1, snapshot: snap, id: 'a', kind: 'island' }).ok, false);
  });
  it('checks the frozen index row shape (id, kind, bbox)', () => {
    const okRow = (row) => fd.readIndex({ schema_version: 1, snapshot: snap, areas: [row], cells: {} }).ok;
    assert.strictEqual(okRow({ id: 'a', kind: 'atoll', bbox: [1, 2, 3, 4], name_en: 'A', name_ja: 'A' }), false);
    assert.strictEqual(okRow({ id: 7, kind: 'island', bbox: [1, 2, 3, 4], name_en: 'A', name_ja: 'A' }), false);
    assert.strictEqual(okRow({ id: 'a', kind: 'island', bbox: [1, 2, 3], name_en: 'A', name_ja: 'A' }), false);
    assert.strictEqual(okRow({ id: 'a', kind: 'tile', bbox: [1, 2, 3, 4], name_en: 'A', name_ja: 'A' }), true);
  });
});

describe('fungi-dashboard: snapshot joins', () => {
  const snap = 'a'.repeat(64), other = 'b'.repeat(64);
  it('keeps joins on when snapshots agree or are absent (v0)', () => {
    assert.deepStrictEqual(fd.resolveSnapshots({ dashboard: snap, index: snap }, false), { refetch: null, joins: true });
    assert.deepStrictEqual(fd.resolveSnapshots({ dashboard: null, index: null }, true), { refetch: null, joins: true });
    assert.deepStrictEqual(fd.resolveSnapshots({ dashboard: null, index: snap }, false), { refetch: null, joins: true });
  });
  it('orders exactly one cache-bypass refetch on a mismatch', () => {
    const layers = { dashboard: snap, index: other };
    assert.deepStrictEqual(fd.resolveSnapshots(layers, false), { refetch: ['dashboard', 'index'], joins: true });
    assert.deepStrictEqual(fd.resolveSnapshots(layers, true), { refetch: null, joins: false });
  });
  it('re-enables joins if the bypassed refetch agrees', () => {
    assert.deepStrictEqual(fd.resolveSnapshots({ dashboard: snap, index: snap }, true), { refetch: null, joins: true });
  });
});

describe('fungi-dashboard: area hash validation', () => {
  it('accepts well-formed known-style ids', () => {
    assert.strictEqual(fd.parseAreaHash('#area-okinawa-honto'), 'okinawa-honto');
    assert.strictEqual(fd.parseAreaHash('area-g-okinawa-prefecture'), 'g-okinawa-prefecture');
    assert.strictEqual(fd.parseAreaHash('#area-t5339'), 't5339');
  });
  it('rejects malformed ids', () => {
    for (const bad of ['#area-', '#area-OKINAWA', '#area-okinawa_honto', '#area--x', '#area-x--y', '#foo', '', '#areas', '#area-x!'])
      assert.strictEqual(fd.parseAreaHash(bad), null, bad);
  });
});

describe('fungi-dashboard: locate me', () => {
  const fix = (lat, lon, accuracy) => ({ coords: { latitude: lat, longitude: lon, accuracy } });
  it('converts a fine mid-cell fix to its JIS cell and nothing else', () => {
    assert.deepStrictEqual(fd.locateCell(fix(26.2125, 127.6809, 30)), { ok: true, row: 314, col: 1021, key: '314:1021' });
  });
  it('rejects a fix whose accuracy radius could span more than one cell', () => {
    assert.strictEqual(fd.locateCell(fix(26.25, 127.681, 30)).reason, 'inaccurate'); // exactly on a row edge
    assert.strictEqual(fd.locateCell(fix(26.2125, 127.6809, 20000)).reason, 'inaccurate');
    assert.strictEqual(fd.locateCell(fix(26.2125, 127.6809, 20000)).ok, false);
  });
  it('rejects fixes outside the envelope and non-numeric input', () => {
    assert.strictEqual(fd.locateCell(fix(10, 130, 5)).reason, 'outside');
    assert.strictEqual(fd.locateCell(fix(30, 200, 5)).reason, 'outside');
    assert.strictEqual(fd.locateCell(fix(NaN, 130, 5)).reason, 'invalid');
    assert.strictEqual(fd.locateCell(null).reason, 'invalid');
  });
  it('runs one user-initiated fix, never a watch, and hands only the cell onward', () => {
    const calls = { got: 0, watch: 0 };
    const seen = [];
    const sink = { status: (kind, cell) => seen.push(['status', kind, cell]), highlight: (cell) => seen.push(['highlight', cell]) };
    const geo = {
      getCurrentPosition(ok) { calls.got++; ok(fix(26.2125, 127.6809, 30)); },
      watchPosition() { calls.watch++; }
    };
    fd.runLocate(geo, sink);
    assert.deepStrictEqual(calls, { got: 1, watch: 0 });
    assert.deepStrictEqual(seen[0], ['highlight', { row: 314, col: 1021, key: '314:1021' }]);
    assert.strictEqual(seen[1][1], 'located');
    assert.ok(!('latitude' in (seen[1][2] || {})), 'the raw fix never leaves locateCell');
  });
  it('maps denial, timeout, unavailability and unsupported browsers to statuses', () => {
    const run = (geo) => {
      const seen = [];
      fd.runLocate(geo, { status: (k) => seen.push(k), highlight: () => seen.push('highlight') });
      return seen;
    };
    const deny = { getCurrentPosition(ok, fail) { fail({ code: 1 }); }, watchPosition() {} };
    const time = { getCurrentPosition(ok, fail) { fail({ code: 3 }); }, watchPosition() {} };
    const unav = { getCurrentPosition(ok, fail) { fail({ code: 2 }); }, watchPosition() {} };
    assert.deepStrictEqual(run(deny), ['denied']);
    assert.deepStrictEqual(run(time), ['timeout']);
    assert.deepStrictEqual(run(unav), ['unavailable']);
    assert.deepStrictEqual(run(null), ['unsupported']);
    assert.deepStrictEqual(run({}), ['unsupported']);
  });
  it('performs zero location-derived I/O (no fetch, storage, URL or analytics in the locate block)', () => {
    const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
    const start = src.indexOf('/* ---- locate (device-side');
    const end = src.indexOf('/* ---- end locate');
    assert.ok(start > 0 && end > start, 'locate block markers must exist');
    const block = src.slice(start, end);
    for (const banned of ['fetch(', 'localStorage', 'sessionStorage', 'history.', 'location.href', 'location.hash', 'location.replace', 'sendBeacon', 'XMLHttpRequest', 'document.cookie'])
      assert.ok(!block.includes(banned), `locate block must not contain ${banned}`);
  });
});

// shared v0 fixtures straight from the published (staging) files
function realIndex() { return require('../assets/data/shroomhunt/areas/index.json'); }
function realArea() { return require('../assets/data/shroomhunt/areas/okinawa-honto.json'); }

// Codex review fixes on #46.
describe('detail join decision survives the warm cache (P1)', () => {
  const { detailJoinOf } = require('../assets/js/fungi-dashboard.js');
  it('recomputes joins from the reader result, not a fabricated null snapshot', () => {
    assert.strictEqual(detailJoinOf({ ok: true, snapshot: 'aaa', data: {} }, 'aaa'), true);
    assert.strictEqual(detailJoinOf({ ok: true, snapshot: 'aaa', data: {} }, 'bbb'), false);
    // the old bug: a cache hit produced snapshot:null and this returned true for known-mismatched data
    assert.strictEqual(detailJoinOf({ ok: true, snapshot: 'bbb', data: {} }, 'aaa'), false);
    assert.strictEqual(detailJoinOf({ ok: true, snapshot: null, data: {} }, 'aaa'), true);   // v0 file
    assert.strictEqual(detailJoinOf({ ok: true, snapshot: 'aaa', data: {} }, null), true);    // index not yet known
  });
});

describe('map listeners are wired once per page (P2)', () => {
  it('setupMap guards listener wiring and the resize observer calls the current draw', () => {
    const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
    assert.ok(/if \(!setupMap\.wired\)/.test(src), 'listeners must attach behind a one-time guard');
    assert.ok(/ResizeObserver\(function \(\) \{ if \(map\.draw\) map\.draw\(\); \}\)/.test(src),
      'observer must call the current draw, never a stale closure');
  });
});

// Geography in the default view (PR #46 review: coast + labels, not search-only).
describe('reference geography renders in the default SVG view', () => {
  const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
  it('loads japan-outline.json at boot, not only on first search', () => {
    assert.ok(/loadBoot\(false\);\s*\n\s*ensureGeo\(\)/.test(src), 'boot must kick off the geography fetch');
  });
  it('draws the coast under the cells and place labels above them', () => {
    assert.ok(src.includes("'<path class=\"fd-map__coast\" d=\"' + coast"), 'coast path renders first');
    assert.ok(src.includes("loc + labels"), 'labels render last, above the cells');
  });
  it('drops the idle dashed island boxes once a coast is present', () => {
    assert.ok(src.includes('if (geo.ref && !on) return;'), 'selected islands keep their outline, idle boxes yield to the coast');
  });
});

describe('street fills stay transparent over tiles (PR #46 review)', () => {
  it('cell fills are semi-transparent so tile labels stay legible', () => {
    const src = readFileSync(new URL('../assets/js/fungi-field-map.js', import.meta.url), 'utf8');
    const m = /fillOpacity:\s*([0-9.]+)/.exec(src);
    assert.ok(m, 'fills carry an explicit fillOpacity');
    assert.ok(+m[1] > 0.4 && +m[1] < 0.85, `fillOpacity ${m[1]} must let tiles read through`);
  });
});
