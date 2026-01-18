# Gherkin Scenarios: step-16

## Step Task
Phase 5 - Step 2: Add Mobile Responsive CSS

Make status page usable on mobile and tablet devices.

Requirements:
- Add media queries for mobile (<768px) and tablet (<1024px)
- Stack layout elements vertically on mobile
- Reduce font sizes and padding on smaller screens
- Make buttons touch-friendly (min 44px tap target)
- Hide non-essential elements on mobile (e.g., keyboard shortcut hints)
- Ensure log viewer is scrollable horizontally
- Test activity panel collapse/expand on mobile

Verification:
- Open status page on mobile device or Chrome DevTools mobile view
- Verify all content is accessible and readable
- Verify touch interactions work correctly

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts (CSS section)

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Mobile media query exists
  Given the status page CSS is defined in page.ts
  When I check for mobile breakpoint media query
  Then a media query for max-width 768px exists

Verification: `grep -q "@media.*max-width.*768px" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Tablet media query exists
  Given the status page CSS is defined in page.ts
  When I check for tablet breakpoint media query
  Then a media query for max-width 1024px exists

Verification: `grep -q "@media.*max-width.*1024px" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Sidebar stacks vertically on mobile
  Given the mobile media query is defined
  When I check for sidebar responsive rules
  Then the sidebar width is set to 100% or uses flex-direction column on mobile

Verification: `grep -A 50 "@media.*max-width.*768px" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q "\.sidebar\|\.main\|flex-direction"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Touch-friendly buttons (44px minimum)
  Given the mobile media query is defined
  When I check for touch-friendly button sizing
  Then buttons have minimum height of 44px for touch targets

Verification: `grep -A 100 "@media.*max-width.*768px" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "min-height:\s*44px|min-width:\s*44px|padding.*10px|padding.*12px"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Keyboard shortcut hints hidden on mobile
  Given the mobile media query is defined
  When I check for kbd-hint hiding on mobile
  Then keyboard shortcut hints have display none or visibility hidden

Verification: `grep -A 100 "@media.*max-width.*768px" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "\.kbd-hint.*display:\s*none|\.kbd-hint\s*\{[^}]*display:\s*none"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Log viewer has horizontal scroll
  Given the log viewer CSS exists
  When I check for horizontal scroll on log viewer
  Then the log viewer body has overflow-x auto or scroll

Verification: `grep -B 5 -A 100 "@media.*max-width.*768px" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "\.log-viewer.*overflow-x|overflow-x:\s*(auto|scroll)"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Reduced padding/margins on mobile
  Given the mobile media query is defined
  When I check for reduced spacing on mobile
  Then padding values are smaller in mobile breakpoint (e.g., 8px, 12px instead of 16px, 20px)

Verification: `grep -A 100 "@media.*max-width.*768px" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "padding:\s*(4px|6px|8px|10px|12px)"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: TypeScript compiles without errors
  Given the page.ts file has been modified
  When I run TypeScript compilation
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0
