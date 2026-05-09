# Agent Handover Guide

Last updated: 2026-05-09

## Purpose

This repository serves two surfaces from one codebase:

1. A **static operator-console homepage** (`index.html` at the root) —
   the AI-forward portfolio with hero, AI workflow recipes, projects,
   -mon family, GitHub feed, career, articles, and a build-in-public
   activity log. EN/JA toggle wired via `assets/js/i18n.js` reading
   `i18n/strings.ja.json`. No Jekyll layout — the file is shipped
   verbatim.
2. A **Jekyll-rendered set of deeper pages** — project case studies
   (`projects/*.md`), Kinokomon hub (`kinokomon.md`), about,
   work history, and the JA mirror under `ja/`. These use
   `_layouts/default.html` and the data files under `_data/`.

Most copy edits should happen in YAML data files, Markdown content, or
the JA translation bundle — not in layout logic.

## Directory Structure (Canonical — Root-First)

All source files live at the repository root. There is **no `site/` subdirectory**. The old `site/` directory was a duplicate that caused file-drift bugs and has been removed.

```
Bio_HP/
├── index.html           ← Static operator-console homepage (no Jekyll layout)
├── i18n/                ← JA translation bundle (strings.ja.json)
├── _config.yml          ← Single Jekyll config
├── _includes/           ← All Jekyll includes
├── _layouts/            ← All Jekyll layouts
├── _data/               ← All data (projects, site config)
├── assets/              ← All assets (js, css, images)
├── projects/            ← Project pages (markdown)
├── kinokomon.md, about.md, work-history.md
├── ja/                  ← JA mirror of Jekyll pages
├── tests/               ← JS unit tests
├── worker/              ← Cloudflare Worker (API backend)
├── scripts/             ← Build/CI helper scripts
├── .githooks/           ← Local git hooks (TDD guard, pre-push)
└── .github/             ← CI workflows
```

## High-Impact Paths

### Operator-console homepage
- `index.html`: static homepage at site root. Tagged with `data-i18n="<key>"`
  and `data-i18n-attr="attr:key,…"` on every translatable element.
  `<html data-i18n-page="page.home">` declares the namespace.
- `assets/css/site.css`: operator-console theme. Includes lang-toggle
  button styles and `html[lang="ja"]` font swap to Noto Sans JP.
- `assets/js/site.js`: theme toggle, nav active-link highlight,
  IntersectionObserver scroll-fade for `[data-fade]`.
- `assets/js/github-feed.js`: live GitHub fetch with static-card fallback.
- `assets/js/i18n.js`: EN/JA applier (lazy-loads `i18n/strings.ja.json`
  on first JA toggle, persists choice in `localStorage.kk_lang`).
- `i18n/strings.ja.json`: translation table. Top-level keys: `_global`
  + `page.<name>`. Keys ending in `.html` are injected via `innerHTML`.

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

The homepage is direct-edit (no build step, no Liquid). To change a
visible string:

1. Find the element in `index.html`. EN is canonical and lives in the
   HTML itself.
2. Edit the EN text/markup in place.
3. Open `i18n/strings.ja.json` and update the matching key under the
   page namespace (e.g. `page.home.hero.summary`). If the key ends in
   `.html`, the value may contain inline tags (`<em>`, `<strong>`).
4. Hard-reload the page, click the JA toggle, and watch the dev
   console — `[i18n] missing key` warnings flag any orphans.

To add a new translatable element: add a `data-i18n="<page>.<new.key>"`
attribute and the matching JA entry. No JS change required.

Internal links from the homepage must use **pretty Jekyll permalinks**
(`/kinokomon/`, `/projects/<slug>/`), not flat `.html` paths.

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

# Run all site JS tests (covers jd_concierge, about, kinokomon, site,
# github-feed, i18n)
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
