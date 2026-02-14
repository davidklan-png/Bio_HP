# JD Concierge (Jekyll + Cloudflare Worker)

Minimal end-to-end JD fit concierge:

- Frontend: plain Jekyll widget under `/site`
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

## Repository Layout

```text
shared/
  profile.json
site/
  _config.yml
  _includes/jd_concierge.html
  assets/js/jd_concierge.js
  assets/css/jd_concierge.css
  index.md
  projects/jd-concierge-sandbox.md
worker/
  src/index.ts
  src/analysis.ts
  src/analysis.test.ts
  wrangler.toml
  package.json
  tsconfig.json
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
