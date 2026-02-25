# OpenClaw Prompt: kinokoholic.com Health-Check Cron Job

## Your Mission

You are a quality-assurance agent for **kinokoholic.com**, a bilingual (English/Japanese)
Jekyll portfolio site with a Cloudflare Worker API backend. Your job is to:

1. Run all health checks described below using BDD scenarios.
2. Log every failure with: URL, expected value, actual value, and severity (`CRITICAL` / `WARNING` / `INFO`).
3. Fix any problems you find, following the project's TDD rules.
4. Re-run affected checks to confirm each fix.
5. Produce an **Improvement Report** at the end suggesting what to watch next cycle.

---

## System Context

| Property | Value |
|---|---|
| Base URL | `https://kinokoholic.com` |
| API endpoint | `POST https://kinokoholic.com/api/analyze` |
| API auth header | `Authorization: Bearer jd-concierge-api-key-2025` |
| API rate limit | 5 requests / hour per IP — 6th returns HTTP 429 |
| Jekyll source | repo root (`_data/`, `_includes/`, `assets/`, `projects/`, `ja/`) |
| Worker source | `worker/src/` (TypeScript, Cloudflare Workers) |
| CI workflow | `.github/workflows/tdd-quality-gates.yml` |
| TDD rules | `AGENTS.md` — Red → Green → Refactor for all code changes |

---

## Complete URL Inventory

### English pages (9)

| Slug | URL |
|---|---|
| Home | `https://kinokoholic.com/` |
| About | `https://kinokoholic.com/about/` |
| Kinokomon | `https://kinokoholic.com/kinokomon/` |
| Work History | `https://kinokoholic.com/work-history/` |
| JD Concierge Sandbox | `https://kinokoholic.com/projects/jd-concierge-sandbox/` |
| JTES (RAG) | `https://kinokoholic.com/projects/japanese-tax-expert-system-jtes-specialized-rag-for-professionals/` |
| Receipt Classification | `https://kinokoholic.com/projects/receipt-classification-and-matching-system/` |
| Ceremony Script Generator | `https://kinokoholic.com/projects/bilingual-ceremony-script-generator-notebooklm-collaboration/` |
| Enterprise AI Enablement | `https://kinokoholic.com/projects/enterprise-ai-enablement-in-insurance-reporting-incident-intelligence/` |

### Japanese pages (8)

| Slug | URL |
|---|---|
| ホーム | `https://kinokoholic.com/ja/` |
| 概要 | `https://kinokoholic.com/ja/about/` |
| きのこもん | `https://kinokoholic.com/ja/kinokomon/` |
| 職歴 | `https://kinokoholic.com/ja/work-history/` |
| JTES (RAG) | `https://kinokoholic.com/ja/projects/japanese-tax-expert-system-jtes-specialized-rag-for-professionals/` |
| 領収書分類 | `https://kinokoholic.com/ja/projects/receipt-classification-and-matching-system/` |
| 式次第ジェネレーター | `https://kinokoholic.com/ja/projects/bilingual-ceremony-script-generator-notebooklm-collaboration/` |
| 保険AI | `https://kinokoholic.com/ja/projects/enterprise-ai-enablement-in-insurance-reporting-incident-intelligence/` |

**Note:** The JD Concierge Sandbox page (`/projects/jd-concierge-sandbox/`) has no Japanese counterpart — this is expected; do NOT flag it as a parity failure.

---

## BDD Health-Check Scenarios

Work through each scenario in order. For each failure, log it before moving on.

---

### Feature 1: Page Availability

```gherkin
Feature: All pages are reachable

  Scenario Outline: Each URL returns HTTP 200
    Given the site is deployed to https://kinokoholic.com
    When I send a GET request to <url>
    Then the response status code is 200
    And the response body is not empty

    Examples: all 17 URLs listed in the inventory above
```

**Implementation hint:** Use `curl -s -o /dev/null -w "%{http_code}" <url>` or Python `requests.get`.
**Severity if fails:** CRITICAL

---

### Feature 2: EN/JA Page Parity

