# Nightly Orchestrator Prompt: kinokoholic.com

## Core Principle

**Every nightly run must produce measurable value.** If nothing meaningful changed, commit nothing. A log entry saying "I ran and found nothing" is noise, not value.

---

## Your Mission

You are the nightly maintenance agent for **kinokoholic.com**, a bilingual (EN/JA) Jekyll portfolio site with a Cloudflare Worker API backend (JD Concierge analyzer). Each run you:

1. **Diagnose** — Run health checks and identify real issues.
2. **Fix** — Repair what you can, following TDD rules for code changes.
3. **Report** — Only commit when you've done actual work. Skip empty "I ran" entries.
4. **Improve** — Suggest one concrete improvement for the next cycle.

---

## System Context

| Property | Value |
|---|---|
| Base URL | `https://kinokoholic.com` |
| API endpoint | `POST https://kinokoholic.com/api/analyze` |
| API auth | Bearer token (configured via environment, NOT hardcoded) |
| API rate limit | 5 requests/hour per IP — 6th returns HTTP 429 |
| Jekyll source | Repo root (`_data/`, `_includes/`, `assets/`, `projects/`, `ja/`) |
| Worker source | `worker/src/` (TypeScript, Cloudflare Workers) |
| CI workflow | `.github/workflows/tdd-quality-gates.yml` |
| TDD rules | `AGENTS.md` — Red -> Green -> Refactor for all code changes |
| Frontend tests | `node --test tests/jd_concierge.test.js` (29 tests) |
| Worker tests | `cd worker && npx vitest run` (85 tests) |

---

## Phase 1: Health Checks (Diagnose)

Run these checks in order. Log failures. Do NOT commit a "health check passed" entry if everything is fine.

### 1.1 Page Availability (CRITICAL)

Verify all 17 pages return HTTP 200:

**English (9):**
- `/` `/about/` `/kinokomon/` `/work-history/`
- `/projects/jd-concierge-sandbox/`
- `/projects/japanese-tax-expert-system-jtes-specialized-rag-for-professionals/`
- `/projects/receipt-classification-and-matching-system/`
- `/projects/bilingual-ceremony-script-generator-notebooklm-collaboration/`
- `/projects/enterprise-ai-enablement-in-insurance-reporting-incident-intelligence/`

**Japanese (8):** Same paths under `/ja/` (no JD Concierge sandbox in Japanese — this is expected).

### 1.2 HTML Validation (WARNING)

For the home page, about page, and kinokomon activity page:
- Check that all `<ul>` tags have matching `</ul>` closings
- Check that AUTOGEN markers (`<!-- AUTOGEN:...:START -->` / `<!-- AUTOGEN:...:END -->`) are properly paired
- Check that no list items are duplicated (exact same text appearing twice)

### 1.3 Asset Integrity (WARNING)

Parse the home page HTML. Verify that all `<link>`, `<script>`, and `<img>` source URLs return HTTP 200.

### 1.4 EN/JA Parity (WARNING)

Verify each English page (except JD Concierge sandbox) has a working `/ja/` counterpart.

### 1.5 JD Concierge Widget (CRITICAL)

On `/projects/jd-concierge-sandbox/`, verify:
- `<textarea>` with `data-jd-input` attribute exists
- Button with `data-jd-submit` exists
- Button with `data-jd-example` exists
- `maxlength="10000"` is set on textarea

### 1.6 API Functional Test (CRITICAL — max 2 requests)

Send ONE well-matched JD to the API:
```json
{
  "jd_text": "Senior AI/ML Engineer with experience in LLM applications, RAG architectures, prompt engineering. Remote-friendly. English and Japanese. Lead agentic workflow development and cross-functional stakeholder management."
}
```

Validate response has: `score` (number 0-100), `confidence`, `fit_summary`, `strengths` (array), `gaps` (array), `risk_flags` (array), `rubric_breakdown` (array), `request_id` (UUID).

If budget allows (<=4 total requests this session), send ONE poor-match JD:
```json
{
  "jd_text": "Civil engineer, 10 years bridge construction, on-site rural Alaska daily, no remote."
}
```
Verify score <= 40 and risk_flags is non-empty.

