# Handoff Contract: GLM Dev Agent Execution

**Version:** 1.0
**Date:** 2026-02-16
**Planning Orchestrator:** jd-test-planning
**Target Agent:** GLM Dev Agent

---

## Purpose

This document serves as the contract between the **Planning Orchestrator** (planning phase) and the **GLM Dev Agent** (execution phase). It provides detailed instructions for executing the JD Concierge E2E test cycle, implementing fixes for known issues, and validating results.

---

## Summary of Deliverables

**Planning Phase (Completed by Planning Orchestrator):**
- ✅ `test-strategy.md` - Overall test strategy and architecture overview
- ✅ `mock-jd-test-cases.json` - 15 test cases with JD text and expected results
- ✅ `handoff-contract.md` - This document (execution instructions)
- ✅ `codex-review-checklist.md` - CODEX issue checklist

**Execution Phase (To be completed by GLM Dev Agent):**
- [ ] Implement E2E test runner
- [ ] Run baseline tests and document failures
- [ ] Write unit tests to reproduce issues
- [ ] Implement fixes following TDD workflow
- [ ] Deploy fixes via CI/CD
- [ ] Run regression tests
- [ ] Document results and recommendations

---

## Prerequisites

### 1. Repository Access

**Repository:** https://github.com/davidklan-png/Bio_HP
**Live Site:** https://kinokoholic.com
**API Endpoint:** https://kinokoholic.com/api/analyze

Ensure you have:
- Git access to the repository
- Cloudflare Worker deployment permissions (via API token or OAuth)
- Node.js v22+ installed
- Python 3.8+ installed (for TDD guard script)

### 2. Environment Setup

```bash
# Clone repository
cd /home/teabagger/dev/projects/Bio_HP
git pull origin main

# Setup worker
cd worker
npm install

# Setup git hooks (if not already done)
cd ..
./scripts/setup-git-hooks.sh
```

### 3. Profile Data

The candidate profile is in `shared/profile.json`. **Do not modify this file** unless instructed. All test expectations are based on this version:
- **Profile Version:** 2026-02-15
- **Skills:** 19 technical/soft skills
- **Projects:** 7 projects with evidence URLs
- **Languages:** English (Native), Japanese (Business)
- **Location:** US/Japan (open to remote/hybrid)

---

## Known Issues to Fix

### Issue 1: Japanese Fluency Hard Cap Not Working (Critical)

**Test Cases:** TC001, TC003, TC005, TC013

**Symptom:**
- JD requiring fluent/native Japanese scores 100 instead of being capped at 60
- Multiple pattern variants are not triggering the hard gate

**Expected Behavior:**
```typescript
// In analysis.ts, evaluateRiskAndConstraints():
const jdRequiresJapaneseFluent =
  /((native or fluent|fluent or native|fluent|fluency|native|professional|advanced).{0,24}japanese|japanese.{0,24}(native or fluent|fluent or native|fluent|fluency|native|professional|advanced)|jlpt\s*n1|japanese\s*n1)/i.test(jdText);
```

**Investigation Steps:**
1. Review the regex pattern in `evaluateRiskAndConstraints()` (around line 690-700)
2. Check if profile Japanese level check is working correctly
3. Verify the hard cap is being applied to `rawScore`

**Expected Code Flow:**
```typescript
// Should trigger hard gate
if (jdRequiresJapaneseFluent && !profileHasJapaneseFluent) {
  triggerHardGate(
    `Hard gate: JD requires Japanese fluency, but profile does not explicitly show fluent Japanese evidence. Score capped at ${config.japaneseHardCap}.`,
    config.japaneseHardCap
  );
}

// Should apply cap to score
const score =
  typeof riskEval.hardScoreCap === "number"
    ? Math.min(rawScore, riskEval.hardScoreCap)
    : rawScore;
```

**Fix Requirements:**
- [ ] Regex pattern must match all fluency variants
- [ ] Profile check must correctly identify Japanese (Business) != fluent
- [ ] Hard cap (60) must be applied to final score
- [ ] Risk flag must include "Hard gate" text
- [ ] Confidence must be downgraded to Low