```gherkin
Feature: Bilingual page parity

  Scenario: Every English page (except jd-concierge-sandbox) has a /ja/ counterpart
    Given the list of English pages
    When I prepend /ja to each path (excluding /projects/jd-concierge-sandbox/)
    Then each /ja/... URL returns HTTP 200

  Scenario: Every Japanese page has an English counterpart
    Given the list of Japanese pages
    When I strip the /ja prefix from each path
    Then each English URL returns HTTP 200

  Scenario: Language toggle links resolve
    Given I fetch any English page HTML
    When I find the lang-toggle anchor (href containing /ja/)
    Then the href is a valid URL that returns HTTP 200
    And vice versa for the Japanese page's toggle back to English
```

**Implementation hint:** Parse `<a>` tags with class `lang-toggle` or `href` matching `/ja/`.
**Severity if fails:** CRITICAL

---

### Feature 3: Navigation Consistency

```gherkin
Feature: Consistent header and footer on all pages

  Scenario Outline: Each page has the expected navigation elements
    Given I fetch the HTML of <url>
    Then the page contains a <nav> or <header> element
    And the page contains a site title link pointing to / or /ja/
    And the page contains a language-toggle link
    And the page contains a <footer> element

    Examples: all 17 pages
```

**Implementation hint:** Use BeautifulSoup or regex on the fetched HTML.
**Severity if fails:** WARNING

---

### Feature 4: JD Concierge Widget Render

```gherkin
Feature: JD Concierge widget is present on the sandbox page

  Scenario: Widget elements are present
    Given I fetch the HTML of https://kinokoholic.com/projects/jd-concierge-sandbox/
    Then the page contains a <textarea> with id "jd-input" (or class "jd-concierge__input")
    And the page contains a button with text "Analyze Fit" (or class "jd-concierge__submit")
    And the page contains a button with text "Try Example JD" (or class "jd-concierge__example")
    And the page contains an element with class "jd-concierge__loading" and attribute [hidden]
    And the page contains an element with class "jd-concierge__results"

  Scenario: Character counter reflects 10,000 limit
    Given the widget HTML
    Then the textarea has attribute maxlength="10000"
    And the counter text mentions "10,000"
```

**Severity if fails:** CRITICAL

---

### Feature 5: JD Analyzer API Functional Test

```gherkin
Feature: API returns a well-formed response

  Background:
    Given the API base URL is https://kinokoholic.com/api
    And the Authorization header is "Bearer jd-concierge-api-key-2025"

  Scenario: Analyze a sample JD and validate the response schema
    When I POST to /api/analyze with body:
      """
      {
        "jd_text": "We are looking for a Senior AI/ML Engineer with experience in LLM applications, RAG architectures, and prompt engineering. The role is remote-friendly and requires English and Japanese language skills. You will lead agentic workflow development and cross-functional stakeholder management."
      }
      """
    Then the response status is 200
    And the response JSON contains "score" (integer 0–100)
    And the response JSON contains "confidence" (one of: "Low", "Medium", "High")
    And the response JSON contains "fit_summary" (non-empty string)
    And the response JSON contains "strengths" (non-empty array)
    And each strength has keys: area, evidence_title, evidence_url, rationale
    And each evidence_url begins with "https://kinokoholic.com/"
    And the response JSON contains "gaps" (array, may be empty)
    And each gap has keys: area, why_it_matters, mitigation
    And the response JSON contains "risk_flags" (array)
    And the response JSON contains "rubric_breakdown" (non-empty array)
    And each rubric entry has keys: category, score, weight, notes
    And the sum of (entry.score * entry.weight) divided by sum(entry.weight) approximates the top-level score (±5 points)
    And "request_id" is a valid UUID

  Scenario: Score is calibrated for a strong match
    Given the JD text from the previous scenario (clear match for David Klan's profile)
    Then the score is >= 60

  Scenario: Score is low for a poor match
    When I POST /api/analyze with body:
      """
      { "jd_text": "We need a civil engineer with 10 years of bridge construction experience. Must be on-site in rural Alaska daily. No remote option." }
      """
    Then the score is <= 40
    And "risk_flags" contains at least one flag (e.g. ONSITE_REQUIRED or LOCATION_MISMATCH)
```

**Implementation hint:** Use `requests.post` or `fetch`. Do NOT send more than 4 requests total in this Feature to stay under the 5/hr rate limit.
**Severity if schema fails:** CRITICAL
**Severity if score calibration fails:** WARNING

---

### Feature 6: Rate Limiting

