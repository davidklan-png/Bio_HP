# JD Concierge (Jekyll + Cloudflare Worker)

Minimal end-to-end job-description concierge for a static Jekyll site.

- Frontend: dependency-free widget (`textarea + button + results`)
- Backend: Cloudflare Worker (TypeScript, Wrangler)
- Grounding: `shared/profile.json` is the source of truth for evidence links
- Guardrails: honest evidence-only strengths, request size limits, and per-IP rate limiting
- `/site` is plain Jekyll (GitHub Pages compatible, no custom plugins required)

## Repository Layout

```text
shared/
  profile.json                  # Source-of-truth profile dataset
worker/
  src/index.ts                 # /analyze endpoint + rubric scorer + Durable Object limiter
  wrangler.toml                # Worker config (ALLOWED_ORIGINS + DO binding)
  tsconfig.json
  package.json
site/
  _includes/jd_concierge.html  # Portable include for Jekyll sites
  assets/js/jd_concierge.js
  assets/css/jd_concierge.css
```

For portability, the widget implementation is canonical under `/site`.

## 1) Edit Your Profile Dataset

File: `shared/profile.json`

Schema fields:

- `skills[]`
- `projects[]` with:
  - `name`
  - `tags[]`
  - `summary`
  - `outcomes[]`
  - `stack[]`
  - `evidence_urls[]`
- `constraints`:
  - `location`
  - `languages[]`
  - `availability`

Honesty rule in scoring:

- A strength is only returned if at least one `evidence_url` is matched.
- If match evidence is missing, output becomes a gap/unknown (`No evidence found`).

## 2) Worker Setup (Cloudflare)

Prereqs:

- Node.js 18+
- Cloudflare account

Commands:

```bash
wrangler login
cd worker && npm i && wrangler dev
```

Local Worker URL is printed by Wrangler (usually `http://127.0.0.1:8787`).

### CORS Allowed Origins

`ALLOWED_ORIGINS` is a comma-separated environment variable in `worker/wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "http://localhost:4000,https://kinokoholic.com"
```

The Worker returns proper preflight responses for `OPTIONS /analyze`.

### Secrets

v1 does not require external API keys.
If you add external providers later, store keys with Wrangler secrets (never frontend):

```bash
wrangler secret put OPENAI_API_KEY
```

### Deploy Worker

```bash
cd worker && wrangler deploy
```

After deploy, copy Worker URL and set it in Jekyll config:

- Root site: `_config.yml` -> `worker_api_base`
- Portable `/site` config: `site/_config.yml` -> `worker_api_base`

## 3) Jekyll Widget Setup

Embed in any page/layout:

```liquid
{% include jd_concierge.html %}
```

The include loads:

- `/assets/css/jd_concierge.css`
- `/assets/js/jd_concierge.js`

Worker base URL is read from:

```yml
worker_api_base: "https://jd-concierge-worker.<your-subdomain>.workers.dev"
```

## 4) End-to-End Local Test

Terminal 1: run Worker

```bash
cd worker && npm i && wrangler dev
```

Terminal 2: run the `/site` Jekyll app

```bash
cd site
bundle exec jekyll serve
```

API quick test with curl:

```bash
curl -sS http://127.0.0.1:8787/analyze \
  -H 'Content-Type: application/json' \
  -d '{"jd_text":"Responsibilities: Build RAG systems. Requirements: Python, TypeScript, Cloud deployment."}' | jq
```

Expected JSON shape:

```json
{
  "score": 0,
  "confidence": "Low",
  "fit_summary": "...",
  "strengths": [
    {
      "area": "...",
      "evidence_title": "...",
      "evidence_url": "...",
      "rationale": "..."
    }
  ],
  "gaps": [
    {
      "area": "...",
      "why_it_matters": "...",
      "mitigation": "..."
    }
  ],
  "risk_flags": ["..."],
  "rubric_breakdown": [
    {
      "category": "Responsibilities match",
      "score": 0,
      "weight": 30,
      "notes": "..."
    }
  ]
}
```

## 5) Anti-Abuse and Upgrade Notes

Current v1 protections in Worker:

- Request content-type enforcement (`application/json`)
- `jd_text` shape validation and max length (`<= 15000` chars)
- Payload size guard (`content-length` cap)
- Durable Object per-IP sliding window rate limiting (`5 requests / 60 minutes`)

Durable Object is the default implementation (not in-memory), so limits work across Worker isolates.

## 6) GitHub Pages Deploy

1. Ensure `worker_api_base` in `site/_config.yml` points to deployed Worker URL.
2. Push `main` branch.
3. Deploy your GitHub Pages site from the `/site` Jekyll content (or mirror `/site` into your Pages root/docs source).
4. If stale, hard refresh and wait for Pages rebuild.
