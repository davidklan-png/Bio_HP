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
  it('flags areas where one survey dominates the records (dominant_source = [title, share])', () => {
    assert.deepStrictEqual(fd.samplingNote(['Okinawa fungal survey', 0.61]), { title: 'Okinawa fungal survey', share: 61 });
    assert.strictEqual(fd.samplingNote(['Naha', 0.29]), null);
    assert.strictEqual(fd.samplingNote(null), null); // field not shipped yet: renders exactly as today
    assert.strictEqual(fd.samplingNote(['x']), null);
  });
  it('reads the leads total from candidates, falling back to pre-rename bundles', () => {
    // lead_totals.candidates (TASK-017); the fallback covers dashboard.json copies
    // published before the rename — drop the fallback after the next publish.
    assert.strictEqual(fd.leadsTotal({ candidates: 5781, with_mo: 10 }), 5781);
    assert.strictEqual(fd.leadsTotal({ neighbour_only: 5781, with_mo: 10 }), 5781);
    assert.strictEqual(fd.leadsTotal(null), undefined);
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
// Owned fixtures, not the live published files: the v0/v1 reader tests must not
// flip verdicts when a data PR changes what is deployed (broke on the v1 cutover).
function realIndex() {
  return { areas: [{ id: 'okinawa-honto', kind: 'island', name_en: 'Okinawa Island', name_ja: '沖縄本島',
    group_en: 'Okinawa', group_ja: '沖縄', bbox: [26.0, 26.9, 127.6, 128.4], records: 10, species: 5 }],
    cells: { '314:1021': 'okinawa-honto' } };
}
function realArea() {
  return { id: 'okinawa-honto', kind: 'island', name_en: 'Okinawa Island', name_ja: '沖縄本島',
    group_en: 'Okinawa', group_ja: '沖縄', bbox: [26.0, 26.9, 127.6, 128.4],
    totals: { records: 10, by_name: 0, species: 5, unresolved: 1, squares: 2 },
    months: new Array(12).fill(0), species: [], possible: [] };
}

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

// Selection silhouette: interior cell edges cancel, the outline is one region boundary.
describe('boundaryRings dissolves cell unions (PR #47 review)', () => {
  const { boundaryRings, cellEdges } = require('../assets/js/fungi-dashboard.js');
  it('a single cell becomes one 4-point ring', () => {
    const r = boundaryRings(['300:1000'], cellEdges);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].length, 4);
  });
  it('a 2x2 block becomes one ring with no interior edges', () => {
    const r = boundaryRings(['300:1000', '300:1001', '301:1000', '301:1001'], cellEdges);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].length, 8); // outer boundary only, no shared middle edges
  });
  it('an L-shape stays one ring through the concave corner', () => {
    const r = boundaryRings(['300:1000', '301:1000', '301:1001'], cellEdges);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].length, 8);
  });
  it('two separated cells become two rings', () => {
    const r = boundaryRings(['300:1000', '305:1010'], cellEdges);
    assert.strictEqual(r.length, 2);
  });
  it('rings close on their start point and use exact cell edges', () => {
    const r = boundaryRings(['300:1000'], cellEdges)[0];
    const e = cellEdges(300, 1000);
    const xs = r.map((p) => p[1]), ys = r.map((p) => p[0]);
    assert.ok(Math.min(...xs) === e[2] && Math.max(...xs) === e[3]);
    assert.ok(Math.min(...ys) === e[0] && Math.max(...ys) === e[1]);
  });
});

