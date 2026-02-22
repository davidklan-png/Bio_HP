# Overnight Task - Bio_HP E2E Critical Issues Fixes

**Date:** 2026-02-19
**Time:** 07:55 JST
**Agent:** Kinokomon (Orchestrator)

---

## Objective

Fix 4 critical issues identified in E2E baseline test (2026-02-16):
1. Japanese Fluency Hard Cap - Score incorrectly exceeds 60 limit in TC013
2. Domain Mismatch Overscoring - Generic skills matching unrelated domains
3. Risk Flag Standardization - Need standard names (JAPANESE_FLUENCY, etc.)
4. Confidence Scoring - Verify thresholds are appropriate

## Test Status (Baseline)

**Total Tests:** 15
**Passed:** 5
**Failed:** 10
**Baseline Results:** All failed as expected (to verify issues exist)

## Critical Issues

### Issue 1: Japanese Fluency Hard Cap

**Test Cases:**
- TC001: Scored 60 (correctly capped) ✅
- TC003: Scored 60 (correctly capped) ✅
- TC005: Scored 60 (correctly capped) ✅
- **TC013: Scored 88 (CRITICAL FAILURE - should be ≤60)** ❌

**Expected Behavior:**
- When JD mentions Japanese fluency requirement and profile does NOT have fluent/native Japanese evidence → cap score at 60
- TC013: Profile has "Japanese (Business)" but JD doesn't mention Japanese → Should NOT trigger hard cap

**Root Cause:**
- Logic in `evaluateRiskAndConstraints()` or `scoreJapaneseFluency()` incorrectly triggers hard cap
- May be checking if profile "has Japanese" rather than "requires Japanese fluent/native"

**Fix Required:**
1. Review Japanese fluency scoring logic in `worker/src/analysis.ts`
2. Fix condition: Only cap at 60 when JD requires fluent/native Japanese AND profile lacks that evidence
3. Test with TC013 to verify score drops to ≤60

### Issue 2: Domain Mismatch Overscoring

**Test Cases:**
- TC002: Scored 40, expected 0-30 (overscoring by ~10-40 points)
- TC006: Scored 71, expected 0-30 (major overscoring by ~40-70 points)
- TC007: Scored 36, expected 0-25 (overscoring by ~10-15 points)
- TC011: Scored 71, expected 20-40 (low-fit role scored high)

**Root Cause:**
- Generic skills (change management, communication) matching across unrelated domains (cosmetics vs AI/LLM)
- No domain validation before counting evidence
- Skills like "change management" counted as evidence even when JD is clearly cosmetics/retail

**Fix Required:**
1. Implement domain-specific term detection in `worker/src/analysis.ts`
2. Validate project domain before counting evidence
3. Create domain-specific skill lists (AI/LLM skills vs. generic business skills)
4. Prevent generic skills from matching when domains differ

### Issue 3: Risk Flag Standardization

**All Risk Flags:**
Currently use descriptive text like:
- "Japanese Language Requirement"
- "JD requires onsite presence"

**Should Be (Standard Names):**
- `JAPANESE_FLUENCY`
- `ONSITE_REQUIRED`
- `LANGUAGE_MISMATCH`
- `CONTRACT_TYPE`

**Fix Required:**
1. Define `STANDARD_RISK_FLAGS` constant in `worker/src/analysis.ts`
2. Update all `addRiskFlag()` calls to use standard names
3. Update frontend (`assets/js/jd_concierge.js`) to display standard flag names

### Issue 4: Confidence Scoring

**Test Case:**
- TC015: Need to verify confidence is appropriate

**Fix Required:**
1. Review confidence scoring thresholds in `worker/src/analysis.ts`
2. Verify thresholds align with expected confidence levels
3. Adjust if necessary

---

## Technical Context

**Files to Modify:**
- `worker/src/analysis.ts` - Main analysis logic
- `worker/src/issue1-japanese-fluency.test.ts` - Unit tests for Issue 1
- `assets/js/jd_concierge.js` - Frontend risk flag display

**Test Data:**
- `test-planning/mock-jd-test-cases.json` - 15 test cases
- `test-planning/e2e-test-results.json` - Baseline results

**Test Runner:**
- `worker/scripts/e2e-test-runner.ts`

**Deployment:**
- `cd worker && npx wrangler deploy`
- CI/CD: `.github/workflows/tdd-quality-gates.yml`

---

## Workload Estimation

### Issue 1 (Japanese Fluency)
- Complexity: Medium (fix condition logic)
- Estimated: 2-4 hours (analysis, fix, tests, deploy)

### Issue 2 (Domain Mismatch)
- Complexity: High (new feature, domain detection, skill categorization)
- Estimated: 4-8 hours (implementation, tests, deploy)

### Issue 3 (Risk Flags)
- Complexity: Low-Medium (constant definition, refactoring)
- Estimated: 1-2 hours

### Issue 4 (Confidence)
- Complexity: Low (review thresholds)
- Estimated: 1-2 hours

**Total Estimated Time:** 8-16 hours

---

## Execution Plan

### Phase 1: Analysis & Planning (1-2 hours)
1. Read `worker/src/analysis.ts` thoroughly
2. Understand current Japanese fluency logic
3. Identify domain validation needs
4. Plan domain-specific skill lists

### Phase 2: Implement Fixes (4-8 hours)
1. Fix Issue 1: Japanese fluency hard cap
2. Fix Issue 2: Domain mismatch prevention
3. Fix Issue 3: Risk flag standardization
4. Fix Issue 4: Confidence scoring review

### Phase 3: Testing (2-4 hours)
1. Run E2E test suite against fixes
2. Verify all 4 issues are resolved
3. Run regression tests (ensure nothing else broke)

### Phase 4: Deployment (1-2 hours)
1. Commit changes to Git
2. Push to GitHub (opens PR)
3. Wait for CI/CD (TDD gates, worker tests)
4. Deploy to Cloudflare Workers
5. Verify production behavior

---

## Success Criteria

### Issue 1 Fixed ✅
- TC013 score ≤ 60 (down from 88)
- TC001, TC003, TC005 still score 60 (regression test)

### Issue 2 Fixed ✅
- TC002 score ≤ 30 (down from 40)
- TC006 score ≤ 30 (down from 71)
- TC007 score ≤ 25 (down from 36)
- TC011 score in range 20-40 (down from 71)

### Issue 3 Fixed ✅
- All risk flags use standard names (JAPANESE_FLUENCY, ONSITE_REQUIRED, etc.)
- Frontend displays standard flag names

### Issue 4 Fixed ✅
- TC015 confidence matches expected level

---

## Notes

- Follow TDD: Red → Green → Refactor
- Run TDD guard before pushing: `python3 scripts/tdd_guard.py --against origin/main`
- Worker must pass: `cd worker && npm run check && npm test`
- Check CODEX issues after deployment
- Send LINE alert when complete: U806bc4f730d471e2aa87266244c9facf

---

## Model Selection

**This task requires:**
- **GLM-5 (zai/glm-5)** for planning and complex architectural decisions
- **GLM-4.7 (zai/glm-4.7)** for implementation, bug fixes, and unit tests

**Reasoning:**
- Issue 2 (Domain Mismatch) is new feature development requiring design decisions
- Issues 1, 3, 4 are fixes to existing logic
- GLM-5 can plan the overall approach
- GLM-4.7 can implement efficiently with proper guidance

---

*End of Overnight Task*
