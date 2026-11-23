#!/usr/bin/env node
/**
 * Tests for scripts/gbif_link_check.mjs (TASK-007): the URL sampler and the
 * fetch checker behind the weekly GBIF link-check workflow. The checker is
 * exercised with an injected fetch, so nothing here touches the network.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { sampleGbifUrls, checkUrls } from '../scripts/gbif_link_check.mjs';

describe('gbif link check: sampler', () => {
  const areas = [{
    species: [
      { n: 'Amanita muscaria', c: 5264934 },
      { n: 'Boletus edulis', lk: 3339669 },
      { n: 'Keyless one' },
      { n: 'Keyless two' }
    ],
    possible: [{ n: 'Volvopluteus gloiocephalus' }]
  }];
  it('builds URLs with the dashboard helper: c beats lk beats name search', () => {
    const urls = sampleGbifUrls({ dashboard: { leads: [] }, areas }, 10);
    assert.ok(urls.includes('https://www.gbif.org/taxon/5264934'));
    assert.ok(urls.includes('https://www.gbif.org/species/3339669'));
    assert.ok(urls.includes('https://www.gbif.org/taxon/search?q=Keyless%20one'));
  });
  it('reads leads from elements 5, 6 and 0, capped at perKind', () => {
    const lead = (c, lk) => ['Phallus lutescens', 'Phallaceae', 196, 2, 'genus known in Japan', c, lk];
    const urls = sampleGbifUrls({ dashboard: { leads: [lead(11, null), lead(null, 22), lead(null, null)] }, areas: [] }, 10);
    assert.ok(urls.includes('https://www.gbif.org/taxon/11'));
    assert.ok(urls.includes('https://www.gbif.org/species/22'));
    assert.ok(urls.includes('https://www.gbif.org/taxon/search?q=Phallus%20lutescens'));
    const many = sampleGbifUrls({ dashboard: { leads: Array.from({ length: 50 }, (_, i) => lead(i + 1, null)) }, areas: [] }, 10);
    assert.strictEqual(many.length, 10);
  });
  it('keeps lead links in the sample when every URL is a name search (PR #59 review)', () => {
    const all = (p) => ({ species: Array.from({ length: 40 }, (_, i) => ({ n: p + i })), possible: [] });
    const lead = ['Phallus lutescens', 'Phallaceae', 196, 2, 'genus known in Japan', undefined, undefined];
    const urls = sampleGbifUrls({ dashboard: { leads: [lead] }, areas: [all('a'), all('b')] }, 10);
    assert.ok(urls.includes('https://www.gbif.org/taxon/search?q=Phallus%20lutescens'));
  });
  it('caps each kind bucket, tops short buckets up with search URLs and dedupes', () => {
    const all = (p) => ({ species: Array.from({ length: 40 }, (_, i) => ({ n: p + i })), possible: [] });
    const urls = sampleGbifUrls({ dashboard: { leads: [] }, areas: [all('a'), all('b')] }, 10);
    assert.strictEqual(urls.length, 40);
    assert.ok(urls.every((u) => /taxon\/search\?q=[ab]\d+$/.test(u)));
    const dupes = sampleGbifUrls({ dashboard: { leads: [['X', '', 1, 1, '', undefined, undefined]] }, areas: [{ species: [{ n: 'X' }], possible: [] }] }, 10);
    assert.deepStrictEqual(dupes, ['https://www.gbif.org/taxon/search?q=X']);
  });
  it('samples only gbif.org URLs from the committed data', () => {
    const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
    const dashboard = read('../assets/data/shroomhunt/dashboard.json');
    const areas = [read('../assets/data/shroomhunt/areas/amami-oshima.json'), read('../assets/data/shroomhunt/areas/awaji.json')];
    const urls = sampleGbifUrls({ dashboard, areas });
    assert.ok(urls.length >= 20 && urls.length <= 40, `sampled ${urls.length}`);
    assert.ok(urls.every((u) => /^https:\/\/www\.gbif\.org\/(taxon|species)\//.test(u)));
  });
});

describe('gbif link check: checker', () => {
  it('sends the contact User-Agent, follows redirects and reports each status', async () => {
    const seen = [];
    const fake = async (url, opts) => { seen.push([url, opts]); return { status: url.includes('bad') ? 404 : 200 }; };
    const results = await checkUrls(['https://x/good', 'https://x/bad'], fake);
    assert.deepStrictEqual(results.map((r) => r.status), [200, 404]);
    assert.match(seen[0][1].headers['User-Agent'], /^ShroomHunt-link-check\/1.0 \(https:\/\/kinokoholic\.com; contact via site\)$/);
    assert.strictEqual(seen[0][1].redirect, 'follow');
  });
  it('records a thrown fetch as a failure instead of crashing', async () => {
    const results = await checkUrls(['https://x/'], async () => { throw new Error('boom'); });
    assert.strictEqual(results[0].status, 0);
    assert.match(results[0].error, /boom/);
  });
});
