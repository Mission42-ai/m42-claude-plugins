# Gherkin Scenarios: step-2

## Step Task
Fix sprint dropdown switching and add stale sprint detection.

Requirements:
1. Fix dropdown in page.ts:
   - Close existing SSE connection on change
   - Navigate to /sprint/{id} with full page reload
   - Add loading indicator

2. Add heartbeat in loop.ts:
   - Write last-activity timestamp each iteration
   - Add process.on('SIGTERM') handler
   - Add process.on('SIGINT') handler
   - Mark sprint as 'interrupted' before exit

3. Detect staleness in transforms.ts:
   - If in-progress but last-activity > 15 min → stale
   - Add isStale flag to status

4. Show stale indicator in page.ts:
   - Display "Stale" badge next to status
   - Show "Resume Sprint" button

5. Add resume endpoint in server.ts:
   - Add /api/sprint/:id/resume endpoint
   - Trigger sprint loop restart

Files:
- plugins/m42-sprint/compiler/src/status-server/page.ts
- plugins/m42-sprint/compiler/src/status-server/server.ts
- plugins/m42-sprint/compiler/src/status-server/transforms.ts
- plugins/m42-sprint/runtime/src/loop.ts
- plugins/m42-sprint/runtime/src/cli.ts

Verification:
- Switch sprints via dropdown, verify correct data loads
- Kill sprint process, wait 15 min, verify "Stale" badge + "Resume" button

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Sprint Dropdown Navigation
Switching sprints via dropdown should navigate to the selected sprint with a full page reload.

```gherkin
Scenario: Sprint dropdown triggers navigation
  Given the user is viewing sprint "sprint-A" in the dashboard
  And there are multiple sprints available ["sprint-A", "sprint-B", "sprint-C"]
  When the user selects "sprint-B" from the dropdown
  Then the browser should navigate to "/sprint/sprint-B"
  And the page should perform a full reload
  And the existing SSE connection should be closed
```

Verification: `node -e "const { generateNavigationBar } = require('./dist/status-server/page.js'); const html = generateNavigationBar({currentSprintId: 'sprint-A', availableSprints: [{sprintId: 'sprint-A', status: 'in-progress'}, {sprintId: 'sprint-B', status: 'completed'}]}); if (!html.includes('onchange') || !html.includes('window.location.href')) { process.exit(1); }"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Loading Indicator During Sprint Switch
A loading indicator should appear while navigating to a different sprint.

```gherkin
Scenario: Loading indicator displays during navigation
  Given the user is viewing sprint "sprint-A" in the dashboard
  When the user selects a different sprint from the dropdown
  Then a loading indicator should appear
  And the UI should indicate navigation is in progress
```

Verification: `grep -q "loading" plugins/m42-sprint/compiler/src/status-server/page.ts && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Heartbeat Written Each Loop Iteration
The loop should write a last-activity timestamp to track sprint health.

```gherkin
Scenario: Loop writes heartbeat timestamp each iteration
  Given a sprint is in-progress
  When the loop executes an iteration
  Then the loop should write "last-activity" timestamp to PROGRESS.yaml
  And the timestamp should be updated on each subsequent iteration
```

Verification: `grep -q "last-activity" plugins/m42-sprint/runtime/src/loop.ts && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: SIGTERM Handler Marks Sprint Interrupted
When receiving SIGTERM, the sprint should be marked as interrupted.

```gherkin
Scenario: SIGTERM handler marks sprint as interrupted
  Given a sprint is in-progress
  When the process receives SIGTERM signal
  Then the loop should catch the signal
  And mark the sprint status as "interrupted" in PROGRESS.yaml
  And write the interrupted timestamp
  And exit gracefully
```

Verification: `grep -q "SIGTERM" plugins/m42-sprint/runtime/src/loop.ts && grep -q "interrupted" plugins/m42-sprint/runtime/src/loop.ts && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: SIGINT Handler Marks Sprint Interrupted
When receiving SIGINT, the sprint should be marked as interrupted.

```gherkin
Scenario: SIGINT handler marks sprint as interrupted
  Given a sprint is in-progress
  When the process receives SIGINT signal (Ctrl+C)
  Then the loop should catch the signal
  And mark the sprint status as "interrupted" in PROGRESS.yaml
  And write the interrupted timestamp
  And exit gracefully
```

Verification: `grep -q "SIGINT" plugins/m42-sprint/runtime/src/loop.ts && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Staleness Detection For Inactive Sprints
A sprint should be marked stale if in-progress but inactive for more than 15 minutes.

```gherkin
Scenario: Detect stale sprint based on last-activity
  Given a sprint has status "in-progress"
  And the "last-activity" timestamp is more than 15 minutes ago
  When the transforms.toStatusUpdate function processes the progress
  Then the StatusUpdate should have isStale = true
  And the header should indicate staleness

Scenario: Active sprint is not marked stale
  Given a sprint has status "in-progress"
  And the "last-activity" timestamp is less than 15 minutes ago
  When the transforms.toStatusUpdate function processes the progress
  Then the StatusUpdate should have isStale = false
```

Verification: `grep -q "isStale" plugins/m42-sprint/compiler/src/status-server/transforms.ts && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Stale Badge Displays In UI
The page should display a "Stale" badge for stale sprints.

```gherkin
Scenario: Stale badge displays for inactive sprint
  Given a sprint is detected as stale
  When the dashboard renders the sprint status
  Then a "Stale" badge should be visible next to the status
  And a "Resume Sprint" button should be displayed
```

Verification: `grep -q "stale" plugins/m42-sprint/compiler/src/status-server/page.ts && grep -qi "resume" plugins/m42-sprint/compiler/src/status-server/page.ts && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Resume Endpoint Triggers Sprint Restart
The /api/sprint/:id/resume endpoint should trigger sprint loop restart.

```gherkin
Scenario: Resume endpoint triggers sprint restart
  Given a sprint "my-sprint" is in "interrupted" or "stale" state
  When a POST request is made to "/api/sprint/my-sprint/resume"
  Then the server should create a resume signal file
  And respond with success status
  And the sprint should be scheduled for restart

Scenario: Resume endpoint rejects non-resumable sprints
  Given a sprint "my-sprint" is in "completed" state
  When a POST request is made to "/api/sprint/my-sprint/resume"
  Then the server should respond with error status
  And the error message should indicate the sprint cannot be resumed
```

Verification: `grep -q "resume" plugins/m42-sprint/compiler/src/status-server/server.ts && grep -q "/api/sprint" plugins/m42-sprint/compiler/src/status-server/server.ts && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| `compiler/src/status-server/dropdown-navigation.test.ts` | 5 | 1, 2 |
| `runtime/src/loop-heartbeat.test.ts` | 6 | 3, 4, 5 |
| `compiler/src/status-server/stale-detection.test.ts` | 4 | 6, 7 |
| `compiler/src/status-server/resume-endpoint.test.ts` | 4 | 8 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/compiler && npm run build && npm run test
cd plugins/m42-sprint/runtime && npm run build && npm run test
# Expected: FAIL (no implementation yet)
```

The tests verify:
1. `dropdown-navigation.test.ts` - Tests that dropdown triggers page reload and closes SSE
2. `loop-heartbeat.test.ts` - Tests heartbeat writing and signal handlers
3. `stale-detection.test.ts` - Tests staleness detection logic in transforms
4. `resume-endpoint.test.ts` - Tests the resume API endpoint

All tests should fail initially because the implementation doesn't exist yet.
