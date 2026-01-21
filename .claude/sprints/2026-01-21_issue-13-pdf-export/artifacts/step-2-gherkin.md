# Gherkin Scenarios: step-2

## Step Task
Step 3: Add visual progress chart to PDF.

Tasks:
- Generate visual chart showing sprint progress (e.g., pie chart, progress bar, or timeline)
- Chart should display: completed vs pending vs failed steps
- Consider adding timeline visualization if timestamps available
- Ensure chart renders cleanly in PDF format
- Use charting library compatible with PDF generation (e.g., chart.js with canvas, SVG-based)

Output: PDF now includes visual progress chart.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Progress chart module can be imported
```gherkin
Scenario: Progress chart module can be imported
  Given the progress-chart.ts module exists
  When I import the module
  Then the module should export createProgressChart function
  And the module should export ChartData interface
  And the module should export ChartOptions interface

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/progress-chart.test.js 2>&1 | grep -q 'progress chart module exports'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Progress chart generates SVG output
```gherkin
Scenario: Progress chart generates SVG output for PDF embedding
  Given sprint stats with completed, pending, and failed counts
  When I call createProgressChart with the stats
  Then the result should be a valid SVG string
  And the SVG should contain viewBox attribute
  And the SVG should contain chart elements (rect, circle, or path)

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/progress-chart.test.js 2>&1 | grep -q 'generates valid SVG'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Progress chart displays completed vs pending vs failed
```gherkin
Scenario: Progress chart displays all status categories
  Given sprint stats with completed=5, pending=3, failed=2
  When I generate a progress chart
  Then the chart should represent completed steps (green segment)
  And the chart should represent pending steps (gray segment)
  And the chart should represent failed steps (red segment)
  And the proportions should reflect the actual counts

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/progress-chart.test.js 2>&1 | grep -q 'displays status categories'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Progress chart handles edge cases
```gherkin
Scenario: Progress chart handles edge cases gracefully
  Given various edge case inputs
  When I generate a progress chart with zero steps
  Then the chart should render without errors
  When I generate a progress chart with all completed steps
  Then the chart should show 100% completed
  When I generate a progress chart with all failed steps
  Then the chart should show 100% failed

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/progress-chart.test.js 2>&1 | grep -q 'handles edge cases'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Progress chart includes legend
```gherkin
Scenario: Progress chart includes a legend
  Given sprint stats with multiple status categories
  When I generate a progress chart with showLegend option true
  Then the chart should include a legend section
  And the legend should show color-coded labels
  And the legend should show count or percentage for each category

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/progress-chart.test.js 2>&1 | grep -q 'includes legend'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Timeline visualization renders with timestamps
```gherkin
Scenario: Timeline visualization renders when timestamps are available
  Given phases with started-at and completed-at timestamps
  When I generate a timeline chart
  Then the timeline should show phase durations
  And the timeline should use proper time scale
  And each phase should be color-coded by status

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/progress-chart.test.js 2>&1 | grep -q 'timeline with timestamps'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: PDF integrates progress chart
```gherkin
Scenario: PDF generator integrates progress chart when includeCharts is true
  Given a CompiledProgress with sprint stats
  And PDF options with includeCharts set to true
  When I generate a PDF document
  Then the PDF should contain the progress chart
  And the chart should be positioned in the statistics section
  And the PDF should still be valid

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/progress-chart.test.js 2>&1 | grep -q 'PDF includes chart'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Progress bar alternative renders correctly
```gherkin
Scenario: Progress bar chart renders as an alternative to pie chart
  Given sprint stats with completion data
  When I generate a progress chart with type "bar"
  Then the chart should render as a horizontal progress bar
  And the bar should show segments for each status
  And the bar should have percentage labels

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/progress-chart.test.js 2>&1 | grep -q 'progress bar renders'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| compiler/src/pdf/progress-chart.test.ts | 25 (new) | 1, 2, 3, 4, 5, 6, 7, 8 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/compiler
npm run build && node dist/pdf/progress-chart.test.js
# Expected: FAIL (no implementation yet)
# All 25 tests should fail because progress-chart.ts doesn't exist
```

### New Functions to Implement (RED Tests)
1. `createProgressChart(data, options)` - Generates SVG chart from sprint data
2. `createPieChart(segments, options)` - Renders pie/donut chart
3. `createProgressBar(data, options)` - Renders horizontal progress bar
4. `createTimelineChart(phases, options)` - Renders timeline visualization
5. `formatChartLabel(value, total)` - Formats percentage labels

### Interfaces to Implement
1. `ChartData` - Input data structure for charts
2. `ChartOptions` - Configuration options for chart rendering
3. `ChartSegment` - Individual segment in pie/bar charts
4. `TimelineEntry` - Entry for timeline visualization

## Implementation Notes

### Chart Types
- **Pie/Donut Chart**: Primary visualization showing status distribution
- **Progress Bar**: Alternative horizontal bar showing completion
- **Timeline**: Optional visualization when timestamps are available

### Color Scheme (matches status colors)
- Completed: Green (#2E7D32)
- In-progress: Blue (#1565C0)
- Pending: Gray (#757575)
- Failed: Red (#C62828)
- Blocked: Orange (#E65100)
- Skipped: Light Gray (#9E9E9E)

### SVG Generation Approach
- Pure TypeScript/JavaScript SVG generation (no external charting library needed)
- Output is SVG string that can be embedded in PDF via PDFKit's SVG support
- Fixed dimensions optimized for PDF page layout (e.g., 200x200 for pie chart)

### PDF Integration
- Chart appears in Statistics section when `includeCharts: true`
- Uses PDFKit's SVGtoPDF or embedded SVG support
- Falls back gracefully if SVG rendering fails

### Chart Dimensions
- Pie chart: 150x150 pixels
- Progress bar: 400x40 pixels
- Timeline: 400x (dynamic based on phases)
- Legend: Auto-sized based on content