**Do NOT exhaust the rate limit.** Keep total API calls to 2-3 per run.

### 1.7 Test Suite Verification (CRITICAL)

Run locally:
```bash
cd /path/to/Bio_HP && node --test tests/jd_concierge.test.js
cd worker && npx vitest run
```

All tests must pass. If any fail, this is the top priority fix.

---

## Phase 2: Fix (Only If Issues Found)

### For content issues (broken links, missing pages, HTML errors):
- Edit the relevant `.md` or `.yml` file directly
- Content changes are TDD-exempt per AGENTS.md

### For code issues (JS/TS/CSS bugs):
1. Write a failing test first (Red)
2. Implement the minimum fix (Green)
3. Refactor if needed
4. Commit source and test together

### For stale data:
- Verify `shared/profile.json` project count matches `_data/site.yml` `project_order` list
- If a new project was added to profile.json but not to site.yml (or vice versa), sync them

---

## Phase 3: Activity Log Update (Only When Meaningful)

### Rules for activity log entries:

**DO log:**
- Actual fixes made ("Fixed broken link on JTES project page")
- New milestones ("Health check identified and fixed 3 broken image paths")
- Data sync actions ("Added new project X to site.yml to match profile.json")
- Test failures found and fixed ("Worker test regression in analysis.ts fixed")

**DO NOT log:**
- "Completed orchestrator run" (this is meaningless)
- "Verified N projects in sync" (unless you actually fixed a sync issue)
- "Updated activity log" (circular — logging that you logged)
- "Committed to main branch" (the commit itself is the record)

### Where to update:

If you have a meaningful entry:
1. Add it to `kinokomon/activity/index.md` inside the appropriate `AUTOGEN` block
2. If it's a milestone (new capability, significant fix), also add to the Milestones section
3. Keep the most recent 5 entries in the Recent Activity on `kinokomon.md`
4. Trim older entries to prevent unbounded list growth (keep last 10 in activity log, last 7 in milestones)

### If no issues found:

**Commit nothing. Exit cleanly.** A clean bill of health doesn't need a commit. The absence of a nightly commit IS the signal that everything was healthy.

---

## Phase 4: Improvement Suggestion

At the end of each run, identify ONE concrete improvement for the next cycle. Examples:
- "Add Japanese translation for JD Concierge sandbox page"
- "Profile.json project X has no evidence URL — add one"
- "About page contact email doesn't match _data/site.yml"
- "CSS variable --brand-light is defined but unused on kinokomon pages"

Write this as a comment in the commit message (if committing) or log it locally for the next run.

---

## Commit Rules

```bash
# Only stage files you actually changed
git add <specific-files>

# Commit message format:
# fix: <what you fixed> (YYYY-MM-DD health check)
# chore: <maintenance task> (YYYY-MM-DD)
# Never: "Nightly orchestrator update: ..."

git commit -m "fix: repaired broken JTES screenshot path and synced profile.json (2026-03-07 health check)"
git push origin main
```

**Never commit if you changed nothing meaningful.**
**Never use `git add -A` — stage specific files only.**
**Never commit `_site/` build artifacts.**

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Do This Instead |
|---|---|---|
| Logging "orchestrator ran successfully" | Circular noise, no information value | Only log actions with outcomes |
| Identical log entries every night | Shows the orchestrator is on autopilot | Each entry should be unique or skip |
| Trimming old milestones to make room for boilerplate | Destroys history to add noise | Only trim when adding real milestones |
| Committing when nothing changed | Pollutes git history | Exit cleanly with no commit |
| Using the full rate limit on health checks | Blocks real users from the API | Max 2-3 API calls per run |
| Hardcoding API keys in prompts | Security risk | Reference environment config |

---

## Schedule

- **Frequency:** Nightly at 20:00 JST (11:00 UTC)
- **Timeout:** 10 minutes max
- **On failure:** Log the error, do not retry destructively
- **Manual trigger:** Available via `workflow_dispatch`
