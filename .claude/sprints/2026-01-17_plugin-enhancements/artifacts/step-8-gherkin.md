# Gherkin Scenarios: step-8

## Step Task
Phase 3 - Step 3: Enhance Log Viewer

Improve the log viewer with line numbers, search navigation, and jump to error.

Requirements:
- Add line numbers column to log display (fixed width, right-aligned)
- Implement search within logs:
  - Search input field at top of log viewer
  - Highlight all matches in log content
  - "Next" and "Previous" buttons to navigate between matches
  - Show match count (e.g., "3 of 12 matches")
- Add "Jump to Error" button that scrolls to first error/failure line
- Error lines should be highlighted with red background
- Preserve line number visibility when scrolling horizontally

Verification:
- Open a log with errors, verify line numbers display
- Search for a term, verify highlighting and navigation
- Click "Jump to Error", verify scroll to error line

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Line numbers column HTML structure exists
  Given the log viewer HTML is generated in page.ts
  When I check for line number container elements
  Then the HTML includes a line numbers column element

Verification: `grep -q 'log-line-numbers\|line-number-col\|line-numbers' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Line numbers CSS styling exists
  Given the page.ts file contains CSS styles
  When I check for line number styling rules
  Then CSS rules for fixed-width right-aligned line numbers exist

Verification: `grep -E '\.log-line-number|line-number.*\{' plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q 'text-align.*right\|width.*ch\|position.*sticky'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Search navigation buttons exist
  Given the log viewer HTML is generated
  When I check for search navigation elements
  Then Next and Previous navigation buttons are present

Verification: `grep -E 'log-search-prev|log-search-next|search.*prev|search.*next' plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE 'button|btn'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Match count display element exists
  Given the log viewer HTML includes search functionality
  When I check for match count display
  Then an element showing current match and total count exists

Verification: `grep -qE 'match-count|search-count|search-results-count|of.*matches' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Jump to Error button exists
  Given the log viewer has error navigation
  When I check for jump to error functionality
  Then a Jump to Error button is present in the log viewer controls

Verification: `grep -qiE 'jump.*error|jumpToError|jump-to-error|scroll.*error' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Error line highlighting CSS exists
  Given the page.ts contains CSS for log viewing
  When I check for error line highlighting styles
  Then CSS rules with red background for error lines exist

Verification: `grep -E 'log-line.*error|error-line|\.log.*error' plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE 'background.*red\|#da3633\|#f85149\|rgba.*255.*0.*0'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Search navigation JavaScript functions exist
  Given the page.ts contains JavaScript for log viewer
  When I check for navigation function implementations
  Then functions for next/previous match navigation are implemented

Verification: `grep -qE 'function.*(navigateToNextMatch|navigateToPrevMatch|nextMatch|prevMatch|goToNextMatch|goToPrevMatch)' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: TypeScript compiles without errors
  Given all log viewer enhancements are implemented in page.ts
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0

---

## Notes

### Line Numbers Implementation
The line numbers column should:
- Be a fixed-width column (e.g., 4-5ch wide)
- Display numbers right-aligned
- Use `position: sticky; left: 0` to remain visible during horizontal scroll
- Have a distinct background color to separate from log content

### Search Navigation
The search implementation should:
- Maintain state of current match index
- Update "X of Y matches" display when navigating
- Scroll the matched element into view when navigating
- Wrap around (last→first, first→last) or disable buttons at boundaries

### Error Detection
Error lines should be detected by patterns like:
- Lines containing "error", "Error", "ERROR"
- Lines containing "failed", "Failed", "FAILED"
- Lines with ANSI red color codes
- Lines starting with common error prefixes
