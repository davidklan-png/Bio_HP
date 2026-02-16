# CODEX Review Checklist

**Version:** 1.0
**Date:** 2026-02-16
**Purpose:** Ensure all E2E test cycle issues are identified and resolved in CODEX

---

## Overview

CODEX has automatic codescan enabled via GitHub integration. This checklist ensures that all issues identified during the E2E test cycle are properly tracked, documented, and fixed in CODEX.

**E2E Test Cycle Issues:**
- Issue 1: Japanese fluency hard cap not working (Critical)
- Issue 2: Domain mismatch overscoring (Critical)
- Issue 3: Risk flag detection incomplete (Moderate)
- Issue 4: Confidence scoring systematically low (Minor)

---

## Pre-Review Checklist

Before reviewing CODEX issues, ensure:

- [ ] E2E test runner has been executed
- [ ] Baseline results saved to `test-planning/baseline-results.json`
- [ ] All failures documented
- [ ] Each failure mapped to one of the 4 known issues
- [ ] CODEX integration is enabled in GitHub repository

---

## CODEX Issue Tracking Template

For each issue found during E2E testing, create a CODEX issue with the following structure:

### Issue Template

```markdown
## Title
[E2E] [Issue Type] Short description of the problem

## Severity
Critical / High / Medium / Low

## Category
Bug / Enhancement / Documentation / Testing

## Test Case Reference
- Test ID: TCXXX
- Test Name: [Test case name]
- Expected Behavior: [What should happen]
- Actual Behavior: [What actually happened]

## Description
Detailed description of the issue, including:
- Root cause analysis
- Impact on system functionality
- Relevant code locations

## Steps to Reproduce
1. Send POST request to `https://kinokoholic.com/api/analyze` with JD:
   ```
   [JD text from mock-jd-test-cases.json]
   ```
2. Observe response:
   - Score: [actual score]
   - Confidence: [actual confidence]
   - Risk Flags: [actual risk flags]
3. Compare with expected:
   - Score should be: [expected range]
   - Confidence should be: [expected confidence]
   - Risk Flags should include: [required flags]

## Expected Behavior
[What should happen according to test strategy]

## Actual Behavior
[What actually happened according to test results]

## Environment
- Repository: https://github.com/davidklan-png/Bio_HP
- API Endpoint: https://kinokoholic.com/api/analyze
- Worker Version: [git commit SHA]
- Profile Version: 2026-02-15

## Affected Components
- `worker/src/analysis.ts` (likely)
- `worker/src/analysis.test.ts` (for unit tests)

