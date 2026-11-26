# Agent Handover Guide

Last updated: 2026-11-26

## Purpose

This repository serves two surfaces from one codebase:

1. The **operator-console homepage** (`index.html`, layout `home`) — hero,
   products, -mon family, writing, career and connect. Its Japanese twin
   `ja/index.html` is **generated** by `scripts/build_ja_home.py` from
   `index.html` + `i18n/strings.ja.json`.
2. **Deeper Jekyll pages** — project case studies (`projects/*.md`), the Shroom
   Hunter fungi dashboard (`kinokomon.md`, URL `/kinokomon/`), the Kinokomon
   agent hub (`kinokomon/agent/` and siblings), articles, about, work history,
   chat — each with a hand-written JA page under `ja/`. Layout `default`.

Both layouts share one `<head>` (`_includes/head.html`), one header
(`_includes/nav.html`, items in `_data/nav.yml`) and one footer
(`_includes/footer.html`). Never give a page its own header or footer.

## Language Model (decided 2026-11-26)

- **The URL is the language.** English at `/path/`, Japanese at `/ja/path/`.
  No client-side translation, no stored language preference. A reader in
  Japanese stays in Japanese because every JA page links to JA pages.
- `_includes/lang.html` computes the counterpart URL. The EN/JA toggle goes to
  the counterpart if it exists, else that section's index (`/ja/articles/`),
  else the language's home — it never 404s. `hreflang` tags are emitted only
  for counterparts that exist.
- Article bodies are English-only (LinkedIn originals); JA readers reach them
  from `/ja/articles/` and the toggle on an article returns to `/ja/articles/`.
- **New page?** Add the EN page and its `ja/` twin (`lang: ja`, `permalink:
  /ja/...`). Without a twin the toggle falls back to the section index.

## Navigation (decided 2026-11-26)

`_data/nav.yml` is the only place nav items are defined. Labels use
"products" (not "projects"); URLs under `/projects/` stay as they are.
**Shroom Hunter** = the Japan fungi dashboard, kept at its historical URL
`/kinokomon/`. **Kinokomon** = the agent (`/kinokomon/agent/`), part of the
-mon family.

Most copy edits should happen in YAML data files, Markdown content, or
the JA translation bundle — not in layout logic.

## Directory Structure (Canonical — Root-First)

All source files live at the repository root. There is **no `site/` subdirectory**. The old `site/` directory was a duplicate that caused file-drift bugs and has been removed.

```
Bio_HP/
├── index.html           ← Homepage (EN, layout: home)
├── i18n/                ← JA strings for the homepage (build input, not published)
├── _config.yml          ← Single Jekyll config
├── _includes/           ← All Jekyll includes
├── _layouts/            ← All Jekyll layouts
├── _data/               ← All data (projects, site config)
├── assets/              ← All assets (js, css, images)
├── projects/            ← Project pages (markdown)
├── _articles/           ← Full-text LinkedIn article archive (generated, curatable)
├── kinokomon.md, about.md, work-history.md
├── ja/                  ← JA pages (ja/index.html is generated)
├── tests/               ← JS unit tests
├── worker/              ← Cloudflare Worker (API backend)
├── scripts/             ← Build/CI helper scripts
├── .githooks/           ← Local git hooks (TDD guard, pre-push)
└── .github/             ← CI workflows
```

## High-Impact Paths

### Operator-console homepage
- `index.html`: homepage body (front matter + sections; layout `home`).
  Tagged with `data-i18n="<key>"` and `data-i18n-attr="attr:key,…"` on every
  translatable element — the contract `scripts/build_ja_home.py` translates.
- `ja/index.html`: **generated** — never edit by hand.
- `_layouts/home.html`, `_includes/{lang,head,nav,footer}.html`, `_data/nav.yml`:
  shared chrome for every page.
- `assets/css/site.css`: operator-console theme. Includes lang-toggle
  button styles and `html[lang="ja"]` font swap to Noto Sans JP.