**Unit Tests to Add:**
```typescript
describe("Japanese fluency hard gate patterns", () => {
  const patterns = [
    "Japanese fluency required (JLPT N1)",
    "Native or fluent Japanese language skills required",
    "Professional Japanese required (JLPT N1-N2 equivalent)",
    "Advanced Japanese required for this role",
    "JLPT N1 or N2 certification required"
  ];

  patterns.forEach((pattern, i) => {
    it(`triggers hard cap for pattern: ${pattern.substring(0, 30)}...`, () => {
      const jd = `Requirements:\n- Python\n- ${pattern}`;
      const result = analyzeJobDescription(jd, baseProfile, `jp-pattern-${i}`);

      expect(result.score).toBeLessThanOrEqual(60);
      expect(result.confidence).toBe("Low");
      expect(result.risk_flags.some(f =>
        f.toLowerCase().includes("japanese") &&
        f.toLowerCase().includes("hard gate")
      )).toBe(true);
    });
  });
});
```

---

### Issue 2: Domain Mismatch Overscoring (Critical)

**Test Cases:** TC002, TC006, TC007

**Symptom:**
- Cosmetics/retail JD vs tech-only profile scores 73 (should be < 30)
- Generic skills ("change management", "communication") match across domains
- Domain validation is not preventing false positives

**Expected Behavior:**
- Domain-specific terms (cosmetics, beauty, fashion, retail) should be detected
- Projects without matching domain terms should not provide evidence
- Score should be capped at 30 for domain-mismatched roles

**Investigation Steps:**
1. Review `evaluateSection()` and `evaluateDomainFit()` functions
2. Check `detectDomainMismatch()` and `projectMatchesDomain()` logic
3. Verify domain term extraction from JD and profile

**Key Functions:**
```typescript
// In analysis.ts, evaluateSection():
// Check if matched term is domain-specific
const isDomainSpecificMatch = jdDomainTerms.some(domainTerm =>
  containsTerm(normalizedLine, domainTerm)
);

// Only apply domain mismatch validation for domain-specific matches
if (isDomainSpecificMatch && jdDomainTerms.length > 0) {
  const domainMatch = projectMatchesDomain(evidenceProject, jdDomainTerms);
  if (!domainMatch) {
    // Project doesn't match JD's domain - don't count as evidence
    matches.push({ line });
    misses.push(line);
    continue;
  }
}
```

**Fix Requirements:**
- [ ] Detect domain-specific terms in JD (cosmetics, beauty, fashion, retail, etc.)
- [ ] Extract domain terms from profile projects
- [ ] Validate project domain against JD domain before counting evidence
- [ ] Ensure generic skills don't create false matches when domains differ
- [ ] Score must be ≤ 30 for domain-mismatched roles

**Unit Tests to Add:**
```typescript
describe("domain mismatch detection", () => {
  it("prevents tech skills from matching cosmetics JD", () => {
    const jd = [
      "Position: Cosmetics Sales Associate",
      "Responsibilities:",
      "- Build relationships with beauty customers",
      "- Provide beauty consultations",
      "- Change management for store promotions"
    ].join("\n");

    const result = analyzeJobDescription(jd, techOnlyProfile, "dm-001");

    expect(result.score).toBeLessThanOrEqual(30);
    // Should NOT have strength for "change management"
    expect(result.strengths.some(s =>
      s.rationale.toLowerCase().includes("change management")
    )).toBe(false);
    // Should have gap for beauty/cosmetics
    expect(result.gaps.some(g =>
      g.why_it_matters.toLowerCase().includes("beauty") ||
      g.why_it_matters.toLowerCase().includes("cosmetics")
    )).toBe(true);
  });
});
```

---

### Issue 3: Risk Flag Detection Incomplete (Moderate)

**Test Cases:** TC004, TC008

**Symptom:**
- Risk flags don't include standardized names (e.g., `ONSITE_REQUIRED`, `JAPANESE_FLUENCY`)
- Current risk flags are descriptive but not machine-readable
- Difficult to filter or categorize risk flags programmatically

