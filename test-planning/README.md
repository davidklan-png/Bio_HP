# JD Concierge E2E Test Cycle - Planning Documents

**Created:** 2026-02-16
**Planning Orchestrator:** jd-test-planning
**Status:** ✅ Planning Complete - Ready for GLM Dev Agent Execution

---

## Overview

This directory contains comprehensive planning documents for the JD Concierge End-to-End Test Cycle. The goal is to validate the full analysis pipeline (JD input → JavaScript processing → Cloudflare Worker → Score/Risk flags) and fix 4 known issues.

---

## Document Structure

### 1. test-strategy.md (18KB)
**Purpose:** Overall test strategy and architecture overview

**Contents:**
- Executive summary and goals
- System architecture diagram
- Scoring rubric and hard gates
- Testing scope (unit, E2E, regression)
- Known issues to validate (Critical/Moderate/Minor)
- Test data strategy and expected results definition
- Test execution methodology (3 phases)
- Test reporting format
- Risk mitigation strategies

**Read this first** to understand the overall testing approach.

---

### 2. mock-jd-test-cases.json (28KB)
**Purpose:** Test cases with JD text and expected results

**Contents:**
- 15 test cases covering diverse scenarios:
  - **Critical (7 tests):** Japanese fluency hard cap, domain mismatch
  - **Moderate (2 tests):** Onsite requirements, contract-only
  - **Regression (4 tests):** High/medium/low fit validation
  - **Edge cases (2 tests):** Minimal JD, confidence scoring
- Expected results for each test:
  - Score ranges (min/max)
  - Confidence level
  - Required/forbidden risk flags
  - Required strength/gap areas
  - Rubric category expectations
  - Human rationale

**Use this** as input for the E2E test runner.

---

### 3. handoff-contract.md (26KB)
**Purpose:** Detailed instructions for GLM dev agent execution

**Contents:**
- Summary of deliverables (planning vs execution)
- Prerequisites and environment setup
- Detailed investigation steps for each issue
- Fix requirements and unit tests to add
- Implementation workflow (5 phases):
  1. Implement E2E test runner
  2. Run baseline tests
  3. Implement fixes (TDD workflow: Red → Green → Refactor)
  4. Deploy fixes
  5. Run regression tests
- Code examples for test runner and unit tests
- Quality gates (pass/fail criteria)

**Use this** as the execution guide for implementing fixes.

---

### 4. codex-review-checklist.md (18KB)
**Purpose:** CODEX issue tracking and verification

**Contents:**
- Pre-review checklist
- CODEX issue tracking template
- Issue-specific checklists for each of the 4 known issues
- CODEX integration verification steps
- Post-fix verification steps
- CODEX issue labels and templates
- Success criteria

**Use this** to ensure all issues are properly tracked in CODEX.

---

## Known Issues to Fix

### Critical Issues

#### Issue 1: Japanese Fluency Hard Cap Not Working
**Test Cases:** TC001, TC003, TC005, TC013
**Symptom:** JD requiring fluent Japanese scores 100 instead of being capped at 60
**Root Cause:** Regex pattern not matching all fluency variants

#### Issue 2: Domain Mismatch Overscoring
**Test Cases:** TC002, TC006, TC007
**Symptom:** Cosmetics/retail JD vs tech profile scores 73 (should be < 30)
**Root Cause:** Generic skills matching across domains without validation

### Moderate Issues

#### Issue 3: Risk Flag Detection Incomplete
**Test Cases:** TC004, TC008
**Symptom:** Missing standard flag names (ONSITE_REQUIRED, JAPANESE_FLUENCY)
**Root Cause:** Flags are descriptive but not machine-readable

### Minor Issues

#### Issue 4: Confidence Scoring Systematically Low
**Test Cases:** TC009, TC015
**Symptom:** Confidence is 1 level lower than expected
**Root Cause:** Thresholds may be too strict

---

## Quick Start for GLM Dev Agent

### Step 1: Read the Planning Documents

```bash
cd /home/teabagger/dev/projects/Bio_HP/test-planning

# Read in order
1. test-strategy.md           # Understand the overall approach
2. mock-jd-test-cases.json    # Review test cases
3. handoff-contract.md        # Detailed execution instructions
4. codex-review-checklist.md  # CODEX issue tracking
```

### Step 2: Implement E2E Test Runner

Follow instructions in `handoff-contract.md` → Phase 1

### Step 3: Run Baseline Tests

Follow instructions in `handoff-contract.md` → Phase 2

Expected result: All 15 tests fail (baseline established)

### Step 4: Implement Fixes (TDD Workflow)

For each issue (Issue 1, 2, 3, 4):
1. Write failing unit test (Red)
2. Implement fix (Green)
3. Refactor and clean up
4. Commit changes

### Step 5: Deploy Fixes

Follow instructions in `handoff-contract.md` → Phase 4

### Step 6: Run Regression Tests

Follow instructions in `handoff-contract.md` → Phase 5

Expected result: All 15 tests pass (100% pass rate)

### Step 7: Close CODEX Issues

Follow instructions in `codex-review-checklist.md`

---

## Test Results Locations

After testing:

- **Baseline Results:** `test-planning/baseline-results.json` (to be created)
- **Regression Results:** `test-planning/regression-results.json` (to be created)

---

## File Reference

### Planning Documents (This Directory)
- ✅ `test-strategy.md` - Test strategy
- ✅ `mock-jd-test-cases.json` - Test cases
- ✅ `handoff-contract.md` - Execution instructions
- ✅ `codex-review-checklist.md` - CODEX tracking
- ✅ `README.md` - This file

### Source Files (Parent Directory)
- `worker/src/analysis.ts` - Core analysis logic (fixes go here)
- `worker/src/analysis.test.ts` - Unit tests (add tests here)
- `shared/profile.json` - Candidate profile (ground truth)

### Scripts (Parent Directory)
- `scripts/tdd_guard.py` - TDD enforcement
- `scripts/setup-git-hooks.sh` - Git hooks setup

---

## Success Criteria

The E2E test cycle is complete when:

- [ ] E2E test runner implemented
- [ ] Baseline tests executed and documented
- [ ] All 4 known issues fixed
- [ ] Unit tests added for all fixes
- [ ] All 15 test cases passing (100% pass rate)
- [ ] Fixes deployed to production
- [ ] Regression tests confirm no regressions
- [ ] CODEX issues created and closed
- [ ] Summary report delivered

---

## Contact

**Planning Orchestrator:** jd-test-planning
**Repository:** https://github.com/davidklan-png/Bio_HP
**Live Site:** https://kinokoholic.com
**API Endpoint:** https://kinokoholic.com/api/analyze

---

## Status

| Phase | Status | Owner |
|-------|--------|-------|
| Planning | ✅ Complete | Planning Orchestrator |
| Execution | ⏳ Pending | GLM Dev Agent |
| Verification | ⏳ Pending | GLM Dev Agent |

---

**Next Step:** GLM Dev Agent should review `handoff-contract.md` and begin Phase 1 (Implement E2E Test Runner).
