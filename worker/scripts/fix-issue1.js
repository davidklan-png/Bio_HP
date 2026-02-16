/**
 * Fix for Issue 1: Japanese Fluency Hard Cap
 *
 * Problem 1: Risk flags use descriptive text instead of standardized names
 * Problem 2: Profile's "Japanese (Business)" incorrectly triggers hard cap when JD doesn't mention Japanese
 */

import { readFileSync, writeFileSync } from 'fs';

const analysisTsPath = '/home/teabagger/dev/projects/Bio_HP/worker/src/analysis.ts';
let content = readFileSync(analysisTsPath, 'utf-8');

// Fix 1: Add standardized risk flag names
content = content.replace(
  /const addRiskFlag = \(message: string\): void => \{[\s\S]{0,300}\}/,
  `const addRiskFlag = (standardName: string, message: string): void => {
    const fullFlag = \`\${standardName}: \${message}\`;
    if (!riskFlags.includes(fullFlag)) {
      riskFlags.push(fullFlag);
    }
  };`
);

// Update triggerHardGate to use standard names
content = content.replace(
  /const triggerHardGate = \(message: string, cap: number\): void => \{[\s\S]{0,300}\}/,
  `const triggerHardGate = (standardName: string, message: string, cap: number): void => {
    addRiskFlag(standardName, message);
    hardScoreCap = typeof hardScoreCap === "number" ? Math.min(hardScoreCap, cap) : cap;
  };`
);

// Fix 2: Update all triggerHardGate calls to include standard name
content = content.replace(
  /triggerHardGate\(\s*`Hard gate: JD requires Japanese fluency[^`]*`,[^)]*\)/g,
  'triggerHardGate("JAPANESE_FLUENCY", `Hard gate: JD requires Japanese fluency, but profile does not explicitly show fluent Japanese evidence. Score capped at ${config.japaneseHardCap}.`, config.japaneseHardCap)'
);

content = content.replace(
  /triggerHardGate\(\s*`Hard gate: Profile indicates Japanese-fluent requirement[^`]*`,[^)]*\)/g,
  'triggerHardGate("JAPANESE_FLUENCY_PROFILE_MISMATCH", `Hard gate: Profile indicates Japanese-fluent requirement, but JD does not include Japanese requirement. Score capped at ${config.japaneseHardCap}.`, config.japaneseHardCap)'
);

content = content.replace(
  /triggerHardGate\(\s*`Hard gate: JD appears onsite-required[^`]*`,[^)]*\)/g,
  'triggerHardGate("ONSITE_REQUIRED", `Hard gate: JD appears onsite-required but profile location preference suggests remote/hybrid. Score capped at ${config.onsiteHardCap}.`, config.onsiteHardCap)'
);

// Fix 3: Remove the incorrect profileRequiresJapaneseFluent logic that causes TC013 to fail
// The profile having "Japanese (Business)" should NOT trigger a hard cap when JD doesn't mention Japanese
content = content.replace(
  /const profileRequiresJapaneseFluent = constraints\.languages\.some\(\(entry\) => \{[\s\S]{0,500}\}\);/,
  `// REMOVED: profileRequiresJapaneseFluent logic was incorrect
// Profile's "Japanese (Business)" describes candidate's capability, not a requirement
// Hard cap should only trigger when JD requires fluent Japanese`
);

// Fix 4: Remove the incorrect hard gate trigger that causes TC013 to fail
content = content.replace(
  /if \(profileRequiresJapaneseFluent && !jdMentionsJapanese\) \{[\s\S]{0,300}\}/,
  `// REMOVED: Incorrect hard gate trigger that causes false positives`
);

// Fix 5: Update generic addRiskFlag calls to use standard names
content = content.replace(
  /addRiskFlag\(`No evidence found for required language: \${language}`\);/g,
  'addRiskFlag("LANGUAGE_MISMATCH", `No evidence found for required language: ${language}`);'
);

content = content.replace(
  /addRiskFlag\("Availability may not align[^"]*"\);/g,
  'addRiskFlag("CONTRACT_AVAILABILITY", "Availability may not align (JD appears contract-only).");'
);

// Fix 6: Remove unnecessary score penalties (the hard cap handles the limitation)
// These penalties were reducing the score below the cap, which is incorrect
content = content.replace(
  /triggerHardGate\([^)]+\);\s+score -= 2;/g,
  'triggerHardGate("JAPANESE_FLUENCY", `Hard gate: JD requires Japanese fluency, but profile does not explicitly show fluent Japanese evidence. Score capped at ${config.japaneseHardCap}.`, config.japaneseHardCap);'
);

writeFileSync(analysisTsPath, content);

console.log('✓ Issue 1 fixes applied to analysis.ts');
