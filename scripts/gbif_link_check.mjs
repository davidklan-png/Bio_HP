#!/usr/bin/env node
/**
 * Weekly GBIF link check (TASK-007, spec item 5) — run by
 * .github/workflows/gbif-link-check.yml, schedule only.
 *
 * Samples ~40 URLs that fungi-dashboard.js would actually link to (built with
 * its own gbifTaxonUrl helper, so the check can never drift from the page) and
 * fetches them from gbif.org. Any non-200 fails the job; a blanket 403 fails
 * with an explicit "blocked" message rather than passing silently.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// The dashboard's helper decides precedence: COL key → legacy key → name search.
const { gbifTaxonUrl } = createRequire(import.meta.url)('../assets/js/fungi-dashboard.js');

const UA = 'ShroomHunt-link-check/1.0 (https://kinokoholic.com; contact via site)';

// Evenly spaced, deterministic pick of n rows (data order is stable per publish).
const spread = (rows, n) => rows.length <= n
  ? rows.slice()
  : Array.from({ length: n }, (_, i) => rows[Math.floor((i * rows.length) / n)]);

/**
 * Sample GBIF URLs from parsed dashboard + area payloads. Buckets: up to
 * `perKind` taxon/<key>, species/<key> and taxon/search URLs from area species
 * and possible rows, plus up to `perKind` from the dashboard leads. Keyed rows
 * don't ship yet, so short buckets top up with search URLs to hold ~40 checks.
 */
export function sampleGbifUrls({ dashboard, areas }, perKind = 10) {
  const rows = []; // [colKey, legacyKey, name] — the same arguments the render sites pass
  for (const a of areas || [])
    for (const s of [...(a.species || []), ...(a.possible || [])])
      rows.push([s.c || undefined, s.lk || undefined, s.n]);
  const leads = spread(((dashboard && dashboard.leads) || []).map((l) => [l[5] || undefined, l[6] || undefined, l[0]]), perKind);
  const buckets = { taxon: [], species: [], search: [] };
  const spare = []; // keyless rows beyond the search cap: they refill the total
  for (const args of [...spread(rows, perKind * 4), ...leads]) {
    if (args[2] == null) continue; // a row without a name can't produce a link
    const kind = args[0] ? 'taxon' : args[1] ? 'species' : 'search';
    if (buckets[kind].length < perKind) buckets[kind].push(gbifTaxonUrl(...args));
    else if (kind === 'search') spare.push(gbifTaxonUrl(...args));
  }
  for (const url of spare) {
    if (buckets.taxon.length + buckets.species.length + buckets.search.length >= perKind * 4) break;
    buckets.search.push(url);
  }
  const seen = new Set();
  return Object.values(buckets).flat().filter((url) => !seen.has(url) && seen.add(url));
}

/** Fetch each URL with the contact UA, following redirects. Never throws. */
export async function checkUrls(urls, fetchImpl = fetch) {
  const results = [];
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, { redirect: 'follow', headers: { 'User-Agent': UA } });
      results.push({ url, status: res.status });
    } catch (err) {
      results.push({ url, status: 0, error: String((err && err.message) || err) });
    }
  }
  return results;
}

async function main() {
  const root = new URL('..', import.meta.url);
  const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
  const dashboard = read('assets/data/shroomhunt/dashboard.json');
  const index = read('assets/data/shroomhunt/areas/index.json');
  const areas = index.areas.filter((a) => a.kind !== 'group').slice(0, 4)
    .map((a) => read(`assets/data/shroomhunt/areas/${a.id}.json`));
  const urls = sampleGbifUrls({ dashboard, areas });
  const kinds = (re) => urls.filter((u) => re.test(u)).length;
  console.log(`Checking ${urls.length} GBIF URLs (taxon/: ${kinds(/\/taxon\/\d/)}, species/: ${kinds(/\/species\/\d/)}, search: ${kinds(/taxon\/search/)}).`);
  const results = await checkUrls(urls);
  const bad = results.filter((r) => r.status !== 200);
  for (const r of bad) console.log(`${r.status || 'ERR'} ${r.url}${r.error ? ' — ' + r.error : ''}`);
  if (bad.length === results.length && bad.length > 0 && bad.every((r) => r.status === 403)) {
    console.error('gbif.org is blocking this runner outright (403 on every URL). The link pattern may be fine; retry manually or from another network before treating this as a data failure.');
  }
  process.exit(bad.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