- `assets/js/site.js`: theme toggle, nav active-link highlight,
  IntersectionObserver scroll-fade for `[data-fade]`.
- `assets/js/github-feed.js`: live GitHub fetch with static-card fallback.
- `i18n/strings.ja.json`: JA strings for the homepage under `page.home`.
  Keys ending in `.html` are inserted as markup.

### Jekyll surfaces
- `_data/projects/*.yml`: project content source of truth
- `projects/*.md`: per-project page routing/front matter
- `_layouts/default.html`, `_layouts/project.html`: page renderers
- `_includes/jd_concierge.html`: JD Concierge widget include
- `assets/js/jd_concierge.js`: JD Concierge client-side logic
- `assets/css/jd_concierge.css`: JD Concierge styling
- `assets/css/styles.css`: legacy Jekyll-page shared styling
- `assets/images/`: static image assets used by the homepage and
  project screenshots

## Critical Rule: No Duplicate Source Trees

**NEVER create a parallel directory structure** (e.g., `site/assets/`, `site/_includes/`). All source files must live in the root-level directories. The `site/` directory was previously a source of bugs where updates were made in one location but not the other.

If you need to test something in isolation, use a separate git branch — not a subdirectory copy.

## Safe Working Flow

1. Edit content in `_data/projects/*.yml` first.
2. Validate YAML before committing.
3. Confirm screenshot paths exist under `assets/images/`.
4. Commit only relevant files (avoid bundling unrelated local changes).

## Editing Homepage Copy

1. Find the element in `index.html`. EN is canonical and lives in the HTML.
2. Edit the EN text/markup in place.
3. Update the matching key under `page.home` in `i18n/strings.ja.json`
   (e.g. `hero.summary`). Keys ending in `.html` may contain inline tags.
4. Run `python3 scripts/build_ja_home.py` and commit `ja/index.html` with the
   change. It fails on a key with no JA string and warns on unused strings;
   CI (`.github/workflows/homepage-ja.yml`) fails if `ja/index.html` is stale.

To add a new translatable element: add a `data-i18n="<new.key>"` attribute,
the matching JA entry, and regenerate. The generator also points internal
links at their `/ja/` twin when one exists. `sync_mon_family.py` and
`linkedin_articles.py sync` regenerate `ja/index.html` automatically.

Internal links from the homepage must use **pretty Jekyll permalinks**
(`/kinokomon/`, `/projects/<slug>/`), not flat `.html` paths.

## Generated: Homepage -MON Family Grid

The homepage `-MON family` grid is **generated**, not hand-edited. Its single
source of truth is the `mon_family` array in `shared/profile.json` (the same
file the orchestrator already syncs the Kinokomon page from).

To add or change a family agent:

1. Edit the `mon_family` entry in `shared/profile.json` (fields: `slug`, `name`,
   `name_ja`, `icon`, `href`, `external`, `desc_en`, `tag_en`, `desc_ja`, `tag_ja`).
2. Run `python3 scripts/sync_mon_family.py`. This rewrites the AUTOGEN region in
   `index.html` and the per-card `fam.<slug>.desc` / `fam.<slug>.tag` keys in
   `i18n/strings.ja.json`.
3. Commit the regenerated files together with the data change.

Do **not** hand-edit the `<!-- AUTOGEN:mon-family:start --> ... :end -->` region
in `index.html`, or the generated `fam.<slug>.*` keys in the JA bundle — they
will be overwritten. CI (`.github/workflows/homepage-mon-family.yml`) runs
`sync_mon_family.py --check` and fails the build if the committed grid drifts
from `shared/profile.json`.

> Scope note: only the family grid is generated. The curated "FEATURED PROJECTS"
> cards are an intentional editorial selection and remain hand-maintained.

## Generated: Articles (LinkedIn archive)

David's LinkedIn articles are archived in full on the site.

