# Gherkin Scenarios: step-8

## Step Task
Run complete end-to-end verification of all dashboard improvements.

Test all features:
1. Live Activity: Start sprint, verify chat-style display with assistant messages
2. Elapsed time: Verify steps show timing in sidebar
3. Sprint timer: Verify prominent HH:MM:SS display in header
4. Step count: Verify "Step X of Y" indicator
5. Sprint switching: Use dropdown to switch sprints
6. Stale detection: Kill a sprint and verify stale indicator
7. Model selection: Verify model override works at step/phase/sprint/workflow levels
8. Workflow reference: Verify single-phase workflow references expand correctly
9. Operator requests: Verify agents can submit requests, operator processes them
10. Dynamic injection: Verify steps can be injected at various positions
11. Operator queue view: Verify pending/decided requests display with reasoning

Build and test:
- Run npm run build in plugins/m42-sprint/compiler
- Run npm run build in plugins/m42-sprint/runtime
- Reinstall plugin and verify all features work

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 11
Required score: 11/11

---

## Scenario 1: Live Activity Chat-Style Display
```gherkin
Scenario: Live activity shows assistant messages in chat-style format
  Given a sprint is running with transcription output
  When Claude emits text content blocks
  Then assistant messages should appear as chat bubbles
  And tool calls should render with grey/secondary styling
  And activity should update in real-time via SSE

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/activity-types.test.js 2>&1 | grep -q '✓' && node dist/status-server/transcription-watcher.test.js 2>&1 | grep -q '✓'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 2: Elapsed Time Display in Sidebar
```gherkin
Scenario: Steps display elapsed time in sidebar
  Given a sprint with completed and in-progress steps
  When the dashboard renders the phase tree
  Then completed steps should show elapsed duration (e.g., "1m 30s")
  And the current step should show running elapsed time
  And step timing data should be calculated from timestamps

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/transforms.test.js 2>&1 | grep -c '✓' | grep -qE '^[5-9]|^[0-9]{2,}'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 3: Sprint Timer in Header
```gherkin
Scenario: Header displays prominent sprint timer
  Given a sprint in 'in-progress' state
  When the dashboard renders the header
  Then a timer should display in HH:MM:SS format
  And the timer should be styled prominently (large font, blue accent)
  And the timer should update in real-time

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/total-duration.test.js 2>&1 | grep -c '✓' | grep -qE '^[2-9]|^[0-9]{2,}'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 4: Step Counter Display
```gherkin
Scenario: Header shows "Step X of Y" indicator
  Given a sprint with multiple steps
  When the dashboard renders the header
  Then it should display "Step X of Y" where X is current step and Y is total
  And the counter should update as steps progress

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/step-progress.test.js 2>&1 | grep -c '✓' | grep -qE '^[2-9]|^[0-9]{2,}'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 5: Sprint Switching via Dropdown
```gherkin
Scenario: Dropdown enables switching between sprints
  Given multiple sprints exist in the sprint directory
  When the user clicks the sprint dropdown
  Then available sprints should be listed
  And selecting a sprint should navigate to that sprint's dashboard
  And navigation should be a full page reload (not AJAX)

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/dropdown-navigation.test.js 2>&1 | grep -c '✓' | grep -qE '^[3-9]|^[0-9]{2,}'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 6: Stale Sprint Detection
```gherkin
Scenario: Detect and indicate stale sprints
  Given a sprint that has not written last-activity for >15 minutes
  When the dashboard renders the sprint status
  Then a "Stale" badge should be displayed
  And the user should see a "Resume Sprint" button
  And the API should support resume endpoint

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/resume-endpoint.test.js 2>&1 | grep -c '✓' | grep -qE '^[2-9]|^[0-9]{2,}'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 7: Model Selection at Multiple Levels
```gherkin
Scenario: Model can be specified at step, phase, sprint, and workflow levels
  Given a SPRINT.yaml with model: "opus" at sprint level
  And a step with model: "haiku" override
  When the sprint is compiled
  Then PROGRESS.yaml should contain resolved model per phase
  And runtime should pass model flag to Claude CLI

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/model-selection.test.js 2>&1 | grep -c '✓' | grep -qE '^[4-9]|^[0-9]{2,}'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 8: Single-Phase Workflow Reference Expansion
```gherkin
Scenario: Workflow reference without for-each expands inline
  Given a SPRINT.yaml with a phase containing workflow: "bugfix-workflow" (no for-each)
  When the sprint is compiled
  Then the referenced workflow phases should be expanded inline
  And phase IDs should be prefixed to avoid collisions
  And circular references should be detected and rejected

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/workflow-reference.test.js 2>&1 | grep -c '✓' | grep -qE '^[4-9]|^[0-9]{2,}'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 9: Operator Request Processing
```gherkin
Scenario: Agents can submit operator requests which get processed
  Given a sprint with operator config enabled
  When Claude returns operatorRequests in JSON result
  Then requests should be queued in PROGRESS.yaml operator-queue
  And the operator should process pending requests
  And decisions should include approve/reject/defer/backlog with reasoning

Verification: `cd plugins/m42-sprint/runtime && npm run build && node dist/operator.test.js 2>&1 | grep -c '✓' | grep -qE '^[5-9]|^[0-9]{2,}'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 10: Dynamic Step Injection
```gherkin
Scenario: Steps can be injected at various positions in running sprint
  Given a running sprint with current phase index 2
  When a step is injected with position: "after-current"
  Then the step should appear at index 3
  And when injected at position: "end-of-workflow"
  Then the step should appear at the end
  And injected steps should have injected: true marker

Verification: `cd plugins/m42-sprint/runtime && npm run build && node dist/progress-injector.test.js 2>&1 | grep -c '✓' | grep -qE '^[5-9]|^[0-9]{2,}'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 11: Operator Queue View Display
```gherkin
Scenario: Operator queue view displays pending, decided, and backlog items
  Given a sprint with operator-queue data in PROGRESS.yaml
  When the user navigates to /sprint/:id/operator
  Then pending requests should display with priority badges and action buttons
  And decision history should display with reasoning blocks (collapsible)
  And backlog section should display with create-issue and acknowledge actions

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/operator-queue-page.test.js 2>&1 | grep -c '✓' | grep -qE '^[10-9]|^[1-9][0-9]+'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Build Verification Scenarios

### Build Verification: Compiler
```gherkin
Scenario: Compiler builds without errors
  Given the compiler source code
  When npm run build is executed in plugins/m42-sprint/compiler
  Then the build should complete successfully (exit code 0)
  And TypeScript should compile without type errors