**Expected Behavior:**
- Risk flags should include standardized machine-readable names
- Format: `[STANDARD_NAME] Description text`
- Standard names: `JAPANESE_FLUENCY`, `ONSITE_REQUIRED`, `LANGUAGE_MISMATCH`, `CONTRACT_ONLY`

**Investigation Steps:**
1. Review `evaluateRiskAndConstraints()` function
2. Check `addRiskFlag()` and `triggerHardGate()` implementations
3. Verify risk flag generation for all constraint conflicts

**Current Code:**
```typescript
const addRiskFlag = (message: string): void => {
  if (!riskFlags.includes(message)) {
    riskFlags.push(message);
  }
};
```

**Expected Code:**
```typescript
const STANDARD_RISK_FLAGS = {
  JAPANESE_FLUENCY: "JAPANESE_FLUENCY: Japanese fluency required but not in profile",
  ONSITE_REQUIRED: "ONSITE_REQUIRED: JD requires onsite but profile prefers remote/hybrid",
  LANGUAGE_MISMATCH: "LANGUAGE_MISMATCH: Required language not found in profile",
  CONTRACT_ONLY: "CONTRACT_ONLY: Availability may not align (JD appears contract-only)"
};

const addRiskFlag = (standardName: string, message: string): void => {
  const fullFlag = `${standardName}: ${message}`;
  if (!riskFlags.includes(fullFlag)) {
    riskFlags.push(fullFlag);
  }
};
```

**Fix Requirements:**
- [ ] Standardize risk flag names with machine-readable prefixes
- [ ] Update `addRiskFlag()` to accept standard name and message
- [ ] Update all `addRiskFlag()` calls to use standard names
- [ ] Ensure risk flags are deduplicated correctly
- [ ] Maintain backward compatibility (risk flags still human-readable)

**Unit Tests to Add:**
```typescript
describe("risk flag standardization", () => {
  it("includes standard flag name for Japanese fluency", () => {
    const jd = "Requirements:\n- Japanese fluency required (JLPT N1)\n- Python";
    const result = analyzeJobDescription(jd, baseProfile, "rf-001");

    expect(result.risk_flags.some(f =>
      f.includes("JAPANESE_FLUENCY:")
    )).toBe(true);
  });

  it("includes standard flag name for onsite requirement", () => {
    const jd = "Requirements:\n- Python\n\nWork: Fully onsite - no remote work";
    const result = analyzeJobDescription(jd, baseProfile, "rf-002");

    expect(result.risk_flags.some(f =>
      f.includes("ONSITE_REQUIRED:")
    )).toBe(true);
  });
});
```

---

### Issue 4: Confidence Scoring Systematically Low (Minor)

**Test Cases:** TC009, TC015

**Symptom:**
- Confidence is 1 level lower than expected
- High confidence cases (70%+ must-have coverage, 3+ URLs, domain aligned) score as Medium
- Medium confidence cases (1+ URL) score as Low

**Expected Behavior:**
```typescript
export function calculateConfidence(input: ConfidenceInput): Confidence {
  const { strengths, mustHavesEval, domainEval, hasHardGateFailure, parserSuccess } = input;

  // If parser failed or hard gate failed, confidence is Low
  if (!parserSuccess || hasHardGateFailure) {
    return "Low";
  }

  // Count unique evidence URLs (grounded evidence)
  const uniqueEvidenceUrls = new Set(strengths.map((s) => s.evidence_url)).size;

  // Count must-have coverage (how many must-haves have evidence)
  const mustHaveCoverage = mustHavesEval.matches.length > 0
    ? mustHavesEval.matches.filter((m) => m.evidenceProject).length / mustHavesEval.matches.length
    : 0;

  // Domain certainty: domain fit score indicates alignment
  const domainCertainty = domainEval.score >= 5; // At least 50% of domain fit weight

  // High confidence: good must-have coverage (70%+), multiple evidence URLs, domain aligned
  if (mustHaveCoverage >= 0.7 && uniqueEvidenceUrls >= 3 && domainCertainty) {
    return "High";
  }

  // Medium confidence: at least one evidence URL, parser succeeded
  if (uniqueEvidenceUrls >= 1) {
    return "Medium";
  }

  return "Low";
}
```