- **Source of truth:** one file per article in `_articles/<slug>.html` (a Jekyll
  collection, rendered at `/articles/<slug>/` with `_layouts/article.html`).
  Index pages: `articles.md` (`/articles/`) and `ja/articles.md` (`/ja/articles/`,
  JA chrome, English bodies). Images live in `assets/images/articles/<slug>/`.
- **Import new articles:** `python3 scripts/linkedin_articles.py import`
  (add `--seed <linkedin.com/pulse/... URL>` for an article that no other
  article links to). Discovery follows each article's "more articles by"
  links, because LinkedIn's API does not expose member articles and the
  profile listing is bot-blocked. Commit `_articles/`, the images, and
  `index.html` together.
- **Curating:** edit `description` (hand-written blurb), `featured` or `tags` in
  an article's front matter. `import --refresh` re-fetches bodies but never
  overwrites those keys. `summary` is the auto excerpt and is regenerated.
- **Homepage block:** the `<!-- AUTOGEN:articles:start --> ... :end -->` region in
  `index.html` (latest 3) is generated; run `python3 scripts/linkedin_articles.py sync`.
  CI (`.github/workflows/articles.yml`) fails if it drifts from `_articles/`.
- **Canonical URL:** `articles_canonical` in `_config.yml` — `linkedin` (default:
  search engines credit LinkedIn, no duplicate-content risk) or `self` (the site
  becomes the canonical home of the writing).
- Writing hosted on other people's sites is linked, not copied: `_data/articles_external.yml`.
- `/kinokomon/linkedin/` is the older, orchestrator-maintained list; it now points to `/articles/`.

## TDD Requirement

For code changes (Worker TS, site JS, workflow Python), use Red -> Green -> Refactor:

1. Add or update a failing test first.
2. Implement the minimum code to pass.
3. Refactor while keeping tests green.
4. Commit source and test updates together.

Tests live in `tests/` (site JS) and `worker/` (Worker TS).

Enforcement exists via `scripts/tdd_guard.py`, local git hooks in `.githooks/`, and CI workflow `.github/workflows/tdd-quality-gates.yml`.

## Validation Commands

```bash
# Validate all YAML files used by Jekyll
python3 - <<'PY'
import yaml, glob
for path in glob.glob('_data/**/*.yml', recursive=True):
    yaml.safe_load(open(path, encoding='utf-8'))
print('ALL_YAML_OK')
PY

# Validate JA translation bundle is parseable JSON
python3 -c "import json; json.load(open('i18n/strings.ja.json'))" && echo I18N_OK

# Japanese home page is in sync with index.html + strings
python3 scripts/build_ja_home.py --check && python3 tests/test_build_ja_home.py

# Run all site JS tests (covers jd_concierge, about, kinokomon, site,
# github-feed, fungi dashboard)
./scripts/run-site-js-tests.sh

# Optional: inspect repo state before commit
git status --short

# TDD guard (branch diff)
python3 scripts/tdd_guard.py --against origin/main

# Worker checks for code changes
cd worker && npm run check && npm test
```

## Commit And Push Workflow

```bash
# create/update feature branch
git checkout main
git pull origin main
git checkout -b fix/short-description

# stage and commit
git add -A
git commit -m "Describe the change"

# push and create PR
git push -u origin fix/short-description
gh pr create --base main --head fix/short-description --title "PR title" --body "Summary"
```

- Keep related changes in the same commit series.
- If hooks fail, fix tests/checks before pushing.

## Deployment Notes

- Deployment target: GitHub Pages from `main` branch, root folder.
- Build artifacts (`_site/`) are gitignored and should never be committed.
- If the website shows stale pages:
  - verify latest commit is on `origin/main`
  - verify YAML parses cleanly
  - wait for Pages rebuild and hard-refresh browser cache

## Current Known Context

- JTES project screenshots are currently set in a 2x2 order in `_data/projects/jtes_specialized_rag.yml` using:
  - `/assets/images/jtes_products.png`
  - `/assets/images/jtes_workflow.png`
  - `/assets/images/jtes_response.png`
  - `/assets/images/jtes_citation.png`
