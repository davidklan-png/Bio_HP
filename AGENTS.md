# Agent Handover Guide

Last updated: 2026-02-17

## Purpose

This repository is a Jekyll-based portfolio site with data-driven project pages. Most edits should happen in YAML data files and Markdown content, not in layout logic.

## Directory Structure (Canonical — Root-First)

All source files live at the repository root. There is **no `site/` subdirectory**. The old `site/` directory was a duplicate that caused file-drift bugs and has been removed.

```
Bio_HP/
├── _config.yml          ← Single Jekyll config
├── _includes/           ← All Jekyll includes
├── _layouts/            ← All Jekyll layouts
├── _data/               ← All data (projects, site config)
├── assets/              ← All assets (js, css, images)
├── projects/            ← Project pages (markdown)
├── tests/               ← JS unit tests
├── worker/              ← Cloudflare Worker (API backend)
├── scripts/             ← Build/CI helper scripts
├── .githooks/           ← Local git hooks (TDD guard, pre-push)
└── .github/             ← CI workflows
```

## High-Impact Paths

- `_data/projects/*.yml`: project content source of truth
- `projects/*.md`: per-project page routing/front matter
- `_layouts/project.html`: project page renderer
- `_includes/jd_concierge.html`: JD Concierge widget include
- `assets/js/jd_concierge.js`: JD Concierge client-side logic
- `assets/css/jd_concierge.css`: JD Concierge styling
- `assets/css/styles.css`: shared styling
- `assets/images/`: static image assets used by project screenshots

## Critical Rule: No Duplicate Source Trees

**NEVER create a parallel directory structure** (e.g., `site/assets/`, `site/_includes/`). All source files must live in the root-level directories. The `site/` directory was previously a source of bugs where updates were made in one location but not the other.

If you need to test something in isolation, use a separate git branch — not a subdirectory copy.

## Safe Working Flow

1. Edit content in `_data/projects/*.yml` first.
2. Validate YAML before committing.
3. Confirm screenshot paths exist under `assets/images/`.
4. Commit only relevant files (avoid bundling unrelated local changes).

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

# Run JS tests
node --test tests/jd_concierge.test.js

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
