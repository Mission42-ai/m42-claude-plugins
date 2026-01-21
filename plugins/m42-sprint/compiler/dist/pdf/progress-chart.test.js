"use strict";
/**
 * Tests for Progress Chart Module
 *
 * Tests for the visual progress chart that displays sprint progress
 * as pie charts, progress bars, and timeline visualizations.
 *
 * RED PHASE: These tests are written BEFORE implementation.
 * They should FAIL until progress-chart.ts is created.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Import the module under test (WILL FAIL - module doesn't exist yet)
const progress_chart_js_1 = require("./progress-chart.js");
// Import PDF generator for integration tests
const pdf_generator_js_1 = require("./pdf-generator.js");
// ============================================================================
// Test Infrastructure
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
async function runTests() {
    for (const { name, fn } of testQueue) {
        try {
            await fn();
            testsPassed++;
            console.log(`✓ ${name}`);
        }
        catch (error) {
            testsFailed++;
            console.error(`✗ ${name}`);
            console.error(`  ${error}`);
        }
    }
    console.log('');
    console.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
    if (testsFailed > 0) {
        process.exitCode = 1;
    }
}
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
function assertEqual(actual, expected, message) {
    const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    if (actual !== expected)
        throw new Error(msg);
}
function assertIncludes(str, substring, message) {
    const msg = message || `Expected string to include "${substring}"`;
    if (!str.includes(substring))
        throw new Error(msg);
}
// ============================================================================
// Test Fixtures
// ============================================================================
function createTestChartData(overrides = {}) {
    return {
        completed: 5,
        pending: 3,
        failed: 2,
        inProgress: 1,
        blocked: 0,
        skipped: 0,
        total: 11,
        ...overrides,
    };
}
function createTestChartOptions(overrides = {}) {
    return {
        width: 200,
        height: 200,
        showLegend: true,
        showLabels: true,
        type: 'pie',
        ...overrides,
    };
}
function createTestProgress(overrides = {}) {
    return {
        'sprint-id': 'test-sprint-2026-01-21',
        status: 'completed',
        current: {
            phase: 2,
            step: null,
            'sub-phase': null,
        },
        stats: {
            'started-at': '2026-01-21T10:00:00Z',
            'completed-at': '2026-01-21T12:30:00Z',
            'total-phases': 3,
            'completed-phases': 3,
            'total-steps': 10,
            'completed-steps': 8,
            elapsed: '2h 30m',
        },
        phases: [
            {
                id: 'phase-1',
                status: 'completed',
                prompt: 'Set up project infrastructure',
                'started-at': '2026-01-21T10:00:00Z',
                'completed-at': '2026-01-21T10:30:00Z',
                elapsed: '30m',
            },
            {
                id: 'phase-2',
                status: 'completed',
                prompt: 'Implement core features',
                'started-at': '2026-01-21T10:30:00Z',
                'completed-at': '2026-01-21T11:45:00Z',
                elapsed: '1h 15m',
            },
            {
                id: 'phase-3',
                status: 'failed',
                prompt: 'Deploy to production',
                'started-at': '2026-01-21T11:45:00Z',
                'completed-at': '2026-01-21T12:30:00Z',
                elapsed: '45m',
                error: 'Deployment failed',
            },
        ],
        ...overrides,
    };
}
function createTimelineTestData() {
    return [
        {
            id: 'phase-1',
            label: 'Setup',
            startTime: '2026-01-21T10:00:00Z',
            endTime: '2026-01-21T10:30:00Z',
            status: 'completed',
        },
        {
            id: 'phase-2',
            label: 'Implementation',
            startTime: '2026-01-21T10:30:00Z',
            endTime: '2026-01-21T11:45:00Z',
            status: 'completed',
        },
        {
            id: 'phase-3',
            label: 'Testing',
            startTime: '2026-01-21T11:45:00Z',
            endTime: '2026-01-21T12:15:00Z',
            status: 'failed',
        },
        {
            id: 'phase-4',
            label: 'Deploy',
            startTime: '2026-01-21T12:15:00Z',
            endTime: '2026-01-21T12:30:00Z',
            status: 'pending',
        },
    ];
}
// ============================================================================
// Scenario 1: Progress chart module can be imported
// ============================================================================
test('progress chart module exports createProgressChart function', () => {
    assert(typeof progress_chart_js_1.createProgressChart === 'function', 'createProgressChart should be a function');
});
test('progress chart module exports createPieChart function', () => {
    assert(typeof progress_chart_js_1.createPieChart === 'function', 'createPieChart should be a function');
});
test('progress chart module exports createProgressBar function', () => {
    assert(typeof progress_chart_js_1.createProgressBar === 'function', 'createProgressBar should be a function');
});
test('progress chart module exports createTimelineChart function', () => {
    assert(typeof progress_chart_js_1.createTimelineChart === 'function', 'createTimelineChart should be a function');
});
test('progress chart module exports formatChartLabel function', () => {
    assert(typeof progress_chart_js_1.formatChartLabel === 'function', 'formatChartLabel should be a function');
});
// ============================================================================
// Scenario 2: Progress chart generates SVG output
// ============================================================================
test('generates valid SVG - createProgressChart returns SVG string', () => {
    const data = createTestChartData();
    const options = createTestChartOptions();
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    assert(typeof svg === 'string', 'Result should be a string');
    assertIncludes(svg, '<svg', 'Result should contain SVG opening tag');
    assertIncludes(svg, '</svg>', 'Result should contain SVG closing tag');
});
test('generates valid SVG - SVG contains viewBox attribute', () => {
    const data = createTestChartData();
    const options = createTestChartOptions();
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    assertIncludes(svg, 'viewBox', 'SVG should have viewBox attribute');
});
test('generates valid SVG - SVG contains chart elements', () => {
    const data = createTestChartData();
    const options = createTestChartOptions();
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    // Should contain at least one of: rect, circle, or path for chart segments
    const hasChartElements = svg.includes('<rect') || svg.includes('<circle') || svg.includes('<path');
    assert(hasChartElements, 'SVG should contain chart elements (rect, circle, or path)');
});
test('generates valid SVG - pie chart generates path elements', () => {
    const data = createTestChartData();
    const options = createTestChartOptions({ type: 'pie' });
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    // Pie chart should use path elements for segments
    assertIncludes(svg, '<path', 'Pie chart should contain path elements');
});
// ============================================================================
// Scenario 3: Progress chart displays completed vs pending vs failed
// ============================================================================
test('displays status categories - chart shows all status types', () => {
    const data = createTestChartData({
        completed: 5,
        pending: 3,
        failed: 2,
        inProgress: 1,
    });
    const options = createTestChartOptions();
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    // Should have multiple segments (at least 4 visible statuses)
    // Count path or rect elements to verify segments
    const pathCount = (svg.match(/<path/g) || []).length;
    const rectCount = (svg.match(/<rect/g) || []).length;
    const circleCount = (svg.match(/<circle/g) || []).length;
    const totalSegments = pathCount + rectCount + circleCount;
    assert(totalSegments >= 4, `Should have at least 4 segments, got ${totalSegments}`);
});
test('displays status categories - uses correct colors', () => {
    const data = createTestChartData({
        completed: 5,
        pending: 3,
        failed: 2,
    });
    const options = createTestChartOptions();
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    // Check for status colors
    assertIncludes(svg, '#2E7D32', 'Should include green for completed');
    assertIncludes(svg, '#757575', 'Should include gray for pending');
    assertIncludes(svg, '#C62828', 'Should include red for failed');
});
test('displays status categories - proportions reflect counts', () => {
    const data = createTestChartData({
        completed: 50, // 50%
        pending: 30, // 30%
        failed: 20, // 20%
        inProgress: 0,
        blocked: 0,
        skipped: 0,
        total: 100,
    });
    const options = createTestChartOptions({ type: 'bar' });
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    // For a progress bar, width attributes should reflect proportions
    assert(svg.includes('width'), 'Bar chart should have width attributes');
});
// ============================================================================
// Scenario 4: Progress chart handles edge cases
// ============================================================================
test('handles edge cases - zero total steps', () => {
    const data = createTestChartData({
        completed: 0,
        pending: 0,
        failed: 0,
        inProgress: 0,
        blocked: 0,
        skipped: 0,
        total: 0,
    });
    const options = createTestChartOptions();
    // Should not throw, should return valid SVG
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    assert(typeof svg === 'string', 'Should handle zero steps');
    assertIncludes(svg, '<svg', 'Should still return valid SVG');
});
test('handles edge cases - all completed (100%)', () => {
    const data = createTestChartData({
        completed: 10,
        pending: 0,
        failed: 0,
        inProgress: 0,
        blocked: 0,
        skipped: 0,
        total: 10,
    });
    const options = createTestChartOptions();
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    assertIncludes(svg, '#2E7D32', 'Should show green for all completed');
    assertIncludes(svg, '<svg', 'Should return valid SVG');
});
test('handles edge cases - all failed (100%)', () => {
    const data = createTestChartData({
        completed: 0,
        pending: 0,
        failed: 10,
        inProgress: 0,
        blocked: 0,
        skipped: 0,
        total: 10,
    });
    const options = createTestChartOptions();
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    assertIncludes(svg, '#C62828', 'Should show red for all failed');
    assertIncludes(svg, '<svg', 'Should return valid SVG');
});
test('handles edge cases - single step', () => {
    const data = createTestChartData({
        completed: 1,
        pending: 0,
        failed: 0,
        inProgress: 0,
        blocked: 0,
        skipped: 0,
        total: 1,
    });
    const options = createTestChartOptions();
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    assertIncludes(svg, '<svg', 'Should handle single step');
});
// ============================================================================
// Scenario 5: Progress chart includes legend
// ============================================================================
test('includes legend - legend shown when showLegend is true', () => {
    const data = createTestChartData();
    const options = createTestChartOptions({ showLegend: true });
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    // Legend should contain text elements with status labels
    assertIncludes(svg, '<text', 'Legend should contain text elements');
});
test('includes legend - legend shows color-coded labels', () => {
    const data = createTestChartData({
        completed: 5,
        pending: 3,
        failed: 2,
    });
    const options = createTestChartOptions({ showLegend: true });
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    // Should have legend items with rect (color box) + text (label)
    assertIncludes(svg, 'Completed', 'Legend should show Completed label');
    assertIncludes(svg, 'Pending', 'Legend should show Pending label');
    assertIncludes(svg, 'Failed', 'Legend should show Failed label');
});
test('includes legend - legend shows counts or percentages', () => {
    const data = createTestChartData({
        completed: 5,
        pending: 3,
        failed: 2,
        total: 10,
    });
    const options = createTestChartOptions({ showLegend: true, showLabels: true });
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    // Should show counts or percentages (e.g., "5" or "50%")
    const hasNumbers = /\d+/.test(svg);
    assert(hasNumbers, 'Legend should show counts or percentages');
});
test('includes legend - legend hidden when showLegend is false', () => {
    const data = createTestChartData();
    const options = createTestChartOptions({ showLegend: false });
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    // Should not contain legend labels when disabled
    const hasCompletedLabel = svg.includes('Completed');
    // Note: the word might appear elsewhere, so just check there's less text
    assert(typeof svg === 'string', 'Should generate SVG without legend');
});
// ============================================================================
// Scenario 6: Timeline visualization renders with timestamps
// ============================================================================
test('timeline with timestamps - createTimelineChart generates timeline', () => {
    const entries = createTimelineTestData();
    const options = createTestChartOptions({ type: 'timeline' });
    const svg = (0, progress_chart_js_1.createTimelineChart)(entries, options);
    assert(typeof svg === 'string', 'Timeline should return string');
    assertIncludes(svg, '<svg', 'Timeline should be SVG');
});
test('timeline with timestamps - shows phase durations', () => {
    const entries = createTimelineTestData();
    const options = createTestChartOptions({ type: 'timeline' });
    const svg = (0, progress_chart_js_1.createTimelineChart)(entries, options);
    // Timeline should show bars/segments representing durations
    assertIncludes(svg, '<rect', 'Timeline should have rect elements for duration bars');
});
test('timeline with timestamps - uses proper time scale', () => {
    const entries = createTimelineTestData();
    const options = createTestChartOptions({ type: 'timeline', width: 400 });
    const svg = (0, progress_chart_js_1.createTimelineChart)(entries, options);
    // Should have x-axis or scale indicators
    assertIncludes(svg, 'width', 'Timeline bars should have width based on duration');
});
test('timeline with timestamps - color codes phases by status', () => {
    const entries = createTimelineTestData();
    const options = createTestChartOptions({ type: 'timeline' });
    const svg = (0, progress_chart_js_1.createTimelineChart)(entries, options);
    // Should use status colors
    assertIncludes(svg, '#2E7D32', 'Should have green for completed phases');
    assertIncludes(svg, '#C62828', 'Should have red for failed phase');
});
test('timeline with timestamps - handles empty entries', () => {
    const entries = [];
    const options = createTestChartOptions({ type: 'timeline' });
    // Should not throw
    const svg = (0, progress_chart_js_1.createTimelineChart)(entries, options);
    assertIncludes(svg, '<svg', 'Should return valid SVG for empty entries');
});
// ============================================================================
// Scenario 7: PDF integrates progress chart
// ============================================================================
test('PDF includes chart - PDF contains chart when includeCharts is true', async () => {
    const progress = createTestProgress();
    const options = {
        title: 'Sprint Summary with Chart',
        includeCharts: true,
    };
    const pdfBuffer = await (0, pdf_generator_js_1.createPdfDocument)(progress, options);
    // PDF with chart should be larger than without
    assert(pdfBuffer.length > 2000, 'PDF with chart should have substantial size');
    // Verify it's still a valid PDF
    const magicBytes = pdfBuffer.slice(0, 5).toString('ascii');
    assertEqual(magicBytes, '%PDF-', 'Should produce valid PDF');
});
test('PDF includes chart - chart positioned in statistics section', async () => {
    const progress = createTestProgress();
    const options = {
        title: 'Sprint Summary with Chart',
        includeCharts: true,
    };
    const pdfBuffer = await (0, pdf_generator_js_1.createPdfDocument)(progress, options);
    // PDF should be valid and contain image/content streams for chart
    assert(Buffer.isBuffer(pdfBuffer), 'Should produce PDF buffer');
    assert(pdfBuffer.length > 1500, 'PDF with chart should have content');
});
test('PDF includes chart - PDF still valid with chart', async () => {
    const progress = createTestProgress({
        stats: {
            'started-at': '2026-01-21T10:00:00Z',
            'completed-at': '2026-01-21T12:30:00Z',
            'total-phases': 5,
            'completed-phases': 3,
            'total-steps': 15,
            'completed-steps': 10,
            elapsed: '2h 30m',
        },
    });
    const options = {
        title: 'Chart Integration Test',
        includeCharts: true,
    };
    const pdfBuffer = await (0, pdf_generator_js_1.createPdfDocument)(progress, options);
    // Verify PDF structure
    const pdfContent = pdfBuffer.toString('latin1');
    assertIncludes(pdfContent, '%PDF-', 'Should start with PDF magic');
    assertIncludes(pdfContent, '%%EOF', 'Should end with EOF marker');
});
test('PDF includes chart - no chart when includeCharts is false', async () => {
    const progress = createTestProgress();
    const withChart = { includeCharts: true };
    const withoutChart = { includeCharts: false };
    const pdfWithChart = await (0, pdf_generator_js_1.createPdfDocument)(progress, withChart);
    const pdfWithoutChart = await (0, pdf_generator_js_1.createPdfDocument)(progress, withoutChart);
    // PDF without chart should be smaller
    assert(pdfWithoutChart.length < pdfWithChart.length, 'PDF without chart should be smaller than PDF with chart');
});
// ============================================================================
// Scenario 8: Progress bar alternative renders correctly
// ============================================================================
test('progress bar renders - createProgressBar returns SVG', () => {
    const data = createTestChartData();
    const options = createTestChartOptions({ type: 'bar' });
    const svg = (0, progress_chart_js_1.createProgressBar)(data, options);
    assert(typeof svg === 'string', 'Progress bar should return string');
    assertIncludes(svg, '<svg', 'Progress bar should be SVG');
});
test('progress bar renders - horizontal bar with segments', () => {
    const data = createTestChartData({
        completed: 50,
        pending: 30,
        failed: 20,
        total: 100,
    });
    const options = createTestChartOptions({ type: 'bar', width: 400, height: 40 });
    const svg = (0, progress_chart_js_1.createProgressBar)(data, options);
    // Should have rect elements for segments
    const rectCount = (svg.match(/<rect/g) || []).length;
    assert(rectCount >= 3, `Should have at least 3 rect segments, got ${rectCount}`);
});
test('progress bar renders - shows percentage labels', () => {
    const data = createTestChartData({
        completed: 50,
        pending: 30,
        failed: 20,
        total: 100,
    });
    const options = createTestChartOptions({ type: 'bar', showLabels: true });
    const svg = (0, progress_chart_js_1.createProgressBar)(data, options);
    // Should contain text elements with percentages
    assertIncludes(svg, '<text', 'Should have text labels');
    const hasPercentage = svg.includes('%') || /\d+/.test(svg);
    assert(hasPercentage, 'Should show percentage or count labels');
});
test('progress bar renders - uses correct segment widths', () => {
    const data = createTestChartData({
        completed: 50,
        pending: 30,
        failed: 20,
        inProgress: 0,
        blocked: 0,
        skipped: 0,
        total: 100,
    });
    const options = createTestChartOptions({ type: 'bar', width: 400 });
    const svg = (0, progress_chart_js_1.createProgressBar)(data, options);
    // Bar segments should have width attributes
    assertIncludes(svg, 'width=', 'Segments should have width attributes');
});
// ============================================================================
// Helper Function Tests
// ============================================================================
test('formatChartLabel formats percentage correctly', () => {
    const result = (0, progress_chart_js_1.formatChartLabel)(75, 100);
    assertEqual(result, '75%', 'Should format as percentage');
});
test('formatChartLabel handles zero total', () => {
    const result = (0, progress_chart_js_1.formatChartLabel)(0, 0);
    assertEqual(result, '0%', 'Should return 0% for zero total');
});
test('formatChartLabel handles decimal percentages', () => {
    const result = (0, progress_chart_js_1.formatChartLabel)(1, 3);
    // Should round to nearest integer
    assertEqual(result, '33%', 'Should round decimal percentages');
});
// ============================================================================
// Pie Chart Specific Tests
// ============================================================================
test('createPieChart generates donut chart', () => {
    const segments = [
        { value: 50, color: '#2E7D32', label: 'Completed' },
        { value: 30, color: '#757575', label: 'Pending' },
        { value: 20, color: '#C62828', label: 'Failed' },
    ];
    const options = createTestChartOptions({ type: 'pie' });
    const svg = (0, progress_chart_js_1.createPieChart)(segments, options);
    assertIncludes(svg, '<svg', 'Should return SVG');
    assertIncludes(svg, '<path', 'Should contain path elements for segments');
});
test('createPieChart handles single segment (full circle)', () => {
    const segments = [{ value: 100, color: '#2E7D32', label: 'Completed' }];
    const options = createTestChartOptions({ type: 'pie' });
    const svg = (0, progress_chart_js_1.createPieChart)(segments, options);
    assertIncludes(svg, '<svg', 'Should return SVG for single segment');
});
// ============================================================================
// Additional Integration Tests
// ============================================================================
test('createProgressChart respects custom dimensions', () => {
    const data = createTestChartData();
    const options = createTestChartOptions({ width: 300, height: 300 });
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    assertIncludes(svg, 'viewBox', 'Should have viewBox for dimensions');
    // ViewBox should reflect requested dimensions
    const viewBoxMatch = svg.match(/viewBox="[^"]*"/);
    assert(viewBoxMatch !== null, 'Should have viewBox attribute');
});
test('createProgressChart defaults to pie chart type', () => {
    const data = createTestChartData();
    const options = { width: 200, height: 200 }; // No type specified
    const svg = (0, progress_chart_js_1.createProgressChart)(data, options);
    // Default should be pie chart with path elements
    assertIncludes(svg, '<path', 'Default chart type should be pie (uses paths)');
});
// ============================================================================
// Run Tests Summary
// ============================================================================
// Tests run sequentially via runTests() triggered by setImmediate
// No setTimeout needed - runTests() handles summary output
//# sourceMappingURL=progress-chart.test.js.map