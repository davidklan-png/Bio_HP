# Revision Playbook

This site is data-driven. Most updates only require editing YAML files in `_data/`.

## 1) Update project text without touching layout

Edit one file per project in `_data/projects/`:

- `_data/projects/receipt_classification_matching.yml`
- `_data/projects/bilingual_ceremony_script_generator.yml`
- `_data/projects/jtex_specialized_rag.yml`
- `_data/projects/enterprise_ai_enablement_insurance.yml`

Safe fields to revise:

- `one_line_value`
- `impact_bullets`
- `executive_summary`
- `use_case`
- `architecture`
- `tech_details`
- `lessons_learned`
- `improve_next`
- `repro`
- `screenshots`

## 2) Add a new project card + detail page

1. Create a new YAML file in `_data/projects/` (copy an existing one).
2. Add its key to `_data/site.yml` under `project_order`.
3. Add a new page in `projects/` with front matter:

```yaml
---
layout: project
title: Your Project Name
permalink: /projects/your-project-slug/
project_id: your_project_key
---
```

4. Optional: add a new icon case in `_includes/icon.html`.

## 3) Replace screenshots

1. Put real images in `assets/images/`.
2. Update each project YAML `screenshots` list with new `src`, `alt`, and `caption`.
3. Keep exactly 3 or more images per project for consistent gallery layout.

## 4) Edit About / Contact content

- Update global profile text and links in `_data/site.yml`.
- About page copy is in `about.md`.

## 5) Change visual style safely

- Main styling is in `assets/css/styles.css`.
- Start with color tokens in `:root`.
- Layout classes to adjust:
  - Home cards: `.card-grid`, `.project-card`
  - Project pages: `.section-block`, `.summary-grid`, `.gallery-grid`
  - Typography: `h1`, `h2`, `h3`, `body`

## 6) If a section must be added/removed across all projects

- Edit `_layouts/project.html` once.
- Keep YAML schema aligned with any new section keys.

## 7) Validate before pushing

- Ensure YAML is valid (spacing matters).
- Confirm all image paths exist.
- Click all project cards and external links.
