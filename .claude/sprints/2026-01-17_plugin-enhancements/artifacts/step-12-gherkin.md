# Gherkin Scenarios: step-12

## Step Task
Phase 4 - Step 4: Add URL Routing to Status Server

Implement routing to serve dashboard and individual sprint views.

Requirements:
- Add URL routing in server.ts:
  - `/` or `/dashboard` - Serve dashboard page
  - `/sprint/:id` - Serve sprint detail page (existing page.ts)
  - `/api/sprints` - Return sprint list JSON
  - `/api/metrics` - Return aggregate metrics JSON
- Parse URL path to determine which page to serve
- Pass sprint ID to existing page generation when on detail view
- Update existing SSE endpoint to include sprint ID context
- Handle 404 for unknown sprint IDs

Verification:
- Navigate to `/`, verify dashboard loads
- Navigate to `/sprint/<id>`, verify detail page loads
- Call `/api/sprints`, verify JSON response

File to modify:
- plugins/m42-sprint/compiler/src/status-server/server.ts


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: TypeScript compiles without errors
```gherkin
Scenario: TypeScript compiles without errors
  Given the server.ts file has been modified with URL routing
  When I run the TypeScript compiler
  Then no compilation errors occur
```

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo "EXIT:$?"`
Pass: Output contains "EXIT:0" → Score 1
Fail: Output does not contain "EXIT:0" → Score 0

---

## Scenario 2: SprintScanner import exists
```gherkin
Scenario: SprintScanner is imported from sprint-scanner module
  Given the server.ts file exists
  When I check for SprintScanner import
  Then the import statement is present
```

Verification: `grep -E "import.*SprintScanner.*from.*'\\./sprint-scanner" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: MetricsAggregator import exists
```gherkin
Scenario: MetricsAggregator is imported from metrics-aggregator module
  Given the server.ts file exists
  When I check for MetricsAggregator import
  Then the import statement is present
```

Verification: `grep -E "import.*MetricsAggregator.*from.*'\\./metrics-aggregator" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Dashboard page generator import exists
```gherkin
Scenario: generateDashboardPage is imported from dashboard-page module
  Given the server.ts file exists
  When I check for dashboard page import
  Then the import statement is present
```

Verification: `grep -E "import.*generateDashboardPage.*from.*'\\./dashboard-page" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Dashboard route handler exists
```gherkin
Scenario: Route handler for /dashboard endpoint exists
  Given the server.ts file has URL routing
  When I check for dashboard route handling
  Then a case or condition for '/dashboard' is present
```

Verification: `grep -E "case.*'/dashboard'|url.*===.*'/dashboard'|url\\.startsWith\\('/dashboard'\\)" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Sprint detail route handler exists
```gherkin
Scenario: Route handler for /sprint/:id endpoint exists
  Given the server.ts file has URL routing
  When I check for sprint detail route handling
  Then a pattern matching '/sprint/' routes is present
```

Verification: `grep -E "/sprint/|sprintMatch|sprintIdMatch|url\\.match\\(.*sprint" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: API sprints endpoint handler exists
```gherkin
Scenario: Route handler for /api/sprints endpoint exists
  Given the server.ts file has API routing
  When I check for sprints list API route
  Then a handler for '/api/sprints' is present
```

Verification: `grep -E "'/api/sprints'|handleSprintsRequest|handleSprintsApiRequest" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: API metrics endpoint handler exists
```gherkin
Scenario: Route handler for /api/metrics endpoint exists
  Given the server.ts file has API routing
  When I check for metrics API route
  Then a handler for '/api/metrics' is present
```

Verification: `grep -E "'/api/metrics'|handleMetricsRequest|handleMetricsApiRequest" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
