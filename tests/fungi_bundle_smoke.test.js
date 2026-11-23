#!/usr/bin/env node
/**
 * Smoke test for the real shipped bundle at assets/data/shroomhunt: every file the
 * page can fetch must pass the same readers the page uses, and the snapshot stamps
 * must join across the index and the area files. The unit tests run on owned
 * fixtures; this file is what catches drift between the page code and what
 * ShroomHunt actually ships. The bundle arrives as data PRs, so a checkout without
 * it skips with a message instead of failing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const fd = require('../assets/js/fungi-dashboard.js');

const bundleDir = new URL('../assets/data/shroomhunt/', import.meta.url);
const skip = !existsSync(bundleDir) && 'shroomhunt bundle directory absent';
const load = (p) => JSON.parse(readFileSync(new URL(p, bundleDir), 'utf8'));

describe('fungi bundle smoke: the shipped files load through the page readers', () => {
  it('dashboard.json validates', { skip }, () => {
    assert.strictEqual(fd.readDashboard(load('dashboard.json')).ok, true);
  });
  it('areas/index.json validates', { skip }, () => {
    assert.strictEqual(fd.readIndex(load('areas/index.json')).ok, true);
  });
  it('every shipped area file validates and joins the index snapshot', { skip }, () => {
    const index = fd.readIndex(load('areas/index.json'));
    assert.strictEqual(index.ok, true);
    const files = readdirSync(new URL('areas/', bundleDir))
      .filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
    assert.ok(files.length > 0, 'the bundle must ship at least one area file');
    for (const f of files) {
      const r = fd.readArea(load('areas/' + f));
      assert.strictEqual(r.ok, true, f);
      assert.ok(r.snapshot, f + ' carries a snapshot stamp');
      assert.strictEqual(fd.detailJoinOf(r, index.snapshot), true, f + ' joins the index snapshot');
    }
  });
  it('mesh-research.json validates', { skip }, () => {
    assert.strictEqual(fd.readResearch(load('mesh-research.json')).ok, true);
  });
  // TASK-010: the species bundles are optional until the next data publish ships;
  // when present, the index and a sample of genus files must pass the page readers.
  const speciesSkip = (!existsSync(bundleDir) && 'shroomhunt bundle directory absent') ||
    (!existsSync(new URL('species/index.json', bundleDir)) && 'species bundles not shipped yet');
  it('species/index.json and its genus files validate', { skip: speciesSkip }, () => {
    const idx = fd.readSpeciesIndex(load('species/index.json'));
    assert.strictEqual(idx.ok, true);
    const slugs = Object.keys(idx.files).sort().slice(0, 5);
    assert.ok(slugs.length > 0, 'the bundle must ship at least one genus file');
    for (const s of slugs) assert.strictEqual(fd.readSpeciesGenus(load('species/' + s + '.json')).ok, true, s);
  });
});
