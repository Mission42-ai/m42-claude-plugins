# Gherkin Scenarios: step-6

## Step Task
Phase 3 - Step 1: Implement Keyboard Shortcuts

Add keyboard navigation for common actions in the status page.

Requirements:
- Add global keydown event listener
- Implement shortcuts:
  - `P` - Pause/Resume sprint (toggle based on current state)
  - `L` - Toggle live activity panel visibility
  - `N` - Open notification settings modal
  - `D` - Download all logs (trigger download-all-logs action)
  - `Esc` - Close any open modals
  - `?` - Show keyboard shortcuts help modal
- Create shortcuts help modal with list of all shortcuts
- Ignore shortcuts when typing in input fields
- Add visual hints in UI (e.g., underline P in Pause button)

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Global keydown event listener is registered
Given the page.ts file contains the getScript function
When I check for a global keydown event listener
Then a document-level keydown listener is registered for keyboard shortcuts

Verification: `grep -qE "document\\.addEventListener\\(['\"]keydown['\"]" plugins/m42-sprint/compiler/src/status-server/page.ts && grep -qE "(handleKeyboardShortcut|handleGlobalKeydown|setupKeyboardShortcuts)" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: All required keyboard shortcuts are implemented
Given the keydown event listener is set up
When I check for each required shortcut key handler
Then handlers for P, L, N, D, Escape, and ? keys exist

Verification: `grep -qE "key.*===.*['\"]p['\"]|key.*===.*['\"]P['\"]|toLowerCase\\(\\).*===.*['\"]p['\"]" plugins/m42-sprint/compiler/src/status-server/page.ts && grep -qE "key.*===.*['\"]l['\"]|key.*===.*['\"]L['\"]|toLowerCase\\(\\).*===.*['\"]l['\"]" plugins/m42-sprint/compiler/src/status-server/page.ts && grep -qE "key.*===.*['\"]n['\"]|key.*===.*['\"]N['\"]|toLowerCase\\(\\).*===.*['\"]n['\"]" plugins/m42-sprint/compiler/src/status-server/page.ts && grep -qE "key.*===.*['\"]d['\"]|key.*===.*['\"]D['\"]|toLowerCase\\(\\).*===.*['\"]d['\"]" plugins/m42-sprint/compiler/src/status-server/page.ts && grep -qE "key.*===.*['\"]\\?['\"]" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Keyboard shortcuts help modal HTML exists
Given the page.ts file generates the HTML content
When I check for the shortcuts help modal structure
Then a modal with id "shortcuts-help-modal" or similar containing shortcut descriptions exists

Verification: `grep -qE "shortcuts-help-modal|keyboard-shortcuts-modal|shortcuts-modal" plugins/m42-sprint/compiler/src/status-server/page.ts && grep -qE "Pause.*Resume|pause/resume" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Input field detection prevents shortcuts while typing
Given the keyboard shortcut handler is implemented
When I check for input field detection logic
Then shortcuts are ignored when activeElement is an input, textarea, or contenteditable element

Verification: `grep -qE "(activeElement|tagName).*(INPUT|TEXTAREA|input|textarea)|isContentEditable|contenteditable" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Visual hints are added to buttons
Given the control buttons exist in the HTML
When I check for visual hints (underlined letters)
Then buttons show underlined shortcut keys (e.g., <u>P</u>ause or similar styling)

Verification: `grep -qE "<u>P</u>|<u>p</u>|<span class=.*(kbd|shortcut-key|underline).*>P|kbd-hint|shortcut-hint" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: TypeScript compiles without errors
Given all keyboard shortcut changes are implemented
When I run the TypeScript compiler
Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; test $? -eq 0`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Escape key closes all modals
Given multiple modals can be open
When I check for Escape key handling
Then Escape key closes shortcuts-help, stop-confirm, skip-confirm, and log-viewer modals

Verification: `grep -qE "Escape.*modal|modal.*Escape" plugins/m42-sprint/compiler/src/status-server/page.ts && grep -c "Escape" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "^[2-9]|^[0-9]{2,}"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