**Investigation Steps:**
1. Review `calculateConfidence()` function
2. Check thresholds (0.7 for must-have coverage, 3 for unique URLs, 5 for domain score)
3. Verify input values (strengths, mustHavesEval, domainEval) are correct

**Fix Requirements:**
- [ ] Verify thresholds are appropriate
- [ ] Ensure must-have coverage calculation is correct
- [ ] Ensure unique evidence URL count is correct
- [ ] Ensure domain certainty check is working
- [ ] Adjust thresholds if necessary (based on test results)

**Unit Tests to Add:**
```typescript
describe("confidence calculation with full context", () => {
  it("returns High when must-have coverage >= 70%, 3+ URLs, domain aligned", () => {
    const input: ConfidenceInput = {
      strengths: [
        { area: "A", evidence_title: "P1", evidence_url: "u1", rationale: "r1" },
        { area: "B", evidence_title: "P2", evidence_url: "u2", rationale: "r2" },
        { area: "C", evidence_title: "P3", evidence_url: "u3", rationale: "r3" }
      ],
      mustHavesEval: {
        score: 25,
        notes: "",
        matches: [
          { line: "req1", evidenceProject: { name: "P1", tags: [], summary: "", outcomes: [], stack: [], evidence_urls: ["u1"] } },
          { line: "req2", evidenceProject: { name: "P2", tags: [], summary: "", outcomes: [], stack: [], evidence_urls: ["u2"] } },
          { line: "req3", evidenceProject: { name: "P3", tags: [], summary: "", outcomes: [], stack: [], evidence_urls: ["u3"] } }
        ],
        misses: []
      },
      domainEval: { score: 8, notes: "", matches: [], misses: [] },
      hasHardGateFailure: false,
      parserSuccess: true
    };

    expect(calculateConfidence(input)).toBe("High");
  });
});
```

---

## Implementation Workflow

### Phase 1: Implement E2E Test Runner

**Objective:** Create a test runner that executes all test cases against the live API and compares results with expectations.

**Deliverable:** `worker/src/e2e-test-runner.ts` or `scripts/e2e-test-runner.js`

**Requirements:**
```typescript
interface TestResult {
  test_id: string;
  status: "PASSED" | "FAILED";
  expected: ExpectedResult;
  actual: {
    score: number;
    confidence: string;
    risk_flags: string[];
    strengths: Strength[];
    gaps: Gap[];
    rubric_breakdown: RubricItem[];
  };
  assertions: AssertionResult[];
}

interface AssertionResult {
  field: string;
  expected: string;
  actual: string;
  status: "PASSED" | "FAILED";
}

interface TestRunSummary {
  test_run_id: string;
  timestamp: string;
  environment: {
    api_url: string;
    profile_version: string;
    worker_version: string;
  };
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  results: TestResult[];
}
```

**Implementation Steps:**
1. Load test cases from `mock-jd-test-cases.json`
2. For each test case:
   - Send POST request to `https://kinokoholic.com/api/analyze`
   - Parse response
   - Compare against expected results
   - Record assertions (score range, confidence, risk flags, etc.)
3. Generate summary JSON report
4. Save results to `test-planning/baseline-results.json`

