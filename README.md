# Kinokoholic Portfolio (Jekyll + Cloudflare Worker)

This repo serves two surfaces from one codebase:

1. **Operator-console homepage** — `index.html` (layout `home`): hero,
   products, -mon family, writing, career, connect. The Japanese home
   (`/ja/`) is generated from it by `scripts/build_ja_home.py`. Language is
   URL-based site-wide: `/path/` is English, `/ja/path/` is Japanese.
2. **JD Concierge** — Jekyll widget + Cloudflare Worker for evidence-
   grounded JD fit analysis. Grounding lives in `shared/profile.json`.

## Homepage (Operator Console)

| File | Role |
| --- | --- |
| `index.html` | Homepage body (layout `home`, shared head/nav/footer). Tagged with `data-i18n="<key>"` and `data-i18n-attr="attr:key"` on every translatable element. |
| `ja/index.html` | **Generated** Japanese home — `python3 scripts/build_ja_home.py` (CI: `--check`). |
| `_data/nav.yml` | The one nav definition (EN + JA labels) for every page. |
| `assets/css/site.css` | Operator-console theme (dark-first, brand teal accents). Includes the EN/JA toggle styling and `html[lang="ja"]` font-stack swap to Noto Sans JP. |
| `assets/js/site.js` | Theme toggle (`data-theme-toggle`), nav active-link highlight, `data-fade` IntersectionObserver. |
| `assets/js/github-feed.js` | Live fetch of `https://api.github.com/users/<user>/repos`; gracefully falls back to the static cards in the markup. |
| `i18n/strings.ja.json` | JA strings for the homepage (`page.home`). Build input only — not published. Keys ending in `.html` are inserted as markup; everything else as text. |

### Adding or editing copy

1. Add the markup with EN as the canonical source (EN lives in the HTML).
2. Tag the element: `<h2 data-i18n="page.home.section.h2">…</h2>` — or
   `data-i18n-attr="placeholder:foo,aria-label:bar"` for attributes.
3. Add the JA value under `page.home` in `i18n/strings.ja.json`. If the
   key ends in `.html`, the value may contain inline tags (`<em>`,
   `<strong>`).
4. Run `python3 scripts/build_ja_home.py` and commit `ja/index.html`.
   It fails on any key without a JA string.

### Internal links

Link to **pretty permalinks**, not flat `.html` paths (the JA generator
rewrites them to their `/ja/` twin when one exists):

- `/` (homepage)
- `/kinokomon/`
- `/projects/<slug>/` — see `projects/*.md` front matter for slugs.

There is no `/projects/` index page; the homepage's `#projects`
anchor is the canonical "all projects" target.

---

## JD Concierge

Minimal end-to-end JD fit concierge:

- Frontend: Jekyll widget under `_includes/jd_concierge.html`
- Backend: Cloudflare Worker (`/worker`)
- Grounding: `shared/profile.json`
- Guardrails: evidence-only strengths, size limits, DO rate limiting

## Public-Release Preview (local, synthetic only)

`scripts/preview_public_release.py` renders a **local, unapproved preview** of
the chat facts from a public-release candidate JSON file:

```bash
python3 scripts/preview_public_release.py path/to/public-release.candidate.json
```

- **Input**: a JSON file with exactly `purpose: "profile-homepage"`,
  `audience: "public"`, a 40-hex-character `knowledge_revision`, and a
  nonempty, ID-sorted `claims` list. Each claim has exactly `id`, `status`
  (`verified` or `historical`) and `statement`, plus optional
  `statement_ja` / `period`. Duplicate JSON keys and `NaN`/`Infinity` are
  rejected.
- **Output**: `build/preview/prompt-facts.txt` (gitignored) — the input
  SHA-256 and revision plus every claim verbatim (EN text, supplied Japanese
  text and period are never translated or invented). No timestamps:
  identical input bytes always produce identical preview bytes. On failure
  nothing is written and any previous preview is preserved.