## Related Test Cases
- TC001: [Japanese fluency hard cap - JLPT N1]
- TC003: [Japanese fluency hard cap - Native or fluent]
- TC005: [Japanese fluency hard cap - Professional/Advanced]
- TC013: [Profile Japanese gate - JD doesn't mention Japanese]
(and more...)

## Labels
`e2e-test-failure`, `[component-tag]`, `bug`, `priority:high`

## Priority
Based on severity:
- Critical: Fix immediately (blocks core functionality)
- High: Fix this sprint
- Medium: Fix within 2 sprints
- Low: Fix when time permits

## Acceptance Criteria
- [ ] Unit test written and failing
- [ ] Fix implemented and unit test passing
- [ ] E2E test case passing
- [ ] No regressions introduced
- [ ] Code reviewed and merged

## Additional Notes
Any additional context, screenshots, or logs.
```

---

## Issue-Specific Checklists

### Issue 1: Japanese Fluency Hard Cap Not Working (Critical)

**Test Cases:**
- TC001: Japanese Fluency Hard Cap (JLPT N1)
- TC003: Japanese Fluency - Native or Fluent Pattern
- TC005: Japanese Fluency - Professional/Advanced Pattern
- TC013: Profile Japanese Gate - JD Doesn't Mention Japanese

**CODEX Issue Checklist:**

- [ ] CODEX issue created with title: `[E2E] [Critical] Japanese fluency hard cap not working - scores 100 instead of being capped at 60`
- [ ] Severity set to: Critical
- [ ] Category set to: Bug
- [ ] Labels added: `e2e-test-failure`, `analysis.ts`, `hard-gate`, `japanese`, `bug`, `priority:critical`
- [ ] Test case references included: TC001, TC003, TC005, TC013
- [ ] Root cause documented: Regex pattern in `evaluateRiskAndConstraints()` not matching all fluency variants
- [ ] Expected behavior documented: Score ≤ 60 for JDs requiring fluent/native Japanese
- [ ] Actual behavior documented: Score is 100 (no cap applied)
- [ ] Code location identified: `worker/src/analysis.ts` line ~690-700 (`evaluateRiskAndConstraints()`)
- [ ] Unit test requirements documented: Add tests for all pattern variants
- [ ] Fix requirements documented: Update regex, verify hard cap application
- [ ] Acceptance criteria defined:
  - [ ] Unit test added and failing
  - [ ] Regex pattern updated to match all fluency variants
  - [ ] Hard cap (60) applied to final score
  - [ ] Risk flag includes "Hard gate" text
  - [ ] Confidence downgraded to Low
  - [ ] All 4 test cases (TC001, TC003, TC005, TC013) passing
- [ ] Linked PR created (after fix)
- [ ] Issue closed after deployment and verification

---

### Issue 2: Domain Mismatch Overscoring (Critical)

**Test Cases:**
- TC002: Domain Mismatch - Cosmetics vs Tech Profile
- TC006: Domain Mismatch - Fashion Retail vs Tech Profile
- TC007: Domain Mismatch - Beauty Consulting vs Tech Profile

**CODEX Issue Checklist:**

- [ ] CODEX issue created with title: `[E2E] [Critical] Domain mismatch overscoring - cosmetics JD scores 73 instead of < 30`
- [ ] Severity set to: Critical
- [ ] Category set to: Bug
- [ ] Labels added: `e2e-test-failure`, `analysis.ts`, `domain-fit`, `scoring`, `bug`, `priority:critical`
- [ ] Test case references included: TC002, TC006, TC007
- [ ] Root cause documented: Generic skills ("change management", "communication") matching across domains without domain validation
- [ ] Expected behavior documented: Score ≤ 30 for domain-mismatched roles
- [ ] Actual behavior documented: Score is 73 (massive overscoring)
- [ ] Code location identified: `worker/src/analysis.ts` line ~450-500 (`evaluateSection()`)
- [ ] Unit test requirements documented: Add test for cosmetics vs tech profile
- [ ] Fix requirements documented: Detect domain terms, validate project domain, prevent generic skill matches
- [ ] Acceptance criteria defined:
  - [ ] Unit test added and failing
  - [ ] Domain-specific term detection implemented
  - [ ] Project domain validation implemented
  - [ ] Generic skills don't create false matches
  - [ ] All 3 test cases (TC002, TC006, TC007) passing with score ≤ 30
- [ ] Linked PR created (after fix)
- [ ] Issue closed after deployment and verification

---

### Issue 3: Risk Flag Detection Incomplete (Moderate)

**Test Cases:**
- TC004: Onsite Required Hard Cap (Fully Onsite)
- TC008: Onsite Required - 5 Days Onsite Pattern

**CODEX Issue Checklist:**

- [ ] CODEX issue created with title: `[E2E] [Moderate] Risk flag detection incomplete - missing standard flag names (ONSITE_REQUIRED, JAPANESE_FLUENCY)`
- [ ] Severity set to: High
- [ ] Category set to: Enhancement
- [ ] Labels added: `e2e-test-failure`, `analysis.ts`, `risk-flags`, `standardization`, `enhancement`, `priority:high`
- [ ] Test case references included: TC004, TC008
- [ ] Root cause documented: Risk flags are descriptive but not machine-readable (no standard names)
- [ ] Expected behavior documented: Risk flags include standard machine-readable names
- [ ] Actual behavior documented: Risk flags are human-readable only (e.g., "Score capped at 70" without "ONSITE_REQUIRED:")
- [ ] Code location identified: `worker/src/analysis.ts` line ~650-680 (`evaluateRiskAndConstraints()`)
- [ ] Unit test requirements documented: Add tests to verify standard flag names are present
- [ ] Fix requirements documented: Update `addRiskFlag()` to accept standard name, define standard flag name constants
- [ ] Acceptance criteria defined:
  - [ ] Unit test added and failing
  - [ ] Standard flag names implemented (JAPANESE_FLUENCY, ONSITE_REQUIRED, LANGUAGE_MISMATCH, CONTRACT_ONLY)
  - [ ] `addRiskFlag()` accepts standard name and message
  - [ ] Risk flags deduplicated correctly
  - [ ] Test cases (TC004, TC008) passing with standard flag names
- [ ] Linked PR created (after fix)
- [ ] Issue closed after deployment and verification

---

### Issue 4: Confidence Scoring Systematically Low (Minor)

**Test Cases:**
- TC009: High Fit - AI/LLM Engineering Role
- TC015: Confidence Scoring - High Evidence Coverage

**CODEX Issue Checklist:**

- [ ] CODEX issue created with title: `[E2E] [Minor] Confidence scoring systematically low - High confidence cases score as Medium`
- [ ] Severity set to: Medium
- [ ] Category set to: Bug / Enhancement
- [ ] Labels added: `e2e-test-failure`, `analysis.ts`, `confidence`, `scoring`, `bug`, `priority:medium`
- [ ] Test case references included: TC009, TC015
- [ ] Root cause documented: Thresholds in `calculateConfidence()` may be too strict
- [ ] Expected behavior documented: Confidence matches human judgment (High when 70%+ must-have coverage, 3+ URLs, domain aligned)
- [ ] Actual behavior documented: Confidence is 1 level lower than expected
- [ ] Code location identified: `worker/src/analysis.ts` line ~400-420 (`calculateConfidence()`)
- [ ] Unit test requirements documented: Add test with full ConfidenceInput context
- [ ] Fix requirements documented: Verify thresholds are appropriate, adjust if necessary
- [ ] Acceptance criteria defined:
  - [ ] Unit test added (may or may not fail)
  - [ ] Thresholds verified (must-have coverage ≥ 0.7, unique URLs ≥ 3, domain score ≥ 5)
  - [ ] If failing: Thresholds adjusted
  - [ ] If passing: No changes needed, documented as correct
  - [ ] Test cases (TC009, TC015) passing with correct confidence
- [ ] Linked PR created (after fix or verification)
- [ ] Issue closed after deployment and verification

---

## CODEX Integration Verification

### 1. Verify CODEX Integration is Enabled

```bash
# Check if CODEX is installed in GitHub repository
gh api repos/davidklan-png/Bio_HP/check-runs
```

**Expected:** CODEX checks appear in recent commit runs

---

### 2. Verify CODEX is Running on Commits

After creating commits for fixes:

- [ ] Push commit to branch
- [ ] Check GitHub Actions tab for CODEX workflow
- [ ] Verify CODEX scan runs automatically
- [ ] Check CODEX scan results for any new issues
- [ ] Address any CODEX-detected issues (unused imports, security issues, etc.)

---

### 3. CODEX Scan Results Review

After each CODEX scan, review:

- [ ] New issues detected (unused code, security vulnerabilities, performance issues)
- [ ] False positives (mark as won't fix with justification)
- [ ] Issues blocking merge (fix immediately)
- [ ] Issues for future sprints (triage and prioritize)

---

## Post-Fix Verification

After fixes are implemented and deployed:

### 1. Run E2E Test Runner Again

```bash
cd worker
npm run test:e2e
```

- [ ] All 15 test cases passing
- [ ] 100% pass rate achieved
- [ ] Regression results saved to `test-planning/regression-results.json`

---

### 2. Compare Baseline vs Regression

- [ ] Baseline: `test-planning/baseline-results.json`
- [ ] Regression: `test-planning/regression-results.json`
- [ ] Document improvements in issue threads

---

### 3. Close CODEX Issues

For each issue:

- [ ] All acceptance criteria met
- [ ] E2E test cases passing
- [ ] Fix deployed to production
- [ ] No regressions introduced
- [ ] CODEX scan passes
- [ ] Issue closed with comment summarizing fix

**Close Comment Template:**
```markdown
Fixed in PR #[PR number]

**Changes:**
- [Summary of changes]

**Test Results:**
- Before: [TC IDs] FAILED
- After: [TC IDs] PASSED

**Baseline Score:** [score] / 100
**Regression Score:** [score] / 100

**Acceptance Criteria:**
- [x] Unit test added and passing
- [x] Fix implemented
- [x] E2E test case passing
- [x] No regressions introduced
- [x] Code reviewed and merged
```

---

## CODEX Issue Labels

Use these labels for consistent categorization:

### Severity
- `priority:critical` - Fix immediately
- `priority:high` - Fix this sprint
- `priority:medium` - Fix within 2 sprints
- `priority:low` - Fix when time permits

### Type
- `bug` - Software defect
- `enhancement` - Feature addition or improvement
- `documentation` - Docs update needed
- `testing` - Test-related work

### Component
- `analysis.ts` - Core analysis logic
- `index.ts` - Worker entry point
- `frontend` - Jekyll widget or JS
- `tests` - Unit or E2E tests
- `profile.json` - Candidate profile data

### Workflow
- `e2e-test-failure` - Issue found during E2E testing
- `needs-investigation` - Root cause not yet identified
- `in-progress` - Currently being worked on
- `blocked` - Waiting on something else
- `ready-for-review` - Ready for code review
- `ready-for-test` - Ready for QA testing

---

## CODEX Issue Templates

### Bug Report (Critical)

```markdown
## [E2E] [Critical] Japanese fluency hard cap not working

### Severity
Critical

### Category
Bug

### Test Case Reference
- TC001, TC003, TC005, TC013

### Description
JD requiring fluent/native Japanese scores 100 instead of being capped at 60.

### Root Cause
Regex pattern in `evaluateRiskAndConstraints()` not matching all fluency variants.

### Code Location
`worker/src/analysis.ts` line ~690-700

### Acceptance Criteria
- [ ] Unit test added and failing
- [ ] Regex pattern updated
- [ ] Hard cap (60) applied
- [ ] All 4 test cases passing

### Labels
`e2e-test-failure`, `analysis.ts`, `hard-gate`, `japanese`, `bug`, `priority:critical`
```

---

### Enhancement (Moderate)

```markdown
## [E2E] [Moderate] Risk flag standardization

### Severity
High

### Category
Enhancement

### Test Case Reference
- TC004, TC008

### Description
Risk flags should include standard machine-readable names for easy filtering.

### Root Cause
Current flags are human-readable only (e.g., "Score capped at 70").

### Proposed Solution
Add standard names: JAPANESE_FLUENCY, ONSITE_REQUIRED, etc.

### Code Location
`worker/src/analysis.ts` line ~650-680

### Acceptance Criteria
- [ ] Standard flag names defined
- [ ] `addRiskFlag()` updated
- [ ] Test cases passing

### Labels
`e2e-test-failure`, `analysis.ts`, `risk-flags`, `standardization`, `enhancement`, `priority:high`
```

---

## CODEX Workflow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Planning Phase (Planning Orchestrator)                   │
│    - Create test strategy                                    │
│    - Define test cases and expected results                 │
│    - Document known issues                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Execution Phase (GLM Dev Agent)                           │
│    - Implement E2E test runner                              │
│    - Run baseline tests                                     │
│    - Create CODEX issues from failures                       │
│    - Implement fixes (TDD)                                   │
│    - Deploy fixes                                            │
│    - Run regression tests                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Verification Phase                                        │
│    - Verify 100% test pass rate                             │
│    - Close CODEX issues                                     │
│    - Document results                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

The E2E test cycle is complete when:

- [ ] All 15 test cases passing (100% pass rate)
- [ ] All 4 CODEX issues created
- [ ] All 4 CODEX issues closed
- [ ] Baseline vs regression comparison documented
- [ ] No regressions introduced
- [ ] CODEX scans passing
- [ ] Summary report delivered

---

## Appendix: CODEX Command Reference

### Create CODEX Issue via CLI

```bash
# Create issue (using GitHub CLI)
gh issue create --title "[E2E] [Critical] Japanese fluency hard cap not working" \
  --body "[Issue description with template]" \
  --label "e2e-test-failure,analysis.ts,hard-gate,japanese,bug,priority:critical"
```

---

### List CODEX Issues

```bash
# List all open CODEX issues
gh issue list --label "e2e-test-failure"

# List by priority
gh issue list --label "e2e-test-failure" --label "priority:critical"
```

---

### Close CODEX Issue

```bash
# Close issue with comment
gh issue close 123 --comment "Fixed in PR #456. All test cases passing."
```

---

## Change History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-16 | Initial CODEX review checklist | Planning Orchestrator |
