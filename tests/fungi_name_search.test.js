#!/usr/bin/env node
/**
 * Unit tests for name search, Phase 1 (TASK-014, filters-and-search-plan S1): scientific
 * names over every published species and genus, fed by species/summary.json.
 * Pure helpers of assets/js/fungi-dashboard.js; the browser wiring is asserted at source
 * level in tests/fungi_dashboard.test.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const fd = require('../assets/js/fungi-dashboard.js');
const SNAP = 'a'.repeat(64);

// Invented rows in the summary shape: [name, col_key|null, legacy_key|null, area_count,
// record_count, mhlw, endemic]. Nothing here stands for a real masked species.
const ROWS = [
  ['Lactarius hatsudake', 'A1', null, 50, 900, false, true],
  ['Lactarius hatsudake var. minor', 'A2', null, 2, 9, true, false],
  ['Lactarius hatusensis', 'A3', null, 5, 40, false, false],
  ['Lactarius vividus', 'A4', null, 30, 300, false, false],
  ['Russula hatsudake', null, '77', 12, 80, false, false],       // an epithet shared with another genus
  ['Russula vesca', 'B2', null, 60, 1200, false, false],
  ['Myena hatsudake', 'C1', null, 1, 1, false, false],
  ['Mycena haematopus', 'C2', null, 25, 210, true, false],
  ['Mycenula haematopus', 'D1', null, 3, 12, false, false],
  ['Amanita muscaria', 'E1', '5', 70, 4000, true, false],
  ['Amanita neo-ovoidea', 'E2', null, 4, 30, false, false],
  ['Amanita regalis', 'E3', null, 1, 2, false, false],           // obscure: one area
  ['Amanita regalispora', 'E4', null, 50, 900, false, false],    // popular: the query is a prefix of its name
  ['Inocybe éburnea', 'F1', null, 2, 7, false, false],
  ['Inocybe oidodes', null, '9', 8, 60, false, false]
];

describe('name search (TASK-014): summary reader', () => {
  const good = { schema_version: 1, snapshot: SNAP, generated: '2026-11-24', species: ROWS };
  it('accepts the published shape and hands back the rows and the snapshot', () => {
    const r = fd.readSpeciesSummary(good);
    assert.deepStrictEqual([r.ok, r.snapshot, r.rows.length], [true, SNAP, ROWS.length]);
  });
  it('rejects anything else', () => {
    for (const bad of [null, {}, { schema_version: 1, snapshot: SNAP }, { schema_version: 0, snapshot: SNAP, species: [] },
      { schema_version: 1, snapshot: 'nope', species: [] }, { schema_version: 1, snapshot: SNAP, species: 'x' },
      { schema_version: 1, snapshot: SNAP, species: [['A b', 1]] }, { schema_version: 1, snapshot: SNAP, species: [['A b', 1, null, 1, 1, false, false], [7]] }])
      assert.strictEqual(fd.readSpeciesSummary(bad).ok, false, JSON.stringify(bad));
  });
  it('reads the real published summary: 12k rows, and its snapshot is the species index snapshot', () => {
    const sum = fd.readSpeciesSummary(JSON.parse(readFileSync(new URL('../assets/data/shroomhunt/species/summary.json', import.meta.url), 'utf8')));
    const idx = JSON.parse(readFileSync(new URL('../assets/data/shroomhunt/species/index.json', import.meta.url), 'utf8'));
    assert.strictEqual(sum.ok, true);
    assert.ok(sum.rows.length > 10000);
    assert.strictEqual(sum.snapshot, idx.snapshot, 'summary and species index are one bundle');
  });
  it('searches the real summary: an obscure exact binomial is the first result; every hit resolves to a file', () => {
    const idx = JSON.parse(readFileSync(new URL('../assets/data/shroomhunt/species/index.json', import.meta.url), 'utf8'));
    const rows = fd.readSpeciesSummary(JSON.parse(readFileSync(new URL('../assets/data/shroomhunt/species/summary.json', import.meta.url), 'utf8'))).rows;
    const one = rows.filter((r) => r[3] === 1 && /^[A-Z][a-z]+ [a-z]+$/.test(r[0])).map((r) => r[0]);
    assert.ok(one.length > 1000);
    for (const name of [one[0], one[Math.floor(one.length / 2)], one[one.length - 1], 'Trametes versicolor']) {
      const hits = fd.searchNames(rows, name.toLowerCase());
      assert.strictEqual(hits.species[0].row[0].toLowerCase(), name.toLowerCase(), name);
      assert.strictEqual(hits.species[0].rank, 0);
      assert.ok(hits.genera.every((g) => idx.files[fd.genusFileSlug(g.genus, idx.aliases)]), name + ': genus hits have files');
    }
    assert.deepStrictEqual(fd.searchNames(rows, 'zzzz qqqq'), { species: [], genera: [] });
  });
});

describe('name search (TASK-014): isLatinQuery', () => {
  it('accepts letters and spaces, a binomial included, from two letters', () => {
    for (const q of ['ru', 'Russula', '  amanita ', 'Amanita muscaria', 'na ha', 'x y', 'Chūbu', 'boletus luridiformis var']) assert.strictEqual(fd.isLatinQuery(q), true, q);
  });
  it('rejects one letter, nothing, Japanese, digits and punctuation', () => {
    for (const q of ['a', ' a ', '', 'マツタケ', '那覇', 'ab1', 'a-', '...', '12-34']) assert.strictEqual(fd.isLatinQuery(q), false, q);
  });
});

describe('name search (TASK-014): searchNames', () => {
  const names = (q, limit) => fd.searchNames(ROWS, q, limit).species.map((h) => h.row[0]);
  const genera = (q, limit) => fd.searchNames(ROWS, q, limit).genera.map((g) => g.genus);
  it('ranks exact > prefix > substring, then area count desc, then name', () => {
    const hits = fd.searchNames(ROWS, 'lactarius vividus').species;
    assert.deepStrictEqual(hits.map((h) => [h.row[0], h.rank]), [['Lactarius vividus', 0]]);
    const pre = fd.searchNames(ROWS, 'lactarius hats').species.map((h) => [h.row[0], h.rank]);
    assert.deepStrictEqual(pre, [['Lactarius hatsudake', 1], ['Lactarius hatsudake var. minor', 1]]); // 50, 2 areas; hatusensis is no "hats"
    const sub = fd.searchNames(ROWS, 'actarius hats').species.map((h) => h.rank);
    assert.deepStrictEqual(sub, [2, 2]); // a substring on the genus word: every hit ranks as substring
    assert.deepStrictEqual(names('mycena hae'), ['Mycena haematopus']); // the other Mycena has more areas but no prefix hit
  });
  it('an epithet-only query matches the second word of any genus, most areas first', () => {
    assert.deepStrictEqual(names('hatsudake'), ['Lactarius hatsudake', 'Russula hatsudake', 'Lactarius hatsudake var. minor', 'Myena hatsudake']);
    assert.deepStrictEqual(fd.searchNames(ROWS, 'hatsudake').species.map((h) => h.rank), [0, 0, 0, 0]);
    assert.deepStrictEqual(names('hatu'), ['Lactarius hatusensis']); // epithet prefix
    assert.deepStrictEqual(names('hatudake'), [], 'no fuzzy match: a miss is a miss');
  });
  it('a one-word query ranks the genus word and the epithet alike, exact first', () => {
    assert.deepStrictEqual(fd.searchNames(ROWS, 'mycena').species.map((h) => [h.row[0], h.rank]),
      [['Mycena haematopus', 0]]); // Mycena is no prefix of Mycenula, nor of Myena
    assert.deepStrictEqual(fd.searchNames(ROWS, 'ycena').species.map((h) => [h.row[0], h.rank]), [['Mycena haematopus', 2]]);
  });
  it('three or more words match the full name by prefix (infraspecific names)', () => {
    assert.deepStrictEqual(names('lactarius hatsudake var'), ['Lactarius hatsudake var. minor']);
    assert.strictEqual(fd.searchNames(ROWS, 'lactarius hatsudake var').species[0].rank, 1, 'a prefix of a longer name is not an exact match');
    assert.deepStrictEqual(names('lactarius hatsudake minor'), [], 'word positions are fixed');
    assert.deepStrictEqual(names('lactarius hatsudake x'), []);
  });
  it("David's test: an obscure exact binomial outranks a popular near-match", () => {
    const hits = fd.searchNames(ROWS, 'amanita regalis').species;
    assert.strictEqual(hits[0].row[0], 'Amanita regalis');
    assert.strictEqual(hits[0].row[3], 1);
    assert.strictEqual(hits[1].row[0], 'Amanita regalispora');
  });
  it('case and diacritics never hide a species', () => {
    assert.deepStrictEqual(names('INOCYBE EBURNEA'), ['Inocybe éburnea']);
    assert.deepStrictEqual(names('  INOCYBE   eburnea '), ['Inocybe éburnea'], 'typed without its diacritic, extra spaces');
    assert.strictEqual(fd.searchNames(ROWS, 'Amanita  muscaria').species[0].rank, 0, 'extra spaces fold away');
  });
  it('genus groups come from the first word, ranked, capped', () => {
    assert.deepStrictEqual(genera('ama'), ['Amanita']);
    assert.deepStrictEqual(genera('amanita muscaria'), ['Amanita'], 'a binomial still offers its genus');
    assert.deepStrictEqual(genera('lactarius hats'), ['Lactarius']);
    assert.deepStrictEqual(genera('zzz'), []);
    assert.deepStrictEqual(genera('hatsudake'), [], 'an epithet-only query names no genus');
    assert.deepStrictEqual(genera('ycen'), ['Mycena', 'Mycenula'], 'substring on the first word; a tie breaks alphabetically');
    assert.deepStrictEqual(genera('my'), ['Mycena', 'Mycenula', 'Myena'], 'prefix ties break alphabetically');
    assert.deepStrictEqual(genera('lactarius'), ['Lactarius'], 'one genus, four species');
  });
  it('caps each list and stays quiet on empty input', () => {
    const many = Array.from({ length: 12 }, (_, i) => ['Genus' + i + ' alpha', String(i), null, i, i, false, false]);
    assert.strictEqual(fd.searchNames(many, 'genus', 8).species.length, 8);
    assert.strictEqual(fd.searchNames(many, 'genus').species.length, 8);
    assert.strictEqual(fd.searchNames(many, 'genus', 3).species.length, 3);
    assert.strictEqual(fd.searchNames(many, 'genus', 3).genera.length, 3);
    assert.deepStrictEqual(fd.searchNames(ROWS, ''), { species: [], genera: [] });
    assert.deepStrictEqual(fd.searchNames(null, 'amanita'), { species: [], genera: [] });
  });
});

describe('name search (TASK-014): genus file slug and key lookup', () => {
  it('resolves the genus file slug of a hit through aliases', () => {
    const aliases = { bombyliospora: 'megalospora' };
    assert.strictEqual(fd.genusFileSlug('Bombyliospora', aliases), 'megalospora');
    assert.strictEqual(fd.genusFileSlug('Bombyliospora japonica', aliases), 'megalospora');
    assert.strictEqual(fd.genusFileSlug('Amanita', aliases), 'amanita');
    assert.strictEqual(fd.genusFileSlug('Amanita', {}), 'amanita');
    assert.strictEqual(fd.genusFileSlug('', aliases), null);
    assert.strictEqual(fd.genusFileSlug(null, aliases), null);
  });
  it('finds a summary row by COL key, then by legacy key; an absent key is null', () => {
    assert.strictEqual(fd.speciesByKey(ROWS, 'A1')[0], 'Lactarius hatsudake');
    assert.strictEqual(fd.speciesByKey(ROWS, '77')[0], 'Russula hatsudake');
    assert.strictEqual(fd.speciesByKey(ROWS, '9')[0], 'Inocybe oidodes');
    assert.strictEqual(fd.speciesByKey(ROWS, 'ZZZZ'), null);
    assert.strictEqual(fd.speciesByKey(null, 'A1'), null);
  });
  it('the real bundle: every summary first token resolves to a published genus file', () => {
    const sum = fd.readSpeciesSummary(JSON.parse(readFileSync(new URL('../assets/data/shroomhunt/species/summary.json', import.meta.url), 'utf8')));
    const idx = JSON.parse(readFileSync(new URL('../assets/data/shroomhunt/species/index.json', import.meta.url), 'utf8'));
    const missing = sum.rows.filter((r) => !idx.files[fd.genusFileSlug(r[0], idx.aliases)]);
    assert.strictEqual(missing.length, 0, missing.slice(0, 3).map((r) => r[0]).join(', '));
  });
});

describe('name search (TASK-014): no-match message by context', () => {
  it('a Latin miss explains scientific-name search; a place or Japanese miss says only 該当なし', () => {
    assert.strictEqual(fd.noMatchKind('zzzqq'), 'names');
    assert.strictEqual(fd.noMatchKind('amanita zzz'), 'names');
    assert.strictEqual(fd.noMatchKind('Hateruma'), 'names'); // Latin letters are a name query, whatever the visitor meant
    assert.strictEqual(fd.noMatchKind('波照間'), 'plain');   // the reported bug: a place miss carried the masking note
    assert.strictEqual(fd.noMatchKind(''), 'plain');
  });
});

describe('name search (TASK-014): outline id sets', () => {
  const INDEX = {
    areas: [
      { id: 'okinawa-honto', kind: 'island', bbox: [26.07, 26.88, 127.63, 128.33] },
      { id: 'yakushima', kind: 'island', bbox: [30.2, 30.5, 130.2, 130.6] },
      { id: 't5339', kind: 'tile', bbox: [35, 36, 139, 140] },
      { id: 'g-ok', kind: 'group', bbox: [24, 27.1, 122.9, 131.4] }
    ],
    cells: { '314:1021': 'okinawa-honto', '427:1118': 't5339', '427:1119': 't5339', '360:1041': 'yakushima', '428:1118': 't5440', '300:1000': 'g-ok' }
  };
  const entry = { key: 'E1', name: 'Amanita muscaria', area_ids: ['okinawa-honto', 't5339', 'ghost'], could_be_found_area_ids: ['yakushima', 't5339'] };
  it('a species outlines area_ids solid and could_be_found_area_ids dashed, never both', () => {
    assert.deepStrictEqual(fd.nameOutline(entry), { solid: ['okinawa-honto', 't5339', 'ghost'], dashed: ['yakushima'] });
    assert.deepStrictEqual(fd.nameOutline({ area_ids: null, could_be_found_area_ids: null }), { solid: [], dashed: [] });
    assert.deepStrictEqual(fd.nameOutline(null), { solid: [], dashed: [] });
  });
  it('splits an id set into islands (by index bbox) and tile cells, dropping unknown ids and groups', () => {
    const o = fd.areaOutline(['okinawa-honto', 't5339', 'g-ok', 'yakushima', 'nope'], INDEX);
    assert.deepStrictEqual(o.islands.map((a) => a.id), ['okinawa-honto', 'yakushima']);
    assert.deepStrictEqual(o.keys.sort(), ['427:1118', '427:1119'], 'only tile cells; islands draw their bbox');
    assert.deepStrictEqual(fd.areaOutline([], INDEX), { islands: [], keys: [] });
    assert.deepStrictEqual(fd.areaOutline(['t5339'], null), { islands: [], keys: [] });
  });
  it('the genus union is every area of its species, once each', () => {
    const entries = [
      { name: 'a', area_ids: ['t5339', 'okinawa-honto'] },
      { name: 'b', area_ids: ['t5339', 'yakushima'] },
      { name: 'c', area_ids: [] }, { name: 'd' }
    ];
    assert.deepStrictEqual(fd.genusAreaIds(entries), ['t5339', 'okinawa-honto', 'yakushima']);
    assert.deepStrictEqual(fd.genusAreaIds([]), []);
    assert.deepStrictEqual(fd.genusAreaIds(null), []);
  });
  it('the camera fits the outline, padded like an area, and never wider than Japan', () => {
    const one = fd.outlineBox(fd.areaOutline(['okinawa-honto'], INDEX));
    assert.ok(one.latMin < 26.07 && one.latMax > 26.88 && one.lonMin < 127.63 && one.lonMax > 128.33);
    const wide = fd.outlineBox(fd.areaOutline(['okinawa-honto', 't5339', 'yakushima'], INDEX));
    assert.ok(wide.latMin >= fd.JAPAN_BOX.latMin && wide.latMax <= fd.JAPAN_BOX.latMax && wide.lonMin >= fd.JAPAN_BOX.lonMin && wide.lonMax <= fd.JAPAN_BOX.lonMax);
    assert.strictEqual(fd.outlineBox({ islands: [], keys: [] }), null);
    const tiles = fd.outlineBox(fd.areaOutline(['t5339'], INDEX));
    assert.ok(tiles.latMin < 427 / 12 && tiles.latMax > 428 / 12 && tiles.lonMin < 1118 / 8 && tiles.lonMax > 1120 / 8,
      'the camera fits the outlined cells, by their exact edges');
  });
});

// ---- page wiring (source level: these paths only run in the browser)
describe('name search (TASK-014): page wiring (source level)', () => {
  const src = readFileSync(new URL('../assets/js/fungi-dashboard.js', import.meta.url), 'utf8');
  const fm = readFileSync(new URL('../assets/js/fungi-field-map.js', import.meta.url), 'utf8');
  const inc = readFileSync(new URL('../_includes/fungi_dashboard.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/css/fungi-dashboard.css', import.meta.url), 'utf8');
  const fn = (name) => { const m = new RegExp('\\n( +)function ' + name + '\\([^)]*\\) \\{([\\s\\S]*?)\\n\\1\\}').exec(src); assert.ok(m, name + ' found'); return m[2]; };

  it('a summary is trusted only by its sha256 and its snapshot against the species index', () => {
    const SNAP2 = 'b'.repeat(64);
    const sum = { ok: true, snapshot: SNAP };
    const idx = { snapshot: SNAP, summary_sha256: 'f'.repeat(64) };
    assert.strictEqual(fd.summaryTrusted(sum, 'f'.repeat(64), idx), true);
    assert.strictEqual(fd.summaryTrusted(sum, 'e'.repeat(64), idx), false, 'another sha');
    assert.strictEqual(fd.summaryTrusted(sum, 'f'.repeat(64), { snapshot: SNAP2, summary_sha256: 'f'.repeat(64) }), false, 'another snapshot');
    assert.strictEqual(fd.summaryTrusted(sum, null, idx), true, 'no WebCrypto (insecure context): the snapshot alone decides');
    assert.strictEqual(fd.summaryTrusted(sum, null, { snapshot: SNAP2 }), false);
    assert.strictEqual(fd.summaryTrusted(sum, 'f'.repeat(64), { snapshot: SNAP }), true, 'an index without summary_sha256 cannot be compared');
    assert.strictEqual(fd.summaryTrusted({ ok: false }, 'f'.repeat(64), idx), false);
    assert.strictEqual(fd.summaryTrusted(sum, 'f'.repeat(64), null), false);
    assert.strictEqual(fd.summaryTrusted(null, null, null), false);
  });
  it('loads summary.json on demand, never at boot, and never per keystroke', () => {
    assert.ok(src.includes("base + 'species/summary.json'"), 'the summary is fetched');
    assert.ok(/root\.crypto && root\.crypto\.subtle/.test(src) && src.includes("'SHA-256'"), 'sha256 through WebCrypto');
    assert.ok(src.includes('summaryTrusted('), 'the pure check decides');
    assert.ok(/function loadSummary\(bypass\)/.test(src) && /cache: bypass \? 'reload' : 'no-cache'/.test(src), 'one bypassed refetch is the standard treatment');
    const ensure = fn('ensureSummary');
    assert.ok(/names\.status === 'idle'/.test(ensure), 'only an idle (or long-dead) summary starts a fetch');
    const run = fn('run');
    assert.ok(!/fetch\(|loadSummary\(/.test(run), 'the input handler fetches nothing itself');
    assert.ok(/search\.live = false; \}/.test(fn('finish')) && /if \(search\.live && \(!results\.hidden \|\| doc\.activeElement === input\)\) run\(\);/.test(src),
      'a pick ends the query: a payload landing afterwards never reopens the popup');
    assert.ok(/var latin = isLatinQuery\(q\);\s*if \(latin\) ensureSummary\(\);/.test(run), 'the first Latin query asks for the summary');
    assert.ok(/names: latin && names\.status === 'ready' \? \{ rows: names\.rows \} : null/.test(run), 'names join the query from memory once loaded');
    const start = src.slice(src.indexOf('function start() {'));
    assert.ok(!/summary\.json|loadSummary\(/.test(start), 'boot requests no summary');
  });
  it('mesh-research.json is not requested at boot; it loads on the first non-default filter and on the first genus pick', () => {
    const start = src.slice(src.indexOf('function start() {'));
    assert.ok(!/loadResearch\(/.test(start), 'no boot probe');
    assert.ok(src.includes("mapMode(state.month, state.kind) === 'estimate' && !research.fetched && !research.loading) loadResearch(false)"), 'first non-default filter');
    assert.ok(/function selectGenus\(genus, source\) \{[\s\S]*?loadResearch\(false\)/.test(src), 'first genus pick');
  });
  it('no-match message by context; the masking caption stays under the box and never joins a miss', () => {
    assert.ok(src.includes("note(nn || t(noMatchKind(q) === 'names' ? 'noResultsNames' : 'noResults'))"), 'the miss picks per query type');
    // found in the browser: concatenating noResults + noResultsNames read 「該当なし。 該当なし。学名…」
    assert.ok(!/t\('noResults'\) \+ \(noMatchKind/.test(src), 'the Latin message is whole on its own: it already opens with 該当なし');
    assert.ok(src.includes("t(names.status === 'loading' ? 'namesLoading' : 'namesUnavailable')"), 'and never answers for names not yet searched');
    assert.ok(!/t\('noResults'\) \+ \(researchReady\(\)/.test(src), 'the masking note no longer rides a miss');
    assert.ok(/geo\.status === 'loading' \? t\('geoLoading'\) : t\('masking'\)/.test(src), 'the caption shows whatever the payload did');
    for (const gone of ['genusScopeNote', 'genusLoad', 'genusUnavailable', 'genusResults', 'genusScope']) assert.ok(!src.includes(gone), gone + ' is gone');
  });
  it('the 表示中 line carries the 種／属 chip; its ✕ and すべて解除 clear the panel', () => {
    assert.ok(src.includes('var chips = activeFilters(state, lang, nameChip());'));
    assert.ok(/function clearFilter\(id\) \{[\s\S]*?state\.kind = 'all';[\s\S]*?if \(id === '\*' \|\| \(state\.name && id === state\.name\.id\)\) closeName\(true\);[\s\S]*?filterChanged\(\);/.test(src));
    assert.ok(src.includes("chipSpecies: ['Species: {name}', '種：{name}']") && src.includes("chipGenus: ['Genus: {name}', '属：{name}']"));
  });
  it('one surface: #species-<key> deep links open the panel, a key in no loaded area resolves through the summary by key', () => {
    assert.ok(!inc.includes('id="fd-species-card"') && !src.includes('showSpeciesCard'), 'the card under the workspace is gone');
    assert.ok(/function openSpeciesByKey\(key\) \{[\s\S]*?speciesByKey\(names\.rows, key\)/.test(src), 'the summary resolves a bare key');
    assert.ok(/function trySpeciesHash\(\) \{[\s\S]*?openSpeciesByKey\(key\)/.test(src), 'the router reaches it');
    assert.ok(/routeFromLocation[\s\S]*?parseSpeciesHash\(h\)[\s\S]*?trySpeciesHash\(\)/.test(src));
    assert.ok(!fn('selectGenus').includes('#species-'), 'a genus pick writes no species hash');
    assert.ok(src.includes("pushUrl('#species-' + key)"), 'a species pick sets its hash');
    assert.ok(/function pushUrl\(url, how\) \{[\s\S]*?lastRoute = root\.location\.href;/.test(src),
      'found in the browser: the router ignored Back onto a href it had only seen through an event');
  });
  it('a key absent from everything gives the generic miss, and nothing names it', () => {
    const miss = fn('nameMissHtml');
    assert.ok(!/key|mask|label/.test(miss), 'the miss builder takes no key and names nothing');
    assert.ok(miss.includes("st('noPage', lang)"));
    assert.ok(/showNameMiss\(\)/.test(fn('openSpeciesByKey')), 'the deep-link path ends in it');
    assert.ok(/names\.status !== 'ready'\) return settle\(\{ miss: t\('namesUnavailable'\) \}\);/.test(fn('openSpeciesByKey')), 'a summary that never loaded is not a denial');
    // found in the browser: the crumb read 「日本全体 › 」 — a separator with nothing after it
    assert.ok(/\$\('fd-crumb-sep'\)\.hidden = \$\('fd-crumb-area'\)\.hidden = !name;/.test(fn('setCrumb')), 'a miss has no name: the crumb shows 日本全体 alone');
  });
  it('a deep-link lookup that lands after the visitor moved on changes nothing, and lets Back try again (PR #75 review)', () => {
    const open = fn('openSpeciesByKey');
    // every outcome goes through settle(), whose first act is the route check: a failure that
    // lands after an area was picked must not replace that area with the miss panel
    assert.ok(!/showNameMiss\(/.test(open.replace(/function settle\(x\) \{[\s\S]*?\n    \}/, '')), 'no outcome bypasses settle()');
    const settle = /function settle\(x\) \{([\s\S]*?)\n    \}/.exec(open)[1];
    assert.ok(/^\s*\/\/ a summary row[\s\S]*?if \(parseSpeciesHash\(root\.location\.hash\) !== key\) \{/.test(settle), 'the route is checked before anything shows');
    assert.ok(/parseSpeciesHash\(root\.location\.hash\) !== key\) \{[\s\S]*?speciesTriedKey = null;[\s\S]*?return;/.test(settle), 'a superseded lookup releases the guard, so Back re-attempts the key');
    assert.ok(/else if \(x && x\.miss\) showNameMiss\(x\.miss\);/.test(settle), 'an unavailable summary is one of the settled outcomes');
    const tried = fn('trySpeciesHash');
    assert.ok(/if \(!key \|\| key === speciesTriedKey\) return;\s*speciesTriedKey = key;/.test(tried), 'the guard still stops a second show of the same key');
  });
  it('dead geography never disables the box: scientific names load on their own (PR #75 review)', () => {
    const avail = /function avail\(\) \{([\s\S]*?)\n    \}/.exec(src)[1];
    assert.ok(!/input\.disabled/.test(avail), 'the input stays enabled');
    assert.ok(/dead \? t\('geoDead'\)/.test(avail), 'the note says what is unavailable and what still works');
    const m = /\n    geoDead: \['([^']+)', '([^']+)'\]/.exec(src);
    assert.ok(m && /Scientific names/.test(m[1]) && /学名/.test(m[2]), 'geoDead is paired and names the working search');
    assert.ok(!/\bsearchUnavailable/.test(src), 'the old all-search-unavailable text is gone (researchUnavailable is another key)');
  });
  it('panels never go through selectArea(); the crumb and an outlined area do', () => {
    for (const f of ['selectGenus', 'showSpecies', 'closeName', 'openNameShell']) assert.ok(!/selectArea\(/.test(fn(f)), f + ' never selects an area');
    assert.ok(/function selectArea\(id, source\) \{[\s\S]*?closeName\(\);/.test(src), 'selecting an area closes the panel');
    assert.ok(/function clearArea\(keepHash\) \{[\s\S]*?closeName\(\);/.test(src), 'the Japan crumb closes the panel');
    assert.ok(/data-nm-area=/.test(src) && /closest\('\[data-nm-area\], \[data-nm-name\]'\)[\s\S]*?selectArea\(t\.getAttribute\('data-nm-area'\), 'toolbar'\)/.test(src), 'an outlined area in the secondary list selects through selectArea()');
  });
  it('the camera moves once per panel: to the outline, or to Japan for a miss — never to Japan in between', () => {
    // Found in the browser: opening a panel over another one first moved the map to Japan,
    // then to the outline. On the street map the Japan move (a small zoom step) is animated
    // and queued for the next frame; the outline move (a jump of 4+ levels) is immediate — so
    // the queued one ran last and dragged the map back: genus → species showed all of Japan.
    assert.ok(!/JAPAN_BOX/.test(fn('openNameShell')), 'opening a panel leaves the camera to nameOutlined()');
    assert.ok(/if \(push\) \{ state\.box = JAPAN_BOX; drawViews\(\); if \(root\.location\.hash\) pushUrl\(root\.location\.pathname\); \}/.test(fn('closeName')),
      "only a visitor's close (the chip, Escape) returns the camera itself");
    assert.ok(/state\.box = JAPAN_BOX; drawViews\(\);/.test(fn('showNameMiss')), 'a miss has no outline: the Japan view');
    // the internal callers of closeName() each set the camera themselves
    assert.ok(/state\.box = zoomBox\(row\.bbox\);/.test(fn('selectArea')) && /state\.box = JAPAN_BOX;/.test(fn('clearArea')));
    for (const f of ['showSpecies', 'selectGenus']) assert.ok(/nameOutlined\(\)/.test(fn(f)), f + ' fits the outline');
  });
  it('both renderers draw the same outline sets', () => {
    assert.ok(src.includes('ringPath(o.keys)') && /o\.islands\.forEach/.test(src), 'the simple map draws tile rings and island boxes');
    assert.ok(/if \(state\.nout\) \['solid', 'dashed'\]\.forEach/.test(src), 'both sets');
    assert.ok(fm.includes('ctx.nameOutlines()'), 'the street layer reads the shared sets');
    assert.ok(/nameOutlines: function \(\) \{ return state\.nout; \}/.test(src), 'the dashboard hands them over');
    assert.ok(/outlineKeys|boundaryRings\(o\.keys, shared\.cellEdges\)/.test(fm), 'street tiles dissolve through boundaryRings');
    assert.ok(/L\.rectangle\(/.test(fm), 'street islands draw their bbox');
    assert.ok(/is-dash/.test(src) && /'8 4'|8 4/.test(fm), 'dashed on both');
  });
  it('the include carries the panel, the legend entries in both languages, the new search copy and a bumped stamp', () => {
    assert.ok(/<section\b[^>]*id="fd-name"[^>]*>/.test(inc) && /\bhidden\b/.test(/<section\b[^>]*id="fd-name"[^>]*>/.exec(inc)[0]), 'the panel ships hidden');
    for (const id of ['fd-name-title', 'fd-name-meta', 'fd-name-body']) assert.ok(inc.includes(`id="${id}"`), id);
    assert.ok(inc.indexOf('id="fd-name"') > inc.indexOf('class="fd-card fd-inspector"') && inc.indexOf('id="fd-name"') < inc.indexOf('class="fd-national"'), 'the panel lives in the inspector');
    for (const s of ['種まで同定された記録のある地域', 'Areas with species-level records', 'fd-map__outline--dash', 'id="fd-legend-name"']) assert.ok(inc.includes(s), s);
    assert.ok(inc.includes('島・地名・属名・種名で検索') && inc.includes('Search islands, places, genus or species names'), 'label and placeholder');
    assert.strictEqual((inc.match(/Search islands, places, genus or species names/g) || []).length, 2, 'label and placeholder');
    assert.ok(inc.includes('?v=2026-11-25-1'), 'CSS stamp bumped');
    assert.ok(/\.fd-legend__name \{ display: none; \}/.test(css) && /\.fd-legend__name\.is-on \{ display: contents; \}/.test(css));
    assert.ok(/\.fd-legend i\.fd-map__outline \{[^}]*border: 2px solid var\(--fd-sel-core\)/.test(css) && !/--fd-name/.test(css), 'outline swatches reuse the selection tokens: no new colour token');
    assert.ok(/\.fd-name \.fd-seg button \{ min-height: 44px; \}/.test(css), '44 px targets in the secondary list');
  });
  it('every new string the script adds is paired EN/JA', () => {
    for (const k of ['noResultsNames', 'namesLoading', 'namesUnavailable', 'chipSpecies', 'chipGenus', 'genusSquares']) {
      const m = new RegExp("\\n    " + k + ": \\['[^']+', '[^']+'\\],?\\n").exec(src);
      assert.ok(m, k + ' must be a paired [EN, JA] string');
    }
    assert.ok(src.includes("sgGenera: ['Genera', '属']") && src.includes("sgSpecies: ['Species', '種']"));
  });
});