- **Boundary**: this validates the file *shape* and renders a local excerpt
  only. It does not verify Git revisions, evidence, private restrictions or
  owner consent, and it approves nothing. The homepage, chat prompt and all
  other live consumers stay unchanged; wiring them to a real release
  requires an owner-approved release and a separate reviewed task.

Tests (synthetic fixtures only): `python3 tests/test_public_release_preview.py`

## TDD Workflow

This repo enforces a test-first workflow for code changes.

- Policy: `TDD.md`
- Guard script: `scripts/tdd_guard.py`
- Site JS test runner: `scripts/run-site-js-tests.sh`
- Local hooks: `.githooks/pre-commit`, `.githooks/pre-push`
- CI gate: `.github/workflows/tdd-quality-gates.yml`

Install hooks once per clone:

```bash
./scripts/setup-git-hooks.sh
```

Run guard manually:

```bash
python3 scripts/tdd_guard.py --against origin/main
```

To make enforcement strict for all contributors, set GitHub branch protection on `main` and require the `TDD Quality Gates` workflow.

## Commit And Push

Use feature branches, then open/refresh a PR.

```bash
# 1) branch from latest main
git checkout main
git pull origin main
git checkout -b fix/short-description

# 2) stage and commit
git add -A
git commit -m "Describe the change"

# 3) push branch
git push -u origin fix/short-description

# 4) open PR (or update existing PR branch)
gh pr create --base main --head fix/short-description --title "PR title" --body "Summary"
```

Notes:
- Pre-commit and pre-push hooks run automatically and may block pushes until checks pass.
- To update an existing PR, commit additional changes on the same branch and run `git push`.

## Repository Layout

All Jekyll source lives at the repo root — there is no `site/` subdirectory.

```text
index.html                ← homepage (EN, layout: home)
ja/index.html             ← GENERATED Japanese homepage (scripts/build_ja_home.py)
i18n/
  strings.ja.json         ← JA strings for the homepage (build input)
assets/
  css/site.css            ← operator-console theme + JA font swap
  css/styles.css          ← legacy Jekyll-page styles
  js/site.js              ← theme toggle + scroll fade
  js/github-feed.js       ← live GitHub repo cards (with fallback)
  js/jd_concierge.js
  css/jd_concierge.css
  images/
_config.yml
_includes/
  jd_concierge.html
  lang.html · head.html · nav.html · footer.html · icon.html
_layouts/
  home.html · default.html · project.html
_data/                    ← projects + site config (YAML)
projects/                 ← per-project Jekyll pages (markdown)
kinokomon.md · about.md · work-history.md
shared/
  profile.json            ← JD Concierge grounding source of truth
worker/
  src/index.ts · src/analysis.ts · src/analysis.test.ts
  wrangler.toml · package.json · tsconfig.json
tests/                    ← site JS unit tests (node --test)
scripts/
  tdd_guard.py · run-site-js-tests.sh · setup-git-hooks.sh
```

## 1) Profile Dataset

Source inputs:

- Portfolio evidence pages (`/projects/...`)
- Work history source files under `_data/hero/`

Curate those inputs into `shared/profile.json`:

- `skills[]`
- `projects[]` with `name`, `tags[]`, `summary`, `outcomes[]`, `stack[]`, `evidence_urls[]`
- `constraints` with `location`, `languages[]`, `availability`
- optional provenance metadata such as `source_documents[]`

Recommended update flow when `_data/hero` changes:

1. Update `/site/work-history.md` with public, linkable evidence summary.
2. Update `shared/profile.json` tags/outcomes/skills so Worker scoring can match the new signals.
3. Keep all claims tied to `evidence_urls` (portfolio page or `/work-history/`).

Honesty rule:

- Strengths are only emitted when evidence URLs exist.
- Missing evidence is surfaced as gaps/unknowns.

## 2) Local Development (OAuth Flow)

This is the normal local path (no API token required):

```bash
cd worker
npm i
npx wrangler login
npx wrangler dev
```

In another terminal:

```bash
cd site
bundle exec jekyll serve
```

## 3) Deploy

### Local deploy (OAuth session)

```bash
cd worker
npx wrangler deploy
```

### CI deploy (API token)

