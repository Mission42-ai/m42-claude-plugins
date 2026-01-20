"use strict";
/**
 * BUG-004: Performance Metrics Cluttered and Uninformative
 *
 * RED PHASE TEST - Tests for metrics organization and actionability
 *
 * This test captures the bug: metrics are currently displayed in a cluttered,
 * uninformative way without proper organization, health indicators, or insights.
 *
 * Success criteria from BUG-004:
 * - Metrics are organized and scannable
 * - Visual hierarchy guides attention
 * - Information density is appropriate
 * - Metrics tell a clear story about sprint health
 */
Object.defineProperty(exports, "__esModule", { value: true });
const metrics_aggregator_js_1 = require("./metrics-aggregator.js");
// ============================================================================
// Test Infrastructure (matching project pattern)
// ============================================================================
let testsPassed = 0;
let testsFailed = 0;
const testQueue = [];
let testsStarted = false;
function test(name, fn) {
    testQueue.push({ name, fn });
    if (!testsStarted) {
        testsStarted = true;
        setImmediate(runTests);
    }
}
function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toBeGreaterThan(expected) {
            if (typeof actual !== 'number' || actual <= expected) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
        toBeDefined() {
            if (actual === undefined || actual === null) {
                throw new Error(`Expected value to be defined, got ${actual}`);
            }
        },
        toContain(expected) {
            if (typeof actual !== 'string' || !actual.includes(expected)) {
                throw new Error(`Expected "${actual}" to contain "${expected}"`);
            }
        },
        toHaveProperty(prop) {
            if (typeof actual !== 'object' || actual === null || !(prop in actual)) {
                throw new Error(`Expected object to have property "${prop}"`);
            }
        },
        toBeOneOf(options) {
            if (!options.includes(actual)) {
                throw new Error(`Expected ${JSON.stringify(actual)} to be one of ${JSON.stringify(options)}`);
            }
        },
    };
}
async function runTests() {
    console.log('\n' + '='.repeat(70));
    console.log('BUG-004: Performance Metrics Quality Tests');
    console.log('='.repeat(70) + '\n');
    for (const { name, fn } of testQueue) {
        try {
            await fn();
            testsPassed++;
            console.log(`✓ ${name}`);
        }
        catch (error) {
            testsFailed++;
            console.log(`✗ ${name}`);
            console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    console.log('\n' + '-'.repeat(70));
    console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('-'.repeat(70) + '\n');
    if (testsFailed > 0) {
        process.exit(1);
    }
}
// ============================================================================
// Test Data Factory
// ============================================================================
function createSprintSummary(overrides = {}) {
    const now = new Date();
    return {
        sprintId: `2026-01-20_test-sprint-${Math.random().toString(36).slice(2, 8)}`,
        status: 'completed',
        startedAt: new Date(now.getTime() - 3600000).toISOString(), // 1 hour ago
        completedAt: now.toISOString(),
        elapsed: '1h 0m',
        totalSteps: 10,
        completedSteps: 10,
        totalPhases: 3,
        completedPhases: 3,
        workflow: 'test-workflow',
        path: '/tmp/test-sprint',
        ...overrides,
    };
}
function createSprintSet(configs) {
    return configs.map((cfg, i) => {
        const startedAt = new Date(cfg.date);
        const completedAt = new Date(startedAt.getTime() + cfg.durationMs);
        return createSprintSummary({
            sprintId: `${cfg.date}_sprint-${i}`,
            status: cfg.status,
            startedAt: startedAt.toISOString(),
            completedAt: cfg.status === 'completed' ? completedAt.toISOString() : null,
        });
    });
}
// ============================================================================
// Tests for BUG-004: Metrics should provide actionable insights
// ============================================================================
// Test 1: Metrics should include health status indicator
test('AggregateMetrics should include sprint health status (healthy/warning/critical)', () => {
    const summaries = [
        createSprintSummary({ status: 'completed' }),
        createSprintSummary({ status: 'completed' }),
        createSprintSummary({ status: 'blocked' }), // 1 failed out of 3 = ~67% success
    ];
    const aggregator = new metrics_aggregator_js_1.MetricsAggregator(summaries);
    const metrics = aggregator.aggregate();
    // BUG: Current implementation doesn't calculate health status
    // Should have a healthStatus field: 'healthy' (>=80%), 'warning' (50-79%), 'critical' (<50%)
    expect(metrics).toHaveProperty('healthStatus');
    expect(metrics.healthStatus).toBeOneOf(['healthy', 'warning', 'critical']);
});
// Test 2: Metrics should include trend direction
test('AggregateMetrics should include success rate trend (improving/declining/stable)', () => {
    // Create sprints with declining success rate over time
    const summaries = createSprintSet([
        { status: 'completed', durationMs: 3600000, date: '2026-01-15T10:00:00Z' },
        { status: 'completed', durationMs: 3600000, date: '2026-01-16T10:00:00Z' },
        { status: 'blocked', durationMs: 3600000, date: '2026-01-17T10:00:00Z' },
        { status: 'blocked', durationMs: 3600000, date: '2026-01-18T10:00:00Z' },
        { status: 'blocked', durationMs: 3600000, date: '2026-01-19T10:00:00Z' },
    ]);
    const aggregator = new metrics_aggregator_js_1.MetricsAggregator(summaries);
    const metrics = aggregator.aggregate();
    // BUG: Current implementation doesn't analyze trends for direction
    expect(metrics).toHaveProperty('successRateTrend');
    expect(metrics.successRateTrend).toBeOneOf(['improving', 'declining', 'stable']);
});
// Test 3: Metrics should include duration anomaly detection
test('AggregateMetrics should flag duration anomalies', () => {
    // Create sprints with one anomalously long duration
    const summaries = [
        createSprintSummary({ startedAt: '2026-01-20T09:00:00Z', completedAt: '2026-01-20T09:30:00Z' }), // 30 min
        createSprintSummary({ startedAt: '2026-01-20T10:00:00Z', completedAt: '2026-01-20T10:25:00Z' }), // 25 min
        createSprintSummary({ startedAt: '2026-01-20T11:00:00Z', completedAt: '2026-01-20T11:35:00Z' }), // 35 min
        createSprintSummary({ startedAt: '2026-01-20T12:00:00Z', completedAt: '2026-01-20T16:00:00Z' }), // 4 hours! Anomaly!
    ];
    const aggregator = new metrics_aggregator_js_1.MetricsAggregator(summaries);
    const metrics = aggregator.aggregate();
    // BUG: Current implementation doesn't detect duration anomalies
    expect(metrics).toHaveProperty('durationAnomalies');
    expect(metrics.durationAnomalies).toBeGreaterThan(0);
});
// Test 4: Metrics should group by quality category
test('AggregateMetrics should provide categorized metrics (velocity, quality, efficiency)', () => {
    const summaries = [
        createSprintSummary({ status: 'completed', totalSteps: 15, completedSteps: 15 }),
        createSprintSummary({ status: 'completed', totalSteps: 12, completedSteps: 12 }),
        createSprintSummary({ status: 'blocked', totalSteps: 8, completedSteps: 4 }),
    ];
    const aggregator = new metrics_aggregator_js_1.MetricsAggregator(summaries);
    const metrics = aggregator.aggregate();
    // BUG: Current implementation doesn't categorize metrics
    // Should provide grouped views for different metric categories
    expect(metrics).toHaveProperty('categories');
    const categories = metrics.categories;
    expect(categories).toHaveProperty('velocity');
    expect(categories).toHaveProperty('quality');
    expect(categories).toHaveProperty('efficiency');
});
// Test 5: Metrics should include comparative context
test('AggregateMetrics should include period-over-period comparison', () => {
    // Create sprints over two weeks with different performance
    const summaries = [
        // Week 1 - 100% success
        ...createSprintSet([
            { status: 'completed', durationMs: 1800000, date: '2026-01-06T10:00:00Z' },
            { status: 'completed', durationMs: 2400000, date: '2026-01-07T10:00:00Z' },
            { status: 'completed', durationMs: 2100000, date: '2026-01-08T10:00:00Z' },
        ]),
        // Week 2 - 50% success (declining)
        ...createSprintSet([
            { status: 'completed', durationMs: 3600000, date: '2026-01-13T10:00:00Z' },
            { status: 'blocked', durationMs: 3600000, date: '2026-01-14T10:00:00Z' },
            { status: 'blocked', durationMs: 3600000, date: '2026-01-15T10:00:00Z' },
            { status: 'completed', durationMs: 3600000, date: '2026-01-16T10:00:00Z' },
        ]),
    ];
    const aggregator = new metrics_aggregator_js_1.MetricsAggregator(summaries);
    const metrics = aggregator.aggregate();
    // BUG: Current implementation doesn't provide period comparisons
    expect(metrics).toHaveProperty('comparison');
    const comparison = metrics.comparison;
    expect(comparison).toHaveProperty('successRateChange'); // e.g., -50 (percentage point drop)
    expect(comparison).toHaveProperty('durationChange'); // e.g., +50 (percent slower)
});
// Test 6: Metrics should highlight concerning values with severity
test('AggregateMetrics should flag metrics needing attention with severity levels', () => {
    // Create scenario with multiple concerning metrics
    const summaries = [
        createSprintSummary({ status: 'blocked' }),
        createSprintSummary({ status: 'blocked' }),
        createSprintSummary({ status: 'blocked' }),
        createSprintSummary({ status: 'completed' }), // Only 25% success rate - critical!
    ];
    const aggregator = new metrics_aggregator_js_1.MetricsAggregator(summaries);
    const metrics = aggregator.aggregate();
    // BUG: Current implementation doesn't identify metrics needing attention
    expect(metrics).toHaveProperty('alerts');
    const alerts = metrics.alerts;
    expect(Array.isArray(alerts)).toBe(true);
    // Should have at least one alert for the poor success rate
    const hasSuccessAlert = alerts.some((a) => a.metric === 'successRate' && a.severity === 'critical');
    expect(hasSuccessAlert).toBe(true);
});
// Test 7: Workflow metrics should include performance breakdown per workflow
test('AggregateMetrics workflowStats should include per-workflow success rates', () => {
    const summaries = [
        createSprintSummary({ workflow: 'build-feature', status: 'completed' }),
        createSprintSummary({ workflow: 'build-feature', status: 'completed' }),
        createSprintSummary({ workflow: 'build-feature', status: 'blocked' }), // 67% success
        createSprintSummary({ workflow: 'fix-bug', status: 'completed' }),
        createSprintSummary({ workflow: 'fix-bug', status: 'blocked' }),
        createSprintSummary({ workflow: 'fix-bug', status: 'blocked' }), // 33% success
    ];
    const aggregator = new metrics_aggregator_js_1.MetricsAggregator(summaries);
    const metrics = aggregator.aggregate();
    // BUG: Current workflowStats only has count/percentage, not success rate per workflow
    const buildFeatureStats = metrics.workflowStats.find(w => w.workflow === 'build-feature');
    expect(buildFeatureStats).toBeDefined();
    expect(buildFeatureStats).toHaveProperty('successRate');
    expect(buildFeatureStats.successRate).toBe(67); // 2/3 success
    const fixBugStats = metrics.workflowStats.find(w => w.workflow === 'fix-bug');
    expect(fixBugStats).toBeDefined();
    expect(fixBugStats).toHaveProperty('successRate');
    expect(fixBugStats.successRate).toBe(33); // 1/3 success
});
// Test 8: Daily trend should include success rate, not just counts
test('TrendDataPoint should include successRate percentage', () => {
    const summaries = createSprintSet([
        { status: 'completed', durationMs: 3600000, date: '2026-01-18T10:00:00Z' },
        { status: 'completed', durationMs: 3600000, date: '2026-01-18T11:00:00Z' },
        { status: 'blocked', durationMs: 3600000, date: '2026-01-18T12:00:00Z' },
        { status: 'completed', durationMs: 3600000, date: '2026-01-19T10:00:00Z' },
    ]);
    const aggregator = new metrics_aggregator_js_1.MetricsAggregator(summaries);
    const metrics = aggregator.aggregate();
    // BUG: Current TrendDataPoint has count/completed/failed but not calculated successRate
    const jan18 = metrics.dailyTrend.find(t => t.dateKey === '2026-01-18');
    expect(jan18).toBeDefined();
    expect(jan18).toHaveProperty('successRate');
    expect(jan18.successRate).toBe(67); // 2/3 success on Jan 18
});
// Test 9: Metrics should provide efficiency score (completed steps vs time)
test('AggregateMetrics should include efficiency metrics (steps per hour)', () => {
    // Sprint 1: 20 steps in 1 hour = 20 steps/hour
    // Sprint 2: 10 steps in 2 hours = 5 steps/hour
    const summaries = [
        createSprintSummary({
            startedAt: '2026-01-20T10:00:00Z',
            completedAt: '2026-01-20T11:00:00Z',
            totalSteps: 20,
            completedSteps: 20,
        }),
        createSprintSummary({
            startedAt: '2026-01-20T12:00:00Z',
            completedAt: '2026-01-20T14:00:00Z',
            totalSteps: 10,
            completedSteps: 10,
        }),
    ];
    const aggregator = new metrics_aggregator_js_1.MetricsAggregator(summaries);
    const metrics = aggregator.aggregate();
    // BUG: Current implementation doesn't calculate efficiency metrics
    expect(metrics).toHaveProperty('averageStepsPerHour');
    expect(metrics.averageStepsPerHour).toBeGreaterThan(0);
});
// Test 10: Summary insights for quick health assessment
test('AggregateMetrics should include actionable summary insights', () => {
    const summaries = [
        createSprintSummary({ status: 'completed' }),
        createSprintSummary({ status: 'blocked' }),
        createSprintSummary({ status: 'in-progress' }),
    ];
    const aggregator = new metrics_aggregator_js_1.MetricsAggregator(summaries);
    const metrics = aggregator.aggregate();
    // BUG: Current implementation doesn't provide summary insights
    expect(metrics).toHaveProperty('insights');
    const insights = metrics.insights;
    expect(Array.isArray(insights)).toBe(true);
    // Should provide at least one actionable insight
    expect(insights.length).toBeGreaterThan(0);
    // Each insight should have type and message
    const firstInsight = insights[0];
    expect(firstInsight).toHaveProperty('type');
    expect(firstInsight).toHaveProperty('message');
});
console.log('Loading metrics quality tests...');
//# sourceMappingURL=metrics-quality.test.js.map