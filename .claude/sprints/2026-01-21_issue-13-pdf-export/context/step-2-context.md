# Step Context: step-2

## Task
Step 3: Add visual progress chart to PDF.

Tasks:
- Generate visual chart showing sprint progress (e.g., pie chart, progress bar, or timeline)
- Chart should display: completed vs pending vs failed steps
- Consider adding timeline visualization if timestamps available
- Ensure chart renders cleanly in PDF format
- Use charting library compatible with PDF generation (e.g., chart.js with canvas, SVG-based)

Output: PDF now includes visual progress chart.

## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **Create progress-chart.ts module** - New file with SVG chart generation:
   - Export interfaces: `ChartData`, `ChartOptions`, `ChartSegment`, `TimelineEntry`
   - Export functions: `createProgressChart`, `createPieChart`, `createProgressBar`, `createTimelineChart`, `formatChartLabel`

2. **Implement SVG pie/donut chart** - `createPieChart(segments, options)`:
   - Generate SVG path elements for pie segments using arc calculations
   - Support color-coded segments for each status
   - Handle edge cases (single segment = full circle, zero total)

3. **Implement progress bar chart** - `createProgressBar(data, options)`:
   - Generate horizontal stacked bar segments as SVG rects
   - Calculate proportional widths based on status counts
   - Include percentage labels when showLabels is true

4. **Implement timeline chart** - `createTimelineChart(entries, options)`:
   - Generate Gantt-style timeline with phase bars
   - Use timestamps to calculate relative positions and widths
   - Color-code bars by phase status

5. **Add legend rendering** - Include in all chart types:
   - Color swatches with status labels
   - Show counts or percentages for each category

6. **Integrate with PDF generator** - Modify `createPdfDocument()`:
   - When `includeCharts: true`, generate and embed chart SVG
   - Use SVGtoPDF or raw SVG string embedding for PDFKit
   - Position chart in statistics section

## Related Code Patterns

### Pattern from: compiler/src/pdf/pdf-generator.ts (status colors)
```typescript
// Existing color palette to reuse
export function getStatusColor(status: PhaseStatus): string {
  const colors: Record<PhaseStatus, string> = {
    'completed': '#2E7D32',   // Green
    'in-progress': '#1565C0', // Blue
    'pending': '#757575',     // Gray
    'failed': '#C62828',      // Red
    'blocked': '#E65100',     // Orange
    'skipped': '#9E9E9E',     // Light gray
  };
  return colors[status] || '#000000';
}
```

### Pattern from: compiler/src/pdf/pdf-generator.ts (buffer-based PDF generation)
```typescript
// PDF generation returns a Promise<Buffer>
export async function createPdfDocument(
  progress: CompiledProgress,
  options: PdfOptions = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ ... });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    // ... render content ...
    doc.end();
  });
}
```

### Pattern from: shared-context.md (test infrastructure)
```typescript
// Test pattern using custom test harness
function test(name: string, fn: () => void | Promise<void>): void {
  testQueue.push({ name, fn });
  if (!testsStarted) {
    testsStarted = true;
    setImmediate(runTests);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
```

## Required Imports

### Internal
- `../types.js`: Import `PhaseStatus`, `CompiledProgress`, `CompiledTopPhase` types
- `./pdf-generator.js`: Import `getStatusColor`, `PdfOptions` for integration

### External
- `pdfkit`: Already available in pdf-generator.ts for PDF embedding
- No additional charting libraries needed - use pure SVG generation

## Types/Interfaces to Create

```typescript
// Input data for charts
export interface ChartData {
  completed: number;
  pending: number;
  failed: number;
  inProgress: number;
  blocked: number;
  skipped: number;
  total: number;
}

// Configuration options
export interface ChartOptions {
  width?: number;       // Default: 200
  height?: number;      // Default: 200
  showLegend?: boolean; // Default: true
  showLabels?: boolean; // Default: true
  type?: 'pie' | 'bar' | 'timeline'; // Default: 'pie'
}

// Individual chart segment
export interface ChartSegment {
  value: number;
  color: string;
  label: string;
}

// Timeline entry for Gantt-style chart
export interface TimelineEntry {
  id: string;
  label: string;
  startTime: string;  // ISO timestamp
  endTime: string;    // ISO timestamp
  status: PhaseStatus;
}
```

## Integration Points

### Called by:
- `createPdfDocument()` when `options.includeCharts === true`
- Direct usage for standalone chart generation

### Calls:
- `getStatusColor()` from pdf-generator.ts for consistent coloring

