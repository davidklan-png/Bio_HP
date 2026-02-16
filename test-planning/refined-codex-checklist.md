# Refined CODEX Review Checklist

**Version:** 2.0
**Date:** 2026-02-16
**Refined By:** Planning Orchestrator (Claude Opus 4.6)
**Baseline Test Run:** e2e-1771231832878 (15 failures)

---

## Executive Summary

Based on baseline test results, we have 4 distinct issues with clear fixes:

1. **TC013 Edge Case** - Profile Japanese gate bug (Score: 88, should be 75-95)
2. **Domain Mismatch** - Severe overscoring (TC006: 71 instead of <25)  
3. **Risk Flag Format** - Missing standard prefixes (all 15 tests affected)
4. **Confidence Tuning** - Conservative thresholds (2 tests affected)

---

## Issue 1: TC013 Profile Japanese Gate Bug

### CODEX Issue Creation

**Title:** `[E2E] [Critical] TC013: Profile Japanese (Business) incorrectly triggers hard cap when JD doesn't mention Japanese`

**Description:**
```markdown
## Summary
When a profile has "Japanese (Business)" and the JD doesn't mention Japanese at all, the system incorrectly applies a hard cap of 60. This is a false positive.

## Test Case
- Test ID: TC013
- Current Score: 88 (partially capped)
- Expected Score: 75-95 (no cap)
- Profile Languages: ["English (Native)", "Japanese (Business)"]
- JD Languages: None mentioned

## Root Cause
The `profileRequiresJapaneseFluent` check incorrectly treats any Japanese language skill as a "requirement" rather than checking if the profile actually requires fluent Japanese for work.

## Impact
False negatives for candidates with business-level Japanese applying to roles that don't require Japanese.
```

**Labels:** `e2e-test-failure`, `analysis.ts`, `japanese`, `logic-bug`, `priority:critical`

**Acceptance Criteria:**
- [ ] Profile having "Japanese (Business)" does NOT trigger cap when JD omits Japanese
- [ ] Only JD requirements for Japanese fluency trigger the cap
- [ ] TC013 scores between 75-95
- [ ] No regression on TC001, TC003, TC005

---

## Issue 2: Domain Mismatch Overscoring

### CODEX Issue Creation

**Title:** `[E2E] [Critical] Domain mismatch: Fashion retail scores 71 instead of <25 against tech profile`

**Description:**
```markdown
## Summary
Generic skills like "communication" and "stakeholder management" are matching across incompatible domains, causing massive overscoring.

## Test Cases Affected
- TC002 (Cosmetics): Score 40, Expected <25
- TC006 (Fashion): Score 71, Expected <25 ⚠️ SEVERE
- TC007 (Beauty): Score 36, Expected <25

## Root Cause
No domain validation when matching generic skills. "Change management" in cosmetics context matches tech profile's change management experience.

## Required Fix
1. Detect JD domain (cosmetics, fashion, beauty, etc.)
2. Validate project domains before counting generic skill matches
3. Only allow generic skills within compatible domains
```

**Labels:** `e2e-test-failure`, `analysis.ts`, `domain-validation`, `scoring`, `priority:critical`

**Code Change Preview:**
```typescript
// Detect domains and validate compatibility
const jdDomains = extractJDDomains(jdText); // ['fashion', 'retail']
const projectDomains = getProjectDomains(project); // ['tech', 'AI']

if (isGenericSkill && !domainsCompatible(jdDomains, projectDomains)) {
  continue; // Skip this match
}
```

---

## Issue 3: Risk Flag Standardization

### CODEX Issue Creation

**Title:** `[E2E] [High] Risk flags missing machine-readable prefixes (affects all 15 tests)`

**Description:**
```markdown
## Summary
All risk flags use human-readable text without standard prefixes, making automated filtering impossible.

## Current Format
"Hard gate: JD requires Japanese fluency..."

## Required Format
"JAPANESE_FLUENCY: Hard gate: JD requires Japanese fluency..."

## Standard Flags Needed
- JAPANESE_FLUENCY
- ONSITE_REQUIRED
- LANGUAGE_MISMATCH
- CONTRACT_ONLY
- LOCATION_MISMATCH

## Impact
Cannot programmatically filter or categorize risk flags for automation.
```

