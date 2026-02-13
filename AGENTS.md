# Agent Handover Guide

Last updated: 2026-02-13

## Purpose

This repository is a Jekyll-based portfolio site with data-driven project pages. Most edits should happen in YAML data files and Markdown content, not in layout logic.

## High-Impact Paths

- `_data/projects/*.yml`: project content source of truth
- `projects/*.md`: per-project page routing/front matter
- `_layouts/project.html`: project page renderer
- `assets/css/styles.css`: shared styling
- `assets/images/`: static image assets used by project screenshots

## Safe Working Flow

1. Edit content in `_data/projects/*.yml` first.
2. Validate YAML before committing.
3. Confirm screenshot paths exist under `assets/images/`.
4. Commit only relevant files (avoid bundling unrelated local changes).

## Validation Commands

```bash
# Validate all YAML files used by Jekyll
python3 - <<'PY'
import yaml, glob
for path in glob.glob('_data/**/*.yml', recursive=True):
    yaml.safe_load(open(path, encoding='utf-8'))
print('ALL_YAML_OK')
PY

# Optional: inspect repo state before commit
git status --short
```

## Deployment Notes

- Deployment target: GitHub Pages from `main` branch, root folder.
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