```gherkin
Feature: API enforces rate limit

  Scenario: 6th request within one hour returns 429
    Given I have already sent 5 requests to /api/analyze in this session
    When I send a 6th request
    Then the response status is 429
    And the response JSON contains "retry_after_seconds" (positive integer)
```

**Note:** Only run this scenario if you have consumed 5 requests already in the session. Otherwise, skip and log as `INFO: rate-limit scenario skipped (insufficient prior requests)`.
**Severity if fails:** WARNING

---

### Feature 7: Asset Integrity

```gherkin
Feature: Static assets load without errors

  Scenario: Key assets return HTTP 200
    Given I parse the HTML of https://kinokoholic.com/
    When I extract all <link rel="stylesheet">, <script src="...">, and <img src="..."> hrefs
    Then each resolved asset URL returns HTTP 200

  Scenario: No broken images on About page
    Given I fetch https://kinokoholic.com/about/
    Then the profile image (assets/images/DK_Avatar2.jpg or similar) returns HTTP 200
```

**Severity if fails:** WARNING

---

## Fix-Retest-Improve Cycle

After running all scenarios:

### Step 1 — Triage

Compile a failure log table:

| # | Severity | Feature | URL / endpoint | Expected | Actual | Root cause hypothesis |
|---|---|---|---|---|---|---|

### Step 2 — Fix

For each CRITICAL failure, attempt a fix:

- **Content fixes** (broken link, missing page, wrong text): edit the relevant `.md` or `.yml` file directly. Content changes are exempt from TDD per `AGENTS.md`.
- **Code fixes** (JS widget bug, Worker API bug, CSS issue): follow Red → Green → Refactor:
  1. Add or update a failing test in `tests/` (site JS) or `worker/src/` (Worker TS).
  2. Implement the minimum fix.
  3. Run the relevant test suite to confirm green.
  4. Commit source and test together.

For WARNING failures, fix if straightforward; otherwise document in the improvement report.

### Step 3 — Validate

Run the existing test suites to confirm nothing regressed:

```bash
# Site JS tests (31 tests)
node --test tests/jd_concierge.test.js

# Worker TypeScript tests (115 tests)
cd worker && npm run check && npm test

# Jekyll build
bundle exec jekyll build

# TDD guard
python3 scripts/tdd_guard.py --against origin/main

# All site JS tests
./scripts/run-site-js-tests.sh
```

All suites must exit 0 before committing.

### Step 4 — Re-run failing scenarios

Re-execute only the scenarios that previously failed to confirm resolution.

### Step 5 — Commit and Push

```bash
git add -p                          # stage only relevant files
git commit -m "fix: health-check remediation YYYY-MM-DD"
git push -u origin <your-branch>
```

**Never commit `_site/` build artifacts** (see AGENTS.md Critical Rule: No Duplicate Source Trees).

---

## Improvement Report Template

At the end of each cycle, produce a report in this format:

```markdown
## kinokoholic.com Health Check — YYYY-MM-DD

### Summary
- Pages checked: 17
- API calls made: N
- Failures found: N (CRITICAL: N, WARNING: N, INFO: N)
- Failures fixed: N
- Failures deferred: N

### Fixed This Cycle
- [description of each fix]

### Deferred / Acceptable
- [description of known issues accepted as-is, with rationale]

### Suggested Improvements for Next Cycle
- [concrete, prioritised suggestions — e.g. add Japanese JD Concierge sandbox page,
   add screenshot tests, expand rubric calibration tests, add Lighthouse performance check]

### Test Suite Status
| Suite | Tests | Result |
|---|---|---|
| site-js (jd_concierge) | 31 | PASS |
| worker-ts | 115 | PASS |
| jekyll-build | — | PASS |
```

---

## Cron Schedule Recommendation

Add a scheduled GitHub Actions workflow to run this health check automatically:

```yaml
# .github/workflows/health-check.yml
name: Site Health Check

on:
  schedule:
    - cron: '0 9 * * 1'   # Every Monday at 09:00 UTC
  workflow_dispatch:        # Allow manual trigger

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install requests beautifulsoup4
      - run: python3 scripts/health_check.py
```

The `scripts/health_check.py` script should implement the BDD scenarios above programmatically and exit non-zero if any CRITICAL check fails (which will make the GitHub Actions run show as failed and notify via email).
