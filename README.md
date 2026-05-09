# Kinokoholic Portfolio (Jekyll + Cloudflare Worker)

This repo serves two surfaces from one codebase:

1. **Operator-console homepage** — a static `index.html` at the site root
   (no Jekyll layout) that ships the AI-forward portfolio: hero +
   operator status, AI workflow recipes, project grid, -mon family,
   live GitHub feed, career table, articles, NOW/NEXT + activity log,
   connect block. EN/JA toggle wired against `i18n/strings.ja.json`.
2. **JD Concierge** — Jekyll widget + Cloudflare Worker for evidence-
   grounded JD fit analysis. Grounding lives in `shared/profile.json`.

## Homepage (Operator Console)

| File | Role |
| --- | --- |
| `index.html` | Static homepage. No Jekyll front matter — copied verbatim to `_site/index.html`. Tagged with `data-i18n="<key>"` and `data-i18n-attr="attr:key"` on every translatable element. `<html data-i18n-page="page.home">` declares the namespace. |
| `assets/css/site.css` | Operator-console theme (dark-first, brand teal accents). Includes lang-toggle button styling and `html[lang="ja"]` font-stack swap to Noto Sans JP. |
| `assets/js/site.js` | Theme toggle (`data-theme-toggle`), nav active-link highlight, `data-fade` IntersectionObserver. |
| `assets/js/github-feed.js` | Live fetch of `https://api.github.com/users/<user>/repos`; gracefully falls back to the static cards in the markup. |
| `assets/js/i18n.js` | EN/JA applier. Caches each EN element's original content on first JA application, swaps `innerHTML`/`textContent` (or attributes) keyed by `data-i18n`, persists choice in `localStorage.kk_lang`, and lazy-fetches the JA bundle only on first JA toggle. |
| `i18n/strings.ja.json` | Full JA translation table — `_global` + page namespaces (currently `page.home` is consumed). Keys ending in `.html` are injected with `innerHTML`; everything else is `textContent`. |

### Adding or editing copy

1. Add the markup with EN as the canonical source (EN lives in the HTML).
2. Tag the element: `<h2 data-i18n="page.home.section.h2">…</h2>` — or
   `data-i18n-attr="placeholder:foo,aria-label:bar"` for attributes.
3. Add the JA value under the matching namespace in
   `i18n/strings.ja.json`. If the key ends in `.html`, the value may
   contain inline tags (`<em>`, `<strong>`) and will be injected via
   `innerHTML`.
4. Reload the page and toggle JA — confirm no `[i18n] missing key`
   warnings in the console.

### Internal links

The homepage is static HTML but references Jekyll-generated pages.
Link to **pretty permalinks**, not flat `.html` paths:

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
index.html                ← static operator-console homepage
i18n/
  strings.ja.json         ← JA translation bundle for the homepage
assets/
  css/site.css            ← operator-console theme + JA font swap
  css/styles.css          ← legacy Jekyll-page styles
  js/i18n.js              ← EN/JA applier
  js/site.js              ← theme toggle + scroll fade
  js/github-feed.js       ← live GitHub repo cards (with fallback)
  js/jd_concierge.js
  css/jd_concierge.css
  images/
_config.yml
_includes/
  jd_concierge.html
  nav.html · footer.html · icon.html
_layouts/
  default.html · project.html
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
