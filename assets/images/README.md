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