**Example Implementation:**
```typescript
// worker/src/e2e-test-runner.ts
import { analyzeJobDescription } from './analysis';
import { parseAndValidateProfile } from './analysis';
import fs from 'fs';

const testCases = JSON.parse(
  fs.readFileSync('/home/teabagger/dev/projects/Bio_HP/test-planning/mock-jd-test-cases.json', 'utf-8')
);

const profile = parseAndValidateProfile(
  JSON.parse(
    fs.readFileSync('/home/teabagger/dev/projects/Bio_HP/shared/profile.json', 'utf-8')
  )
);

const results: TestResult[] = [];

for (const testCase of testCases.test_cases) {
  const actual = analyzeJobDescription(testCase.jd_text, profile, testCase.test_id);
  const expected = testCase.expected;
  const assertions: AssertionResult[] = [];

  // Score range assertion
  const scoreInBounds = actual.score >= expected.min_score && actual.score <= expected.max_score;
  assertions.push({
    field: "score",
    expected: `${expected.min_score}-${expected.max_score}`,
    actual: String(actual.score),
    status: scoreInBounds ? "PASSED" : "FAILED"
  });

  // Confidence assertion
  const confidenceMatches = actual.confidence === expected.confidence;
  assertions.push({
    field: "confidence",
    expected: expected.confidence,
    actual: actual.confidence,
    status: confidenceMatches ? "PASSED" : "FAILED"
  });

  // Required risk flags assertion
  const hasRequiredRiskFlags = expected.required_risk_flags.every(flag =>
    actual.risk_flags.some(rf => rf.includes(flag))
  );
  assertions.push({
    field: "required_risk_flags",
    expected: expected.required_risk_flags.join(", "),
    actual: actual.risk_flags.join(", "),
    status: hasRequiredRiskFlags ? "PASSED" : "FAILED"
  });

  // (Add more assertions as needed...)

  const allPassed = assertions.every(a => a.status === "PASSED");

  results.push({
    test_id: testCase.test_id,
    status: allPassed ? "PASSED" : "FAILED",
    expected,
    actual,
    assertions
  });
}

// Save results
const summary: TestRunSummary = {
  test_run_id: `2026-02-16-e2e-cycle-${Date.now()}`,
  timestamp: new Date().toISOString(),
  environment: {
    api_url: "https://kinokoholic.com/api/analyze",
    profile_version: "2026-02-15",
    worker_version: "main" // Get from git
  },
  summary: {
    total_tests: results.length,
    passed: results.filter(r => r.status === "PASSED").length,
    failed: results.filter(r => r.status === "FAILED").length,
    skipped: 0
  },
  results
};

fs.writeFileSync(
  '/home/teabagger/dev/projects/Bio_HP/test-planning/baseline-results.json',
  JSON.stringify(summary, null, 2)
);

console.log(`Test run complete: ${summary.summary.passed}/${summary.summary.total_tests} passed`);
```

**Execution:**
```bash
cd worker
npm run test:e2e
```

---

### Phase 2: Run Baseline Tests

**Objective:** Capture current behavior before fixes.

**Steps:**
1. Run E2E test runner
2. Document all failures
3. Categorize failures by issue (Issue 1, Issue 2, Issue 3, Issue 4)
4. Save baseline results to `test-planning/baseline-results.json`

**Expected Baseline:**
- All 15 test cases will fail
- Issue 1 failures: TC001, TC003, TC005, TC013 (Japanese hard cap not working)
- Issue 2 failures: TC002, TC006, TC007 (Domain mismatch overscoring)
- Issue 3 failures: TC004, TC008 (Risk flag names not standardized)
- Issue 4 failures: TC009, TC015 (Confidence scoring too low)

---

### Phase 3: Implement Fixes (TDD Workflow)

For each issue, follow **Red → Green → Refactor**:

#### Issue 1: Japanese Fluency Hard Cap

1. **Red (Write failing test):**
   - Add unit test in `worker/src/analysis.test.ts`
   - Run `npm test` → Should fail

2. **Green (Implement fix):**
   - Update regex pattern in `evaluateRiskAndConstraints()`
   - Verify hard cap is applied to `rawScore`
   - Run `npm test` → Should pass

3. **Refactor (Clean up):**
   - Extract regex to constant
   - Add comments explaining pattern
   - Run `npm test` → Still passing

4. **Commit:**
   ```bash
   cd /home/teabagger/dev/projects/Bio_HP
   git add worker/src/analysis.ts worker/src/analysis.test.ts
   git commit -m "Fix: Japanese fluency hard cap (Issue 1)

   - Updated regex pattern to match all fluency variants
   - Ensured hard cap (60) is applied to final score
   - Added unit tests for all pattern variants"
   ```

