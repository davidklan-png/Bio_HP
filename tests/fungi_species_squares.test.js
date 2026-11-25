#!/usr/bin/env node
/**
 * Unit tests for species/squares.json (TASK-017): which ~10 km square holds which
 * species — a named species' own squares filled on the map, and a square's species in
 * the inspector. Pure helpers of assets/js/fungi-dashboard.js; the browser wiring is
 * asserted at source level here. The file is not published yet: the staged real copy
 * (with its squares_sha256 in the species index) lives at /tmp/fd-harness/t17, so those
 * cases skip where it is absent (CI) and the synthetic ones still run.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const fd = require('../assets/js/fungi-dashboard.js');
const SNAP = 'a'.repeat(64);

// Invented squares rows: [key, [summary-row idx, …]], keys "row:col" in numeric order.
const SQUARES = [
  ['55:80', [0, 2]],
  ['55:81', [2, 3]],
  ['56:80', [1]]
];
// Invented summary rows they index: [name, col_key, legacy_key, area_count, record_count, mhlw, endemic].
const SUMMARY = [
  ['Lactarius hatsudake', 'A1', null, 50, 900, false, true],
  ['Amanita muscaria', 'E1', '5', 70, 4000, true, false],
  ['Mycena haematopus', 'C2', null, 25, 210, true, false],
  ['Russula vesca', 'B2', null, 60, 1200, false, false]
];

// The staged publication (planner-created): the live data plus squares.json and an
// index.json carrying its squares_sha256. Present on the machines that ran this task.
const STAGED = '/tmp/fd-harness/t17/data/shroomhunt/species';
const staged = (name) => readFileSync(STAGED + '/' + name);
const stagedJson = (name) => JSON.parse(staged(name));
const hasStaged = existsSync(STAGED + '/squares.json');

describe('species squares (TASK-017): readSpeciesSquares', () => {
  const good = { schema_version: 1, snapshot: SNAP, generated: '2026-11-25', species: SQUARES };
  it('accepts the published shape and hands back the rows and the snapshot', () => {
    const r = fd.readSpeciesSquares(good);
    assert.deepStrictEqual([r.ok, r.snapshot, r.rows.length, r.rows[0][0]], [true, SNAP, 3, '55:80']);
  });
  it('rejects anything else', () => {
    for (const bad of [null, {}, { schema_version: 1, snapshot: SNAP }, { schema_version: 0, snapshot: SNAP, species: [] },
      { schema_version: 1, snapshot: 'nope', species: [] }, { schema_version: 1, snapshot: SNAP, species: 'x' },
      { schema_version: 1, snapshot: SNAP, species: [['55:80']] },
      { schema_version: 1, snapshot: SNAP, species: [['5580', [0]]] },
      { schema_version: 1, snapshot: SNAP, species: [['a:b', [0]]] },
      { schema_version: 1, snapshot: SNAP, species: [[55, [0]]] },
      { schema_version: 1, snapshot: SNAP, species: [['55:80', 'x']] },
      { schema_version: 1, snapshot: SNAP, species: [['55:80', ['0']]] },
      { schema_version: 1, snapshot: SNAP, species: [['55:80', [-1]]] },
      { schema_version: 1, snapshot: SNAP, species: [['55:80', [0]], ['55:80', [1]]] },   // duplicate key
      { schema_version: 1, snapshot: SNAP, species: [['56:80', [0]], ['55:81', [1]]] }]) // out of numeric order
      assert.strictEqual(fd.readSpeciesSquares(bad).ok, false, JSON.stringify(bad));
  });
  it('the staged real file: 2,321 rows, every index below 12,022, the known pairs', { skip: !hasStaged }, () => {
    const r = fd.readSpeciesSquares(stagedJson('squares.json'));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.rows.length, 2321);
    assert.ok(r.rows.every((row) => row[1].every((i) => Number.isInteger(i) && i >= 0 && i < 12022)),
      'row i belongs to summary row i');
    const sum = fd.readSpeciesSummary(stagedJson('summary.json'));
    assert.strictEqual(sum.ok, true);
    const byName = {};
    sum.rows.forEach((row, i) => { byName[row[0]] = i; });
    const squaresOf = (name) => r.rows.filter((row) => row[1].indexOf(byName[name]) >= 0).map((row) => row[0]);
    assert.deepStrictEqual(squaresOf('Russula peckii'), ['431:1110'], 'one tile, one square');
    assert.strictEqual(squaresOf('Pleurotus ostreatus').length, 126, '32 areas, 126 squares');
    assert.ok(squaresOf('Pleurotus ostreatus').indexOf('315:1023') >= 0, 'a known pair');
  });
});

describe('species squares (TASK-017): squaresTrusted', () => {
  const sq = { ok: true, snapshot: SNAP, rows: SQUARES };
  const summary = { status: 'ready', rows: SUMMARY, indexSnap: SNAP };
  const index = { snapshot: SNAP, squares_sha256: 'e'.repeat(64) };
  it('accepts the bundle the index names alongside a ready summary', () => {
    assert.strictEqual(fd.squaresTrusted(sq, 'e'.repeat(64), summary, index), true);
    assert.strictEqual(fd.squaresTrusted(sq, null, summary, index), true, 'no WebCrypto: the snapshot alone decides');
    assert.strictEqual(fd.squaresTrusted(sq, 'e'.repeat(64), summary, { snapshot: SNAP, squares_sha256: null }), true,
      'an index without squares_sha256 cannot be compared (not yet published)');
  });
  it('rejects another sha, another snapshot and no summary', () => {
    assert.strictEqual(fd.squaresTrusted(sq, 'e'.repeat(63) + 'f', summary, index), false, 'another sha');
    assert.strictEqual(fd.squaresTrusted(sq, 'e'.repeat(64), { status: 'ready', rows: SUMMARY, indexSnap: 'b'.repeat(64) }, index), false,
      'another snapshot: not the summary\'s publication');
    assert.strictEqual(fd.squaresTrusted(sq, 'e'.repeat(64), { status: 'absent', rows: null, indexSnap: null }, index), false, 'no summary');
    assert.strictEqual(fd.squaresTrusted({ ok: false }, 'e'.repeat(64), summary, index), false);
    assert.strictEqual(fd.squaresTrusted(null, null, null, null), false);
  });
  it('readSpeciesIndex gains squares_sha256, null when absent', () => {
    const r = fd.readSpeciesIndex({ schema_version: 1, files: {}, squares_sha256: SNAP });
    assert.strictEqual(r.squares_sha256, SNAP);
    assert.strictEqual(fd.readSpeciesIndex({ schema_version: 1, files: {} }).squares_sha256, null);
    assert.strictEqual(fd.readSpeciesIndex({ schema_version: 1, files: {}, squares_sha256: 'short' }).squares_sha256, null);
  });
  it('the staged real bundle: its bytes hash to the squares_sha256 the index names', { skip: !hasStaged }, () => {
    const { createHash } = require('node:crypto');
    const idx = fd.readSpeciesIndex(stagedJson('index.json'));
    const sq = fd.readSpeciesSquares(stagedJson('squares.json'));
    const sum = fd.readSpeciesSummary(stagedJson('summary.json'));
    assert.strictEqual(fd.squaresTrusted(sq, createHash('sha256').update(staged('squares.json')).digest('hex'),
      { status: 'ready', rows: sum.rows, indexSnap: idx.snapshot }, idx), true);
  });
});

describe('species squares (TASK-017): the inversions', () => {
  it('byRow maps a summary row to its keys, bySquare a key to the summary rows it holds', () => {
    const inv = fd.invertSpeciesSquares(SQUARES, SUMMARY);
    assert.deepStrictEqual(inv.byRow.get(SUMMARY[0]), ['55:80']);
    assert.deepStrictEqual(inv.byRow.get(SUMMARY[2]), ['55:80', '55:81']); // one row, two squares
    assert.strictEqual(inv.byRow.get(SUMMARY[1]).length, 1);
    assert.strictEqual(inv.byRow.has(['Lactarius hatsudake', 'A1', null, 50, 900, false, true]), false, 'row identity, not content');
    assert.deepStrictEqual(inv.bySquare['55:81'], [SUMMARY[2], SUMMARY[3]]);
    assert.deepStrictEqual(inv.bySquare['56:80'], [SUMMARY[1]]);
    assert.strictEqual(inv.bySquare['99:99'], undefined);
  });
  it('an index outside the summary rejects the whole file: row i belongs to row i', () => {
    assert.strictEqual(fd.invertSpeciesSquares([['55:80', [4]]], SUMMARY), null);
    assert.strictEqual(fd.invertSpeciesSquares([['55:80', [0, 99]]], SUMMARY), null);
  });
  it('the staged real file inverts: peckii one square, ostreatus 126, a square\'s rows', { skip: !hasStaged }, () => {
    const sum = fd.readSpeciesSummary(stagedJson('summary.json'));
    const inv = fd.invertSpeciesSquares(fd.readSpeciesSquares(stagedJson('squares.json')).rows, sum.rows);
    const byName = {};
    sum.rows.forEach((row, i) => { byName[row[0]] = i; });
    assert.strictEqual(inv.byRow.get(sum.rows[byName['Russula peckii']]).length, 1);
    assert.strictEqual(inv.byRow.get(sum.rows[byName['Pleurotus ostreatus']]).length, 126);
    assert.ok(inv.bySquare['291:990'].length > 10, 'a busy square holds many species');
    assert.ok(inv.bySquare['291:990'].every((row) => Array.isArray(row)), 'bySquare holds summary rows');
  });
});

describe('species squares (TASK-017): a panel\'s own squares', () => {
  const inv = fd.invertSpeciesSquares(SQUARES, SUMMARY);
  it('a species\' keys from a summary row, an entry and a key — speciesByKey finds the row', () => {
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [SUMMARY[2]]), ['55:80', '55:81']);
    const entry = { key: 'E1', legacy_key: '5', name: 'Amanita muscaria' }; // a genus panel row
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [fd.speciesByKey(SUMMARY, entry.key)]), ['56:80']);
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [fd.speciesByKey(SUMMARY, 'C2')]), ['55:80', '55:81']);
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [fd.speciesByKey(SUMMARY, '5')]), ['56:80'], 'legacy key');
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [fd.speciesByKey(SUMMARY, 'ZZZ')]), [], 'nothing published');
  });
  it('a genus\' union over its species\' rows, deduped, file order', () => {
    const rows = [SUMMARY[0], SUMMARY[1], SUMMARY[2]]; // hatsudake + muscaria + haematopus
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, rows), ['55:80', '56:80', '55:81']);
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [SUMMARY[0], SUMMARY[2], SUMMARY[2]]), ['55:80', '55:81'], 'a row twice, keys once');
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, []), []);
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, null), []);
  });
});

describe('species squares (TASK-017): a square\'s species', () => {
  const inv = fd.invertSpeciesSquares(SQUARES, SUMMARY);
  it('sorted by records, then name; nothing for an unknown key', () => {
    assert.deepStrictEqual(fd.squareSpeciesRows(inv.bySquare['55:81']).map((r) => r[0]), ['Russula vesca', 'Mycena haematopus'],
      '1,200 records above 210');
    assert.deepStrictEqual(fd.squareSpeciesRows(inv.bySquare['55:80']).map((r) => r[0]), ['Lactarius hatsudake', 'Mycena haematopus'],
      '900 above 210');
    assert.deepStrictEqual(fd.squareSpeciesRows(inv.bySquare['99:99']), []);
    assert.deepStrictEqual(fd.squareSpeciesRows(null), []);
  });
  it('ties break on the name, never on the input order', () => {
    const rows = [['B name', 'x', null, 1, 5, false, false], ['A name', 'y', null, 1, 5, false, false]];
    assert.deepStrictEqual(fd.squareSpeciesRows(rows).map((r) => r[0]), ['A name', 'B name']);
    assert.deepStrictEqual(fd.squareSpeciesRows(rows.slice().reverse()).map((r) => r[0]), ['A name', 'B name']);
  });
});

describe('species squares (TASK-017): browser wiring (source level)', () => {
  const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
  const fm = readFileSync(new URL('../assets/js/fungi-field-map.js', import.meta.url), 'utf8');
  const inc = readFileSync(new URL('../_includes/fungi_dashboard.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/css/fungi-dashboard.css', import.meta.url), 'utf8');
  // openSquarePanel sits directly before renderNamePanel: the slice is its whole body.
  const panelBody = src.slice(src.indexOf('function openSquarePanel'), src.indexOf('function renderNamePanel'));

  it('loads on first need: the panels and the preview trigger ensureSquares', () => {
    assert.ok(/function ensureSquares\(\) \{/.test(src), 'the one entry point');
    assert.ok(/function showSpecies\(spec, source\) \{[\s\S]*?ensureSquares\(\);[\s\S]*?\n  \}/.test(src), 'a species panel');
    assert.ok(/function selectGenus\(genus, source\) \{[\s\S]*?ensureSquares\(\);[\s\S]*?\n  \}/.test(src), 'a genus panel');
    assert.ok(/function renderPreview\(tap, m\) \{[\s\S]*?ensureSquares\(\);[\s\S]*?\n  \}/.test(src), 'a square first tapped');
  });
  it('the square panel fits the map to its square in one camera move, as a species panel fits its outline', () => {
    // planner check in WebKit: at national zoom a single square is a few pixels
    assert.ok(/openNameShell\(n\);[\s\S]*?state\.box = zoomBox\(cellEdges\(n\.cell\.row, n\.cell\.col\)\);\s*drawViews\(\);/.test(panelBody), 'one move, to the square');
    assert.strictEqual((panelBody.match(/state\.box =/g) || []).length, 1, 'never a stop at Japan in between');
  });
  it('one shared promise, trusted by squares_sha256 through sha256Hex and the summary\'s snapshot', () => {
    assert.ok(/var squares = \{ status: 'idle', byRow: null, bySquare: null, at: 0, pending: null \}/.test(src));
    assert.ok(/root\.fetch\(base \+ 'species\/squares\.json', \{ cache: 'no-cache' \}\)/.test(src), 'the file, no-cache, like its siblings');
    assert.ok(/squaresTrusted\(sq, xs\[0\], names, species\.index\)/.test(src), 'sha + snapshot + ready summary');
    assert.ok(/invertSpeciesSquares\(sq\.rows, names\.rows\)/.test(src), 'inverted once, against the loaded summary');
    assert.ok(/squares\.status = 'absent'/.test(src), 'untrusted degrades to absent');
  });
  it('a publication change reloads the bundle: the rows ride the summary', () => {
    assert.ok(/names\.status = 'idle';\s*\n\s*nameIndex\.status = 'idle';\s*\n\s*nameIndex\.jaBy = null;\s*\n\s*squares\.status = 'idle';\s*\n\s*squares\.byRow = squares\.bySquare = null;/.test(src));
  });
  it('the SVG emits the cell set above the tile fill', () => {
    assert.ok(/state\.nout\.sq\.forEach\(function \(k\) \{/.test(src), 'one cell rect per key');
    assert.ok(/sqOut \+ nameOut/.test(src), 'above the record squares, under the outline strokes');
    assert.ok(/\.fd-map__sq-fill \{ fill: var\(--fd-sel-core\); fill-opacity: \.5; \}/.test(css), 'the selection core at about 50%');
  });
  it('the street map emits the same cell set', () => {
    assert.ok(/boundaryRings\(nm\.sq, shared\.cellEdges\)/.test(fm), 'dissolved once, like the tile fill');
    assert.ok(/fillOpacity: 0\.5, stroke: false/.test(fm), 'the same half-strength fill');
  });
  it('the legend entry in both languages, only while squares are drawn', () => {
    assert.ok(/sqSpecies: \['Squares recording this species \(all time\)', 'この種が記録されたマス（全期間）'\]/.test(src));
    assert.ok(/sqGenus: \["Squares recording this genus' species \(all time\)", 'この属の種が記録されたマス（全期間）'\]/.test(src));
    assert.ok(/fd-legend__sq"[^>]*hidden/.test(inc), 'the item ships hidden in the include');
    assert.ok(/fd-legend__sq-t/.test(inc), 'its text is set by JS: the wording follows the panel');
    assert.ok(/sq\.hidden = !on/.test(src) && /var on = !!\(state\.nout && state\.nout\.sq && state\.nout\.sq\.length\);/.test(src),
      'only when squares are drawn');
    assert.ok(/\.fd-legend i\.fd-map__sq \{ background: color-mix\(in srgb, var\(--fd-sel-core\) 50%, transparent\); border: 2px solid var\(--fd-sel-core\); \}/.test(css));
  });
  it('the preview bar\'s second button, only when the square holds species', () => {
    assert.ok(/id="fd-preview-species"[^>]*hidden/.test(inc), 'after Open area, hidden by default');
    assert.ok(inc.includes('このマスの種') && inc.includes('Species in this square'), 'bilingual copy in the include');
    assert.ok(/sqb\.hidden = !\(tap\.cell && squaresReady\(\) && \(squares\.bySquare\[tap\.cell\] \|\| \[\]\)\.length\)/.test(src));
    assert.ok(/\$\('fd-preview-species'\)\.addEventListener\('click', function \(\) \{[\s\S]*?openSquarePanel\(tapState\.cell\)/.test(src));
  });
  it('the square panel: title, meta, sorted rows, the chip — and no hash', () => {
    assert.ok(/squareTitle: \['Square \{key\}', 'マス \{key\}'\]/.test(src));
    assert.ok(/squareMeta: \['About 10 km · \{n\} species \(all time\)', '約10km四方 · 種 \{n\}（全期間）'\]/.test(src));
    assert.ok(/openNameShell\(n\)/.test(panelBody) && /filterChanged\(\)/.test(panelBody), 'a name-panel shell');
    assert.ok(!/pushUrl|selectArea\(/.test(panelBody), 'no hash, never through selectArea()');
    assert.ok(/if \(n\.id === 'square'\) \{[\s\S]*?squareRowsHtml\(n\.rows\)/.test(src), 'the inspector branch');
    assert.ok(/function squareRowsHtml\(rows\) \{[\s\S]*?fd-name-toggle/.test(src), 'each row a 44 px button');
    assert.ok(/squareSpeciesRows\(squares\.bySquare\[key\]\)/.test(src), 'the rows come from bySquare, sorted');
    assert.ok(/chipSquare: \['Square: \{name\}', 'マス：\{name\}'\]/.test(src));
    assert.ok(/n\.id === 'square' \? 'chipSquare' : 'chipSpecies'/.test(src), 'the chip joins 表示中');
  });
  it('the square is outlined in the locate-cell style on both renderers', () => {
    assert.ok(/squareCell: function \(\) \{ return state\.name && state\.name\.id === 'square' \? state\.name\.cell : null; \}/.test(src),
      'squareCell feeds the street map');
    assert.ok(/cellRing\(sc\.key, shared\.cellEdges\)/.test(fm), 'the street map draws it like the located cell');
    assert.ok(/state\.name && state\.name\.id === 'square' \? state\.name\.cell : null/.test(src), 'the SVG reuses the locate rect');
  });
  it('absence breaks nothing: the catch path degrades to absent, every reader gated', () => {
    assert.ok(/\.catch\(function \(\) \{ squares\.status = 'absent'; squares\.at = Date\.now\(\); \}\)/.test(src));
    assert.ok(/function squaresReady\(\) \{ return squares\.status === 'ready'; \}/.test(src));
    assert.ok(/function nameSquares\(n\) \{[\s\S]*?squaresReady\(\)/.test(src));
  });
  it('the two-tap flow stays the single path for areas', () => {
    assert.ok(/if \(tr\.action === 'open'\) \{ clearPreview\(\); selectArea\(aid\); \}/.test(src), 'second tap still opens the area');
  });
  it('CSS stamp bumped for the new rules', () => {
    assert.ok(inc.includes('?v=2026-11-25-4'), 'CSS stamp bumped (TASK-017)');
  });
});
