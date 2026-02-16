#!/usr/bin/env node

/**
 * E2E Test Runner for JD Concierge
 *
 * This script runs test cases against the live API and compares results with expectations.
 * It produces a detailed JSON report with assertions and pass/fail status.
 */

import { analyzeJobDescription, parseAndValidateProfile } from '../src/analysis.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TypeScript interfaces
interface Strength {
  area: string;
  evidence_title: string;
  evidence_url: string;
  rationale: string;
}

interface Gap {
  area: string;
  gap: string;
  why_it_matters: string;
}

interface RubricItem {
  section: string;
  score: number;
  max_score: number;
  notes: string;
}

interface TestResult {
  score: number;
  confidence: 'High' | 'Medium' | 'Low';
  risk_flags: string[];
  strengths: Strength[];
  gaps: Gap[];
  rubric_breakdown: RubricItem[];
}

interface ExpectedResult {
  min_score: number;
  max_score: number;
  confidence: 'High' | 'Medium' | 'Low';
  required_risk_flags: string[];
  forbidden_risk_flags: string[];
  required_strength_areas: string[];
  required_gap_areas: string[];
  rubric_expectations: Record<string, { min_score: number; max_score: number }>;
  rationale: string;
}

interface TestCase {
  test_id: string;
  name: string;
  category: string;
  known_issue: string;
  jd_text: string;
  expected: ExpectedResult;
}

interface AssertionResult {
  field: string;
  expected: string;
  actual: string;
  status: 'PASSED' | 'FAILED';
}

interface DetailedTestResult {
  test_id: string;
  status: 'PASSED' | 'FAILED';
  expected: ExpectedResult;
  actual: TestResult;
  assertions: AssertionResult[];
  test_name: string;
  category: string;
  known_issue: string;
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
  results: DetailedTestResult[];
}

/**
 * Load and parse profile.json
 */
function loadProfile() {
  const profilePath = path.resolve(__dirname, '../../shared/profile.json');
  const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
  return parseAndValidateProfile(profileData);
}

/**
 * Load test cases from JSON file
 */
function loadTestCases(): TestCase[] {
  const testCasesPath = path.resolve(__dirname, '../../test-planning/mock-jd-test-cases.json');
  const data = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));
  return data.test_cases;
}

/**
 * Run assertions for a test case
 */
function runAssertions(testCase: TestCase, actual: TestResult): AssertionResult[] {
  const assertions: AssertionResult[] = [];
  const expected = testCase.expected;

  // Score range assertion
  const scoreInBounds = actual.score >= expected.min_score && actual.score <= expected.max_score;
  assertions.push({
    field: 'score',
    expected: `${expected.min_score}-${expected.max_score}`,
    actual: String(actual.score),
    status: scoreInBounds ? 'PASSED' : 'FAILED'
  });

  // Confidence assertion
  const confidenceMatches = actual.confidence === expected.confidence;
  assertions.push({
    field: 'confidence',
    expected: expected.confidence,
    actual: actual.confidence,
    status: confidenceMatches ? 'PASSED' : 'FAILED'
  });

  // Required risk flags assertion
  const hasRequiredRiskFlags = expected.required_risk_flags.every(flag =>
    actual.risk_flags.some(rf => rf.includes(flag))
  );
  assertions.push({
    field: 'required_risk_flags',
    expected: expected.required_risk_flags.join(', ') || 'none',
    actual: actual.risk_flags.join(', ') || 'none',
    status: hasRequiredRiskFlags ? 'PASSED' : 'FAILED'
  });

  // Forbidden risk flags assertion
  const hasForbiddenRiskFlags = expected.forbidden_risk_flags.some(flag =>
    actual.risk_flags.some(rf => rf.includes(flag))
  );
  assertions.push({
    field: 'forbidden_risk_flags',
    expected: expected.forbidden_risk_flags.join(', ') || 'none',
    actual: actual.risk_flags.filter(rf =>
      expected.forbidden_risk_flags.some(ff => rf.includes(ff))
    ).join(', ') || 'none',
    status: !hasForbiddenRiskFlags ? 'PASSED' : 'FAILED'
  });

  // Required strength areas assertion
  const hasRequiredStrengthAreas = expected.required_strength_areas.every(area =>
    actual.strengths.some(s => s.area === area)
  );
  assertions.push({
    field: 'required_strength_areas',
    expected: expected.required_strength_areas.join(', ') || 'none',
    actual: actual.strengths.map(s => s.area).join(', ') || 'none',
    status: hasRequiredStrengthAreas ? 'PASSED' : 'FAILED'
  });

  // Required gap areas assertion
  const hasRequiredGapAreas = expected.required_gap_areas.length === 0 ||
    expected.required_gap_areas.every(area =>
      actual.gaps.some(g => g.area === area)
    );
  assertions.push({
    field: 'required_gap_areas',
    expected: expected.required_gap_areas.join(', ') || 'none',
    actual: actual.gaps.map(g => g.area).join(', ') || 'none',
    status: hasRequiredGapAreas ? 'PASSED' : 'FAILED'
  });

  // Rubric breakdown assertions
  for (const [section, expectation] of Object.entries(expected.rubric_expectations)) {
    const rubricItem = actual.rubric_breakdown.find(r => r.section?.toLowerCase()?.includes(section.toLowerCase()));
    if (rubricItem) {
      const rubricInBounds = rubricItem.score >= expectation.min_score && rubricItem.score <= expectation.max_score;
      assertions.push({
        field: `rubric_${section}`,
        expected: `${expectation.min_score}-${expectation.max_score}`,
        actual: String(rubricItem.score),
        status: rubricInBounds ? 'PASSED' : 'FAILED'
      });
    }
  }

  return assertions;
}

