# JD Concierge E2E Test Strategy

**Version:** 1.0
**Date:** 2026-02-16
**Repository:** https://github.com/davidklan-png/Bio_HP
**Live Site:** https://kinokoholic.com

---

## Executive Summary

This document outlines the comprehensive end-to-end testing strategy for the JD Concierge system, a job description analysis tool that evaluates candidate fit against a structured profile. The system combines Jekyll frontend with Cloudflare Worker backend to provide evidence-based scoring.

**Primary Goals:**
1. Validate the full analysis pipeline: JD input → JavaScript processing → Cloudflare Worker → Score/Risk flags
2. Verify critical bug fixes: Japanese fluency hard cap, domain mismatch overscoring, risk flag detection
3. Ensure confidence scoring accuracy
4. Document expected results for regression testing

---

## System Architecture Overview

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Jekyll Frontend                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  jd_concierge.html (Widget)                          │  │
│  │  - Character counter                                 │  │
│  │  - Example JD button                                 │  │
│  │  - Loading/error handling                            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  jd_concierge.js (Client-side)                       │  │
│  │  - Input validation                                   │  │
│  │  - API call to Worker                                 │  │
│  │  - Response rendering                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ POST /api/analyze
                            │ { jd_text: "..." }
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               Cloudflare Worker (TypeScript)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  index.ts (Entry Point)                               │  │
│  │  - CORS handling                                      │  │
│  │  - Rate limiting (DO-based)                           │  │
│  │  - Request routing                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  analysis.ts (Core Logic)                             │  │
│  │  - Section parsing (responsibilities/requirements)   │  │
│  │  - Evidence matching against profile.json            │  │
│  │  - Rubric scoring (6 categories)                      │  │
│  │  - Hard gates (Japanese fluency, onsite)              │  │
│  │  - Risk flag detection                                │  │
│  │  - Confidence calculation                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ loads
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              shared/profile.json (Ground Truth)             │
│  - skills[] (19 skills)                                     │
│  - capability_tags[] (8 semantic clusters)                   │
│  - projects[] (7 projects with evidence URLs)               │
│  - constraints (location, languages, availability)           │
└─────────────────────────────────────────────────────────────┘
```

### Scoring Rubric

| Category | Weight | Description |
|----------|--------|-------------|
| Responsibilities | 30% | How many JD responsibilities have evidence in profile |
| Must-haves | 30% | How many required skills/qualifications are matched |
| Nice-to-haves | 10% | Bonus skills (neutral if not found) |
| Domain fit | 10% | Domain-specific alignment (tax, insurance, enterprise, etc.) |
| Delivery credibility | 15% | Number of unique projects providing evidence |
| Risk/constraints | 5% | Alignment with constraints (language, location, availability) |

### Hard Gates

| Gate Condition | Cap Score | Risk Flag Pattern |
|----------------|-----------|-------------------|
| Japanese fluency required (JLPT N1, native, fluent) | 60 | `Hard gate: JD requires Japanese fluency...` |
| Profile requires Japanese but JD doesn't mention it | 60 | `Hard gate: Profile indicates Japanese-fluent requirement...` |
| Onsite required (5 days, fully onsite) | 70 | `Hard gate: JD appears onsite-required...` |

---

## Testing Scope

### 1. Unit Tests (Already Exists)
**Location:** `worker/src/analysis.test.ts`
**Framework:** Vitest
**Coverage:**
- Hard gate logic (Japanese, onsite)
- Confidence calculation
- Domain mismatch detection (TC002)
- Input validation
- Rate limit payload shape

**Status:** ✅ Passing

### 2. E2E Integration Tests (This Cycle)
**Goal:** Validate the complete flow from frontend widget to live API
**Methodology:**
- Mock JDs from real-world recruiters/LinkedIn
- Expected results defined by human analysis
- Test against production API: `https://kinokoholic.com/api/analyze`
- Compare actual vs expected scores, risk flags, confidence

### 3. Regression Tests
**Goal:** Verify fixes for known issues don't break existing functionality
**Methodology:**
- Re-run previous test cases that exposed bugs
- Confirm scores are now within expected ranges
- Validate risk flags are properly detected

---

## Known Issues to Validate

### Critical Issues

#### Issue 1: Japanese Fluency Hard Cap Not Working
**Symptom:** JD requiring fluent Japanese scored 100 instead of being capped at 60
**Root Cause:** Pattern matching in `evaluateRiskAndConstraints()` may be too narrow
**Test Cases:**
- TC001: JD with "Japanese fluency required (JLPT N1)"
- TC003: JD with "Native or fluent Japanese language skills required"
- TC005: JD with "Professional Japanese required"

**Expected Behavior:**
- Score ≤ 60 for all variants
- Risk flag contains "Hard gate" and "Japanese fluency"
- Confidence = Low (due to hard gate failure)

