# JD Concierge Worker

Cloudflare Worker that analyzes job descriptions against a candidate profile and returns fit scores with evidence-backed strengths and gaps.

## Features

- **Job description analysis**: Parses JD text and matches against profile evidence
- **Fit scoring**: 0-100 score with confidence levels (Low/Medium/High)
- **Evidence-backed**: Links strengths to actual project evidence URLs
- **Rate limiting**: Durable Object-based rate limiter (5 requests/hour per IP)
- **D1 storage**: Stores all submissions for continuous improvement

## Development

```bash
# Install dependencies
npm install

# Type check
npm run check

# Run tests
npm test

# Local development (with local D1)
npm run dev
```

## D1 Database Setup

### 1. Create the database

```bash
npx wrangler d1 create jd_concierge
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "jd_concierge"
database_id = "<your-database-id>"
```

### 2. Run migrations

```bash
# Local (for development)
npm run db:migrate:local

# Production
npm run db:migrate
```

## D1 Schema

### `submissions` table

Stores each analysis request and response:

| Column | Type | Description |
|--------|------|-------------|
| request_id | TEXT | Primary key, UUID |
| created_at | TEXT | ISO8601 timestamp |
| jd_text | TEXT | Full JD text (max 15000 chars) |
| jd_text_len | INTEGER | Character count |
| jd_sha256 | TEXT | SHA-256 hash for deduplication |
| origin | TEXT | Request Origin header |
| user_agent_hash | TEXT | SHA-256 of User-Agent (no raw UA stored) |
| scorer_version | TEXT | Algorithm version (e.g., "1.1.0") |
| score | INTEGER | Fit score 0-100 |
| confidence | TEXT | "Low", "Medium", or "High" |
| evidence_count | INTEGER | Number of strengths found |
| response_json | TEXT | Full analysis response JSON |
| latency_ms | INTEGER | Request processing time |
| rate_limited | INTEGER | 1 if rate-limited, 0 otherwise |
| validation_error | TEXT | Error message if validation failed |

### `labels` table

For manual annotation and continuous improvement:

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| request_id | TEXT | FK to submissions |
| created_at | TEXT | ISO8601 timestamp |
| label_type | TEXT | e.g., "quality", "false_positive", "false_negative" |
| label_value | TEXT | e.g., "good"/"bad" or freeform |
| notes | TEXT | Optional notes |

## Continuous Improvement Workflow

### Query examples

Find low-confidence cases:

```sql
SELECT request_id, created_at, score, confidence, evidence_count
FROM submissions
WHERE confidence='Low'
ORDER BY created_at DESC
LIMIT 50;
```

Find borderline scores (55-75):

```sql
SELECT request_id, score, confidence, jd_text
FROM submissions
WHERE score BETWEEN 55 AND 75
ORDER BY created_at DESC
LIMIT 100;
```

Find duplicates by JD hash:

```sql
SELECT jd_sha256, COUNT(*) as count
FROM submissions
GROUP BY jd_sha256
HAVING count > 1;
```

Get samples with full JD and response for review:

```sql
SELECT request_id, jd_text, response_json
FROM submissions
WHERE confidence = 'Low'
ORDER BY created_at DESC
LIMIT 10;
```

### Export data for offline review

```bash
# Using wrangler (outputs to console)
npx wrangler d1 execute jd_concierge --remote --command \
  "SELECT * FROM submissions ORDER BY created_at DESC LIMIT 100"

# Or use the export script (requires env vars)
CLOUDFLARE_ACCOUNT_ID=xxx \
CLOUDFLARE_API_TOKEN=xxx \
D1_DATABASE_ID=xxx \
npm run db:export 500
```

### Add labels manually

After reviewing samples, insert labels into the database:

```sql
INSERT INTO labels (request_id, created_at, label_type, label_value, notes)
VALUES
  ('uuid-1', '2026-02-14T12:00:00Z', 'quality', 'good', 'Score accurately reflects fit'),
  ('uuid-2', '2026-02-14T12:05:00Z', 'false_negative', 'underestimated', 'Strengths exist but not matched');
```

### Track algorithm changes

When you update the scoring algorithm:

1. Bump `SCORER_VERSION` in `src/storage.ts`
2. Document the change in git commit
3. Use `scorer_version` in queries to compare before/after performance

Example:

```sql
SELECT scorer_version, AVG(score) as avg_score, COUNT(*) as count
FROM submissions
GROUP BY scorer_version;
```

## Integration Smoke Test

After deployment, verify the full flow:

```bash
# 1. Send a test request
curl -X POST https://kinokoholic.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"jd_text": "Looking for a TypeScript developer with Cloudflare Workers experience."}'

# 2. Note the request_id from response

# 3. Query D1 to verify it was stored
npx wrangler d1 execute jd_concierge --remote --command \
  "SELECT * FROM submissions WHERE request_id = '<your-request-id>'"
```

## Security Notes

- No IP addresses stored in plaintext
- No raw User-Agent strings stored (only SHA-256 hash)
- JD text is stored for analysis but truncated to 15000 characters
- DB insert failures never block API responses (fail-open)
- JD text is NOT logged to console (only length and metadata)

## Deployment

```bash
npm run deploy
```

This deploys the Worker with:
- D1 database bound as `DB`
- Rate limiter Durable Object bound as `RATE_LIMITER`
- Routes configured for `kinokoholic.com/api/*`