### Test file:
- `compiler/src/pdf/progress-chart.test.ts` - Contains 25 RED tests

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `compiler/src/pdf/progress-chart.ts` | Create | New module for SVG chart generation |
| `compiler/src/pdf/pdf-generator.ts` | Modify | Add chart integration when includeCharts=true |

## SVG Generation Approach

### Pie Chart SVG Structure
```xml
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Pie segments as arc paths -->
  <path d="M100,100 L100,10 A90,90 0 0,1 190,100 Z" fill="#2E7D32"/>
  <path d="M100,100 L190,100 A90,90 0 0,1 10,100 Z" fill="#757575"/>
  <!-- Legend items -->
  <rect x="10" y="160" width="12" height="12" fill="#2E7D32"/>
  <text x="26" y="171" font-size="10">Completed (5)</text>
</svg>
```

### Progress Bar SVG Structure
```xml
<svg viewBox="0 0 400 40" xmlns="http://www.w3.org/2000/svg">
  <!-- Stacked horizontal bars -->
  <rect x="0" y="0" width="200" height="30" fill="#2E7D32"/>   <!-- 50% completed -->
  <rect x="200" y="0" width="120" height="30" fill="#757575"/> <!-- 30% pending -->
  <rect x="320" y="0" width="80" height="30" fill="#C62828"/>  <!-- 20% failed -->
  <!-- Percentage labels -->
  <text x="100" y="20" fill="white" text-anchor="middle">50%</text>
</svg>
```

### Timeline SVG Structure
```xml
<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Timeline bars (Gantt-style) -->
  <rect x="0" y="10" width="100" height="20" fill="#2E7D32"/>
  <text x="5" y="24" font-size="10" fill="white">Setup</text>
  <rect x="100" y="10" width="150" height="20" fill="#2E7D32"/>
  <text x="105" y="24" font-size="10" fill="white">Implementation</text>
  <!-- Time scale axis -->
  <line x1="0" y1="40" x2="400" y2="40" stroke="#ccc"/>
</svg>
```

## Arc Path Calculation for Pie Chart

```typescript
// Calculate SVG arc path for a pie segment
function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', cx, cy,
    'L', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    'Z'
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDegrees: number) {
  const angleRadians = (angleDegrees - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(angleRadians),
    y: cy + radius * Math.sin(angleRadians)
  };
}
```

## PDF Integration Notes

### SVG Embedding in PDFKit
PDFKit supports SVG embedding via the `SVGtoPDF` library or manual path rendering. For simplicity, we can:

1. **Option A**: Use `svg-to-pdfkit` package (would need to add dependency)
2. **Option B**: Render chart as PNG using canvas, then embed image
3. **Option C**: Use PDFKit's native drawing API to recreate chart shapes

**Recommended**: Option C - Use PDFKit's native drawing since we control the SVG generation and can translate to PDFKit calls directly.

```typescript
// Example: Draw pie segment using PDFKit
doc.save()
   .moveTo(cx, cy)
   .lineTo(startX, startY)
   .arc(cx, cy, radius, startAngle, endAngle, false)
   .lineTo(cx, cy)
   .fill(color)
   .restore();
```

### Chart Positioning
- Place chart after Statistics section header
- Use DEFAULT_LAYOUT_CONFIG dimensions for sizing
- Chart width: 150px (pie) or 300px (bar/timeline)
- Add moveDown spacing after chart

## Test Verification Commands

```bash
# Build and run chart tests
cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/progress-chart.test.js

# Expected test patterns to pass:
# - "progress chart module exports" (Scenario 1)
# - "generates valid SVG" (Scenario 2)
# - "displays status categories" (Scenario 3)
# - "handles edge cases" (Scenario 4)
# - "includes legend" (Scenario 5)
# - "timeline with timestamps" (Scenario 6)
# - "PDF includes chart" (Scenario 7)
# - "progress bar renders" (Scenario 8)
```

## Color Palette Reference

| Status | Hex Code | Usage |
|--------|----------|-------|
| Completed | #2E7D32 | Green for success |
| In-progress | #1565C0 | Blue for active |
| Pending | #757575 | Gray for waiting |
| Failed | #C62828 | Red for errors |
| Blocked | #E65100 | Orange for blocked |
| Skipped | #9E9E9E | Light gray for skipped |

## Chart Dimensions

| Chart Type | Width | Height | Notes |
|------------|-------|--------|-------|
| Pie chart | 150 | 150 | Compact for sidebar |
| Progress bar | 400 | 40 | Horizontal span |
| Timeline | 400 | dynamic | Height based on phases |
| Legend | auto | auto | Auto-sized based on entries |
