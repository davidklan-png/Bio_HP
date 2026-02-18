# Screenshot Placeholders

This site uses three shared placeholder images:

- `placeholder-workflow.svg`
- `placeholder-dashboard.svg`
- `placeholder-architecture.svg`

## How to replace with real screenshots

1. Add your real image files to `assets/images/` (or subfolders if you prefer).
2. Update each project's YAML file under `_data/projects/` in the `screenshots` section:
   - `src`: path to image (e.g., `/assets/images/receipt-overview.png`)
   - `alt`: meaningful accessibility description
   - `caption`: short context sentence
3. Keep at least 3 screenshot entries per project for layout consistency.

Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`.

## Agent Handover Notes (2026-02-13)

- Latest JTES images in use:
  - `jtes_products.png`
  - `jtes_workflow.png`
  - `jtes_response.png`
  - `jtes_citation.png`
- Current JTES screenshot display expects a 2x2 order in `_data/projects/jtes_specialized_rag.yml`:
  1. `jtes_products.png`
  2. `jtes_workflow.png`
  3. `jtes_response.png`
  4. `jtes_citation.png`
- If captions include `:`, quote the whole YAML string to avoid parse errors during Pages build.