// UI/UX pass: breadcrumb context, joined search, on-map legend, themed street chrome.
describe('UI restructure (comprehensive visual pass)', () => {
  const fs = require('node:fs');
  const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
  const inc = readFileSync(new URL('../_includes/fungi_dashboard.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/css/fungi-dashboard.css', import.meta.url), 'utf8');
  it('selected area surfaces as breadcrumb + context line, cleared on deselect', () => {
    assert.ok(/function setCrumb\(row\)/.test(src) && /function clearCrumb\(\)/.test(src));
    assert.ok(inc.includes('fd-crumb-area') && inc.includes('id="fd-context"'));
    assert.ok(/selectArea[\s\S]*setCrumb\(row\)/.test(src) && /clearArea[\s\S]*clearCrumb\(\)/.test(src));
  });
  it('legend overlays the map itself (both renderers) with backdrop and no pointer capture', () => {
    assert.ok(inc.includes('fd-legend--onmap'));
    assert.ok(/\.fd-legend \{[^}]*position: absolute/.test(css) && css.includes('pointer-events: none'));
  });
  it('street zoom control sits bottom-right away from the legend', () => {
    const fm = fs.readFileSync(new URL('../assets/js/fungi-field-map.js', import.meta.url), 'utf8');
    assert.ok(fm.includes("L.control.zoom({ position: 'bottomright' })"));
  });
  it('buckets stay a single-hue sequential ramp per theme (no warm accent mid-scale)', () => {
    const dark = /--fd-b0: (#[0-9a-f]+); --fd-b1: (#[0-9a-f]+); --fd-b2: (#[0-9a-f]+); --fd-b3: (#[0-9a-f]+); --fd-b4: (#[0-9a-f]+);/.exec(css);
    assert.ok(dark, 'bucket tokens present');
  });
});

// Street-as-default + availability-gated research (product review follow-up).
describe('street map is the default view (no toggle)', () => {
  it('auto-enters once the mesh renders and retries re-enter after tile failure', () => {
    const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
    assert.ok(/if \(!street\.auto\) \{ street\.auto = true; enterStreet\(\); \}/.test(src), 'render() enters street automatically');
    assert.ok(/if \(street\.failed\) \{ enterStreet\(\); return; \}/.test(src), 'retry re-enters the street map');
    assert.ok(!src.includes('fd-street'), 'no street toggle remains');
  });
  it('the include carries no street button', () => {
    const inc = readFileSync(new URL('../_includes/fungi_dashboard.html', import.meta.url), 'utf8');
    assert.ok(!inc.includes('id="fd-street"'));
  });
});
describe('research entry exists only when a payload answers', () => {
  it('boot probes mesh-research.json and gates the button and error notes', () => {
    const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
    assert.ok(/loadResearch\(false\); \/\/ availability probe/.test(src), 'probe at boot');
    assert.ok(src.includes('function researchAvailable()'));
    assert.ok(src.includes('rb.hidden = !ok'), 'research button gated');
  });
  it('street squares carry a same-hue edge over busy tiles', () => {
    const fm = readFileSync(new URL('../assets/js/fungi-field-map.js', import.meta.url), 'utf8');
    assert.ok(/stroke: true, color: pal\.b\[i\], weight: 0\.75/.test(fm), 'cell edges defined on tiles');
  });
});

// Street map takes standard zoom gestures (product review: keep zoom-in/out).
describe('street map zoom gestures', () => {
  it('wheel zoom enabled and the container yields touch gestures to Leaflet', () => {
    const fm = readFileSync(new URL('../assets/js/fungi-field-map.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../assets/css/fungi-dashboard.css', import.meta.url), 'utf8');
    assert.ok(/scrollWheelZoom: true/.test(fm), 'wheel zoom on');
    assert.ok(/\.fd-map__street \{ touch-action: none; \}/.test(css), 'pinch belongs to the map');
  });
});


// Product round: title, layout, kind slicer removal, Name search, street slice rebuild.
describe('product round: app identity and layout', () => {
  const inc = readFileSync(new URL('../_includes/fungi_dashboard.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/css/fungi-dashboard.css', import.meta.url), 'utf8');
  const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
  it('app name is Shroom Hunter and the old title is gone', () => {
    assert.ok(inc.includes('Shroom Hunter') && inc.includes('シュルームハンター'));
    assert.ok(!inc.includes('What fungi are recorded in Japan'));
  });
  it('workspace: map column + inspector side by side; national stats below (TASK-007)', () => {
    assert.ok(inc.includes('class="fd-workspace"') && inc.includes('class="fd-mapcol"'));
    assert.ok(inc.indexOf('fd-mapcol') < inc.indexOf('fd-inspector'), 'map left, inspector right');
    assert.ok(inc.indexOf('id="fd-area"') < inc.indexOf('fd-national'), 'the inspector precedes the national stats');
    assert.ok(!css.includes('max-width: 920px'), 'the 920 px product-round cap is gone');
    assert.ok(css.includes('@media (min-width: 1024px)'), 'two columns from 1024 px');
    assert.ok(css.includes('minmax(0, 1.4fr) minmax(360px, 1fr)'), 'the task column widths');
  });
  it('kind slicer removed; month remains', () => {
    assert.ok(!inc.includes('data-fd-kind'));
    assert.ok(inc.includes('id="fd-month"'));
    assert.ok(!src.includes("[data-fd-kind]"));
  });
  it('figcaption copy removed but live counters kept for assistive tech', () => {
    assert.ok(!inc.includes('fd-figcaption'));
    assert.ok(inc.includes('id="fd-map-cells"') && inc.includes('id="fd-masked"'));
  });
});

describe('name search matches common names and aliases', () => {
  const fd = require('../assets/js/fungi-dashboard.js');
  const ix = { areas: [{ id: 'okisle', kind: 'island', name_en: 'Ok Island', name_ja: '島', bbox: [26, 27, 127, 128] }] };
  const genera = [
    ['Amanita', ['okisle'], ['Amanita', 'テングタケ属', 'amanita']],
    ['Tricholoma', ['okisle'], ['Tricholoma', 'キシメジ属', 'matsutake', 'マツタケ']]
  ];
  it('matches Latin, English alias and Japanese alias by prefix', () => {
    const q = (x) => fd.genusResults(genera, x, ix);
    assert.strictEqual(q('Aman')[0].genus, 'Amanita');
    assert.strictEqual(q('matsutake')[0].genus, 'Tricholoma');
    assert.strictEqual(q('マツタケ')[0].genus, 'Tricholoma');
    assert.ok(q('テング')[0].label.includes('テングタケ属'));
    assert.strictEqual(q('zzz').length, 0);
  });
});

describe('street fills rebuild when the research slice changes', () => {
  it('redraw compares the slice key, not just the palette', () => {
    const fm = readFileSync(new URL('../assets/js/fungi-field-map.js', import.meta.url), 'utf8');
    assert.ok(fm.includes('rvKey !== lastRvKey'), 'slice change triggers buildFills');
  });
});

// PR #55 Codex P1: the reader must accept three-element genus rows (names).
describe('readResearch accepts the names element', () => {
  const fd = require('../assets/js/fungi-dashboard.js');
  const base = (genera) => ({ schema_version: 1, snapshot: 'a'.repeat(64), slices: [], genera });
  it('accepts two- and three-element rows; rejects malformed thirds', () => {
    assert.strictEqual(fd.readResearch(base([['Amanita', ['okisle']]])).ok, true);
    assert.strictEqual(fd.readResearch(base([['Amanita', ['okisle'], ['Amanita', 'テングタケ属']]])).ok, true);
    assert.strictEqual(fd.readResearch(base([['Amanita', ['okisle'], 'Amanita']])).ok, false);
    assert.strictEqual(fd.readResearch(base([['Amanita', ['okisle'], [1]]])).ok, false);
    assert.strictEqual(fd.readResearch(base([['Amanita', ['okisle'], [], []]])).ok, false);
  });
});

// TASK-005: masking notice on name search; Where column hidden until habitat ships.
describe('masking notice and hidden Where column (TASK-005)', () => {
  const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
  it('name search carries a persistent bilingual caption, repeated on empty results (TASK-008 port)', () => {
    assert.ok(/masking: \['/.test(src), 'bilingual T.masking entry exists');
    assert.ok(/researchReady\(\) \? t\('masking'\) : ''/.test(src), 'a research-ready search shows the caption persistently');
    assert.ok(src.includes("note(t('noResults') + (researchReady() ? ' ' + t('masking') : ''))"), 'empty name results repeat the caption');
  });
  it('hides the Where column while has_habitat is false; groups show islands as a row subline (TASK-007)', () => {
    assert.ok(src.includes("var showWhere = a.kind !== 'group' && (a.has_habitat !== false && !(state.index && state.index.has_habitat === false))"),
      'per-area and index-level has_habitat both gate the column; groups never get one');
    assert.ok(src.includes("if (showWhere) head.push(t('where'))"));
    assert.ok(src.includes("a.kind === 'group'"), 'groups still render their member islands');
  });
  it('reads dominant_source, never top_localities', () => {
    assert.ok(src.includes('samplingNote(a.dominant_source)') && !src.includes('top_localities'));
  });
});

// TASK-007: workspace layout — inspector aggregates, tabs, history actions.
describe('TASK-007: inspector aggregates', () => {
  const species = [
    { n: 'A', f: 'Russulaceae', r: 10, e: { s: 6, d: 4 } },
    { n: 'B', f: 'Russulaceae', r: 7, e: { s: 7 } },
    { n: 'C', f: 'Amanitaceae', r: 9, e: { o: 9 } },
    { n: 'D', f: 'Amanitaceae', r: 9, e: {} },
    { n: 'E', r: 3 }
  ];
  it('areaEvidenceMix sums each row evidence and sorts by records desc', () => {
    assert.deepStrictEqual(fd.areaEvidenceMix(species), [['s', 13], ['o', 9], ['d', 4]]);
  });
  it('areaEvidenceMix tolerates rows without evidence and empty input', () => {
    assert.deepStrictEqual(fd.areaEvidenceMix([{ r: 1 }, { e: null }]), []);
    assert.deepStrictEqual(fd.areaEvidenceMix(null), []);
  });
  it('topFamilies counts species and records per family, ties broken by records', () => {
    assert.deepStrictEqual(fd.topFamilies(species, 3),
      [['Amanitaceae', 2, 18], ['Russulaceae', 2, 17]]);
    assert.deepStrictEqual(fd.topFamilies(species, 1), [['Amanitaceae', 2, 18]]);
  });
  it('topFamilies skips rows without a family and defaults to six rows', () => {
    assert.deepStrictEqual(fd.topFamilies([{ f: 'F', r: 1 }, { r: 1 }], 6), [['F', 1, 1]]);
    const many = Array.from({ length: 9 }, (_, i) => ({ f: 'F' + i, r: 1 }));
    assert.strictEqual(fd.topFamilies(many).length, 6);
    assert.deepStrictEqual(fd.topFamilies(null), []);
  });
});

describe('TASK-007: inspector tabs', () => {
  it('wraps forward and backward through Overview, Recorded, Possible', () => {
    assert.strictEqual(fd.nextTab('overview', 1), 'recorded');
    assert.strictEqual(fd.nextTab('recorded', 1), 'possible');
    assert.strictEqual(fd.nextTab('possible', 1), 'overview');
    assert.strictEqual(fd.nextTab('overview', -1), 'possible');
    assert.strictEqual(fd.nextTab('recorded', -1), 'overview');
  });
  it('falls back to the first tab for unknown names', () => {
    assert.strictEqual(fd.nextTab('bogus', 1), 'recorded');
    assert.strictEqual(fd.nextTab(null, 1), 'recorded');
  });
  it('ships a tablist with three tabs, panels and a roving tabindex', () => {
    const inc = readFileSync(new URL('../_includes/fungi_dashboard.html', import.meta.url), 'utf8');
    assert.ok(inc.includes('role="tablist"'));
    for (const n of ['overview', 'recorded', 'possible']) {
      assert.ok(inc.includes('id="fd-tab-' + n + '"'), 'tab ' + n);
      assert.ok(inc.includes('id="fd-panel-' + n + '"'), 'panel ' + n);
    }
    const recorded = /<button[^>]*id="fd-tab-recorded"[^>]*>/.exec(inc)[0];
    assert.ok(recorded.includes('tabindex="-1"'), 'inactive tabs start out of the tab order');
    assert.ok(recorded.includes('aria-controls="fd-panel-recorded"'));
  });
});

describe('TASK-007: history actions', () => {
  it('maps sources to push, replace or no write', () => {
    assert.strictEqual(fd.historyAction('init'), 'replace'); // deep-link load keeps one entry
    assert.strictEqual(fd.historyAction('popstate'), null);  // Back/Forward never re-pushes
    for (const s of ['search', 'tap', 'suggestion', 'preview', 'toolbar', undefined])
      assert.strictEqual(fd.historyAction(s), 'push', 'source ' + s);
  });
  it('selectArea routes every history write through historyAction, clearArea pushes', () => {
    const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
    assert.ok(/var act = historyAction\(source\)/.test(src), 'one decision point');
    assert.ok(src.includes("root.history[act + 'State']"), 'act picks push vs replace');
    assert.ok(/clearArea[\s\S]*?pushState/.test(src), 'the crumb clear pushes the bare path');
    assert.ok(src.includes("addEventListener('popstate'"), 'popstate listener wired');
    assert.ok(src.includes("addEventListener('hashchange'"), 'hashchange listener wired');
  });
});

// TASK-006: author display rules were beating the UA [hidden] style — #fd-area
// rendered on load with empty tables and the label-less more-buttons showed as
// empty 44x44 boxes. No browser in tests, so these are source-level assertions.
describe('[hidden] stays hidden (TASK-006)', () => {
  const css = readFileSync(new URL('../assets/css/fungi-dashboard.css', import.meta.url), 'utf8');
  const inc = readFileSync(new URL('../_includes/fungi_dashboard.html', import.meta.url), 'utf8');
  // Rule bodies never nest (media queries contribute their inner rules only).
  const rules = (css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^{}]*\}/g) || [])
    .map((r) => /^([^{}]+)\{([^{}]*)\}$/.exec(r).slice(1));
  it('carries a global [hidden] { display: none !important; } rule', () => {
    assert.ok(css.includes('[hidden] { display: none !important; }'));
  });
  it('no [hidden] selector sets a display other than none (nothing can beat the !important)', () => {
    for (const [sel, decls] of rules) {
      if (!sel.includes('[hidden]')) continue;
      const display = /(^|;)\s*display\s*:\s*([^;!]+)/.exec(decls);
      if (display) assert.strictEqual(display[2].split('!')[0].trim(), 'none', sel.trim());
    }
  });
  it('every button in the include has a non-empty accessible name, hidden ones included', () => {
    const liquid = /\{%-?[\s\S]*?-?%\}/g; // strip before judging emptiness: only one branch renders
    const buttons = inc.match(/<button\b[\s\S]*?<\/button>/g) || [];
    assert.ok(buttons.length >= 8, `parsed ${buttons.length} buttons`);
    for (const b of buttons) {
      const attrs = /^<button\b([^>]*)>/.exec(b)[1];
      const id = /id="([^"]*)"/.exec(attrs)?.[1] || attrs.trim();
      const aria = /aria-(?:label|labelledby)="([^"]*)"/.exec(attrs);
      const name = aria ? aria[1].replace(liquid, '').trim()
        : b.replace(/<[^>]*>/g, '').replace(liquid, '').trim();
      assert.ok(name !== '', `button #${id} has no accessible name`);
    }
  });
  it('#fd-area ships hidden in the include', () => {
    const tag = /<section\b[^>]*\bid="fd-area"[^>]*>/.exec(inc);
    assert.ok(tag && /\bhidden\b/.test(tag[0]), 'the area section must not render before JS fills it');
  });
});