**Success Criteria:**
- [ ] All Japanese fluency patterns trigger hard cap
- [ ] Risk flag messages are consistent
- [ ] Confidence correctly downgraded to Low

---

#### Issue 2: Domain Mismatch Overscoring
**Symptom:** Cosmetics/retail JD vs tech-only profile scored 73 (should be < 30)
**Root Cause:** Generic skills ("change management", "communication") matching across domains without domain validation
**Test Cases:**
- TC002: Cosmetics sales JD vs tech profile
- TC006: Fashion retail JD vs tech profile
- TC007: Beauty consulting JD vs tech profile

**Expected Behavior:**
- Score ≤ 30 for domain-mismatched roles
- Gaps mention domain-specific terms (cosmetics, beauty, fashion)
- No strengths for generic skills when domains don't align

**Success Criteria:**
- [ ] Domain-specific terms detected correctly
- [ ] Generic skills don't overscore mismatched domains
- [ ] Project domain validation prevents false positives

---

### Moderate Issues

#### Issue 3: Risk Flag Detection Incomplete
**Symptom:** Missing `ONSITE_REQUIRED` and `JAPANESE_FLUENCY` risk flags
**Root Cause:** Risk flag generation may not include standardized flag names
**Test Cases:**
- TC004: "Fully onsite - no remote work" → Should have ONSITE_REQUIRED flag
- TC001: Japanese fluency → Should have JAPANESE_FLUENCY flag
- TC008: "5 days onsite" → Should have ONSITE_REQUIRED flag

**Expected Behavior:**
- Risk flags include standardized names for easy filtering
- Standard flag names: `JAPANESE_FLUENCY`, `ONSITE_REQUIRED`, `LANGUAGE_MISMATCH`, `CONTRACT_ONLY`

**Success Criteria:**
- [ ] Standard flag names appear in risk_flags array
- [ ] All risk flags are descriptive and actionable
- [ ] Risk flag count matches number of constraint conflicts

---

### Minor Issues

#### Issue 4: Confidence Scoring Systematically Low
**Symptom:** Confidence is 1 level lower than expected (High → Medium, Medium → Low)
**Root Cause:** Thresholds in `calculateConfidence()` may be too strict
**Test Cases:**
- Multiple test cases across all scenarios
- Compare manual confidence assessment vs algorithm output

**Expected Behavior:**
- Confidence aligns with human judgment
- High confidence: 70%+ must-have coverage, 3+ unique evidence URLs, domain aligned
- Medium confidence: 1+ evidence URL, parser succeeded
- Low confidence: No evidence, parser failed, or hard gate triggered

**Success Criteria:**
- [ ] Confidence scores match expected values in 80%+ of cases
- [ ] Confidence calculation is deterministic and explainable
- [ ] Parser failures and hard gates correctly downgrade confidence

---

## Test Data Strategy

### Mock JD Sources

1. **Real Recruiters/LinkedIn**
   - Standard boilerplate JD formats
   - Variety of industries and seniority levels
   - Authentic language patterns

2. **Edge Cases**
   - Minimal JDs (50 chars)
   - Maximum JDs (15,000 chars)
   - Malformed JDs (no sections, all one paragraph)
   - International characters and formatting

3. **Domain Coverage**
   - AI/LLM/ML (high fit)
   - Enterprise IT/Tech (medium fit)
   - Finance/Insurance (medium fit)
   - Non-tech domains (low fit - cosmetics, retail, fashion)

4. **Constraint Scenarios**
   - Japanese fluency required
   - Onsite requirements
   - Contract-only roles
   - Remote-first roles
   - Multi-language requirements

### Expected Results Definition

For each test case, define:

```typescript
interface ExpectedResult {
  test_id: string;
  name: string;
  description: string;

  // Expected score range (inclusive)
  min_score: number;
  max_score: number;

  // Expected confidence
  confidence: "Low" | "Medium" | "High";

  // Risk flags that MUST be present
  required_risk_flags: string[];

  // Risk flags that MUST NOT be present
  forbidden_risk_flags: string[];

  // Strengths that MUST be present (partial match allowed)
  required_strength_areas: string[];

  // Gaps that MUST be present (partial match allowed)
  required_gap_areas: string[];

  // Specific rubric category expectations
  rubric_expectations: {
    responsibilities?: { min_score: number; max_score: number };
    mustHaves?: { min_score: number; max_score: number };
    niceToHaves?: { min_score: number; max_score: number };
    domainFit?: { min_score: number; max_score: number };
    deliveryCredibility?: { min_score: number; max_score: number };
    riskConstraints?: { min_score: number; max_score: number };
  };

  // Human rationale for expected results
  rationale: string;
}
```

---

## Test Execution Methodology

### Phase 1: Baseline Testing (Before Fixes)

1. **Run all test cases against current production**
   ```bash
   # Execute test runner (to be implemented)
   npm run test:e2e
   ```