Set `CLOUDFLARE_API_TOKEN` in CI secrets, then:

```bash
cd worker
npm ci
npx wrangler deploy
```

## 4) Worker Config

`worker/wrangler.toml`:

- `ALLOWED_ORIGINS` (comma-separated; strict allowlist)
- `ANALYTICS_SAMPLE_RATE` (`0` to `1`, default `0`)

Example:

```toml
[vars]
ALLOWED_ORIGINS = "http://localhost:4000,https://kinokoholic.com"
ANALYTICS_SAMPLE_RATE = "0"
```

## 5) Widget Integration

Set Worker base URL in `site/_config.yml`:

```yml
worker_api_base: "https://kinokoholic.com/api"
```

Embed on any page:

```liquid
{% include jd_concierge.html %}
```

Widget features:

- Character counter (`X / 15000`, remaining chars)
- Analyze disabled when empty or over limit
- Loading spinner + button disable during request
- Error handling for validation, rate limit, network
- Example JD button with auto-analyze + auto-scroll
- Collapsible rubric breakdown

## 6) Unit Tests (No Network)

Tests are pure function tests in `worker/src/analysis.test.ts`:

- Japanese hard-gate cap
- Onsite hard-gate cap
- Confidence tier logic
- Request size validation
- 429 payload shape (`retry_after_seconds`)

Run:

```bash
cd worker
npm i
npm test
```

## 7) Production Verification

### A) Response includes `request_id`

```bash
curl -sS -X POST https://kinokoholic.com/api/analyze \
  -H "Origin: https://kinokoholic.com" \
  -H "Content-Type: application/json" \
  -d '{"jd_text":"Looking for AI consultant with prompt engineering experience"}' | jq '{request_id,score,confidence}'
```

### B) `Cache-Control: no-store` header

```bash
curl -i -sS -X POST https://kinokoholic.com/api/analyze \
  -H "Origin: https://kinokoholic.com" \
  -H "Content-Type: application/json" \
  -d '{"jd_text":"Requirements: Python"}' | tr -d '\r' | rg -i 'cache-control|content-type|access-control-allow-origin'
```

### C) Rate limit payload includes `retry_after_seconds`

```bash
for i in 1 2 3 4 5 6; do
  curl -sS -o /tmp/jd-rate-$i.json -w "call_$i=%{http_code}\n" \
    -X POST https://kinokoholic.com/api/analyze \
    -H "Origin: https://kinokoholic.com" \
    -H "Content-Type: application/json" \
    -d '{"jd_text":"Requirements: Python"}'
done
cat /tmp/jd-rate-6.json | jq
```

Expected on the blocked call:

```json
{
  "request_id": "...",
  "error": "Rate limit exceeded",
  "retry_after_seconds": 3600
}
```

## 8) Observability

Runtime logs include:

- `request_id`
- `timestamp`
- `jd_text_length`
- `score`
- `confidence`
- `rate_limited`

Optional sampled analytics log (safe by default):

- enabled only when `ANALYTICS_SAMPLE_RATE > 0`
- logs compact JSON with `request_id`, `score`, `confidence`, `length`, `timestamp`
- never logs full JD text

View logs:

```bash
cd worker
npx wrangler tail
```

## 9) API Documentation

OpenAPI 3.0 specification available at `worker/api-spec.yaml`.

This document describes:
- All endpoints and HTTP methods
- Request/response schemas with examples
- Error response formats
- Rate limiting behavior
- CORS requirements

**Usage:**
- Import into [Swagger UI](https://editor.swagger.io/) for interactive testing
- Generate client SDKs with `openapi-generator`
- Validate requests against schemas


Runtime logs include:

- `request_id`
- `timestamp`
- `jd_text_length`
- `score`
- `confidence`
- `rate_limited`

Optional sampled analytics log (safe by default):

- enabled only when `ANALYTICS_SAMPLE_RATE > 0`
- logs compact JSON with `request_id`, `score`, `confidence`, `length`, `timestamp`
- never logs full JD text

View logs:

```bash
cd worker
npx wrangler tail
```
