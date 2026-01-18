# Gherkin Scenarios: step-13

## Step Task
Phase 4 - Step 5: Add Navigation Header to Sprint Detail Page

Add navigation between dashboard and sprint detail views.

Requirements:
- Add navigation bar at top of sprint detail page
- Include "← Back to Dashboard" link
- Show breadcrumb: Dashboard > Sprint: <sprint-id>
- Add sprint switcher dropdown (last 10 sprints)
- Style navigation consistent with existing header
- Update dashboard page with same navigation pattern

Files to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts
- plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Sprint detail page contains navigation bar element
  Given the status server page.ts file exists
  When I check for navigation bar HTML structure
  Then a nav element or navigation container exists in the generated HTML

Verification: `grep -E 'nav-bar|navigation-bar|class="nav"|<nav' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Sprint detail page contains Back to Dashboard link
  Given the status server page.ts file exists
  When I check for back link to dashboard
  Then a link element with href="/dashboard" and back navigation text exists

Verification: `grep -E 'href.*["/]dashboard["/].*Back|Back.*href.*["/]dashboard["/]|←.*Dashboard|Back to Dashboard' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Sprint detail page contains breadcrumb structure
  Given the status server page.ts file exists
  When I check for breadcrumb HTML structure
  Then breadcrumb elements showing Dashboard > Sprint path exist

Verification: `grep -E 'breadcrumb|Dashboard.*>.*Sprint|Sprint.*breadcrumb' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Sprint detail page contains sprint switcher dropdown
  Given the status server page.ts file exists
  When I check for sprint switcher dropdown
  Then a select element or dropdown component for switching sprints exists

Verification: `grep -E 'sprint-switcher|sprint-select|id=".*sprint.*select|select.*sprint|dropdown.*sprint' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Sprint detail page navigation has consistent styling
  Given the status server page.ts file exists
  When I check for navigation CSS styles
  Then navigation-related CSS classes are defined

Verification: `grep -E '\.nav-bar|\.navigation|\.breadcrumb|\.sprint-switcher' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: TypeScript compiles without errors
  Given the page.ts and dashboard-page.ts files are modified
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0
