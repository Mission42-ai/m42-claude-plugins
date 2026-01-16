# Gherkin Scenarios: step-8

## Step Task
Track D - Step 1: Add Skip/Retry Phase Buttons

Implement Skip and Retry buttons for individual phases in the status page.

Requirements:
- Add POST /api/skip/:phaseId endpoint to skip blocked/stuck phases
- Add POST /api/retry/:phaseId endpoint to retry failed phases without full restart
- Skip endpoint should:
  - Mark current phase as "skipped" in PROGRESS.yaml
  - Advance to next phase
  - Show confirmation dialog with data loss warning
- Retry endpoint should:
  - Reset phase status to "pending" in PROGRESS.yaml
  - Re-queue phase for execution
  - Preserve any partial work if possible
- Add contextual buttons in phase cards (Skip visible for stuck/blocked, Retry for failed)
- Include confirmation modal for Skip with warning about incomplete work
- Update SSE to reflect phase status changes immediately

Files to modify:
- compiler/src/status-server/server.ts (add API endpoints)
- compiler/src/status-server/page.ts (add contextual buttons per phase)


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Skip API endpoint exists
```gherkin
Scenario: POST /api/skip/:phaseId endpoint is registered
  Given the status server code exists
  When I check for the skip endpoint handler
  Then the endpoint pattern for skip should be defined in server.ts

Verification: `grep -E "(api/skip|handleSkip)" plugins/m42-sprint/compiler/src/status-server/server.ts | grep -q .`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Retry API endpoint exists
```gherkin
Scenario: POST /api/retry/:phaseId endpoint is registered
  Given the status server code exists
  When I check for the retry endpoint handler
  Then the endpoint pattern for retry should be defined in server.ts

Verification: `grep -E "(api/retry|handleRetry)" plugins/m42-sprint/compiler/src/status-server/server.ts | grep -q .`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Skip endpoint modifies PROGRESS.yaml
```gherkin
Scenario: Skip endpoint implementation modifies PROGRESS.yaml
  Given the skip endpoint handler is implemented
  When I check the skip handler implementation
  Then it should write to or modify PROGRESS.yaml with skipped status

Verification: `grep -A 50 "handleSkip" plugins/m42-sprint/compiler/src/status-server/server.ts | grep -E "(skipped|PROGRESS|yaml|writeFile)" | grep -q .`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Retry endpoint modifies PROGRESS.yaml
```gherkin
Scenario: Retry endpoint implementation modifies PROGRESS.yaml
  Given the retry endpoint handler is implemented
  When I check the retry handler implementation
  Then it should write to or modify PROGRESS.yaml with pending status

Verification: `grep -A 50 "handleRetry" plugins/m42-sprint/compiler/src/status-server/server.ts | grep -E "(pending|PROGRESS|yaml|writeFile)" | grep -q .`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: UI has Skip button component
```gherkin
Scenario: Skip button is present in the page UI
  Given the page.ts file contains the status page HTML
  When I check for skip button elements
  Then skip button markup or handler should be present

Verification: `grep -iE "(skip.*btn|skip.*button|handleSkip|skipPhase)" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q .`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: UI has Retry button component
```gherkin
Scenario: Retry button is present in the page UI
  Given the page.ts file contains the status page HTML
  When I check for retry button elements
  Then retry button markup or handler should be present

Verification: `grep -iE "(retry.*btn|retry.*button|handleRetry|retryPhase)" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q .`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Skip confirmation modal exists
```gherkin
Scenario: Skip action has confirmation modal with warning
  Given the page.ts file contains UI components
  When I check for skip confirmation modal
  Then a modal with warning about data loss should be present

Verification: `grep -iE "(skip.*modal|skip.*confirm|modal.*skip|warning.*incomplete|data.*loss)" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q .`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: TypeScript compiles without errors
```gherkin
Scenario: Status server TypeScript compiles without errors
  Given the server.ts and page.ts modifications are complete
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npm run build 2>&1 | tail -1 | grep -v "error" && echo "0" || echo "1"`
Pass: Output ends with 0 → Score 1
Fail: Output ends with 1 → Score 0
```