#### Issue 2: Domain Mismatch Detection

1. **Red (Write failing test):**
   - Add unit test in `worker/src/analysis.test.ts`
   - Run `npm test` → Should fail

2. **Green (Implement fix):**
   - Update `evaluateSection()` to check domain specificity
   - Ensure `projectMatchesDomain()` works correctly
   - Run `npm test` → Should pass

3. **Refactor (Clean up):**
   - Extract domain detection to helper functions
   - Add comments explaining logic
   - Run `npm test` → Still passing

4. **Commit:**
   ```bash
   cd /home/teabagger/dev/projects/Bio_HP
   git add worker/src/analysis.ts worker/src/analysis.test.ts
   git commit -m "Fix: Domain mismatch overscoring (Issue 2)

   - Added domain-specific term detection
   - Validate project domain before counting evidence
   - Prevented generic skills from matching mismatched domains"
   ```

#### Issue 3: Risk Flag Standardization

1. **Red (Write failing test):**
   - Add unit test in `worker/src/analysis.test.ts`
   - Run `npm test` → Should fail

2. **Green (Implement fix):**
   - Update `addRiskFlag()` to accept standard name and message
   - Update all `addRiskFlag()` calls
   - Define standard flag name constants
   - Run `npm test` → Should pass

3. **Refactor (Clean up):**
   - Extract standard flag names to constant
   - Add comments explaining standardization
   - Run `npm test` → Still passing

4. **Commit:**
   ```bash
   cd /home/teabagger/dev/projects/Bio_HP
   git add worker/src/analysis.ts worker/src/analysis.test.ts
   git commit -m "Fix: Risk flag standardization (Issue 3)

   - Added standard flag names (JAPANESE_FLUENCY, ONSITE_REQUIRED, etc.)
   - Updated addRiskFlag() to use standard names
   - Maintained human-readable descriptions"
   ```

#### Issue 4: Confidence Scoring

1. **Red (Write failing test):**
   - Add unit test in `worker/src/analysis.test.ts`
   - Run `npm test` → May or may not fail (needs investigation)

2. **Green (Implement fix):**
   - If failing: Update thresholds in `calculateConfidence()`
   - If passing: No changes needed (thresholds may be correct)
   - Run `npm test` → Should pass

3. **Refactor (Clean up):**
   - Extract thresholds to constants
   - Add comments explaining confidence calculation
   - Run `npm test` → Still passing

4. **Commit:**
   ```bash
   cd /home/teabagger/dev/projects/Bio_HP
   git add worker/src/analysis.ts worker/src/analysis.test.ts
   git commit -m "Fix: Confidence scoring thresholds (Issue 4)

   - Adjusted must-have coverage threshold to 0.7
   - Verified unique evidence URL counting
   - Ensured domain certainty check works correctly"
   ```
   ```
   (Or if no changes needed:)
   git commit -m "Verify: Confidence scoring is correct (Issue 4)

   - Verified thresholds are appropriate
   - No changes needed to calculateConfidence()"
   ```

---

### Phase 4: Deploy Fixes

**Objective:** Deploy all fixes to production via CI/CD.

**Steps:**
1. Push commits to feature branch
2. Create PR with detailed description
3. Ensure CI checks pass (TDD Quality Gates)
4. Merge to main
5. Deploy to production

```bash
# Push to feature branch
git checkout -b fix/japanese-fluency-hard-cap
git push -u origin fix/japanese-fluency-hard-cap

# Create PR
gh pr create --base main --head fix/japanese-fluency-hard-cap \
  --title "Fix: Japanese fluency hard cap not working" \
  --body "Fixes Issue 1 from E2E test cycle.

Changes:
- Updated regex pattern in evaluateRiskAndConstraints()
- Ensured hard cap (60) is applied to final score
- Added unit tests for all pattern variants

Test Results:
- Before fix: TC001, TC003, TC005, TC013 FAILED (scored 100 instead of ≤ 60)
- After fix: TC001, TC003, TC005, TC013 PASSED

See test-planning/baseline-results.json and test-planning/regression-results.json"
```

