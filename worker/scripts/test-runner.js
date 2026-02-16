#!/usr/bin/env node

/**
 * JD Analyzer Test Runner
 * Loads test cases from JSON file and validates analyzer API responses
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const TEST_CASES_PATH = '/home/teabagger/dev/projects/Bio_HP/test-planning/mock-jd-test-cases.json';
const ANALYZER_API = 'https://kinokoholic.com/api/analyze';
const ANALYZER_API_KEY = '1b55824bd1eee4096c748d97e27b37a71b8576f0c70a82aa55b6160c882ceb65';
const DELAY_BETWEEN_TESTS_MS = 1000; // 1 second between tests (reduced for faster execution)
const MAX_TESTS = Number(process.env.MAX_TESTS) || 9999; // Optional: limit number of tests to run

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Load test cases from JSON file
function loadTestCases() {
  try {
    const data = readFileSync(TEST_CASES_PATH, 'utf8');
    const json = JSON.parse(data);

    // Check if this is the new format (test-planning) or old format
    if (json.test_cases) {
      // New format from test-planning/mock-jd-test-cases.json
      console.log('Detected new test-planning format');
      return json.test_cases.map(tc => ({
        name: tc.name,
        jd_content: tc.jd_text,
        jd_text: tc.jd_text,
        expected_score_range: [tc.expected.min_score, tc.expected.max_score],
        expected_confidence: tc.expected.confidence,
        expected_risk_flags: tc.expected.required_risk_flags || [],
        reasoning: tc.expected.rationale || '',
        failure_modes: [],
        category: tc.category,
        known_issue: tc.known_issue,
        test_id: tc.test_id
      }));
    } else {
      // Old format (array of test cases directly)
      console.log('Detected old format');
      return Array.isArray(json) ? json : [json];
    }
  } catch (error) {
    console.error(colorize(`Error loading test cases: ${error.message}`, 'red'));
    process.exit(1);
  }
}

// Call analyzer API using curl
async function callAnalyzerAPI(jdContent) {
  try {
    const curlCommand = `curl -s -X POST '${ANALYZER_API}' \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer ${ANALYZER_API_KEY}' \
      -d '${JSON.stringify({ jd_text: jdContent }).replace(/'/g, "'\\''")}'`;

    const output = execSync(curlCommand, { encoding: 'utf8' });
    const response = JSON.parse(output);

    if (response.error) {
      throw new Error(`API error: ${response.error}`);
    }

    return response;
  } catch (error) {
    if (error.message.includes('API error')) {
      throw error;
    }
    throw new Error(`Failed to call API: ${error.message}`);
  }
}

// Check if score is within expected range
function isScoreInRange(actualScore, expectedRange) {
  const [min, max] = expectedRange;
  return actualScore >= min && actualScore <= max;
}

// Compare risk flags
function compareRiskFlags(actual, expected) {
  const missing = expected.filter(flag => !actual.includes(flag));
  const unexpected = actual.filter(flag => !expected.includes(flag));
  return { missing, unexpected };
}

// Normalize confidence level
function normalizeConfidence(confidence) {
  if (!confidence) return 'Unknown';
  const lower = confidence.toLowerCase();
  if (lower.includes('high')) return 'High';
  if (lower.includes('medium') || lower.includes('moderate')) return 'Medium';
  if (lower.includes('low')) return 'Low';
  return confidence;
}

// Run a single test case
async function runTestCase(testCase) {
  console.log(`\n${colorize('═'.repeat(70), 'cyan')}`);
  console.log(colorize(`Test: ${testCase.name}`, 'bright'));
  console.log(colorize('═'.repeat(70), 'cyan'));

  console.log(`Expected score: ${testCase.expected_score_range[0]}-${testCase.expected_score_range[1]}`);
  console.log(`Expected confidence: ${testCase.expected_confidence}`);
  console.log(`Expected risk flags: ${testCase.expected_risk_flags.join(', ') || 'None'}`);

  try {
    // Call the analyzer API
    console.log(`\n${colorize('Calling analyzer API...', 'blue')}`);
    const result = await callAnalyzerAPI(testCase.jd_content);

    // Extract relevant fields
    const actualScore = result.score ?? result.final_score ?? 0;
    const actualConfidence = normalizeConfidence(result.confidence ?? result.prediction_confidence);
    const actualRiskFlags = result.risk_flags ?? result.detected_risks ?? [];
    const rubricBreakdown = result.rubric_breakdown ?? result.score_breakdown ?? {};

    console.log(`\n${colorize('Results:', 'bright')}`);
    console.log(`  Score: ${colorize(actualScore, 'bright')} (${isScoreInRange(actualScore, testCase.expected_score_range) ? colorize('✓', 'green') : colorize('✗', 'red')})`);
    console.log(`  Confidence: ${colorize(actualConfidence, 'bright')} ${actualConfidence === testCase.expected_confidence ? colorize('✓', 'green') : colorize('✗', 'red')}`);
    console.log(`  Risk flags: ${actualRiskFlags.join(', ') || 'None'}`);

    if (Array.isArray(rubricBreakdown) && rubricBreakdown.length > 0) {
      console.log(`\n${colorize('Rubric Breakdown:', 'bright')}`);
      rubricBreakdown.forEach(item => {
        console.log(`  ${item.category}: ${item.score}/${item.weight} - ${item.notes}`);
      });
    } else if (Object.keys(rubricBreakdown).length > 0) {
      console.log(`\n${colorize('Rubric Breakdown:', 'bright')}`);
      for (const [category, value] of Object.entries(rubricBreakdown)) {
        console.log(`  ${category}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
      }
    }

    // Determine pass/fail
    const scoreInRange = isScoreInRange(actualScore, testCase.expected_score_range);
    const confidenceMatch = actualConfidence === testCase.expected_confidence;
    const { missing, unexpected } = compareRiskFlags(actualRiskFlags, testCase.expected_risk_flags);
    const riskFlagsMatch = missing.length === 0 && unexpected.length === 0;

    const passed = scoreInRange && confidenceMatch && riskFlagsMatch;

    // Calculate delta from expected range
    const deltaMin = actualScore - testCase.expected_score_range[0];
    const deltaMax = actualScore - testCase.expected_score_range[1];
    const deltaText = deltaMin >= 0 && deltaMax <= 0
      ? 'Within range'
      : `${deltaMin > 0 ? '+' : ''}${deltaMin} (from min), ${deltaMax > 0 ? '+' : ''}${deltaMax} (from max)`;

    // Build result object
    const testResult = {
      name: testCase.name,
      passed,
      actualScore,
      expectedRange: testCase.expected_score_range,
      delta: deltaText,
      confidenceMatch,
      actualConfidence,
      expectedConfidence: testCase.expected_confidence,
      riskFlagsMatch,
      missingRiskFlags: missing,
      unexpectedRiskFlags: unexpected,
      rubricBreakdown,
      reasoning: testCase.reasoning,
      failureModes: testCase.failure_modes,
    };

    // Report discrepancies
    const discrepancies = [];

    if (!scoreInRange) {
      discrepancies.push(`Score out of range (${deltaText})`);
    }

    if (!confidenceMatch) {
      discrepancies.push(`Confidence mismatch: expected ${testCase.expected_confidence}, got ${actualConfidence}`);
    }

    if (missing.length > 0) {
      discrepancies.push(`Missing risk flags: ${missing.join(', ')}`);
    }

    if (unexpected.length > 0) {
      discrepancies.push(`Unexpected risk flags: ${unexpected.join(', ')}`);
    }

    if (discrepancies.length > 0) {
      console.log(`\n${colorize('Discrepancies:', 'yellow')}`);
      discrepancies.forEach(d => console.log(`  • ${d}`));
    }

    if (passed) {
      console.log(`\n${colorize('✓ PASSED', 'green')}`);
    } else {
      console.log(`\n${colorize('✗ FAILED', 'red')}`);
    }

    return testResult;

  } catch (error) {
    console.error(`\n${colorize(`Error: ${error.message}`, 'red')}`);
    return {
      name: testCase.name,
      passed: false,
      error: error.message,
      actualScore: null,
      expectedRange: testCase.expected_score_range,
    };
  }
}

// Analyze results and identify systematic issues
function analyzeResults(results) {
  console.log(`\n\n${colorize('='.repeat(70), 'cyan')}`);
  console.log(colorize('ANALYSIS SUMMARY', 'bright'));
  console.log(colorize('='.repeat(70), 'cyan'));

  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed && !r.error);
  const errors = results.filter(r => r.error);

  console.log(`\nTotal tests: ${results.length}`);
  console.log(`  ${colorize(`${passed.length} PASSED`, 'green')}`);
  console.log(`  ${colorize(`${failed.length} FAILED`, 'red')}`);
  console.log(`  ${colorize(`${errors.length} ERRORS`, 'yellow')}`);

  // Score analysis
  const validResults = results.filter(r => !r.error);
  let avgDelta = null;
  if (validResults.length > 0) {
    console.log(`\n${colorize('Score Analysis:', 'bright')}`);

    const scoreDeltas = validResults.map(r => {
      const midExpected = (r.expectedRange[0] + r.expectedRange[1]) / 2;
      return r.actualScore - midExpected;
    });

    avgDelta = scoreDeltas.reduce((a, b) => a + b, 0) / scoreDeltas.length;

    console.log(`  Average delta from expected mid-point: ${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(1)}`);

    if (avgDelta > 5) {
      console.log(`  ${colorize('⚠ Systematic overscoring detected', 'yellow')}`);
    } else if (avgDelta < -5) {
      console.log(`  ${colorize('⚠ Systematic underscoring detected', 'yellow')}`);
    } else {
      console.log(`  ${colorize('✓ No systematic scoring bias', 'green')}`);
    }

    // Individual score deltas
    console.log(`\n  Individual score deltas:`);
    validResults.forEach(r => {
      const midExpected = (r.expectedRange[0] + r.expectedRange[1]) / 2;
      const delta = r.actualScore - midExpected;
      const status = Math.abs(delta) <= 5 ? '✓' : Math.abs(delta) <= 10 ? '~' : '✗';
      console.log(`    ${status} ${r.name}: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`);
    });
  }

  // Confidence analysis
  const confidenceMismatches = validResults.filter(r => !r.confidenceMatch);
  if (confidenceMismatches.length > 0) {
    console.log(`\n${colorize('Confidence Issues:', 'yellow')}`);
    confidenceMismatches.forEach(r => {
      console.log(`  • ${r.name}: expected ${r.expectedConfidence}, got ${r.actualConfidence}`);
    });
  }

  // Risk flag analysis
  const riskFlagIssues = validResults.filter(r => !r.riskFlagsMatch);
  const missingFlags = {};
  const unexpectedFlags = {};

  if (riskFlagIssues.length > 0) {
    console.log(`\n${colorize('Risk Flag Issues:', 'yellow')}`);

    // Count missing flags
    riskFlagIssues.forEach(r => {
      r.missingRiskFlags.forEach(flag => {
        missingFlags[flag] = (missingFlags[flag] || 0) + 1;
      });
    });

    if (Object.keys(missingFlags).length > 0) {
      console.log(`  Missing risk flags (frequency):`);
      Object.entries(missingFlags).forEach(([flag, count]) => {
        console.log(`    • ${flag}: ${count} test(s)`);
      });
    }

    // Count unexpected flags
    riskFlagIssues.forEach(r => {
      r.unexpectedRiskFlags.forEach(flag => {
        unexpectedFlags[flag] = (unexpectedFlags[flag] || 0) + 1;
      });
    });

    if (Object.keys(unexpectedFlags).length > 0) {
      console.log(`  Unexpected risk flags (frequency):`);
      Object.entries(unexpectedFlags).forEach(([flag, count]) => {
        console.log(`    • ${flag}: ${count} test(s)`);
      });
    }
  }

  // Recommendations
  const recommendations = [];

  if (avgDelta > 5) {
    recommendations.push('Review scoring algorithm - may be too generous');
    recommendations.push('Check if bonus/extra-credit items are over-weighted');
  } else if (avgDelta < -5) {
    recommendations.push('Review scoring algorithm - may be too strict');
    recommendations.push('Check if matching criteria are too narrow');
  }

  if (missingFlags['JAPANESE_FLUENCY'] > 0) {
    recommendations.push('Improve Japanese fluency detection - look for variations like "Native-level", "JLPT N1"');
  }

  if (missingFlags['ONSITE_REQUIRED'] > 0) {
    recommendations.push('Improve onsite detection - look for variations like "in-office", "no remote work"');
  }

  if (confidenceMismatches.length > validResults.length / 2) {
    recommendations.push('Review confidence scoring algorithm - systematic mismatch detected');
  }

  if (recommendations.length > 0) {
    console.log(`\n${colorize('Recommendations:', 'bright')}`);
    recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }

  // Summary JSON
  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: passed.length,
    failed: failed.length,
    errors: errors.length,
    averageDelta: validResults.length > 0
      ? scoreDeltas.reduce((a, b) => a + b, 0) / scoreDeltas.length
      : null,
    systematicIssues: recommendations.length > 0,
    recommendations,
    results,
  };

  return summary;
}

// Main execution
async function main() {
  console.log(colorize('\nJD Analyzer Test Runner', 'bright'));
  console.log(colorize('======================', 'cyan'));

  // Load test cases
  const testCases = loadTestCases();
  console.log(`Loaded ${testCases.length} test cases from ${TEST_CASES_PATH}`);

  // Limit number of tests if MAX_TESTS is set
  const testsToRun = testCases.slice(0, Math.min(testCases.length, MAX_TESTS));
  if (MAX_TESTS < testCases.length) {
    console.log(`Running first ${MAX_TESTS} tests only (MAX_TESTS=${MAX_TESTS})`);
  }

  // Run tests
  const results = [];
  for (let i = 0; i < testsToRun.length; i++) {
    const testCase = testsToRun[i];
    const result = await runTestCase(testCase);
    results.push(result);

    // Add delay between tests to avoid rate limits (except after last test)
    if (i < testsToRun.length - 1) {
      console.log(`\n${colorize(`Waiting ${DELAY_BETWEEN_TESTS_MS / 1000}s before next test...`, 'blue')}`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TESTS_MS));
    }
  }

  // Analyze results
  const summary = analyzeResults(results);

  // Write summary to file
  const summaryPath = join(__dirname, 'test-results.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n${colorize(`Summary saved to: ${summaryPath}`, 'blue')}`);

  // Exit with appropriate code
  const exitCode = summary.errors.length > 0 ? 2 : summary.failed.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Run main function
main().catch(error => {
  console.error(colorize(`\nFatal error: ${error.message}`, 'red'));
  console.error(error.stack);
  process.exit(1);
});
