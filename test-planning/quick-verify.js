#!/usr/bin/env node
/**
 * Quick Verification Script for E2E Test Fixes
 * Run this after implementing fixes to verify critical test cases
 */

const fs = require('fs');
const path = require('path');

// Load test dependencies
const testCasesPath = path.join(__dirname, 'mock-jd-test-cases.json');
const profilePath = path.join(__dirname, '..', 'shared', 'profile.json');
const analysisPath = path.join(__dirname, '..', 'worker', 'lib', 'analysis.js');

// Check if compiled
if (!fs.existsSync(analysisPath)) {
  console.error('❌ Please compile TypeScript first: cd worker && npm run build');
  process.exit(1);
}

const { analyzeJobDescription } = require(analysisPath);
const testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf8'));
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

console.log('🔍 E2E Quick Verification Tool\n');

// Critical test cases to verify
const CRITICAL_TESTS = [
  { id: 'TC013', name: 'Japanese Edge Case', expectedMin: 75, expectedMax: 95 },
  { id: 'TC002', name: 'Cosmetics Domain', expectedMin: 0, expectedMax: 25 },
  { id: 'TC006', name: 'Fashion Domain', expectedMin: 0, expectedMax: 25 },
  { id: 'TC007', name: 'Beauty Domain', expectedMin: 0, expectedMax: 25 }
];

// Risk flag format check
const EXPECTED_FLAG_PREFIXES = [
  'JAPANESE_FLUENCY:',
  'ONSITE_REQUIRED:',
  'LANGUAGE_MISMATCH:',
  'CONTRACT_ONLY:'
];

console.log('Testing critical cases...\n');

let allPassed = true;

CRITICAL_TESTS.forEach(test => {
  const testCase = testCases.test_cases.find(tc => tc.test_id === test.id);
  if (!testCase) {
    console.error(`❌ Test case ${test.id} not found`);
    return;
  }

  try {
    const result = analyzeJobDescription(testCase.jd_text, profile, test.id);
    
    // Check score
    const scorePassed = result.score >= test.expectedMin && result.score <= test.expectedMax;
    const scoreIcon = scorePassed ? '✅' : '❌';
    
    console.log(`${test.id}: ${test.name}`);
    console.log(`  ${scoreIcon} Score: ${result.score} (expected: ${test.expectedMin}-${test.expectedMax})`);
    
    // Check risk flag format if any exist
    if (result.risk_flags && result.risk_flags.length > 0) {
      const hasStandardFormat = result.risk_flags.some(flag => 
        EXPECTED_FLAG_PREFIXES.some(prefix => flag.startsWith(prefix))
      );
      const flagIcon = hasStandardFormat ? '✅' : '⚠️';
      console.log(`  ${flagIcon} Risk flags: ${hasStandardFormat ? 'Standardized' : 'Need prefix'}`);
      
      if (!hasStandardFormat) {
        console.log(`     Example: "${result.risk_flags[0].substring(0, 50)}..."`);
      }
    }
    
    // Special checks
    if (test.id === 'TC013' && result.risk_flags.some(f => f.includes('Japanese'))) {
      console.log(`  ⚠️  WARNING: TC013 should NOT have Japanese risk flags!`);
      allPassed = false;
    }
    
    if ((test.id === 'TC002' || test.id === 'TC006' || test.id === 'TC007') && result.score > 30) {
      console.log(`  ⚠️  WARNING: Domain mismatch score too high!`);
      allPassed = false;
    }
    
    if (!scorePassed) allPassed = false;
    
    console.log('');
    
  } catch (error) {
    console.error(`❌ Error testing ${test.id}:`, error.message);
    allPassed = false;
  }
});

// Check confidence on high-fit cases
console.log('\nChecking confidence scoring...\n');

const CONFIDENCE_TESTS = ['TC009', 'TC015'];
CONFIDENCE_TESTS.forEach(testId => {
  const testCase = testCases.test_cases.find(tc => tc.test_id === testId);
  if (!testCase) return;
  
  try {
    const result = analyzeJobDescription(testCase.jd_text, profile, testId);
    const confIcon = result.confidence === 'High' ? '✅' : '⚠️';
    console.log(`${testId}: Confidence = ${result.confidence} ${confIcon}`);
    
    if (result.confidence !== 'High') {
      // Log diagnostic info
      console.log(`  Strengths: ${result.strengths.length}`);
      console.log(`  Unique URLs: ${new Set(result.strengths.map(s => s.evidence_url)).size}`);
      console.log(`  Domain fit score: ${result.rubric_breakdown.find(r => r.category.includes('Domain'))?.score || 'N/A'}`);
    }
  } catch (error) {
    console.error(`❌ Error testing ${testId}:`, error.message);
  }
});

// Summary
console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ All critical tests passed! Ready for full E2E run.');
} else {
  console.log('❌ Some tests failed. Please fix the issues above.');
  process.exit(1);
}

// Helpful next steps
console.log('\nNext steps:');
console.log('1. Run full E2E suite: npm run test:e2e');
console.log('2. Check all 15 tests pass');
console.log('3. Deploy to production');
console.log('4. Run against live API');