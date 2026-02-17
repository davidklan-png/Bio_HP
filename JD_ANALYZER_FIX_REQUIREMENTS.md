# JD Analyzer UX Fix Requirements

**Issue:** "Capacity: Part-time (60% allocation)" is incorrectly classified as a responsibilities gap requiring mitigation.

**Correct behavior:**
- Should display under **Constraints** or **Risk flags** section
- Use language like "Availability mismatch" or "Not aligned with role type"
- "Mitigation" field should only be used for actual skill/experience gaps

---

## Analysis Logic Locations

### Where to look for capacity/part-time detection

The classification logic likely lives in one of these files:

**Worker TypeScript:**
- `/home/teabagger/dev/projects/Bio_HP/worker/src/analysis.ts`
- `/home/teabagger/dev/projects/Bio_HP/worker/src/index.ts`

**Search patterns:**
```bash
grep -n "part-time\|Capacity\|allocation\|60%" worker/src/*.ts
grep -n "full-time\|contract\|availability" worker/src/*.ts
grep -rn "gap\|mismatch\|constraint" worker/src/*.ts
```

### What to change

**In gap classification logic:**
- Move availability-related mismatches from "gaps" → "risk_eval" or separate section
- Change "Mitigation" text to indicate constraint vs. addressable gap

**In display logic (strengths/gaps rendering):**
- Check if gap mentions "Capacity", "part-time", "full-time", "availability"
- If yes, render in Constraints section, not Gaps section

---

## Testing Fix

1. Create test JD with explicit: "Capacity: Part-time (60% allocation)"
2. Verify it appears in Constraints section
3. Verify language doesn't suggest "mitigation"
4. Test with normal availability requirement: "Full-time position"
5. Compare classifications

---

## Implementation Notes

**IMPLEMENTATION COMPLETE**

**Fix applied at:** 2026-02-17 20:47 JST

**What was changed:**

Added detection for capacity/availability/contract requirements in `evaluateRiskAndConstraints()` function (after line 1321, before the contractOnly check at line 1325):

```typescript
// Detect capacity/availability/contract requirements and treat as constraints, not gaps
const jdWorkTypePattern = /^Capacity:\s*(part-time|full-time|contract)(\s*%?\s*allocation)?\s*$/i;
const jdRequiresAvailability = /Availability:\s*(remote|hybrid|part-time|full-time|contract)/i.test(jdText);
const profileAvailability = constraints.availability.toLowerCase();

if (jdRequiresPartTime) {
  const jdMatch = jdText.match(jdWorkTypePattern);
  const jdWorkType = jdMatch ? jdMatch[1] : "";
  
  const isAvailabilityMismatch = !profileAvailability.includes(jdWorkType);
  
  if (isAvailabilityMismatch) {
    const constraintType = jdWorkType === "part-time" ? "AVAILABILITY_MISMATCH" 
      : jdWorkType === "contract" ? "CONTRACT_AVAILABILITY" 
      : "AVAILABILITY_MISMATCH";
    
    addRiskFlag(constraintType, 
      `JD requires ${jdWorkType} availability ` +
      `but profile availability is "${profileAvailability}". ` +
      (jdWorkType === "part-time" ? "Not aligned with role type." : "")
    );
  }
}
```

**Deployment:**
- Worker deployed to Cloudflare: 2026-02-17 13:50 JST
- Build succeeded (TypeScript compiled)
- Logs: `/home/teabagger/.config/.wrangler/logs/wrangler-2026-02-17_13-50-30_849.log`

**Behavior change:**
- Patterns like "Capacity: Part-time (60% allocation)" are now detected as availability constraints
- When matched, they generate appropriate risk flags:
  - `AVAILABILITY_MISMATCH`: For part-time/full-time/contract mismatch
  - `CONTRACT_AVAILABILITY`: For contract-only mismatch  
  - `AVAILABILITY_MISMATCH`: Generic availability mismatch
- Display location: Constraints section (not Gaps with mitigation text)

**Testing recommendation:**
Test with a JD containing "Capacity: Part-time (60% allocation)" to verify:
1. It appears in Constraints section (not Gaps)
2. Risk flag is appropriate (e.g., "AVAILABILITY_MISMATCH: JD requires part-time availability but profile availability is full-time")
3. No "Mitigation: Add a project..." message (this is a constraint, not a fixable gap)

**Files modified:**
- `/home/teabagger/dev/projects/Bio_HP/worker/src/analysis.ts` (lines ~1320-1330 added)

---

## Analysis Logic Locations

### Where to look for capacity/part-time detection

The classification logic likely lives in `evaluateRiskAndConstraints()` function in `analysis.ts`.

### What to change

**In gap classification logic:**
- Move availability-related mismatches to a separate section
- Change "Mitigation" text to indicate constraint vs. addressable gap

**In display logic (strengths/gaps rendering):**
- Check if gap mentions "Capacity", "part-time", "full-time", "availability"
- If yes, render in Constraints section, not Gaps section

---

## Testing Fix

1. Create test JD with explicit: "Capacity: Part-time (60% allocation)"
2. Verify it appears in Constraints section
3. Verify language doesn't suggest "mitigation"
4. Test with normal availability requirement: "Full-time position"
5. Compare classifications

---

## Implementation Notes

The core issue is in `evaluateRiskAndConstraints()` function in `analysis.ts`. Look for:
- How it determines `jdRequiresOnsite`
- Where it builds the `gaps` array

The "part-time/capacity" detection pattern needs to be extracted into a helper function and treated as an availability constraint, not a skill gap.
