/**
 * Tests for Dashboard Page Generator - BUG-004
 *
 * BUG-004: Performance Metrics Cluttered and Uninformative
 *
 * Issue: The performance metrics section is cluttered and doesn't provide
 * actionable insights. Only 4 of 12 calculated metrics are displayed,
 * with no categorization, trends, or breakdown information.
 *
 * These tests define what "informative metrics" should look like and will
 * FAIL until the metrics section is redesigned.
 */

import { generateDashboardPage } from './dashboard-page.js';
import type { SprintSummary } from './sprint-scanner.js';
import type { AggregateMetrics } from './metrics-aggregator.js';

// ============================================================================
// Test Infrastructure
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;
const testQueue: Array<{ name: string; fn: () => void | Promise<void> }> = [];
let testsStarted = false;

function test(name: string, fn: () => void | Promise<void>): void {
  testQueue.push({ name, fn });
  if (!testsStarted) {
    testsStarted = true;
    setImmediate(runTests);
  }
}

async function runTests(): Promise<void> {
  console.log('\n=== Dashboard Page Tests (BUG-004) ===\n');

  for (const { name, fn } of testQueue) {
    try {
      await fn();
      testsPassed++;
      console.log(`✓ ${name}`);
    } catch (error) {
      testsFailed++;
      console.error(`✗ ${name}`);
      console.error(`  ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log('');
  console.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
  if (testsFailed > 0) {
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestMetrics(): AggregateMetrics {
  return {
    totalSprints: 50,
    completedSprints: 42,
    failedSprints: 5,
    inProgressSprints: 3,
    successRate: 89,
    averageDuration: 3600000, // 1 hour
    averageDurationFormatted: '1h 0m',
    averageStepsPerSprint: 12.5,
    workflowStats: [
      { workflow: 'development', count: 30, percentage: 60, successRate: 90 },
      { workflow: 'bugfix', count: 15, percentage: 30, successRate: 85 },
      { workflow: 'testing', count: 5, percentage: 10, successRate: 100 },
    ],
    mostCommonWorkflow: 'development',
    dailyTrend: [
      { dateKey: '2026-01-18', count: 8, completed: 7, failed: 1, successRate: 88 },
      { dateKey: '2026-01-19', count: 12, completed: 10, failed: 2, successRate: 83 },
      { dateKey: '2026-01-20', count: 5, completed: 4, failed: 0, successRate: 100 },
    ],
    weeklyTrend: [
      { dateKey: '2026-W02', count: 20, completed: 18, failed: 2, successRate: 90 },
      { dateKey: '2026-W03', count: 30, completed: 24, failed: 3, successRate: 89 },
    ],
    // BUG-004: Additional actionable metrics
    healthStatus: 'healthy',
    successRateTrend: 'stable',
    durationAnomalies: 0,
    categories: {
      velocity: { sprintsPerDay: 8.3, averageStepsPerSprint: 12.5 },
      quality: { successRate: 89, failureRate: 11 },
      efficiency: { averageDuration: 3600000, stepsPerHour: 12.5 },
    },
    comparison: { successRateChange: -1, durationChange: 5 },
    alerts: [],
    averageStepsPerHour: 12.5,
    insights: [
      { type: 'success', message: 'Excellent success rate - sprints are completing reliably' },
    ],
  };
}

function createTestSprints(): SprintSummary[] {
  return [
    {
      sprintId: '2026-01-20_test-sprint',
      path: '/path/to/sprint',
      status: 'completed',
      workflow: 'development',
      totalSteps: 10,
      completedSteps: 10,
      totalPhases: 3,
      completedPhases: 3,
      startedAt: '2026-01-20T10:00:00Z',
      completedAt: '2026-01-20T11:00:00Z',
      elapsed: '1h 0m',
    },
  ];
}

// ============================================================================
// BUG-004 Tests: Metrics Should Be Informative, Not Cluttered
// ============================================================================

/**
 * TEST 1: Metrics section should utilize ALL calculated data
 *
 * Currently: Only 4 of 12 metrics displayed (33% utilization)
 * Expected: At least 75% of calculated metrics should be visible
 *
 * The MetricsAggregator calculates:
 * - totalSprints ✓ (displayed)
 * - completedSprints ✗ (not displayed)
 * - failedSprints ✗ (not displayed)
 * - inProgressSprints ✗ (not displayed)
 * - successRate ✓ (displayed)
 * - averageDuration ✓ (displayed as averageDurationFormatted)
 * - averageStepsPerSprint ✗ (not displayed)
 * - workflowStats ✗ (not displayed)
 * - mostCommonWorkflow ✗ (not displayed)
 * - dailyTrend ✗ (not displayed)
 * - weeklyTrend ✗ (not displayed)
 */
test('metrics section should display status breakdown (completed/failed/in-progress)', () => {
  const metrics = createTestMetrics();
  const sprints = createTestSprints();
  const html = generateDashboardPage(sprints, metrics, null);

  // Extract just the metrics section HTML element (not CSS)
  // Look for the actual section element with class="metrics-section"
  const metricsStart = html.indexOf('<section class="metrics-section">');
  const metricsEnd = html.indexOf('</section>', metricsStart);
  const metricsSection = html.substring(metricsStart, metricsEnd);

  // The metrics section should show status breakdown with labeled metrics
  // New BUG-004 design: label in one div, value in metric-value div
  // Pattern: <div class="metric-label">Completed</div>\n...<div class="metric-value ...">42</div>
  const hasCompletedMetric =
    metricsSection.includes('42 completed') ||
    metricsSection.includes('42 Completed') ||
    metricsSection.includes('Completed">42') ||
    metricsSection.includes('completed-count">42') ||
    (metricsSection.includes('Completed Sprints') && metricsSection.includes('>42<')) ||
    (metricsSection.includes('>Completed<') && metricsSection.includes('>42<'));

  const hasFailedMetric =
    metricsSection.includes('5 failed') ||
    metricsSection.includes('5 Failed') ||
    metricsSection.includes('Failed">5') ||
    metricsSection.includes('failed-count">5') ||
    (metricsSection.includes('Failed Sprints') && metricsSection.includes('>5<')) ||
    (metricsSection.includes('>Failed<') && metricsSection.includes('>5<'));

  const hasInProgressMetric =
    metricsSection.includes('3 in-progress') ||
    metricsSection.includes('3 In Progress') ||
    metricsSection.includes('Active">3') ||
    metricsSection.includes('in-progress-count">3') ||
    (metricsSection.includes('In Progress') && metricsSection.includes('>3<'));

  assert(
    hasCompletedMetric && hasFailedMetric && hasInProgressMetric,
    'Metrics section should display status breakdown with labeled counts. ' +
    'Expected: "42 Completed", "5 Failed", "3 In Progress" or similar labeled metrics. ' +
    `Found in metrics section - Completed: ${hasCompletedMetric}, Failed: ${hasFailedMetric}, InProgress: ${hasInProgressMetric}`
  );
});

/**
 * TEST 2: Metrics should be organized into meaningful categories
 *
 * Currently: 4 cards in flat grid with mixed concerns
 * Expected: Metrics grouped by category (e.g., Status, Performance, Trends)
 *
 * Good categorization:
 * - Status: Total, Completed, Failed, In-Progress, Success Rate
 * - Performance: Avg Duration, Avg Steps
 * - Workflows: Most Common, Distribution
 * - Trends: Daily/Weekly charts or summaries
 */
test('metrics should be organized into categories', () => {
  const metrics = createTestMetrics();
  const sprints = createTestSprints();
  const html = generateDashboardPage(sprints, metrics, null);

  // Extract just the metrics section HTML element (not CSS)
  const metricsStart = html.indexOf('<section class="metrics-section">');
  const metricsEnd = html.indexOf('</section>', metricsStart);
  const metricsSection = html.substring(metricsStart, metricsEnd);

  // Look for category headers/groups within the metrics section
  // Categories should be clearly labeled sections, not just CSS classes
  const hasCategoryHeaders =
    metricsSection.includes('metrics-category') ||
    metricsSection.includes('category-title') ||
    metricsSection.includes('metrics-group') ||
    metricsSection.includes('<h2') ||
    metricsSection.includes('<h3');

  // Look for semantic groupings
  const hasStatusGroup =
    (metricsSection.includes('Status') && metricsSection.includes('Completed') && metricsSection.includes('Failed'));
  const hasPerformanceGroup =
    (metricsSection.includes('Performance') || metricsSection.includes('Timing'));
  const hasTrendGroup =
    metricsSection.includes('Trend') ||
    metricsSection.includes('History') ||
    metricsSection.includes('Activity');

  // Check for multiple distinct metric groups (not just a flat grid)
  const metricGridCount = (metricsSection.match(/metrics-grid/g) || []).length;
  const hasMultipleGroups = metricGridCount > 1 || hasCategoryHeaders;

  assert(
    hasMultipleGroups || (hasStatusGroup && hasPerformanceGroup),
    'Metrics should be organized into categories with clear headers/groups. ' +
    'Expected multiple metric groups (Status, Performance, Trends) with headers. ' +
    `Currently: single flat grid of 4 cards. Found category headers: ${hasCategoryHeaders}, ` +
    `Status group: ${hasStatusGroup}, Performance group: ${hasPerformanceGroup}, ` +
    `Multiple grids: ${metricGridCount > 1}`
  );
});

/**
 * TEST 3: Workflow information should be displayed
 *
 * Currently: workflowStats and mostCommonWorkflow are calculated but hidden
 * Expected: Users should see which workflows are most used
 */
test('metrics should display workflow statistics', () => {
  const metrics = createTestMetrics();
  const sprints = createTestSprints();
  const html = generateDashboardPage(sprints, metrics, null);

  // Should show most common workflow
  const hasMostCommonWorkflow = html.includes('development');

  // Should show workflow distribution or at least mention workflows
  const hasWorkflowInfo =
    html.includes('workflow') ||
    html.includes('Workflow') ||
    html.includes('60%'); // percentage of most common

  assert(
    hasMostCommonWorkflow && hasWorkflowInfo,
    'Metrics should display workflow statistics. ' +
    `Most common workflow "development" found: ${hasMostCommonWorkflow}, ` +
    `Workflow info displayed: ${hasWorkflowInfo}`
  );
});

/**
 * TEST 4: Average steps per sprint should be displayed
 *
 * Currently: averageStepsPerSprint is calculated but not shown
 * Expected: This metric helps users understand sprint complexity
 */
test('metrics should display average steps per sprint', () => {
  const metrics = createTestMetrics();
  const sprints = createTestSprints();
  const html = generateDashboardPage(sprints, metrics, null);

  // Extract just the metrics section HTML element (not CSS)
  const metricsStart = html.indexOf('<section class="metrics-section">');
  const metricsEnd = html.indexOf('</section>', metricsStart);
  const metricsSection = html.substring(metricsStart, metricsEnd);

  // Should show avg steps (12.5) as a labeled metric
  const hasAvgStepsValue = metricsSection.includes('12.5');

  // Check for step-related metric labels
  const hasStepMetricLabel =
    metricsSection.includes('Avg Steps') ||
    metricsSection.includes('Average Steps') ||
    metricsSection.includes('Steps/Sprint') ||
    metricsSection.includes('Steps Per Sprint');

  assert(
    hasAvgStepsValue && hasStepMetricLabel,
    'Metrics section should display average steps per sprint (12.5) as a labeled metric. ' +
    `Found value 12.5: ${hasAvgStepsValue}, Found label: ${hasStepMetricLabel}. ` +
    'This metric helps understand sprint complexity.'
  );
});

/**
 * TEST 5: Trend data should be visualized or summarized
 *
 * Currently: dailyTrend and weeklyTrend are calculated but completely hidden
 * Expected: At minimum, show recent trend direction or summary
 */
test('metrics should display trend information', () => {
  const metrics = createTestMetrics();
  const sprints = createTestSprints();
  const html = generateDashboardPage(sprints, metrics, null);

  // Should show some trend visualization or data
  const hasTrendVisualization =
    html.includes('trend') ||
    html.includes('Trend') ||
    html.includes('chart') ||
    html.includes('Chart') ||
    html.includes('graph') ||
    html.includes('sparkline');

  // Or at least show recent activity summary
  const hasActivitySummary =
    html.includes('today') ||
    html.includes('this week') ||
    html.includes('recent') ||
    html.includes('W03'); // weekly trend key

  assert(
    hasTrendVisualization || hasActivitySummary,
    'Metrics should display trend information or activity summary. ' +
    'dailyTrend and weeklyTrend are calculated but completely hidden.'
  );
});

/**
 * TEST 6: Success rate should show context (what it's out of)
 *
 * Currently: Just shows "89%" without context
 * Expected: "89% (42/47 sprints)" or similar context
 */
test('success rate should include context', () => {
  const metrics = createTestMetrics();
  const sprints = createTestSprints();
  const html = generateDashboardPage(sprints, metrics, null);

  // Should show 89% with some context
  const hasSuccessRate = html.includes('89');

  // Context could be:
  // - "42/47" (completed/finished)
  // - "42 of 47"
  // - "(47 finished)"
  // - Tooltip with breakdown
  const hasContext =
    html.includes('42/47') ||
    html.includes('42 of 47') ||
    html.includes('finished') ||
    html.includes('47 sprints') ||
    html.includes('title="'); // tooltip

  assert(
    hasSuccessRate && hasContext,
    'Success rate (89%) should include context showing what it represents. ' +
    'Currently shows just "89%" without explaining it\'s 42 completed out of 47 finished.'
  );
});

/**
 * TEST 7: Metrics section should not mix navigation with metrics
 *
 * Currently: "Active Sprint" card mixes navigation concept with metrics
 * Expected: Clear separation - metrics show data, navigation is separate
 */
test('metrics section should not include navigation elements', () => {
  const metrics = createTestMetrics();
  const sprints = createTestSprints();
  const html = generateDashboardPage(sprints, metrics, 'active-sprint-123');

  // Find the metrics section - use specific class selector to avoid matching CSS
  const metricsStart = html.indexOf('<section class="metrics-section">');
  const metricsEnd = html.indexOf('</section>', metricsStart);
  const metricsSection = html.substring(metricsStart, metricsEnd);

  // Active sprint link should NOT be in metrics section
  // It's navigation, not a metric
  const hasActiveSprintInMetrics =
    metricsSection.includes('Active Sprint') ||
    metricsSection.includes('active-sprint-123');

  assert(
    !hasActiveSprintInMetrics,
    '"Active Sprint" is navigation, not a metric. ' +
    'It should be in the header or a separate nav section, not mixed with metrics.'
  );
});

/**
 * TEST 8: Metrics should provide visual hierarchy
 *
 * Expected: Key metrics (success rate, status counts) should be prominent
 * Secondary metrics (workflows, steps) can be smaller
 */
test('metrics should have visual hierarchy for importance', () => {
  const metrics = createTestMetrics();
  const sprints = createTestSprints();
  const html = generateDashboardPage(sprints, metrics, null);

  // Look for different card sizes or prominence indicators
  const hasPrimaryMetrics =
    html.includes('metric-primary') ||
    html.includes('metric-large') ||
    html.includes('primary-card') ||
    html.includes('featured-metric');

  const hasSecondaryMetrics =
    html.includes('metric-secondary') ||
    html.includes('metric-small') ||
    html.includes('secondary-card') ||
    html.includes('supporting-metric');

  // Alternative: different grid spans
  const hasVariedSizes =
    html.includes('col-span-2') ||
    html.includes('grid-column: span') ||
    html.includes('metric-wide');

  const hasHierarchy = (hasPrimaryMetrics && hasSecondaryMetrics) || hasVariedSizes;

  assert(
    hasHierarchy,
    'Metrics should have visual hierarchy to guide attention. ' +
    'Key metrics should be more prominent than secondary metrics. ' +
    'Currently all 4 cards have identical styling.'
  );
});

/**
 * TEST 9: Data utilization should be at least 75%
 *
 * Currently: 4/12 = 33% of calculated metrics displayed
 * Expected: At least 9/12 = 75% metrics utilized
 */
test('metrics section should utilize at least 75% of calculated metrics', () => {
  const metrics = createTestMetrics();
  const sprints = createTestSprints();
  const html = generateDashboardPage(sprints, metrics, null);

  // Count which metrics appear in the output
  let utilized = 0;
  const total = 12;

  // Check each metric
  if (html.includes(String(metrics.totalSprints))) utilized++; // totalSprints
  if (html.includes(String(metrics.completedSprints))) utilized++; // completedSprints
  if (html.includes(String(metrics.failedSprints))) utilized++; // failedSprints
  if (html.includes(String(metrics.inProgressSprints))) utilized++; // inProgressSprints
  if (html.includes(String(metrics.successRate))) utilized++; // successRate
  if (html.includes(metrics.averageDurationFormatted)) utilized++; // averageDuration
  if (html.includes(String(metrics.averageStepsPerSprint))) utilized++; // averageStepsPerSprint
  if (metrics.mostCommonWorkflow && html.includes(metrics.mostCommonWorkflow)) utilized++; // mostCommonWorkflow

  // Workflow stats (check if any workflow distribution is shown)
  if (metrics.workflowStats.some(w =>
    html.includes(w.workflow) && html.includes(String(w.percentage))
  )) utilized++;

  // Trend data (check if any trend info is shown)
  if (metrics.dailyTrend.some(d =>
    html.includes(d.dateKey)
  )) utilized++;

  if (metrics.weeklyTrend.some(w =>
    html.includes(w.dateKey)
  )) utilized++;

  // Count raw display (we count showing the count breakdown in the same area)
  // This is a soft count as workflow breakdown is 1 metric

  const utilizationRate = (utilized / total) * 100;
  const threshold = 75;

  assert(
    utilizationRate >= threshold,
    `Metrics utilization is ${Math.round(utilizationRate)}% (${utilized}/${total}). ` +
    `Expected at least ${threshold}%. ` +
    `Currently displaying: totalSprints, successRate, averageDuration, and Active Sprint link. ` +
    `Missing: completedSprints, failedSprints, inProgressSprints, averageStepsPerSprint, ` +
    `workflowStats, mostCommonWorkflow, dailyTrend, weeklyTrend.`
  );
});
