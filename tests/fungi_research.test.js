#!/usr/bin/env node
/**
 * Unit tests for the research filters and place/genus search helpers of
 * assets/js/fungi-dashboard.js (TASK-004, map-improvement-plan §5 row 3B).
 * The producer (ShroomHunt 3A) is not built yet, so every payload here follows
 * the frozen §6 Research shape.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fd = require('../assets/js/fungi-dashboard.js');

const SNAP = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);

function research(over) {
  return Object.assign({
    schema_version: 1,
    snapshot: SNAP,
    slices: [
      [0, 'all', [['314:1021', 2, null]]],
      [0, 'm', [['314:1021', 1, 0], ['315:1022', 4, null]]],
      [6, 'm', [['314:1021', 0, 4]]]
    ],
    genera: [['Amanita', ['okinawa-honto']]]
  }, over);
}

describe('research: reader', () => {
  it('accepts a valid v1 payload', () => {
    const r = fd.readResearch(research());
    assert.deepStrictEqual([r.ok, r.snapshot], [true, SNAP]);
    assert.strictEqual(r.data.slices.length, 3);
  });
  it('requires v1 with a snapshot (research never existed as v0)', () => {
    const noVer = research();
    delete noVer.schema_version;
    assert.strictEqual(fd.readResearch(noVer).ok, false);
    assert.strictEqual(fd.readResearch(research({ schema_version: 2 })).ok, false);
    assert.strictEqual(fd.readResearch(research({ schema_version: '1' })).ok, false);
    assert.strictEqual(fd.readResearch(research({ snapshot: 'nope' })).ok, false);
  });
  it('rejects malformed slices, cells and genera', () => {
    for (const bad of [
      research({ slices: 'x' }),
      research({ slices: [[13, 'm', []]] }),          // month 13
      research({ slices: [[-1, 'm', []]] }),          // negative month
      research({ slices: [['6', 'm', []]] }),         // non-numeric month
      research({ slices: [[6, 'x', []]] }),           // unknown kind
      research({ slices: [[6, 'M', []]] }, ),         // kinds are lowercase
      research({ slices: [[6, 'm', 'cells']] }),
      research({ slices: [[6, 'm', [['bad-key', 1, null]]]] }),
      research({ slices: [[6, 'm, ', [['314', 1, null]]]] }),
      research({ slices: [[6, 'm', [['314:1021', 5, null]]]] }),   // count band 5
      research({ slices: [[6, 'm', [['314:1021', -1, null]]]] }),
      research({ slices: [[6, 'm', [['314:1021', '2', null]]]] }),
      research({ slices: [[6, 'm', [['314:1021', 1, 5]]]] }),      // share band 5
      research({ slices: [[6, 'm', [['314:1021', 1, '1']]]] }),
      research({ genera: 'x' }),
      research({ genera: [['Amanita']] }),
      research({ genera: [['Amanita', 'okinawa-honto']] }),        // areas must be a list
      research({ genera: [['Amanita', [7]]] })
    ]) assert.strictEqual(fd.readResearch(bad).ok, false, JSON.stringify(bad).slice(0, 80));
  });
  it('accepts a null genus share band and empty containers', () => {
    const r = fd.readResearch(research({ slices: [[0, 'all', []]], genera: [] }));
    assert.strictEqual(r.ok, true);
  });
});

describe('research: band labels', () => {
  it('maps count bands 0–4 to the §6 ranges and nothing else', () => {
    assert.deepStrictEqual(fd.COUNT_BANDS, ['10–24', '25–49', '50–99', '100–249', '250+']);
    assert.strictEqual(fd.countBandLabel(0), '10–24');
    assert.strictEqual(fd.countBandLabel(4), '250+');
    assert.strictEqual(fd.countBandLabel(5), null);
    assert.strictEqual(fd.countBandLabel(-1), null);
  });
  it('maps share bands 0–4 to labelled ranges and nothing else', () => {
    assert.deepStrictEqual(fd.SHARE_BANDS, ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%']);
    assert.strictEqual(fd.shareBandLabel(1), '20–40%');
    assert.strictEqual(fd.shareBandLabel(4), '80–100%');
    assert.strictEqual(fd.shareBandLabel(5), null);
  });
});

describe('research: snapshot joins', () => {
  it('joins when snapshots agree or the base files are v0 (no snapshot)', () => {
    assert.strictEqual(fd.researchJoins(null, null, SNAP), true);
    assert.strictEqual(fd.researchJoins(SNAP, null, SNAP), true);
    assert.strictEqual(fd.researchJoins(null, SNAP, SNAP), true);
    assert.strictEqual(fd.researchJoins(SNAP, SNAP, SNAP), true);
  });
  it('does not join a research snapshot from another bundle', () => {
    assert.strictEqual(fd.researchJoins(SNAP, SNAP, OTHER), false);
    assert.strictEqual(fd.researchJoins(SNAP, null, OTHER), false);
    assert.strictEqual(fd.researchJoins(null, SNAP, OTHER), false);
  });
});

describe('research: slice lookup and view states', () => {
  const data = research();
  it('finds the exact month × kind slice', () => {
    assert.strictEqual(fd.findSlice(data, 0, 'all')[2].length, 1);
    assert.strictEqual(fd.findSlice(data, 6, 'm')[2][0][0], '314:1021');
  });
  it('reports a missing slice as withheld, an absent cell as no estimate', () => {
    const withheld = fd.researchView(data, 12, 'l'); // no such slice
    assert.deepStrictEqual(withheld, { withheld: true, cells: null });
    const view = fd.researchView(data, 6, 'm');
    assert.strictEqual(view.withheld, false);
    assert.deepStrictEqual(view.cells['314:1021'], [0, 4]);
    assert.strictEqual(view.cells['999:999'], undefined); // absent → caller renders "no public estimate"
  });
  it('keeps a measured band and a withheld share distinguishable', () => {
    const view = fd.researchView(data, 0, 'm');
    assert.deepStrictEqual(view.cells['314:1021'], [1, 0]);  // measured share band 0
    assert.deepStrictEqual(view.cells['315:1022'], [4, null]); // share withheld
  });
  it('returns no view without data', () => {
    assert.strictEqual(fd.researchView(null, 0, 'all'), null);
  });
});

describe('place search: folding and aliases', () => {
  const places = [
    { en: 'Naha', ja: '那覇', aliases: ['Naha-shi'], at: [127.68, 26.21], area_id: 'okinawa-honto' },
    { en: 'Nago', ja: '名護', aliases: [], at: [127.98, 26.58] },
    { en: 'Yakushima', ja: '屋久島', aliases: ['Yaku Island'], at: [130.66, 30.36] },
    { en: 'Ōsaka', ja: '大阪', aliases: [], at: [135.5, 34.7] }
  ];
  it('folds case, diacritics and whitespace', () => {
    assert.strictEqual(fd.foldQuery('  Tōkyō '), 'tokyo');
    assert.strictEqual(fd.foldQuery('NAHA'), 'naha');
    assert.strictEqual(fd.foldQuery('Éze'), 'eze');
  });
  it('matches en, ja and aliases insensitively', () => {
    assert.strictEqual(fd.searchPlaces(places, 'naha').length, 1);
    assert.strictEqual(fd.searchPlaces(places, 'NAHA').length, 1);
    assert.strictEqual(fd.searchPlaces(places, '那覇').length, 1);
    assert.strictEqual(fd.searchPlaces(places, 'naha-shi').length, 1);
    assert.strictEqual(fd.searchPlaces(places, 'yaku is').length, 1); // alias, folded spaces
    assert.strictEqual(fd.searchPlaces(places, 'osaka').length, 1);   // macron folded
  });
  it('ranks prefix matches first, then by name, caps the list and stays quiet on no match', () => {
    const hits = fd.searchPlaces(places, 'na');
    assert.deepStrictEqual(hits.map((h) => h.place.en), ['Nago', 'Naha']); // same rank: alphabetical
    assert.strictEqual(fd.searchPlaces(places, 'na', 1).length, 1);
    assert.deepStrictEqual(fd.searchPlaces(places, 'zzz'), []);
    assert.deepStrictEqual(fd.searchPlaces(places, ''), []);
  });
});

describe('genus search: allowlist and unknown-id drop', () => {
  const index = {
    areas: [
      { id: 'okinawa-honto', kind: 'island' },
      { id: 'ishigaki', kind: 'island' },
      { id: 't5339', kind: 'tile' },
      { id: 'g-okinawa-prefecture', kind: 'group' }
    ]
  };
  const genera = [
    ['Amanita', ['okinawa-honto', 'ghost-id', 'g-okinawa-prefecture']],
    ['Amanitopsis', ['ishigaki']],
    ['Russula', ['t5339']],
    ['Xylaria', ['ghost-id']]
  ];
  it('prefix-matches Latin names case-insensitively', () => {
    assert.deepStrictEqual(fd.genusResults(genera, 'ama', index).map((g) => g.genus), ['Amanita', 'Amanitopsis']);
    assert.deepStrictEqual(fd.genusResults(genera, 'AMANITA', index).map((g) => g.genus), ['Amanita']);
    assert.deepStrictEqual(fd.genusResults(genera, 'russ', index).map((g) => g.genus), ['Russula']);
  });
  it('is prefix-only: mid-string matches return nothing', () => {
    assert.deepStrictEqual(fd.genusResults(genera, 'manita', index), []);
  });
  it('keeps only known leaf areas (unknown ids and groups drop)', () => {
    const [amanita] = fd.genusResults(genera, 'amanita', index);
    assert.deepStrictEqual(amanita.areas, ['okinawa-honto']);
    assert.deepStrictEqual(fd.genusResults(genera, 'russ', index)[0].areas, ['t5339']); // tiles are leaves
  });
  it('drops a genus whose every area was filtered away', () => {
    assert.deepStrictEqual(fd.genusResults(genera, 'xyl', index), []);
  });
  it('caps the result list', () => {
    const many = Array.from({ length: 12 }, (_, i) => ['Genus' + i, ['okinawa-honto']]);
    assert.strictEqual(fd.genusResults(many, 'genus', index, 8).length, 8);
  });
});

describe('reference geography reader (japan-outline.json)', () => {
  const places = [{ en: 'Naha', ja: '那覇', aliases: [], at: [127.68, 26.21], area_id: 'okinawa-honto' }];
  const ref = { schema_version: 1, source: { name: 'Natural Earth', release: '5.1.1', url: 'https://www.naturalearthdata.com' },
    bbox: [24, 46, 122, 154], land: [[[ [122.0, 24.0], [122.1, 24.0], [122.1, 24.1], [122.0, 24.0] ]]], places: places };
  it('accepts a valid v1 MapReference', () => {
    const r = fd.readMapReference(ref);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.places.length, 1);
  });
  it('rejects unknown versions and broken shapes', () => {
    for (const bad of [
      Object.assign({}, ref, { schema_version: 2 }),
      Object.assign({}, ref, { places: 'x' }),
      Object.assign({}, ref, { places: [{ en: 'Naha', ja: '那覇', aliases: [], at: [1] }] }), // at needs lon+lat
      Object.assign({}, ref, { places: [{ en: 'Naha', ja: '那覇', aliases: 'x', at: [1, 2] }] })
    ]) assert.strictEqual(fd.readMapReference(bad).ok, false, JSON.stringify(bad).slice(0, 80));
  });
});
