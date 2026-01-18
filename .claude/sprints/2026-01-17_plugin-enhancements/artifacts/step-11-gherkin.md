# Gherkin Scenarios: step-11

## Step Task
Phase 4 - Step 3: Create Dashboard Page HTML

Create the dashboard page showing sprint history and metrics.

Requirements:
- Create dashboard-page.ts with generateDashboardPage() function
- Header with "Sprint Dashboard" title and link to docs
- Metrics summary cards at top:
  - Total sprints, Success rate, Avg duration, Active sprint
- Sprint list table with columns:
  - Sprint ID (link to detail view)
  - Status (with colored badge)
  - Started, Duration, Steps (completed/total)
- Pagination or "Load more" for >20 sprints
- Style consistent with existing page.ts GitHub dark theme
- Include navigation link to current sprint (if active)

Verification:
- Generate dashboard HTML with sample data
- Verify all sections render correctly
- Verify links work correctly

New file to create:
- plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Dashboard page file exists
  Given the project structure is set up
  When I check for the dashboard page module
  Then plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts exists

Verification: `test -f plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: TypeScript compiles without errors
  Given the file dashboard-page.ts exists
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit src/status-server/dashboard-page.ts 2>&1 | tail -1 | grep -q "^$" && echo 0 || npx tsc --noEmit src/status-server/dashboard-page.ts >/dev/null 2>&1; echo $?`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: generateDashboardPage function is exported
  Given dashboard-page.ts exists
  When I check for the generateDashboardPage export
  Then the function is publicly available

Verification: `grep -qE "export.*function generateDashboardPage|export.*const generateDashboardPage|export \{ generateDashboardPage" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Dashboard header with title and docs link
  Given dashboard-page.ts generates HTML
  When I check for the header content
  Then the HTML contains "Sprint Dashboard" title and documentation link

Verification: `grep -q "Sprint Dashboard" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts && grep -qE "(docs|documentation|/docs)" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Metrics summary cards are present
  Given dashboard-page.ts generates HTML
  When I check for metrics card content
  Then the HTML contains Total sprints, Success rate, Avg duration, and Active sprint metrics

Verification: `grep -qi "total.*sprint" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts && grep -qi "success.*rate" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts && grep -qi "duration\|avg" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts && grep -qi "active" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Sprint list table with required columns
  Given dashboard-page.ts generates HTML
  When I check for table structure
  Then the HTML contains Sprint ID, Status, Started, Duration, and Steps columns

Verification: `grep -qi "sprint.*id\|sprintid" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts && grep -qi "status" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts && grep -qiE "started|start" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts && grep -qi "steps" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: GitHub dark theme CSS variables used
  Given dashboard-page.ts generates HTML with styles
  When I check for GitHub dark theme CSS variables
  Then the CSS uses var(--bg-primary), var(--text-primary), and other theme variables

Verification: `grep -qE "var\(--bg-primary\)|#0d1117" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts && grep -qE "var\(--text-primary\)|#c9d1d9" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Imports from sprint-scanner and metrics-aggregator
  Given dashboard-page.ts needs sprint data types
  When I check for required imports
  Then the module imports SprintSummary and AggregateMetrics types

Verification: `grep -qE "import.*SprintSummary.*from|from.*sprint-scanner" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts && grep -qE "import.*AggregateMetrics.*from|from.*metrics-aggregator" plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