**Labels:** `e2e-test-failure`, `analysis.ts`, `risk-flags`, `standardization`, `priority:high`

**Implementation:**
```typescript
enum RiskFlag {
  JAPANESE_FLUENCY = 'JAPANESE_FLUENCY',
  ONSITE_REQUIRED = 'ONSITE_REQUIRED'
}

addRiskFlag(RiskFlag.JAPANESE_FLUENCY, 'Hard gate: ...');
```

---

## Issue 4: Confidence Threshold Tuning

### CODEX Issue Creation

**Title:** `[E2E] [Medium] Confidence scoring too conservative - High-fit roles score Medium`

**Description:**
```markdown
## Summary
TC009 and TC015 have excellent matches but score Medium confidence instead of High.

## Affected Tests
- TC009: High-fit AI role (Remote, all skills match)
- TC015: Designed specifically for High confidence

## Investigation Needed
1. Log confidence calculation inputs
2. Verify unique URL counting
3. Check must-have coverage calculation
4. Adjust thresholds if needed
```

**Labels:** `e2e-test-failure`, `analysis.ts`, `confidence`, `tuning`, `priority:medium`

---

## CODEX Automation Checks

### Pre-Commit Checks
```yaml
# .codex.yml
checks:
  - name: "E2E Test Validation"
    run: "npm test -- --grep 'TC001|TC002|TC006|TC013'"
    required: true
    
  - name: "Risk Flag Format"
    pattern: "riskFlags\\.push\\("
    message: "Use addRiskFlag(RiskFlag.TYPE, message) instead"
```

### Post-Deploy Validation
```bash
# Run against production API
curl -X POST https://kinokoholic.com/api/analyze \
  -H "Content-Type: application/json" \
  -d @test-planning/tc013.json \
  | jq '.score' # Should be > 60
```

---

## Quick Reference: Expected Outcomes

| Test ID | Issue | Current | Expected | Priority |
|---------|-------|---------|----------|----------|
| TC013 | Japanese gate | 88 | 75-95 | 🔴 Critical |
| TC002 | Domain mismatch | 40 | <25 | 🔴 Critical |
| TC006 | Domain mismatch | 71 | <25 | 🔴 Critical |
| TC007 | Domain mismatch | 36 | <25 | 🔴 Critical |
| TC001-015 | Risk flags | No prefix | With prefix | 🟡 High |
| TC009,015 | Confidence | Medium | High | 🟢 Medium |

---

## Verification Script

Create `test-planning/verify-fixes.js`:

```javascript
const testCases = require('./mock-jd-test-cases.json');
const { analyzeJobDescription } = require('../worker/lib/analysis');
const profile = require('../shared/profile.json');

const criticalTests = ['TC013', 'TC002', 'TC006'];

criticalTests.forEach(testId => {
  const tc = testCases.test_cases.find(t => t.test_id === testId);
  const result = analyzeJobDescription(tc.jd_text, profile, testId);
  
  console.log(`${testId}: Score=${result.score} (Expected: ${tc.expected.min_score}-${tc.expected.max_score})`);
  
  // Check risk flag format
  const hasStandardFlags = result.risk_flags.every(flag => 
    /^[A-Z_]+:/.test(flag)
  );
  console.log(`  Risk flags standardized: ${hasStandardFlags}`);
});
```

---

## Success Metrics

### Phase 1: Critical Fixes
- [ ] TC013 scores 75-95 (no cap)
- [ ] TC002 scores <25
- [ ] TC006 scores <25
- [ ] TC007 scores <25

### Phase 2: Format & Tuning  
- [ ] All risk flags have standard prefixes
- [ ] TC009 confidence = High
- [ ] TC015 confidence = High

### Phase 3: Full Pass
- [ ] 15/15 tests passing
- [ ] No performance regression
- [ ] CODEX scan clean

---

## Change History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-16 | Initial CODEX checklist | GLM Planning Agent |
| 2.0 | 2026-02-16 | Refined with specific fixes based on baseline results | Planning Orchestrator (Opus) |