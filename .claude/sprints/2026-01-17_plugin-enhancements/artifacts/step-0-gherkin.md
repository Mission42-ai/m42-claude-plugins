# Gherkin Scenarios: step-0

## Step Task
Phase 1 - Step 1: Fix Elapsed Timer Running Indefinitely

The elapsed time timer continues updating after sprint completes/pauses/fails.

Requirements:
- Modify `updateElapsedTimes()` function in page.ts
- Check sprint status before updating timers
- Stop updating for terminal statuses: 'completed', 'failed', 'stopped', 'blocked'
- Also handle 'paused' status (freeze timer, don't stop)
- Ensure timer resumes correctly when sprint is resumed from pause

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts (~line 2989, updateElapsedTimes function)

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: updateElapsedTimes function checks currentSprintStatus variable
```gherkin
Scenario: updateElapsedTimes checks sprint status before updating
  Given the page.ts file exists with updateElapsedTimes function
  When I examine the updateElapsedTimes function
  Then it references currentSprintStatus to determine if timer should update

Verification: `grep -A 20 "function updateElapsedTimes" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q "currentSprintStatus"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Timer stops for 'completed' status
```gherkin
Scenario: Timer stops when sprint status is completed
  Given the updateElapsedTimes function has status checking
  When the sprint status is 'completed'
  Then the timer does not update the elapsed time display

Verification: `grep -A 30 "function updateElapsedTimes" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "'completed'|\"completed\""`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Timer stops for 'failed' status
```gherkin
Scenario: Timer stops when sprint status is failed
  Given the updateElapsedTimes function has status checking
  When the sprint status is 'failed'
  Then the timer does not update the elapsed time display

Verification: `grep -A 30 "function updateElapsedTimes" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "'failed'|\"failed\""`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Timer stops for 'blocked' status
```gherkin
Scenario: Timer stops when sprint status is blocked
  Given the updateElapsedTimes function has status checking
  When the sprint status is 'blocked'
  Then the timer does not update the elapsed time display

Verification: `grep -A 30 "function updateElapsedTimes" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "'blocked'|\"blocked\""`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Timer freezes for 'paused' status
```gherkin
Scenario: Timer freezes when sprint is paused
  Given the updateElapsedTimes function has status checking
  When the sprint status is 'paused'
  Then the timer freezes (does not update but can resume)

Verification: `grep -A 30 "function updateElapsedTimes" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "'paused'|\"paused\""`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: TypeScript compiles without errors
```gherkin
Scenario: Modified page.ts compiles successfully
  Given the updateElapsedTimes function has been modified
  When I run the TypeScript compiler
  Then no compilation errors occur in page.ts

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; test $? -eq 0`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Summary

| Scenario | Description | What it Verifies |
|----------|-------------|------------------|
| 1 | Status check exists | Function reads currentSprintStatus |
| 2 | Completed handling | Timer stops on completion |
| 3 | Failed handling | Timer stops on failure |
| 4 | Blocked handling | Timer stops when blocked |
| 5 | Paused handling | Timer freezes when paused |
| 6 | TypeScript validity | Code compiles without errors |

## Implementation Notes

The `currentSprintStatus` variable is already defined at line 1699 and updated at line 2257 in the `updateControlButtons()` function. The implementation should:

1. Check `currentSprintStatus` at the start of `updateElapsedTimes()`
2. Return early (skip update) for terminal statuses: 'completed', 'failed', 'blocked', 'needs-human'
3. Also return early for 'paused' status (timer freezes but can resume when status changes back to 'in-progress')
4. Only update elapsed time when status is 'in-progress' or 'not-started' (before sprint starts, no timer anyway)