2. **Document current behavior**
   - Record actual scores for each test case
   - Identify which cases expose the known issues
   - Save baseline results for comparison

3. **Create issue tracking**
   - For each failed assertion, create GitHub issue
   - Tag with `e2e-test-failure` and relevant component tags

---

### Phase 2: Code Fixes (By GLM Dev Agent)

The GLM dev agent will:
1. Review failed test cases
2. Identify root causes in `worker/src/analysis.ts`
3. Write unit tests to reproduce the issue
4. Implement fixes following TDD workflow
5. Verify all unit tests pass
6. Deploy to production via CI/CD

---

### Phase 3: Regression Testing (After Fixes)

1. **Re-run all test cases**
   - Compare results with baseline
   - Verify all expected results now pass
   - Check no regressions introduced

2. **Validate hard gates**
   - Confirm Japanese fluency cap at 60
   - Confirm onsite cap at 70
   - Confirm confidence downgrade on hard gates

3. **Validate domain mismatch detection**
   - Confirm mismatched roles score ≤ 30
   - Confirm domain-specific gaps are present
   - Confirm generic skills don't overscore

4. **Validate risk flag detection**
   - Confirm standard flag names are used
   - Confirm all constraint conflicts generate flags
   - Confirm flag count matches conflicts

---

## Test Reporting

### Test Results Format

```json
{
  "test_run_id": "2026-02-16-e2e-cycle-001",
  "timestamp": "2026-02-16T17:00:00Z",
  "environment": {
    "api_url": "https://kinokoholic.com/api/analyze",
    "profile_version": "2026-02-15",
    "worker_version": "main-abc123"
  },
  "summary": {
    "total_tests": 15,
    "passed": 0,
    "failed": 15,
    "skipped": 0
  },
  "results": [
    {
      "test_id": "TC001",
      "name": "Japanese Fluency Hard Cap (JLPT N1)",
      "status": "FAILED",
      "expected": {
        "min_score": 0,
        "max_score": 60,
        "confidence": "Low",
        "required_risk_flags": ["JAPANESE_FLUENCY"]
      },
      "actual": {
        "score": 100,
        "confidence": "Medium",
        "risk_flags": []
      },
      "assertions": [
        {
          "field": "score",
          "expected": "<= 60",
          "actual": "100",
          "status": "FAILED"
        },
        {
          "field": "confidence",
          "expected": "Low",
          "actual": "Medium",
          "status": "FAILED"
        },
        {
          "field": "risk_flags",
          "expected": "contains 'JAPANESE_FLUENCY'",
          "actual": "[]",
          "status": "FAILED"
        }
      ]
    }
  ]
}
```

### Success Metrics

| Metric | Target | Current (Baseline) |
|--------|--------|-------------------|
| Test pass rate | 100% | 0% (expected) |
| Critical bugs fixed | 3/3 | 0/3 |
| Moderate bugs fixed | 1/1 | 0/1 |
| Minor bugs fixed | 1/1 | 0/1 |
| Confidence accuracy | ≥ 80% | Unknown |

---

## Risk Mitigation

### Potential Risks

1. **Profile Data Changes**
   - **Risk:** Profile updates may invalidate test expectations
   - **Mitigation:** Pin profile version in test metadata, re-evaluate expectations on updates

2. **API Instability**
   - **Risk:** Production API downtime or rate limiting during testing
   - **Mitigation:** Implement retry logic, use test API endpoint if available

3. **False Negatives**
   - **Risk:** Test expectations may be too strict
   - **Mitigation:** Manual review of failed tests, adjust expectations if justified

4. **Performance Impact**
   - **Risk:** Large JDs may cause timeouts
   - **Mitigation:** Set appropriate timeout thresholds, monitor API response times

---

## Handoff to GLM Dev Agent

The GLM dev agent will receive:
1. This test strategy document
2. `mock-jd-test-cases.json` with all test cases and expected results
3. `handoff-contract.md` with detailed execution instructions
4. Baseline test results showing current failures

The GLM agent is responsible for:
1. Writing unit tests to reproduce issues
2. Implementing fixes in `worker/src/analysis.ts`
3. Following TDD workflow (Red → Green → Refactor)
4. Deploying fixes via CI/CD
5. Providing summary of changes made

---

## Appendix: Terminology

| Term | Definition |
|------|------------|
| **Hard Gate** | A rule that caps the maximum score regardless of other factors |
| **Domain Fit** | Alignment between JD industry domain and candidate's experience |
| **Evidence Grounding** | Requirement that all claims have portfolio evidence URLs |
| **Confidence** | Measure of how well the analysis is supported by evidence |
| **Risk Flag** | Warnings about constraint conflicts or missing requirements |
| **Rubric** | Scoring framework with weighted categories |
| **JD** | Job Description |
| **LLM** | Large Language Model |
| **RAG** | Retrieval-Augmented Generation |

---

## Change History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-16 | Initial E2E test strategy | Planning Orchestrator |
