#!/usr/bin/env node
/**
 * Unit tests for assets/js/fungi-field-map.js (the street adapter: Leaflet + GSI Pale
 * tiles behind the dashboard's Street map button) and the dashboard's lazy loader
 * that injects it. Pure helpers only — no Leaflet, no DOM, no network.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const fm = require('../assets/js/fungi-field-map.js');
const fd = require('../assets/js/fungi-dashboard.js');

// 0D parity fixture, same coordinates as tests/fungi_dashboard.test.js.
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

describe('fungi-field-map: exact JIS rectangles from integer keys', () => {
  it('rebuilds rectangle corners from keys via the dashboard cellEdges (0D parity fixture)', () => {
    for (const [lat, lon, key] of parity) {
      const [row, col] = key.split(':').map(Number);
      // ring order: SW, SE, NE, NW in [lat, lon] pairs, edges exact from the integers
      assert.deepStrictEqual(fm.cellRing(key, fd.cellEdges),
        [[row / 12, col / 8], [row / 12, (col + 1) / 8], [(row + 1) / 12, (col + 1) / 8], [(row + 1) / 12, col / 8]],
        key);
      const r = fm.cellRing(key, fd.cellEdges);
      assert.ok(r[0][0] <= lat && lat < r[2][0] && r[0][1] <= lon && lon < r[1][1], key + ' contains its fixture point');
    }
  });
  it('rejects malformed keys', () => {
    assert.deepStrictEqual(fm.parseKey('314:1021'), { row: 314, col: 1021 });
    for (const bad of ['naha', '', '314', '314:', '-1:5', '3.5:1021'])
      assert.strictEqual(fm.parseKey(bad), null, bad);
    assert.strictEqual(fm.cellRing('naha', fd.cellEdges), null);
  });
});

describe('fungi-field-map: z9 entry clamp', () => {
  it('fits the whole of Japan at whole zooms well below the cap', () => {
    const z = fm.fitZoom({ latMin: 24, latMax: 46, lonMin: 122, lonMax: 154 }, 800, 420);
    assert.ok(z >= 3 && z <= 6, 'Japan entry zoom ' + z);
  });
  it('fits Okinawa within the cap and never enters above z9, however small the area', () => {
    const okinawa = fd.zoomBox([26.07, 26.88, 127.63, 128.33]);
    const z = fm.fitZoom(okinawa, 390, 500);
    assert.ok(z >= 6 && z <= 9, 'Okinawa entry zoom ' + z);
    const tiny = fm.fitZoom({ latMin: 35.6, latMax: 35.7, lonMin: 139.7, lonMax: 139.8 }, 390, 500);
    assert.strictEqual(tiny, fm.ENTRY_MAX_ZOOM);
  });
  it('clamps degenerate input to a safe floor', () => {
    assert.strictEqual(fm.fitZoom(null, 400, 400), 0);
    assert.strictEqual(fm.fitZoom({ latMin: 1, latMax: 2, lonMin: 3, lonMax: 4 }, 0, 0), 0);
  });
});

describe('fungi-field-map: street entry/exit machine and tile budget', () => {
  it('constructs no tile URL before Street map entry or after exit', () => {
    const m = fm.streetMachine();
    assert.strictEqual(m.tileUrl(9, 441, 192), null);
    assert.strictEqual(m.enter(), true);
    assert.strictEqual(m.state().mode, 'loading');
    assert.strictEqual(m.tileUrl(9, 441, 192), null); // assets still loading
    assert.strictEqual(m.ready(), true);
    assert.strictEqual(m.state().mode, 'street');
    assert.strictEqual(m.tileUrl(9, 441, 192), 'https://cyberjapandata.gsi.go.jp/xyz/pale/9/441/192.png');
    assert.strictEqual(m.exit(), true);
    assert.strictEqual(m.tileUrl(10, 882, 384), null);
  });
  it('ignores repeated enters and exits from idle', () => {
    const busy = fm.streetMachine();
    busy.enter();
    assert.strictEqual(busy.enter(), false);
    const idle = fm.streetMachine();
    assert.strictEqual(idle.exit(), false);
    assert.strictEqual(idle.fail(), false);
  });
  it('marks a failed session as a fallback exit and a user exit as manual', () => {
    const failed = fm.streetMachine();
    failed.enter(); failed.ready();
    assert.strictEqual(failed.fail(), true);
    assert.deepStrictEqual(failed.state(), { mode: 'svg', fallback: true });
    const manual = fm.streetMachine();
    manual.enter(); manual.ready(); manual.exit();
    assert.deepStrictEqual(manual.state(), { mode: 'svg', fallback: false });
  });
});

describe('fungi-field-map: blocked-tile fallback decision', () => {
  it('falls back only when tiles fail before anything has loaded', () => {
    assert.strictEqual(fm.fallbackDecision(0, 1), 'wait');
    assert.strictEqual(fm.fallbackDecision(0, 2), 'wait');
    assert.strictEqual(fm.fallbackDecision(0, 3), 'fallback');
    assert.strictEqual(fm.fallbackDecision(4, 3), 'wait');
    assert.strictEqual(fm.fallbackDecision(2, 40), 'wait'); // later failures keep a working map
  });
});

describe('fungi-field-map: module loads no network at import', () => {
  it('contains no top-level network calls (the adapter runs only after injection)', () => {
    const src = readFileSync(new URL('../assets/js/fungi-field-map.js', import.meta.url), 'utf8');
    for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'localStorage', 'sessionStorage', 'new Image('])
      assert.ok(!src.includes(banned), `adapter must not contain ${banned}`);
    assert.ok(src.includes('cyberjapandata.gsi.go.jp'), 'GSI Pale tile template expected');
  });
});

describe('fungi-dashboard: street asset injection', () => {
  function stubDoc() {
    const made = [];
    return {
      made,
      createElement(tag) { const el = { tag }; made.push(el); return el; },
      head: { children: [], appendChild(el) { this.children.push(el); } }
    };
  }
  const flush = () => new Promise((r) => setImmediate(r));
  it('injects the stylesheet, Leaflet and the adapter same-origin, scripts ordered', () => {
    assert.deepStrictEqual(fd.STREET_ASSETS, [
      { tag: 'link', href: '/assets/vendor/leaflet/leaflet.css' },
      { tag: 'script', src: '/assets/vendor/leaflet/leaflet.js' },
      { tag: 'script', src: '/assets/js/fungi-field-map.js' }
    ]);
  });
  it('creates link/script tags with the right attributes and resolves when each loads', async () => {
    const doc = stubDoc();
    const p = fd.injectAssets(doc, fd.STREET_ASSETS);
    await flush();
    assert.strictEqual(doc.head.children.length, 3);
    const [link, leaflet, adapter] = doc.made;
    assert.strictEqual(link.tag, 'link');
    assert.strictEqual(link.rel, 'stylesheet');
    assert.strictEqual(link.href, '/assets/vendor/leaflet/leaflet.css');
    for (const s of [leaflet, adapter]) {
      assert.strictEqual(s.tag, 'script');
      assert.strictEqual(s.async, false); // execution order preserved
      assert.ok(typeof s.onload === 'function' && typeof s.onerror === 'function');
    }
    assert.strictEqual(leaflet.src, '/assets/vendor/leaflet/leaflet.js');
    assert.strictEqual(adapter.src, '/assets/js/fungi-field-map.js');
    doc.made.forEach((el) => el.onload());
    await p;
  });
  it('rejects when an asset fails to load', async () => {
    const doc = stubDoc();
    const p = fd.injectAssets(doc, [{ tag: 'script', src: 'missing.js' }]);
    await flush();
    doc.made[0].onerror();
    await assert.rejects(p);
  });
});

// Codex review fixes on #46.
describe('fungi-field-map: national view may display below native tile zoom', () => {
  it('display floor sits below native tile zoom, so the fitted national view is not raised', () => {
    assert.strictEqual(fm.TILE_MIN_ZOOM, 5);            // GSI Pale native tiles
    assert.ok(fm.TILE_MIN_DISPLAY < fm.TILE_MIN_ZOOM, 'display floor must sit below native or Leaflet raises the map');
    const z = fm.fitZoom({ latMin: 24, latMax: 46, lonMin: 122, lonMax: 154 }, 800, 420);
    assert.ok(z >= fm.TILE_MIN_DISPLAY, `fitted national zoom ${z} must be >= display floor ${fm.TILE_MIN_DISPLAY}`);
  });
});
