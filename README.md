# LLM Portfolio Site (GitHub Pages)

Static, recruiter-friendly portfolio site for last-year LLM projects, built with Jekyll and data-driven project content.

## Why this setup

- **Minimal friction on GitHub Pages:** native Jekyll support, no custom build pipeline required.
- **Data-driven updates:** project content lives in `_data/projects/*.yml` so you can revise text/screenshots without editing layout code.
- **Two-audience design:** fast value scanning for business stakeholders and implementation depth for technical reviewers.

## Local Preview (optional)

If you want local preview before pushing:

```bash
bundle exec jekyll serve
```

If Bundler/Jekyll are not installed:

```bash
gem install bundler jekyll
bundle init
bundle add jekyll
bundle exec jekyll serve
```

## GitHub Pages Deployment (recommended)

1. Push this repository to GitHub.
2. Open `Settings -> Pages`.
3. Under **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main` (or `master`), folder: `/ (root)`
4. Save and wait for GitHub Pages to publish.
5. Your site URL will be shown in the Pages settings panel.

## Content Editing

- Global profile/contact/skills: `_data/site.yml`
- Project details: `_data/projects/*.yml`
- Home page structure: `index.md`
- Project page layout: `_layouts/project.html`
- Styling: `assets/css/styles.css`
- Screenshot instructions: `assets/images/README.md`

## Full revision guide

See `REVISION_PLAYBOOK.md`.