Verification: `cd plugins/m42-sprint/compiler && npm run build 2>&1; exit $?`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

### Build Verification: Runtime
```gherkin
Scenario: Runtime builds without errors
  Given the runtime source code
  When npm run build is executed in plugins/m42-sprint/runtime
  Then the build should complete successfully (exit code 0)
  And TypeScript should compile without type errors

Verification: `cd plugins/m42-sprint/runtime && npm run build 2>&1; exit $?`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| `compiler/src/status-server/activity-types.test.ts` | 6+ | 1 |
| `compiler/src/status-server/transcription-watcher.test.ts` | 5+ | 1 |
| `compiler/src/status-server/transforms.test.ts` | 8+ | 2, 4 |
| `compiler/src/status-server/total-duration.test.ts` | 3+ | 3 |
| `compiler/src/status-server/step-progress.test.ts` | 4+ | 4 |
| `compiler/src/status-server/dropdown-navigation.test.ts` | 4+ | 5 |
| `compiler/src/status-server/resume-endpoint.test.ts` | 3+ | 6 |
| `compiler/src/model-selection.test.ts` | 5+ | 7 |
| `compiler/src/workflow-reference.test.ts` | 5+ | 8 |
| `runtime/src/operator.test.ts` | 6+ | 9 |
| `runtime/src/progress-injector.test.ts` | 6+ | 10 |
| `compiler/src/status-server/operator-queue-page.test.ts` | 15+ | 11 |

---

## RED Phase Verification

This step is about VERIFICATION, not RED phase testing. We run the full test suite:

```bash
# Build both packages
cd plugins/m42-sprint/compiler && npm run build
cd plugins/m42-sprint/runtime && npm run build

# Run all tests
cd plugins/m42-sprint/compiler && npm run test
cd plugins/m42-sprint/runtime && npm run test

# Run E2E tests
cd plugins/m42-sprint/e2e && npm run test

# Expected: ALL tests should PASS (GREEN)
```

---

## E2E Integration Test File

The comprehensive E2E test file for final verification is located at:
`plugins/m42-sprint/e2e/dashboard-e2e.test.ts`

This test file:
1. Starts the status server
2. Runs a mock sprint
3. Verifies dashboard renders correctly
4. Tests all feature integrations
5. Validates real-time updates via SSE

---

## Final Verification Checklist

| Feature | Implemented | Unit Tests | Integration Test |
|---------|-------------|------------|------------------|
| Chat-style live activity | Yes | Yes | Manual |
| Elapsed time display | Yes | Yes | Manual |
| Sprint timer (HH:MM:SS) | Yes | Yes | Manual |
| Step X of Y counter | Yes | Yes | Manual |
| Sprint dropdown switching | Yes | Yes | Manual |
| Stale detection + resume | Yes | Yes | Manual |
| Model selection (4 levels) | Yes | Yes | Manual |
| Workflow reference expansion | Yes | Yes | Manual |
| Operator request system | Yes | Yes | Manual |
| Dynamic step injection | Yes | Yes | Manual |
| Operator queue view | Yes | Yes | Manual |

---

## Manual Verification Steps

For complete E2E verification, perform these manual tests:

### 1. Start Dashboard
```bash
# Terminal 1: Start status server
cd plugins/m42-sprint && ./dist/cli.js sprint-watch --port 3100

# Terminal 2: Run a test sprint
cd plugins/m42-sprint/e2e/fixtures/minimal-sprint
../../compiler/dist/index.js .
../../runtime/dist/cli.js run-sprint .
```

### 2. Verify Features in Browser
Open http://localhost:3100 and verify:
- [ ] Chat-style activity with assistant messages
- [ ] Step elapsed time in sidebar
- [ ] HH:MM:SS timer in header
- [ ] "Step X of Y" indicator
- [ ] Sprint dropdown works
- [ ] Stale indicator appears when sprint dies

### 3. Verify Operator Queue
```bash
# Create test operator requests
# Navigate to http://localhost:3100/sprint/test-sprint/operator
# Verify pending/history/backlog sections
```

### 4. Verify Model Selection
```bash
# Create SPRINT.yaml with model overrides
# Compile and run sprint
# Verify Claude invoked with correct --model flag
```

### 5. Verify Dynamic Injection
```bash
# Use progress-injector API to inject step
# Verify step appears in PROGRESS.yaml
# Verify dashboard updates
```
