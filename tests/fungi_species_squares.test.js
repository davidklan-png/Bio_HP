#!/usr/bin/env node
/**
 * Unit tests for species/squares.json (TASK-017): which ~10 km square holds which
 * species — a named species' own squares filled on the map, and a square's species in
 * the inspector. Pure helpers of assets/js/fungi-dashboard.js; the browser wiring is
 * asserted at source level here. The real file ships with the repo (PR #78), so the
 * real-file cases read assets/data/shroomhunt/species/ the way fungi_name_search.test.js
 * reads the real summary — they run everywhere, CI included.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

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

// The shipped publication (PR #78): squares.json, summary.json and an index.json that
// names the file's squares_sha256 — the same files the page fetches.
const realFile = (name) => readFileSync(new URL('../assets/data/shroomhunt/species/' + name, import.meta.url));
const realJson = (name) => JSON.parse(realFile(name));

describe('mesh keys: parseCellKey', () => {
  it('parses "row:col" to its integers, null for anything else', () => {
    assert.deepStrictEqual(fd.parseCellKey('55:81'), { row: 55, col: 81 });
    assert.deepStrictEqual(fd.parseCellKey('0:0'), { row: 0, col: 0 });
    for (const bad of [null, undefined, '', 55, '5581', 'a:b', '55:', '55:81:9', ' 55:81', '55:81 '])
      assert.strictEqual(fd.parseCellKey(bad), null, JSON.stringify(bad));
  });
});

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
      { schema_version: 1, snapshot: SNAP, species: [['55:80', [0, 0]]] },  // an index twice inside one square
      { schema_version: 1, snapshot: SNAP, species: [['55:80', [0]], ['55:80', [1]]] },   // duplicate key
      { schema_version: 1, snapshot: SNAP, species: [['56:80', [0]], ['55:81', [1]]] }]) // out of numeric order
      assert.strictEqual(fd.readSpeciesSquares(bad).ok, false, JSON.stringify(bad));
  });
  it('the real file: 2,321 squares, every index below 12,022, the known pairs', () => {
    const r = fd.readSpeciesSquares(realJson('squares.json'));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.rows.length, 2321);
    assert.ok(r.rows.every((row) => row[1].every((i) => Number.isInteger(i) && i >= 0 && i < 12022)),
      'row i belongs to summary row i');
    const sum = fd.readSpeciesSummary(realJson('summary.json'));
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
  const index = { snapshot: SNAP, squares_sha256: 'e'.repeat(64) };
  it('accepts the bundle the index names — no summary needed at load (TASK-017b review)', () => {
    assert.strictEqual(fd.squaresTrusted(sq, 'e'.repeat(64), index), true);
    assert.strictEqual(fd.squaresTrusted(sq, null, index), true, 'no WebCrypto: the snapshot alone decides');
    assert.strictEqual(fd.squaresTrusted(sq, 'e'.repeat(64), { snapshot: SNAP, squares_sha256: null }), true,
      'an index without squares_sha256 cannot be compared');
  });
  it('rejects another sha, another snapshot and no index', () => {
    assert.strictEqual(fd.squaresTrusted(sq, 'e'.repeat(63) + 'f', index), false, 'another sha');
    assert.strictEqual(fd.squaresTrusted(sq, 'e'.repeat(64), { snapshot: 'b'.repeat(64), squares_sha256: 'e'.repeat(64) }), false,
      "another snapshot: not the index's publication");
    assert.strictEqual(fd.squaresTrusted(sq, 'e'.repeat(64), null), false, 'no index to name the file');
    assert.strictEqual(fd.squaresTrusted({ ok: false }, 'e'.repeat(64), index), false);
    assert.strictEqual(fd.squaresTrusted(null, null, null), false);
  });
  it('readSpeciesIndex gains squares_sha256, null when absent', () => {
    const r = fd.readSpeciesIndex({ schema_version: 1, files: {}, squares_sha256: SNAP });
    assert.strictEqual(r.squares_sha256, SNAP);
    assert.strictEqual(fd.readSpeciesIndex({ schema_version: 1, files: {} }).squares_sha256, null);
    assert.strictEqual(fd.readSpeciesIndex({ schema_version: 1, files: {}, squares_sha256: 'short' }).squares_sha256, null);
  });
  it('the real bundle: its bytes hash to the squares_sha256 the shipped index names', () => {
    const { createHash } = require('node:crypto');
    const idx = fd.readSpeciesIndex(realJson('index.json'));
    const sq = fd.readSpeciesSquares(realJson('squares.json'));
    assert.strictEqual(fd.squaresTrusted(sq, createHash('sha256').update(realFile('squares.json')).digest('hex'), idx), true);
  });
});

describe('species squares (TASK-017): the inversions', () => {
  it('byRow maps a summary row index to its keys, bySquare a key to the row indices it holds', () => {
    const inv = fd.invertSpeciesSquares(SQUARES);
    assert.deepStrictEqual(inv.byRow.get(0), ['55:80']);
    assert.deepStrictEqual(inv.byRow.get(2), ['55:80', '55:81']); // one row, two squares
    assert.strictEqual(inv.byRow.get(1).length, 1);
    assert.strictEqual(inv.byRow.has(4), false, 'a row no square holds');
    assert.deepStrictEqual(inv.bySquare['55:81'], [2, 3]);
    assert.deepStrictEqual(inv.bySquare['56:80'], [1]);
    assert.strictEqual(inv.bySquare['99:99'], undefined);
  });
  it('needs no summary: indices resolve to rows only when a panel opens', () => {
    assert.strictEqual(fd.invertSpeciesSquares([['55:80', [4]]]).byRow.get(4).length, 1,
      'an out-of-range index lands with the resolver, never inverts a file away');
    assert.strictEqual(fd.invertSpeciesSquares(null).byRow.size, 0);
  });
  it('the real file inverts: peckii one square, ostreatus 126, a square\'s rows', () => {
    const sum = fd.readSpeciesSummary(realJson('summary.json'));
    const inv = fd.invertSpeciesSquares(fd.readSpeciesSquares(realJson('squares.json')).rows);
    const byName = {};
    sum.rows.forEach((row, i) => { byName[row[0]] = i; });
    assert.strictEqual(inv.byRow.get(byName['Russula peckii']).length, 1);
    assert.strictEqual(inv.byRow.get(byName['Pleurotus ostreatus']).length, 126);
    const iri = inv.bySquare['291:990'].map((i) => sum.rows[i]); // Iriomote's square
    assert.ok(iri.length > 10, 'a busy square holds many species');
    assert.ok(iri.every((row) => Array.isArray(row)), 'the indices resolve to summary rows');
  });
});

describe('species squares (TASK-017): a panel\'s own squares', () => {
  const inv = fd.invertSpeciesSquares(SQUARES);
  it('a species\' keys from its row index, or by key through speciesByKey + indexOf', () => {
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [2]), ['55:80', '55:81']);
    const rowOf = (k) => SUMMARY.indexOf(fd.speciesByKey(SUMMARY, k));
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [rowOf('E1')]), ['56:80']);
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [rowOf('C2')]), ['55:80', '55:81']);
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [rowOf('5')]), ['56:80'], 'legacy key');
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [rowOf('ZZZ')]), [], 'nothing published: indexOf(null) is -1');
  });
  it('a genus\' union over the row indices of the rows it lists, deduped, file order', () => {
    const byName = fd.nameRowIdx(SUMMARY);
    const rows = [SUMMARY[0], SUMMARY[1], SUMMARY[2]]; // hatsudake + muscaria + haematopus
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, rows.map((r) => byName[r[0]])), ['55:80', '56:80', '55:81']);
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [0, 2, 2]), ['55:80', '55:81'], 'a row twice, keys once');
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, [1, undefined]), ['56:80'], 'a listed entry the summary does not know');
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, []), []);
    assert.deepStrictEqual(fd.panelSquares(inv.byRow, null), []);
  });
  it('the real genera: the union over the rows the panel lists, not a display-token filter', () => {
    const sum = fd.readSpeciesSummary(realJson('summary.json'));
    const inv = fd.invertSpeciesSquares(fd.readSpeciesSquares(realJson('squares.json')).rows);
    const byName = fd.nameRowIdx(sum.rows);
    for (const [slug, listed, union, tokenUnion] of [['megalospora', 5, 23, 9], ['umbilicaria', 15, 146, 144]]) {
      const gen = fd.readSpeciesGenus(realJson(slug + '.json'));
      assert.strictEqual(gen.ok, true, slug);
      assert.strictEqual(gen.entries.length, listed, slug + ': the rows its panel lists');
      const panel = fd.panelSquares(inv.byRow, gen.entries.map((e) => byName[e.name]));
      assert.strictEqual(panel.length, union, slug + ': every listed species\' squares');
      const token = new Set();
      sum.rows.forEach((r) => {
        if (fd.speciesSlugFor(r[0]) === slug) (inv.byRow.get(byName[r[0]]) || []).forEach((k) => token.add(k));
      });
      assert.strictEqual(token.size, tokenUnion, slug + ': what the old display-token filter reached');
    }
  });
});

describe('species squares (TASK-017): a square\'s species', () => {
  const inv = fd.invertSpeciesSquares(SQUARES);
  const rowsOf = (key) => inv.bySquare[key].map((i) => SUMMARY[i]);
  it('sorted by records, then name; nothing for an unknown key', () => {
    assert.deepStrictEqual(fd.squareSpeciesRows(rowsOf('55:81')).map((r) => r[0]), ['Russula vesca', 'Mycena haematopus'],
      '1,200 records above 210');
    assert.deepStrictEqual(fd.squareSpeciesRows(rowsOf('55:80')).map((r) => r[0]), ['Lactarius hatsudake', 'Mycena haematopus'],
      '900 above 210');
    assert.deepStrictEqual(fd.squareSpeciesRows(fd.invertSpeciesSquares(SQUARES).bySquare['99:99']), []);
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
  const fn = (name) => { const m = new RegExp('\\n( +)function ' + name + '\\([^)]*\\) \\{([\\s\\S]*?)\\n\\1\\}').exec(src); assert.ok(m, name + ' found'); return m[2]; };
  // openSquarePanel sits directly before renderNamePanel: the slice is its whole body.
  const panelBody = src.slice(src.indexOf('function openSquarePanel'), src.indexOf('function renderNamePanel'));

  it('loads on first need: the panels and the preview trigger ensureSquares', () => {
    assert.ok(/function ensureSquares\(\) \{/.test(src), 'the one entry point');
    assert.ok(/function showSpecies\(spec, source\) \{[\s\S]*?ensureSquares\(\);[\s\S]*?\n  \}/.test(src), 'a species panel');
    assert.ok(/function selectGenus\(genus, source\) \{[\s\S]*?ensureSquares\(\);[\s\S]*?\n  \}/.test(src), 'a genus panel');
    assert.ok(/function renderPreview\(tap, m\) \{[\s\S]*?ensureSquares\(\);[\s\S]*?\n  \}/.test(src), 'a square first tapped');
  });
  it('a first tap costs the index and the squares file only; the summary waits for a panel (TASK-017b review)', () => {
    assert.ok(!/ensureSummary|ensureNameIndex|names\./.test(fn('loadSquares')), 'the load touches no summary');
    assert.ok(/ensureNameIndex\(\)\.then\(/.test(panelBody), 'the square panel resolves its rows once the summary is in');
    assert.ok(/names\.rows\[i\]/.test(panelBody), 'an index resolves to its row through names.rows[i]');
  });
  it('the square panel fits the map to its square in one camera move, as a species panel fits its outline', () => {
    // planner check in WebKit: at national zoom a single square is a few pixels
    assert.ok(/openNameShell\(n\);[\s\S]*?state\.box = zoomBox\(cellEdges\(n\.cell\.row, n\.cell\.col\)\);\s*drawViews\(\);/.test(panelBody), 'one move, to the square');
    assert.strictEqual((panelBody.match(/state\.box =/g) || []).length, 1, 'never a stop at Japan in between');
  });
  it('a square panel row opens its species from the summary row, with no genus-file request to fail (PR #79 review)', () => {
    const pick = src.slice(src.indexOf('function pickNameRow'), src.indexOf('function speciesInLoaded'));
    assert.ok(/n\.id === 'square' \? \(n\.rows \|\| \[\]\)\.filter\(function \(x\) \{ return x\[0\] === name; \}\)\[0\] : null;\s*if \(r\) return showSpecies\(\{ row: r \}, 'search'\);/.test(pick),
      'a square row is a summary row: showSpecies from it, so a failed detail load lands in the panel');
  });
  it('names.json and squares.json share one species-file loader (TASK-017b review)', () => {
    assert.ok(/function loadSpeciesBundle\(bundle, path, parse\) \{/.test(src), 'the shared loader');
    assert.ok(/nameIndex\.pending = loadSpeciesBundle\(nameIndex, 'species\/names\.json',/.test(fn('loadNameIndex')), 'names.json through it');
    assert.ok(/squares\.pending = loadSpeciesBundle\(squares, 'species\/squares\.json',/.test(fn('loadSquares')), 'squares.json through it');
    assert.ok(/root\.fetch\(base \+ path, \{ cache: 'no-cache' \}\)/.test(src), 'one fetch, no-cache, like the summary');
    assert.ok(/\.catch\(function \(\) \{ bundle\.status = 'absent'; bundle\.at = Date\.now\(\); \}\)/.test(src), 'one catch to absent');
  });
  it('one shared promise, trusted by squares_sha256 against the index publication', () => {
    assert.ok(/var squares = \{ status: 'idle', byRow: null, bySquare: null, at: 0, pending: null \}/.test(src));
    assert.ok(/squaresTrusted\(sq, sha, species\.index\)/.test(fn('loadSquares')), 'sha + the index snapshot, no summary at load');
    assert.ok(/invertSpeciesSquares\(sq\.rows\)/.test(fn('loadSquares')), 'inverted once, from the raw rows');
    assert.ok(/squares\.status = 'ready'/.test(src), 'trusted lands ready');
  });
  it('a publication change reloads the bundle, and an open panel re-resolves its row', () => {
    assert.ok(/names\.status = 'idle';\s*\n\s*nameIndex\.status = 'idle';\s*\n\s*nameIndex\.jaBy = null;\s*\n\s*squares\.status = 'idle';\s*\n\s*squares\.byRow = squares\.bySquare = null;/.test(src));
    assert.ok(/if \(state\.name\) state\.name\.rowIdx = null;/.test(src), 'a stored row index never outlives its publication');
  });
  it("a species panel stores its summary row index when it opens and re-resolves by key otherwise (TASK-017b review)", () => {
    assert.ok(/rowIdx: spec\.row && names\.status === 'ready' \? names\.rows\.indexOf\(spec\.row\) : null/.test(fn('showSpecies')),
      'opened from a row (search, a square panel): the index is stored at open');
    const ns = fn('nameSquares');
    assert.ok(/speciesByKey\(names\.rows, n\.key\)/.test(ns), 'opened from an entry or a deep link: resolved by key');
    assert.ok(/names\.rows\.indexOf\(row\)/.test(ns), 'through the current publication\'s rows');
  });
  it("a genus panel's squares come from the rows it lists, not a second token filter (TASK-017b review)", () => {
    const ns = fn('nameSquares');
    assert.ok(/nameRowIdx\(names\.rows\)\[e\.name\]/.test(ns), 'each listed entry by its display name, COL aliases included');
    assert.ok(!/speciesSlugFor/.test(ns), 'no token filter');
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
  it('the legend entry in both languages, only while squares are drawn — and it says all kinds (TASK-017b review)', () => {
    assert.ok(/sqSpecies: \['Squares recording this species \(all time, all kinds\)', 'この種が記録されたマス（全期間・すべての菌類）'\]/.test(src));
    assert.ok(/sqGenus: \["Squares recording this genus' species \(all time, all kinds\)", 'この属の種が記録されたマス（全期間・すべての菌類）'\]/.test(src));
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
  it('the square panel: title, meta with all kinds, Japan-wide column, sorted rows, the chip — and no hash', () => {
    assert.ok(/squareTitle: \['Square \{key\}', 'マス \{key\}'\]/.test(src));
    assert.ok(/squareMeta: \['About 10 km · \{n\} species \(all time, all kinds\)', '約10km四方 · 種 \{n\}（全期間・すべての菌類）'\]/.test(src));
    assert.ok(/recJapan: \['Records in Japan', '全国の記録数'\]/.test(src), 'the file has no per-square count: the column is Japan-wide');
    assert.ok(/var head = \[t\('sp'\), t\('recJapan'\)\];/.test(fn('squareRowsHtml')), 'the square table head');
    assert.ok(/b\[4\] - a\[4\]/.test(fn('squareSpeciesRows')), 'still sorted by that count');
    assert.ok(/openNameShell\(n\)/.test(panelBody) && /filterChanged\(\)/.test(panelBody), 'a name-panel shell');
    assert.ok(!/pushUrl|selectArea\(/.test(panelBody), 'no hash, never through selectArea()');
    assert.ok(/if \(n\.id === 'square'\) \{[\s\S]*?squareRowsHtml\(n\.rows\)/.test(src), 'the inspector branch');
    assert.ok(/function squareRowsHtml\(rows\) \{[\s\S]*?fd-name-toggle/.test(src), 'each row a 44 px button');
    assert.ok(/squareSpeciesRows\(/.test(panelBody), 'the rows come sorted, by records');
    assert.ok(/chipSquare: \['Square: \{name\}', 'マス：\{name\}'\]/.test(src));
    assert.ok(/n\.id === 'square' \? 'chipSquare' : 'chipSpecies'/.test(src), 'the chip joins 表示中');
  });
  it('the square is outlined in the locate-cell style on both renderers', () => {
    assert.ok(/squareCell: function \(\) \{ return state\.name && state\.name\.id === 'square' \? state\.name\.cell : null; \}/.test(src),
      'squareCell feeds the street map');
    assert.ok(/cellRing\(sc\.key, shared\.cellEdges\)/.test(fm), 'the street map draws it like the located cell');
    assert.ok(/state\.name && state\.name\.id === 'square' \? state\.name\.cell : null/.test(src), 'the SVG reuses the locate rect');
  });
  it('one parseCellKey for every "row:col" key (TASK-017b review)', () => {
    const CELL_RE = /^(\d+):(\d+)$/;
    assert.strictEqual(src.split(CELL_RE.source).length - 1, 1, 'the pattern is written out once, in parseCellKey');
    for (const f of ['boundaryRings', 'readSpeciesSquares', 'outlineBox', 'openSquarePanel']) assert.ok(/parseCellKey\(/.test(fn(f)), f);
    assert.ok(/parseCellKey\(k\)/.test(src), 'the SVG cell set draws through it');
    assert.ok(/parseCellKey: parseCellKey/.test(src), 'exported beside meshCell/cellEdges');
  });
  it('absence breaks nothing: the shared catch degrades to absent, every reader gated', () => {
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