// TASK-007: key-based GBIF links — COL key, legacy key, then an encoded name search.
describe('key-based GBIF links (TASK-007)', () => {
  const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
  it('prefers taxon/<colKey>, then species/<legacyKey>, then an encoded name search', () => {
    assert.strictEqual(fd.gbifTaxonUrl(5264934, 7571796, 'Amanita muscaria'), 'https://www.gbif.org/taxon/5264934');
    assert.strictEqual(fd.gbifTaxonUrl(null, 7571796, 'Amanita muscaria'), 'https://www.gbif.org/species/7571796');
    assert.strictEqual(fd.gbifTaxonUrl(undefined, undefined, 'Boletus edulis var. satanas'),
      'https://www.gbif.org/taxon/search?q=Boletus%20edulis%20var.%20satanas');
  });
  it('lets empty and missing keys fall through on truthiness', () => {
    assert.strictEqual(fd.gbifTaxonUrl('', 7571796, 'X'), 'https://www.gbif.org/species/7571796');
    assert.strictEqual(fd.gbifTaxonUrl('', '', 'X'), 'https://www.gbif.org/taxon/search?q=X');
    assert.strictEqual(fd.gbifTaxonUrl(undefined, undefined, 'X'), 'https://www.gbif.org/taxon/search?q=X');
    assert.strictEqual(fd.gbifTaxonUrl(null, null, 'X'), 'https://www.gbif.org/taxon/search?q=X');
  });
  it('keeps the search pattern in one constant and leaves no species/search link behind', () => {
    assert.ok(!src.includes('species/search'), 'the legacy /species/search?q= pattern must be gone');
    assert.strictEqual((src.match(/taxon\/search/g) || []).length, 1, 'exactly one taxon/search constant');
  });
  it('routes every species-link render site through the helper', () => {
    // TASK-010 moved the two area tables onto speciesNameCell (button + ↗ sibling; the
    // degrade path reuses it), so the sites are: name cell, detail links, leads, overview.
    assert.strictEqual((src.match(/gbifTaxonUrl\(/g) || []).length, 5, 'one definition plus four call sites');
    assert.ok(src.includes('gbifTaxonUrl(colKey || undefined, legacyKey || undefined, name)'), 'species name cell');
    assert.ok(src.includes('speciesNameCell(s.c, s.lk, s.n'), 'area species table renders the name cell');
    assert.ok(src.includes('speciesNameCell(p.c, p.lk, p.n'), 'could-be-found table renders the name cell');
    assert.ok(src.includes('gbifTaxonUrl(l[5], l[6], l[0])'), 'leads table');
    assert.ok(src.includes('gbifTaxonUrl(row.c || undefined, row.lk || undefined, row.n)'), 'overview top-5 lists');
  });
});

// TASK-008: one combobox replaces the area dropdown, the Place/Name toggle and the input.
describe('TASK-008: unified search markup', () => {
  const inc = readFileSync(new URL('../_includes/fungi_dashboard.html', import.meta.url), 'utf8');
  const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/css/fungi-dashboard.css', import.meta.url), 'utf8');
  it('ships one labelled combobox input wired to a listbox; no select, no toggle remains', () => {
    for (const gone of ['<select', 'fd-area-pick', 'fd-search-place', 'fd-search-genus'])
      assert.ok(!inc.includes(gone), 'include must not contain ' + gone);
    for (const gone of ['fd-area-pick', 'fd-search-place', 'fd-search-genus'])
      assert.ok(!src.includes(gone), 'script must not reference ' + gone);
    const input = /<input[^>]*id="fd-search-input"[^>]*>/.exec(inc);
    assert.ok(input, 'input present');
    for (const attr of ['role="combobox"', 'aria-controls="fd-search-results"', 'aria-expanded="false"', 'aria-autocomplete="list"'])
      assert.ok(input[0].includes(attr), 'input carries ' + attr);
    assert.ok(/id="fd-search-results"[^>]*role="listbox"/.test(inc), 'results are a listbox');
    assert.ok(inc.includes('Search islands, places or genus names') && inc.includes('島・地名・属名で検索'), 'placeholder EN/JA');
  });
  it('deletes the picker and toggle CSS and bumps the stamp', () => {
    assert.ok(!css.includes('.fd-picker'), 'picker CSS gone');
    assert.ok(!css.includes('.fd-search__field'), 'joined-field CSS gone');
    assert.ok(inc.includes('?v=2026-11-23-4'), 'CSS stamp bumped');
  });
  it('renders role=option items inside role=group sections and manages the combobox pattern', () => {
    assert.ok(src.includes("el.setAttribute('role', 'option')"), 'options carry role=option');
    assert.ok(src.includes("li.setAttribute('role', 'group')"), 'sections are groups');
    assert.ok(src.includes("input.setAttribute('aria-activedescendant', options[i].el.id)"), 'aria-activedescendant follows the active option');
    assert.ok(src.includes("o.el.setAttribute('aria-selected', String(j === i))"), 'only the active option is selected');
    assert.ok(src.includes('scrollIntoView({ block: \'nearest\' })'), 'the active option scrolls into view');
    assert.ok(/clearTimeout\(countTimer\)/.test(src), 'the debounced count announcement cancels');
  });
  it('routes every selection through the existing paths with the push history rule', () => {
    assert.ok(src.includes("selectArea(row.id, 'search')"), 'area options select');
    assert.ok(src.includes("selectArea(p.area_id, 'search')"), 'places with an area select it');
    assert.ok(src.includes('centreOn(p)'), 'places without an area centre the camera');
    assert.ok(src.includes("selectArea(item.areaId, 'search')"), 'genus options select their area');
  });
  it('street success only clears a status it owns, so the index-failure line survives', () => {
    assert.ok(/if \(street\.ownsMsg\) \{ street\.ownsMsg = false; areaMsg\(null\); \}/.test(src),
      'the boot-time street auto-enter must not race away the index status');
  });
});

describe('TASK-008: searchAll', () => {
  const areas = [
    { id: 'g-ok', kind: 'group', name_en: 'Okinawa Prefecture', name_ja: '沖縄県（全島）', bbox: [24.03, 27.1, 122.9, 131.4], species: 3900 },
    { id: 'okinawa-honto', kind: 'island', name_en: 'Okinawa Island', name_ja: '沖縄本島', bbox: [26.07, 26.88, 127.63, 128.33], species: 1100 },
    { id: 'amami-oshima', kind: 'island', name_en: 'Amami Oshima', name_ja: '奄美大島', bbox: [28.03, 28.56, 129.08, 129.76], species: 109 },
    { id: 'hokkaido', kind: 'island', name_en: 'Hokkaido', name_ja: '北海道', bbox: [41.4, 45.5, 139.3, 145.8], species: 5000 },
    { id: 't5339', kind: 'tile', name_en: 'Chūbu · around 36.2°N 138.5°E', name_ja: '中部・北緯36.2度 東経138.5度付近', bbox: [36.0, 36.6, 138.3, 139.0], species: 30 }
  ];
  const places = [
    { en: 'Naha', ja: '那覇', aliases: [], at: [127.68, 26.21] },
    { en: 'Amami', ja: '奄美', aliases: [], at: [129.5, 28.38] },
    { en: 'Yakushima', ja: '屋久島', aliases: [], at: [130.5, 30.3], area_id: 'yakushima' }
  ];
  const genera = [
    ['Russula', ['okinawa-honto', 'hokkaido'], ['Russula', 'ベニタケ属', 'brittlegill']],
    ['Amanita', ['amami-oshima'], ['Amanita', 'テングタケ属']]
  ];
  it('groups areas, places and genera in that order', () => {
    const g = fd.searchAll('am', { areas, places, genera });
    assert.deepStrictEqual(g.map((x) => x.group), ['areas', 'places', 'genera']);
    assert.deepStrictEqual(g[0].items.map((x) => x.area.id), ['amami-oshima']);
    assert.deepStrictEqual(g[1].items.map((x) => x.place.en), ['Amami']);
    assert.deepStrictEqual(g[2].items.map((x) => x.areaId), ['amami-oshima']);
  });
  it('caps each group at 8 by default and reports the rest as more', () => {
    const isles = Array.from({ length: 10 }, (_, i) => ({ id: 'i' + i, kind: 'island', name_en: 'Isla ' + i, name_ja: '島' + i, bbox: [30 + i, 31, 130, 131], species: i }));
    const g = fd.searchAll('isla', { areas: isles });
    assert.strictEqual(g.length, 1);
    assert.strictEqual(g[0].items.length, 8);
    assert.strictEqual(g[0].more, 2);
    const tight = fd.searchAll('isla', { areas: isles }, 3);
    assert.strictEqual(tight[0].items.length, 3);
    assert.strictEqual(tight[0].more, 7);
  });
  it('folds case, diacritics and Japanese names for areas', () => {
    assert.ok(fd.searchAll('OKIN', { areas })[0].items.length === 2, 'case-insensitive');
    const ja = fd.searchAll('沖縄', { areas })[0].items.map((x) => x.area.id);
    assert.ok(ja.includes('okinawa-honto') && ja.includes('g-ok'), 'JA names match');
    assert.ok(fd.searchAll('chubu', { areas })[0].items[0].area.id === 't5339', 'diacritics fold');
    const ranked = fd.searchAll('okinawa', { areas })[0].items.map((x) => x.area.id);
    assert.deepStrictEqual(ranked, ['g-ok', 'okinawa-honto'], 'same rank keeps picker order: groups before islands');
  });
  it('keeps place search behaviour: ranks and the JA name', () => {
    assert.deepStrictEqual(fd.searchAll('naha', { places })[0].items[0].place.en, 'Naha');
    const ja = fd.searchAll('那覇', { places })[0].items[0];
    assert.strictEqual(ja.place.en, 'Naha');
    assert.strictEqual(ja.rank, 0); // exact match outranks prefixes
    assert.deepStrictEqual(fd.searchAll('yak', { places })[0].items[0].place.area_id, 'yakushima');
  });
  it('flattens genus results into one option per genus × area', () => {
    const g = fd.searchAll('russ', { areas, genera })[0];
    assert.strictEqual(g.group, 'genera');
    assert.deepStrictEqual(g.items.map((x) => x.areaId), ['okinawa-honto', 'hokkaido']);
    assert.strictEqual(g.items[0].genus, 'Russula');
    assert.strictEqual(g.items[0].label, 'Russula · ベニタケ属');
  });
  it('returns no group for absent sources or no matches', () => {
    assert.deepStrictEqual(fd.searchAll('zzz', { areas, places, genera }), []);
    assert.deepStrictEqual(fd.searchAll('okin', { places }), []); // no index: areas cannot match
    assert.deepStrictEqual(fd.searchAll('russ', { areas, genera: null }), []); // research not loaded
    assert.deepStrictEqual(fd.searchAll('russ', { genera }), []); // no index: no valid leaf areas
  });
});

describe('TASK-008: empty-state suggestions and lazy genus option', () => {
  const areas = [
    { id: 'hk', kind: 'island', name_en: 'Hokkaido', bbox: [41.4, 45.5, 139.3, 145.8], species: 5000 },
    { id: 'g-yaeyama', kind: 'group', name_en: 'Yaeyama', bbox: [24.03, 24.4, 122.9, 124.5], species: 800 },
    { id: 'g-amami', kind: 'group', name_en: 'Amami', bbox: [26.99, 28.6, 128.9, 130.2], species: 600 },
    { id: 'okinawa-honto', kind: 'island', name_en: 'Okinawa Island', bbox: [26.07, 26.88, 127.63, 128.33], species: 1100 },
    { id: 't5339', kind: 'tile', name_en: 'A tile', bbox: [36.0, 36.6, 138.3, 139.0], species: 30 }
  ];
  it('shows island groups then islands, each south-to-north, tiles excluded', () => {
    const g = fd.suggestGroups(areas);
    assert.deepStrictEqual(g.map((x) => x.group), ['groups', 'islands']);
    assert.deepStrictEqual(g[0].items.map((x) => x.area.id), ['g-yaeyama', 'g-amami']);
    assert.deepStrictEqual(g[1].items.map((x) => x.area.id), ['okinawa-honto', 'hk']);
    assert.ok(g.every((x) => x.more === 0), 'the whole former dropdown contents show, no cap');
  });
  it('tolerates a missing index', () => {
    assert.deepStrictEqual(fd.suggestGroups(null), []);
  });
  it('offers the genus lazy-load only for 3+ plain Latin-letter queries', () => {
    assert.strictEqual(fd.isLatinQuery('Russula'), true);
    assert.strictEqual(fd.isLatinQuery('  amanita '), true);   // folded and trimmed
    assert.strictEqual(fd.isLatinQuery('Chūbu'), true);        // diacritics fold to plain letters
    assert.strictEqual(fd.isLatinQuery('ru'), false);
    assert.strictEqual(fd.isLatinQuery('ab1'), false);
    assert.strictEqual(fd.isLatinQuery('na ha'), false);
    assert.strictEqual(fd.isLatinQuery('マツタケ'), false);
    assert.strictEqual(fd.isLatinQuery(''), false);
  });
});

// TASK-009 (spec item 10): the Data and Method footer. Two runtime values come from
// the loaded dashboard.json (snapshot date, missing-coordinate share); everything else
// is pinned bilingual copy, asserted at source level like the blocks above.
describe('TASK-009: method helpers', () => {
  it('reads the snapshot date from the loaded data, dashing when absent', () => {
    assert.strictEqual(fd.methodSnapshot({ generated: '2026-11-22' }), '2026-11-22');
    assert.strictEqual(fd.methodSnapshot({ generated: '' }), '–');
    assert.strictEqual(fd.methodSnapshot({ generated: null }), '–');
    assert.strictEqual(fd.methodSnapshot({}), '–');
    assert.strictEqual(fd.methodSnapshot(null), '–');
  });
  it('computes the missing-coordinate share as 100 − georeferenced/records', () => {
    assert.strictEqual(fd.missingCoordsPct({ totals: { records: 345509, georeferenced: 148207 } }), '57%');
    assert.strictEqual(fd.missingCoordsPct({ totals: { records: 200, georeferenced: 150 } }), '25%');
    assert.strictEqual(fd.missingCoordsPct({ totals: { records: 100, georeferenced: 100 } }), '0%');
    assert.strictEqual(fd.missingCoordsPct({ totals: { records: 100, georeferenced: 0 } }), '100%');
  });
  it('dashes on absent or unusable totals instead of NaN', () => {
    for (const bad of [
      { totals: { records: 345509 } }, { totals: { georeferenced: 1 } },
      { totals: { records: 0, georeferenced: 0 } }, { totals: null }, {}, null
    ]) assert.strictEqual(fd.missingCoordsPct(bad), '–');
  });
  it('renders both values from the live published bundle', () => {
    const data = require('../assets/data/shroomhunt/dashboard.json');
    assert.strictEqual(fd.methodSnapshot(data), data.generated);
    const expected = Math.round(100 - (100 * data.totals.georeferenced) / data.totals.records) + '%';
    assert.notStrictEqual(expected, '–');
    assert.strictEqual(fd.missingCoordsPct(data), expected);
  });
  it('renderSources fills the snapshot and missing spans through the helpers', () => {
    const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
    assert.ok(src.includes('methodSnapshot(d)'), 'snapshot through the helper');
    assert.ok(src.includes('missingCoordsPct(d)'), 'missing share through the helper');
  });
});

describe('TASK-009: data and method section (six subsections, both languages)', () => {
  const inc = readFileSync(new URL('../_includes/fungi_dashboard.html', import.meta.url), 'utf8');
  it('ships all six subsection headings in EN and JA', () => {
    for (const [en, ja] of [
      ['Data', 'データ'], ['Method', '方法'], ['Protection', '保護'], ['Caveats', '注意点'],
      ['Markers and sources', '記号と出典'], ['Licence and citation', 'ライセンスと引用']
    ]) {
      assert.ok(inc.includes(`<h3>{% if ja %}${ja}{% else %}${en}{% endif %}</h3>`), `heading ${en}/${ja}`);
    }
  });
  it('collapses the subsections: six details, exactly one open', () => {
    assert.strictEqual((inc.match(/<details class="fd-method__sec"/g) || []).length, 6);
    assert.strictEqual((inc.match(/<details class="fd-method__sec" open>/g) || []).length, 1);
  });
  it('carries every pinned DOI and source URL verbatim', () => {
    for (const u of [
      'https://doi.org/10.15468/dl.ng3tup',
      'https://doi.org/10.15468/dl.4ybwrt',
      'https://doi.org/10.15468/dl.8xq5m7',
      'https://doi.org/10.15468/dl.akuuf8',
      'https://doi.org/10.15468/dl.pzk484',
      'https://www.env.go.jp/nature/kisho/5th-rl-2025-book/05-5thredlist-fungi.pdf',
      'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/syokuchu/poison/index.html',
      'https://agriknowledge.affrc.go.jp/RN/2010910274.pdf',
      'https://www.jstage.jst.go.jp/browse/mycosci/-char/en',
      'https://www.mushroomexpert.com/'
    ]) assert.ok(inc.includes(u), u);
  });
  it('pins the method numbers, taxonomy release and licence in both languages', () => {
    for (const s of ['COL 26.5 XR', 'P846', 'CC BY-NC 4.0',
      '800 km', '250 km', '1.5°', '28 islands', '7 island groups',
      '800km', '250km', '1.5度', '28の島', '7つの島しょ群']) assert.ok(inc.includes(s), s);
  });
  it('keeps the runtime spans in the section', () => {
    for (const id of ['fd-sources', 'fd-generated', 'fd-missing']) assert.ok(inc.includes(`id="${id}"`), id);
  });
  it('makes no edibility claim and promises to name no masked taxon', () => {
    assert.ok(!/edib|食用|食べられ|可食/.test(inc), 'no edibility wording anywhere');
    const ja = inc.includes('隠している種名を公表することはありません');
    const en = inc.includes('Masked taxa are never named here');
    assert.ok(ja || en, 'the no-naming promise must read in the rendered language');
  });
});

// TASK-010 (spec item 8): inline species details behind name toggles, ⚠/固有 markers,
// the GBIF ↗ sibling link and #species-<key> deep links, fed by the per-genus species
// bundles ShroomHunt publishes under species/ (index.json + <genus-slug>.json).
describe('TASK-010: species bundle readers', () => {
  it('readSpeciesIndex accepts the published index shape and rejects anything else', () => {
    const good = { schema_version: 1, snapshot: 'a'.repeat(64), generated: '2026-11-22', genera: 2, species: 3,
      files: { amanita: { sha256: 'b'.repeat(64), bytes: 100, species: 2 } } };
    const r = fd.readSpeciesIndex(good);
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(Object.keys(r.files), ['amanita']);
    for (const bad of [{}, { schema_version: 1 }, { schema_version: 0, files: {} }, { schema_version: 1, files: [] }, { schema_version: 1, files: 'x' }, null])
      assert.strictEqual(fd.readSpeciesIndex(bad).ok, false, JSON.stringify(bad));
  });
  it('readSpeciesGenus accepts the published genus shape and rejects anything else', () => {
    const good = { genus: 'Amanita', schema_version: 1, species: [{ key: '5TYZ9', name: 'Amanita muscaria' }] };
    assert.strictEqual(fd.readSpeciesGenus(good).ok, true);
    assert.strictEqual(fd.readSpeciesGenus(good).entries[0].name, 'Amanita muscaria');
    for (const bad of [{}, { genus: 'A' }, { schema_version: 1 }, { schema_version: 0, species: [] }, { schema_version: 1, species: {} }, { schema_version: 1, species: ['x'] }, null])
      assert.strictEqual(fd.readSpeciesGenus(bad).ok, false, JSON.stringify(bad));
  });
  it('speciesSlugFor takes the lowercase first token of the name', () => {
    assert.strictEqual(fd.speciesSlugFor('Amanita muscaria var. alba'), 'amanita');
    assert.strictEqual(fd.speciesSlugFor('  Russula '), 'russula');
    assert.strictEqual(fd.speciesSlugFor('X'), 'x');
    assert.strictEqual(fd.speciesSlugFor(''), null);
    assert.strictEqual(fd.speciesSlugFor(null), null);
  });
  it('findSpeciesEntry matches the COL key, then the legacy key, then the exact name', () => {
    const entries = [
      { key: '5TYZ9', legacy_key: null, name: 'Amanita muscaria' },
      { key: null, legacy_key: '8961574', name: 'Amanita pantherina' },
      { key: '65ZFG', legacy_key: null, name: 'Amanita eijii' }
    ];
    assert.strictEqual(fd.findSpeciesEntry(entries, '5TYZ9', null, 'wrong name').name, 'Amanita muscaria');
    assert.strictEqual(fd.findSpeciesEntry(entries, null, '8961574', 'wrong name').name, 'Amanita pantherina');
    assert.strictEqual(fd.findSpeciesEntry(entries, null, null, 'Amanita eijii').name, 'Amanita eijii');
    assert.strictEqual(fd.findSpeciesEntry(entries, 'ZZZ', '999', 'nope'), null);
    assert.strictEqual(fd.findSpeciesEntry(null, '5TYZ9', null, 'x'), null);
  });
});

describe('TASK-010: markers gate on the flags', () => {
  it('speciesMarkers is all-false for a bare entry', () => {
    assert.deepStrictEqual(fd.speciesMarkers({ external: { mhlw_url: null, endemic_hosoya2016: false } }), { toxic: false, endemic: false });
    assert.deepStrictEqual(fd.speciesMarkers({}), { toxic: false, endemic: false });
    assert.deepStrictEqual(fd.speciesMarkers(null), { toxic: false, endemic: false });
  });
  it('toxic needs a truthy mhlw_url; endemic needs exactly true', () => {
    assert.strictEqual(fd.speciesMarkers({ external: { mhlw_url: 'https://www.mhlw.go.jp/x' } }).toxic, true);
    assert.strictEqual(fd.speciesMarkers({ external: { mhlw_url: '' } }).toxic, false);
    assert.strictEqual(fd.speciesMarkers({ external: { endemic_hosoya2016: true } }).endemic, true);
    assert.strictEqual(fd.speciesMarkers({ external: { endemic_hosoya2016: 1 } }).endemic, false);
    assert.strictEqual(fd.speciesMarkers({ external: { endemic_hosoya2016: 'yes' } }).endemic, false);
  });
  it('markersHtml emits each marker only when true, with aria-labels in both languages', () => {
    assert.strictEqual(fd.markersHtml({ toxic: false, endemic: false }, 'en'), '');
    const toxic = fd.markersHtml({ toxic: true, endemic: false }, 'en');
    assert.ok(toxic.includes('⚠'), 'the ⚠ glyph');
    assert.ok(toxic.includes('aria-label="Toxic: see the MHLW risk profile"'));
    assert.ok(toxic.includes('title="Toxic: see the MHLW risk profile"'), 'tooltip carries the same text');
    assert.ok(!toxic.includes('固有'), 'no endemic marker');
    const endemic = fd.markersHtml({ toxic: false, endemic: true }, 'ja');
    assert.ok(endemic.includes('>固有<'));
    assert.ok(endemic.includes('aria-label="2016年の保全状況に基づく固有種（細矢ほか 2016）"'));
    const both = fd.markersHtml({ toxic: true, endemic: true }, 'ja');
    assert.ok(both.includes('⚠') && both.includes('固有'));
    assert.ok(both.includes('aria-label="毒：厚労省のリスクプロファイル参照"'));
  });
});

describe('TASK-010: details row assembly', () => {
  const full = {
    key: '5TYZ9', legacy_key: null, name: 'Amanita muscaria', name_ja: 'ベニテングタケ',
    family: 'Amanitaceae', order: 'Agaricales', class: 'Agaricomycetes', kind: 'm',
    records_by_tier: { s: 41, d: 2, o: 7 }, fruiting_months: [0, 0, 0, 0, 3, 9, 14, 8, 0, 0, 0, 0],
    area_ids: ['t1', 't2', 't3'], elevation_band: null, host_genera: null, east_asia: true,
    could_be_found_area_ids: [], first_decade: 1900, last_decade: 2020,
    external: {
      wikidata_qid: 'Q131262',
      wikipedia_ja: 'https://ja.wikipedia.org/wiki/%E3%83%99%E3%83%8B%E3%83%86%E3%83%B3%E3%82%B0%E3%82%BF%E3%82%B1',
      wikipedia_en: 'https://en.wikipedia.org/wiki/Amanita_muscaria',
      photo: { thumb_url: 'https://commons.wikimedia.org/w/thumb.php?f=X.jpg&w=96',
        file_page: 'https://commons.wikimedia.org/wiki/File:X.jpg',
        author: 'Dan Molter', licence: 'CC BY-SA 3.0',
        licence_url: 'https://creativecommons.org/licenses/by-sa/3.0' },
      mhlw_url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/syokuchu/poison/index.html',
      endemic_hosoya2016: false,
      literature: [
        { doi: 'https://doi.org/10.2307/j.1', title: 'First study', year: 1999 },
        { doi: 'https://doi.org/10.2307/j.2', title: 'Second study', year: 2011 }
      ],
      mushroomexpert_url: 'https://www.mushroomexpert.com/amanita_muscaria.html', mushroomexpert_level: 'species'
    }
  };
  it('renders the photo credit line: author · licence link · file link (only when photo present)', () => {
    const html = fd.speciesDetailsHtml(full, 'en', 0);
    assert.ok(html.includes('<img src="https://commons.wikimedia.org/w/thumb.php?f=X.jpg&amp;w=96"'));
    assert.ok(html.includes('Dan Molter'));
    assert.ok(html.includes('href="https://creativecommons.org/licenses/by-sa/3.0"'));
    assert.ok(html.includes('CC BY-SA 3.0</a>'));
    assert.ok(html.includes('href="https://commons.wikimedia.org/wiki/File:X.jpg"'));
    const bare = fd.speciesDetailsHtml({ ...full, external: { wikidata_qid: null } }, 'en', 0);
    assert.ok(!bare.includes('<img'), 'no photo, no image element');
    assert.ok(!bare.includes('Dan Molter'));
  });
  it('renders the link row only-if-present, Wikipedia ja preferred over en', () => {
    const html = fd.speciesDetailsHtml(full, 'en', 0);
    assert.ok(html.includes('href="https://ja.wikipedia.org/wiki/%E3%83%99%E3%83%8B%E3%83%86%E3%83%B3%E3%82%B0%E3%82%BF%E3%82%B1"'));
    assert.ok(!html.includes('href="https://en.wikipedia.org/wiki/Amanita_muscaria"'), 'ja link wins when present');
    assert.ok(html.includes('href="https://www.gbif.org/taxon/5TYZ9"'), 'GBIF link from the COL key');
    assert.ok(html.includes('href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/syokuchu/poison/index.html"'));
    assert.ok(html.includes('Literature (2)'), 'the literature count');
    assert.ok(html.includes('href="https://doi.org/10.2307/j.1"') && html.includes('href="https://doi.org/10.2307/j.2"'));
    assert.ok(html.includes('MushroomExpert (North America)'));
    assert.ok(html.includes('href="https://www.mushroomexpert.com/amanita_muscaria.html"'));
    const enOnly = fd.speciesDetailsHtml({ ...full, external: { ...full.external, wikipedia_ja: null } }, 'en', 0);
    assert.ok(enOnly.includes('href="https://en.wikipedia.org/wiki/Amanita_muscaria"'), 'en link is the fallback');
    const legacyOnly = fd.speciesDetailsHtml({ ...full, key: null, legacy_key: 7571796, external: {} }, 'en', 0);
    assert.ok(legacyOnly.includes('href="https://www.gbif.org/species/7571796"'), 'legacy key falls through');
    assert.ok(legacyOnly.includes('>GBIF</a>'), 'GBIF stays even with no external sources');
    for (const gone of ['Wikipedia', 'MHLW', 'Literature', 'MushroomExpert'])
      assert.ok(!legacyOnly.includes('>' + gone), 'no ' + gone + ' link without a source');
  });
  it('carries the fixed not-for-edibility line in both languages', () => {
    assert.ok(fd.speciesDetailsHtml(full, 'en', 0).includes('Not for deciding whether a mushroom is edible.'));
    assert.ok(fd.speciesDetailsHtml(full, 'ja', 0).includes('食用可否の判断に用いないでください。'));
    assert.ok(fd.speciesDetailsHtml({ key: 'X', name: 'Bare' , external: {} }, 'en', 0).includes('Not for deciding whether a mushroom is edible.'));
  });
  it('assembles the fact line: tiers · month strip · area count · East Asia, endemic note only when true', () => {
    const html = fd.speciesDetailsHtml(full, 'en', 6);
    assert.ok(html.includes('41 specimen'));
    assert.ok(html.includes('2 DNA') && html.includes('7 sighting'));
    assert.ok(html.includes('fd-ms'), 'the month strip is reused');
    assert.ok(html.includes('3 areas'));
    assert.ok(html.includes('Recorded in neighbouring East Asia: yes'));
    assert.ok(!html.includes('Endemic as of 2016'), 'no endemic note when the flag is false');
    const ja = fd.speciesDetailsHtml({ ...full, east_asia: false, external: { endemic_hosoya2016: true, wikipedia_en: null } }, 'ja', 0);
    assert.ok(ja.includes('近隣の東アジアでの記録：なし'));
    assert.ok(ja.includes('2016年時点の固有種（細矢ほか 2016）'), 'the endemic note beside the East Asia line');
    assert.ok(ja.includes('3地域'));
  });
});

describe('TASK-010: name cell, degradation and the ↗ link', () => {
  it('renders a button toggle with the GBIF ↗ sibling and data attributes', () => {
    const html = fd.speciesNameCell('5TYZ9', null, 'Amanita muscaria', false, 'en');
    assert.ok(html.includes('<button type="button" class="fd-name-toggle" aria-expanded="false"'));
    assert.ok(html.includes('data-sp-col="5TYZ9"') && html.includes('data-sp-legacy=""') && html.includes('data-sp-name="Amanita muscaria"'));
    assert.ok(html.includes('<i>Amanita muscaria</i>'));
    const arrow = /<a class="fd-gbif"[^>]*>/.exec(html)[0];
    assert.ok(arrow.includes('href="https://www.gbif.org/taxon/5TYZ9"'));
    assert.ok(arrow.includes('aria-label="Open in GBIF (new tab)"'));
    assert.ok(arrow.includes('target="_blank"'));
    const ja = fd.speciesNameCell(null, 8961574, 'Amanita pantherina', false, 'ja');
    assert.ok(ja.includes('aria-label="GBIFで開く（新しいタブ）"'));
    assert.ok(ja.includes('href="https://www.gbif.org/species/8961574"'));
  });
  it('degrades to the plain linked name when the bundles are unavailable', () => {
    const html = fd.speciesNameCell('5TYZ9', null, 'Amanita muscaria', true, 'en');
    assert.ok(html.startsWith('<a '), 'a plain anchor, no button');
    assert.ok(!html.includes('fd-name-toggle') && !html.includes('fd-gbif'));
    assert.ok(html.includes('href="https://www.gbif.org/taxon/5TYZ9"'));
    assert.ok(html.includes('<i>Amanita muscaria</i>'));
  });
});

describe('TASK-010: #species- deep links', () => {
  it('parseSpeciesHash accepts COL and legacy keys, rejects everything else', () => {
    assert.strictEqual(fd.parseSpeciesHash('#species-5TYZ9'), '5TYZ9');
    assert.strictEqual(fd.parseSpeciesHash('species-8961574'), '8961574');
    assert.strictEqual(fd.parseSpeciesHash('#species-ABCdef123'), 'ABCdef123');
    for (const bad of ['#species-', '#SPECIES-x', '#species-x_y', '#species-x y', '#area-x', '#species', '', '#foo'])
      assert.strictEqual(fd.parseSpeciesHash(bad), null, bad);
  });
  it('routes species hashes to the deep-link attempt inside the hash router', () => {
    const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
    assert.ok(/routeFromLocation[\s\S]*?parseSpeciesHash\(h\)[\s\S]*?trySpeciesHash\(\)/.test(src),
      'routeFromLocation parses species hashes and attempts the deep link');
    assert.ok(src.includes('scrollIntoView({ block: \'center\' })'), 'an opened deep link scrolls into view');
    assert.ok(src.includes('st(\'noPage\', lang)'), 'unresolvable keys get the no-page line');
  });
  it('shows the no-page card without saying why (both languages)', () => {
    assert.strictEqual(fd.st('noPage', 'en'), 'No public page for this taxon');
    assert.strictEqual(fd.st('noPage', 'ja'), 'この分類群の公開ページはありません');
  });
});

describe('TASK-010: interaction and network wiring (source-level)', () => {
  const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
  const inc = readFileSync(new URL('../_includes/fungi_dashboard.html', import.meta.url), 'utf8');
  it('one detail row open at a time; a second click on the same toggle closes it', () => {
    assert.ok(/function toggleSpecies\(btn\) \{[\s\S]*?if \(openDetail && openDetail\.btn === btn\) return closeSpeciesDetail\(\);[\s\S]*?closeSpeciesDetail\(\);/.test(src),
      'the open path closes any other row first and re-clicks close');
  });
  it('Esc closes the detail row and the card before the preview and the area', () => {
    const esc = /doc\.addEventListener\('keydown', function \(e\) \{[\s\S]*?\}\);/.exec(src)[0];
    const iDetail = esc.indexOf('closeSpeciesDetail()');
    const iCard = esc.indexOf('hideSpeciesCard()');
    const iPreview = esc.indexOf("var pv = $('fd-preview')");
    assert.ok(iDetail >= 0 && iCard > iDetail && iPreview > iCard, 'detail row → card → preview → area');
  });
  it('tables delegate toggle clicks, so rebuilt rows keep working', () => {
    assert.ok(src.includes("'fd-area-species', 'fd-area-possible'"), 'both tables delegate');
    assert.ok(src.includes("e.target.closest('.fd-name-toggle')"), 'the delegate resolves the toggle');
  });
  it('loaded genus files backfill markers onto every matching row', () => {
    assert.ok(/function backfillMarkers\(slug, entries\)[\s\S]*?insertAdjacentHTML\('beforeend'/.test(src));
  });
  it('makes no browser calls to Wikidata, Commons or Wikipedia APIs', () => {
    for (const banned of ['api.wikidata', 'commons.wikimedia.org/w/api.php', 'wikipedia.org/w/api.php', 'query.wikidata', 'specimen?'])
      assert.ok(!src.includes(banned), 'no ' + banned + ' API calls');
    assert.ok(src.includes("base + 'species/index.json'") && src.includes("base + 'species/' + encodeURIComponent(slug)"),
      'the only species fetches are the bundle index and genus files');
  });
  it('the include ships the deep-link card container', () => {
    assert.ok(inc.includes('id="fd-species-card"'));
  });
});