/**
 * Run a single test case
 */
function runTestCase(testCase: TestCase, profile: any): DetailedTestResult {
  console.log(`\n▶ Running ${testCase.test_id}: ${testCase.name}`);

  try {
    const actual = analyzeJobDescription(testCase.jd_text, profile, testCase.test_id);
    const assertions = runAssertions(testCase, actual);
    const allPassed = assertions.every(a => a.status === 'PASSED');

    const result: DetailedTestResult = {
      test_id: testCase.test_id,
      status: allPassed ? 'PASSED' : 'FAILED',
      expected: testCase.expected,
      actual,
      assertions,
      test_name: testCase.name,
      category: testCase.category,
      known_issue: testCase.known_issue
    };

    if (allPassed) {
      console.log(`  ✅ PASSED`);
    } else {
      console.log(`  ❌ FAILED`);
      const failedAssertions = assertions.filter(a => a.status === 'FAILED');
      failedAssertions.forEach(a => {
        console.log(`     - ${a.field}: expected ${a.expected}, got ${a.actual}`);
      });
    }

    return result;
  } catch (error: any) {
    console.error(`  ❌ ERROR: ${error.message}`);
    return {
      test_id: testCase.test_id,
      status: 'FAILED',
      expected: testCase.expected,
      actual: {
        score: 0,
        confidence: 'Low',
        risk_flags: [`ERROR: ${error.message}`],
        strengths: [],
        gaps: [],
        rubric_breakdown: []
      },
      assertions: [{
        field: 'execution',
        expected: 'success',
        actual: error.message,
        status: 'FAILED'
      }],
      test_name: testCase.name,
      category: testCase.category,
      known_issue: testCase.known_issue
    };
  }
}

/**
 * Main execution
 */
function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('     JD Concierge E2E Test Runner');
  console.log('═══════════════════════════════════════════════════════════\n');

  const profile = loadProfile();
  const testCases = loadTestCases();
  const results: DetailedTestResult[] = [];

  for (const testCase of testCases) {
    const result = runTestCase(testCase, profile);
    results.push(result);
  }

  const summary: TestRunSummary = {
    test_run_id: `e2e-${Date.now()}`,
    timestamp: new Date().toISOString(),
    environment: {
      api_url: 'https://kinokoholic.com/api/analyze',
      profile_version: '2026-02-15',
      worker_version: 'main'
    },
    summary: {
      total_tests: results.length,
      passed: results.filter(r => r.status === 'PASSED').length,
      failed: results.filter(r => r.status === 'FAILED').length,
      skipped: 0
    },
    results
  };

  // Save results
  const resultsPath = path.resolve(__dirname, '../../test-planning/e2e-test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2));

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`     Test Run Complete: ${summary.summary.passed}/${summary.summary.total_tests} passed`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Print summary by issue
  console.log('Summary by Known Issue:');
  console.log('─────────────────────────────────────────────────────────────');

  const issueGroups = new Map<string, DetailedTestResult[]>();
  for (const result of results) {
    if (result.known_issue && !issueGroups.has(result.known_issue)) {
      issueGroups.set(result.known_issue, []);
    }
    if (result.known_issue) {
      issueGroups.get(result.known_issue)!.push(result);
    }
  }

  for (const [issue, issueResults] of issueGroups.entries()) {
    const passed = issueResults.filter(r => r.status === 'PASSED').length;
    const total = issueResults.length;
    console.log(`\n${issue}`);
    console.log(`  ${passed}/${total} tests passed`);
  }

  console.log(`\nResults saved to: ${resultsPath}`);

  // Exit with non-zero code if any tests failed
  if (summary.summary.failed > 0) {
    process.exit(1);
  }
}

main();
