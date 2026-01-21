# Gherkin Scenarios: step-1

## Step Task
Step 2: Implement core PDF export with sprint data.

Tasks:
- Create PDF template/layout for sprint summary
- Include sprint metadata (name, dates, status)
- Add step listing with status indicators
- Include timing information and completion percentages
- Format text content for readability (headers, sections, spacing)

Output: Basic PDF export that renders sprint text content.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: PDF includes sprint header with title and ID
```gherkin
Scenario: PDF includes sprint header with title and ID
  Given a CompiledProgress with sprint-id "sprint-2026-01-21-pdf-export"
  When I generate a PDF with title "Sprint Summary Report"
  Then the PDF should contain a header section
  And the header should display the sprint ID
  And the header should display the document title

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/pdf-generator.test.js 2>&1 | grep -q 'renders sprint header'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: PDF includes sprint metadata section
```gherkin
Scenario: PDF includes sprint metadata section with dates and status
  Given a CompiledProgress with status "completed"
  And started-at "2026-01-21T10:00:00Z"
  And completed-at "2026-01-21T14:30:00Z"
  When I generate a PDF
  Then the PDF should include a metadata section
  And the section should show sprint status
  And the section should show start date/time
  And the section should show completion date/time

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/pdf-generator.test.js 2>&1 | grep -q 'renders sprint metadata'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: PDF includes step listing with status indicators
```gherkin
Scenario: PDF includes step listing with visual status indicators
  Given a CompiledProgress with a development phase
  And the phase has 3 steps with statuses "completed", "in-progress", "pending"
  When I generate a PDF
  Then the PDF should list all steps
  And each step should have a status indicator
  And completed steps should show a checkmark or "✓"
  And in-progress steps should show a progress indicator
  And pending steps should show a pending indicator

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/pdf-generator.test.js 2>&1 | grep -q 'renders step status indicators'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: PDF includes timing information for phases and steps
```gherkin
Scenario: PDF includes timing information for phases and steps
  Given a CompiledProgress with phases that have elapsed times
  And step-0 has elapsed "15m"
  And step-1 has elapsed "45m"
  When I generate a PDF
  Then the PDF should show elapsed time for each phase
  And the PDF should show elapsed time for each step

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/pdf-generator.test.js 2>&1 | grep -q 'renders timing information'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: PDF includes completion percentages
```gherkin
Scenario: PDF includes completion percentages in statistics
  Given a CompiledProgress with total-phases 4 and completed-phases 3
  And total-steps 10 and completed-steps 7
  When I generate a PDF
  Then the PDF should show phase completion percentage (75%)
  And the PDF should show step completion percentage (70%)

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/pdf-generator.test.js 2>&1 | grep -q 'renders completion percentages'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: PDF uses proper header formatting
```gherkin
Scenario: PDF uses proper header hierarchy for readability
  Given a CompiledProgress with multiple phases
  When I generate a PDF
  Then the document title should use large font (H1 style)
  And section headers should use medium font (H2 style)
  And phase headers should use smaller font (H3 style)
  And body text should use readable standard font

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/pdf-generator.test.js 2>&1 | grep -q 'uses header hierarchy'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: PDF sections have proper spacing
```gherkin
Scenario: PDF sections have proper spacing for readability
  Given a CompiledProgress with multiple phases and steps
  When I generate a PDF
  Then there should be spacing between sections
  And there should be spacing between phases
  And there should be indentation for nested content

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/pdf-generator.test.js 2>&1 | grep -q 'uses proper spacing'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: PDF handles failed and blocked steps
```gherkin
Scenario: PDF displays error information for failed steps
  Given a CompiledProgress with a phase containing failed steps
  And step-2 has status "failed" with error "Test failure"
  When I generate a PDF
  Then failed steps should be visually distinct (red or marked)
  And error messages should be displayed for failed steps

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/pdf-generator.test.js 2>&1 | grep -q 'renders failed step errors'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| compiler/src/pdf/pdf-generator.test.ts | 16 (existing) + 24 (new) = 40 total | 1, 2, 3, 4, 5, 6, 7, 8 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/compiler
npm run build && node dist/pdf/pdf-generator.test.js
# Expected output:
# Tests completed: 29 passed, 11 failed
# (11 RED tests for new functionality, 29 existing tests still pass)
```

### New Functions to Implement (RED Tests)
1. `getStatusIndicator(status)` - Returns visual symbols (✓ ◉ ○ ✗ ⊘ ⊝)
2. `formatCompletionPercentage(completed, total)` - Returns formatted percentage string
3. `getStatusColor(status)` - Returns hex color code for status
4. `DEFAULT_LAYOUT_CONFIG` - Exported layout configuration object

## Implementation Notes

### Status Indicators
- ✓ (checkmark) for completed
- ◉ (filled circle) for in-progress
- ○ (empty circle) for pending
- ✗ (x mark) for failed
- ⊘ (blocked symbol) for blocked
- ⊝ (skipped symbol) for skipped

### Font Sizes (points)
- Document title (H1): 24pt
- Section headers (H2): 16pt
- Phase headers (H3): 14pt
- Step headers: 12pt
- Body text: 10pt
- Metadata/timing: 9pt

### Spacing
- Section spacing: 1.5 line breaks
- Phase spacing: 1 line break
- Step indentation: 20pt from left
- Sub-phase indentation: 40pt from left

### Colors
- Completed: Green (#2E7D32)
- In-progress: Blue (#1565C0)
- Pending: Gray (#757575)
- Failed: Red (#C62828)
- Blocked: Orange (#E65100)
