# Step Context: step-1

## Task
Step 2: Implement core PDF export with sprint data.

Tasks:
- Create PDF template/layout for sprint summary
- Include sprint metadata (name, dates, status)
- Add step listing with status indicators
- Include timing information and completion percentages
- Format text content for readability (headers, sections, spacing)

Output: Basic PDF export that renders sprint text content.

## Implementation Plan
Based on gherkin scenarios and RED tests, implement in this order:

1. **Export helper functions** - Add new exported functions to pdf-generator.ts:
   - `getStatusIndicator(status: PhaseStatus)` - Returns Unicode status symbols
   - `getStatusColor(status: PhaseStatus)` - Returns hex color codes
   - `formatCompletionPercentage(completed: number, total: number)` - Returns percentage string

2. **Export layout configuration** - Add `DEFAULT_LAYOUT_CONFIG` constant with font sizes and spacing

3. **Enhance renderStats()** - Update to show completion percentages in statistics section

4. **Enhance renderPhase()** - Update to use status indicators and colors

5. **Enhance renderStep()** - Update to use status indicators, colors, and display errors

6. **Update renderSubPhase()** - Consistent styling with parent step

## Related Code Patterns

### Pattern from: compiler/src/pdf/pdf-generator.ts (existing render functions)
```typescript
// Current basic implementation uses simple text and moveDown for spacing
function renderPhase(doc: PDFKit.PDFDocument, phase: CompiledTopPhase): void {
  doc.fontSize(12).text(`${phase.id} [${phase.status}]`, { continued: false });

  if (phase.summary) {
    doc.fontSize(9).fillColor('gray').text(`Summary: ${phase.summary}`, { indent: 20 });
    doc.fillColor('black');
  }

  doc.moveDown(0.5);
}
```

### Pattern from: runtime/src/loop.ts (status constants)
```typescript
// Status values are consistent across the codebase
type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
```

## Required Imports

### Internal
- `../types.js`: Import `PhaseStatus` type for status indicator functions

### External
- `pdfkit`: Already imported, used for PDF generation

## Types/Interfaces to Use

### From types.ts
```typescript
// Status type for indicator/color functions
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';

// Already using these for data
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases?: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
}

export interface SprintStats {
  'started-at': string | null;
  'completed-at'?: string | null;
  'total-phases': number;
  'completed-phases': number;
  'total-steps'?: number;
  'completed-steps'?: number;
  elapsed?: string;
}
```

### New Types to Create
```typescript
// Layout configuration interface
export interface PdfLayoutConfig {
  titleFontSize: number;      // 24pt - Document title (H1)
  sectionFontSize: number;    // 16pt - Section headers (H2)
  phaseFontSize: number;      // 14pt - Phase headers (H3)
  stepFontSize: number;       // 12pt - Step headers
  bodyFontSize: number;       // 10pt - Body text
  metaFontSize: number;       // 9pt - Metadata/timing
  sectionSpacing: number;     // 1.5 - Line breaks between sections
  phaseSpacing: number;       // 1 - Line break between phases
  stepIndent: number;         // 20pt - Step indentation
  subPhaseIndent: number;     // 40pt - Sub-phase indentation
}
```

## Integration Points

### Called by:
- `createPdfDocument()` calls render functions internally
- External consumers call `createPdfDocument(progress, options)`

### Calls:
- `PDFDocument` from pdfkit for all PDF operations
- Types from `../types.js`

### Test file:
- `compiler/src/pdf/pdf-generator.test.ts` - Contains 40 tests (29 passing, 11 RED)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `compiler/src/pdf/pdf-generator.ts` | Modify | Add helper functions and enhance render functions |

## New Exports Required

Based on RED tests, these must be exported:

```typescript
// Status indicator function
export function getStatusIndicator(status: PhaseStatus): string {
  const indicators: Record<PhaseStatus, string> = {
    'completed': '\u2713',    // ✓ checkmark
    'in-progress': '\u25C9',  // ◉ filled circle
    'pending': '\u25CB',      // ○ empty circle
    'failed': '\u2717',       // ✗ x mark
    'blocked': '\u2298',      // ⊘ blocked symbol
    'skipped': '\u229D',      // ⊝ skipped symbol
  };
  return indicators[status] || '?';
}

// Status color function
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

// Percentage formatter
export function formatCompletionPercentage(completed: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((completed / total) * 100)}%`;
}

// Default layout configuration
export const DEFAULT_LAYOUT_CONFIG: PdfLayoutConfig = {
  titleFontSize: 24,
  sectionFontSize: 16,
  phaseFontSize: 14,
  stepFontSize: 12,
  bodyFontSize: 10,
  metaFontSize: 9,
  sectionSpacing: 1.5,
  phaseSpacing: 1,
  stepIndent: 20,
  subPhaseIndent: 40,
};
```

## Test Verification Commands

```bash
# Build and run tests
cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/pdf-generator.test.js

# Expected test patterns to pass:
# - "renders sprint header"
# - "renders sprint metadata"
# - "renders step status indicators"
# - "renders timing information"
# - "renders completion percentages"
# - "uses header hierarchy"
# - "uses proper spacing"
# - "renders failed step errors"
# - All RED tests for helper functions
```

## Implementation Notes

### Unicode Status Symbols
- `\u2713` = ✓ (checkmark) for completed
- `\u25C9` = ◉ (filled circle) for in-progress
- `\u25CB` = ○ (empty circle) for pending
- `\u2717` = ✗ (x mark) for failed
- `\u2298` = ⊘ (circle with diagonal) for blocked
- `\u229D` = ⊝ (circle with horizontal bar) for skipped

### Color Palette (Hex)
- Completed: `#2E7D32` (Green)
- In-progress: `#1565C0` (Blue)
- Pending: `#757575` (Gray)
- Failed: `#C62828` (Red)
- Blocked: `#E65100` (Orange)
- Skipped: `#9E9E9E` (Light Gray)

### PDFKit Usage Notes
- `doc.fillColor(hex)` sets text color
- `doc.fillColor('black')` resets to default
- `doc.fontSize(pt)` sets font size in points
- `doc.moveDown(n)` adds n line breaks
- `doc.text(str, { indent: pt })` indents from left margin
- Status indicators should be rendered inline before status text