Repeat for each issue, or create a single PR with all fixes:
```bash
git checkout -b fix/e2e-test-cycle-issues
# Commit all fixes
git push -u origin fix/e2e-test-cycle-issues

gh pr create --base main --head fix/e2e-test-cycle-issues \
  --title "Fix: All E2E test cycle issues (Japanese hard cap, domain mismatch, risk flags)" \
  --body "Fixes Issues 1-4 from E2E test cycle.

Changes:
- Issue 1: Japanese fluency hard cap
- Issue 2: Domain mismatch overscoring
- Issue 3: Risk flag standardization
- Issue 4: Confidence scoring verification

All unit tests passing. Ready for regression testing."
```

---

### Phase 5: Run Regression Tests

**Objective:** Verify all fixes work correctly.

**Steps:**
1. Run E2E test runner again
2. Compare with baseline results
3. Document improvements
4. Save regression results to `test-planning/regression-results.json`

**Expected Results:**
- Issue 1: TC001, TC003, TC005, TC013 now PASS (score ≤ 60)
- Issue 2: TC002, TC006, TC007 now PASS (score ≤ 30)
- Issue 3: TC004, TC008 now PASS (risk flags have standard names)
- Issue 4: TC009, TC015 now PASS (confidence is correct)
- Overall pass rate: 100% (15/15 tests passing)

**If any tests still fail:**
- Investigate root cause
- Implement additional fixes
- Repeat Phase 3 (Red → Green → Refactor)

---

## Deliverables

After completing all phases, deliver:

### 1. Code Changes
- Updated `worker/src/analysis.ts`
- Updated `worker/src/analysis.test.ts`
- E2E test runner (`worker/src/e2e-test-runner.ts` or `scripts/e2e-test-runner.js`)

### 2. Test Results
- Baseline results: `test-planning/baseline-results.json`
- Regression results: `test-planning/regression-results.json`
- Comparison summary showing improvements

### 3. Documentation
- Summary of changes made (what was fixed and how)
- Any unexpected findings
- Recommendations for future improvements

### 4. CODEX Issues
- Ensure all issues are created in GitHub
- Link issues to relevant test cases
- Tag issues with `e2e-test-failure` and component tags
- Close issues after fixes are deployed and verified

---

## Quality Gates

Before marking this task complete, ensure:

- [ ] All unit tests pass: `cd worker && npm test`
- [ ] TDD guard passes: `python3 scripts/tdd_guard.py --against origin/main`
- [ ] E2E test runner passes: `npm run test:e2e`
- [ ] All test results documented in `test-planning/`
- [ ] CODEX issues created and linked to test cases
- [ ] Fixes deployed to production
- [ ] Regression tests confirm 100% pass rate

---

## Contact

**Planning Orchestrator:** jd-test-planning
**Planning Documents:** `/home/teabagger/dev/projects/Bio_HP/test-planning/`
**Repository:** https://github.com/davidklan-png/Bio_HP
**Live Site:** https://kinokoholic.com

---

## Appendix: File Reference

### Planning Documents
- `test-planning/test-strategy.md` - Overall test strategy
- `test-planning/mock-jd-test-cases.json` - 15 test cases
- `test-planning/handoff-contract.md` - This document
- `test-planning/codex-review-checklist.md` - CODEX issue checklist

### Source Files
- `worker/src/analysis.ts` - Core analysis logic (fixes go here)
- `worker/src/analysis.test.ts` - Unit tests (add tests here)
- `worker/src/index.ts` - Worker entry point
- `shared/profile.json` - Candidate profile (ground truth)

### Scripts
- `scripts/tdd_guard.py` - TDD enforcement script
- `scripts/setup-git-hooks.sh` - Git hooks setup
- `scripts/run-site-js-tests.sh` - Site JS tests

### CI/CD
- `.github/workflows/tdd-quality-gates.yml` - CI quality gates
- `.githooks/pre-commit` - Pre-commit hook
- `.githooks/pre-push` - Pre-push hook

---

## Change History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-16 | Initial handoff contract | Planning Orchestrator |
