# Gherkin Scenarios: transition-function

## Step Task
GIVEN the discriminated union types from Step 0
WHEN implementing transition logic
THEN create testable pure function returning state + actions

## Scope
Create NEW file: plugins/m42-sprint/runtime/src/transition.ts
Create runtime directory structure if needed.

## Acceptance Criteria

### Core Function
- [ ] `transition(state: SprintState, event: SprintEvent, context: CompiledProgress): TransitionResult`
- [ ] Pure function - NO side effects
- [ ] Returns { nextState, actions, context }

### Event Handling (exhaustive matching)
- [ ] START → in-progress + SPAWN_CLAUDE action
- [ ] PHASE_COMPLETE → advance pointer or completed + WRITE_PROGRESS
- [ ] PHASE_FAILED + retryable → same state + SCHEDULE_RETRY
- [ ] PHASE_FAILED + not retryable → blocked + WRITE_PROGRESS
- [ ] PAUSE → paused + WRITE_PROGRESS
- [ ] RESUME → in-progress + SPAWN_CLAUDE
- [ ] PROPOSE_STEPS + autoApprove → INSERT_STEP actions
- [ ] PROPOSE_STEPS + !autoApprove → update step-queue context
- [ ] MAX_ITERATIONS_REACHED → blocked
- [ ] HUMAN_NEEDED → needs-human

### Helper Functions
- [ ] `advancePointer(current, context)` → { nextPointer, hasMore }
- [ ] `calculateBackoff(context)` → delay in ms
- [ ] `getCurrentPhase/Step/SubPhase(progress)` → current item

### Guards Integration
- [ ] Use guards from types.ts for conditions
- [ ] TypeScript enforces exhaustive switch

### Tests
- [ ] Unit test for each state × event combination
- [ ] Test: invalid transitions return unchanged state
- [ ] Test: actions are correct for each transition
- [ ] 100% code coverage

## Files to Create
- plugins/m42-sprint/runtime/src/transition.ts
- plugins/m42-sprint/runtime/src/transition.test.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: START Event Transitions Sprint
```gherkin
Scenario: START event transitions not-started to in-progress
  Given a sprint state with status "not-started"
  And a compiled progress with phases defined
  When a START event is processed
  Then the next state should have status "in-progress"
  And the next state should have iteration 1
  And the next state should have a startedAt timestamp
  And the actions should include SPAWN_CLAUDE
```

**Verification:**
```bash
cd plugins/m42-sprint/runtime && node dist/transition.test.js 2>&1 | grep -E "✓ START:" | wc -l
# Pass: >= 5 (all START tests pass)
```

---

## Scenario 2: PHASE_COMPLETE Advances Pointer
```gherkin
Scenario: PHASE_COMPLETE advances to next phase when more phases exist
  Given a sprint state with status "in-progress" at phase 0
  And a compiled progress with 2 phases
  When a PHASE_COMPLETE event is processed for phase 0
  Then the next state should remain "in-progress"
  And the current pointer should be at phase 1
  And iteration should be incremented
  And the actions should include WRITE_PROGRESS and SPAWN_CLAUDE

Scenario: PHASE_COMPLETE transitions to completed when no more phases
  Given a sprint state with status "in-progress" at last phase
  And a compiled progress with 2 phases
  When a PHASE_COMPLETE event is processed for the last phase
  Then the next state should have status "completed"
  And the next state should have completedAt and elapsed
  And the actions should include WRITE_PROGRESS
```

**Verification:**
```bash
cd plugins/m42-sprint/runtime && node dist/transition.test.js 2>&1 | grep -E "✓ PHASE_COMPLETE:" | wc -l
# Pass: >= 6 (all PHASE_COMPLETE tests pass)
```

---

## Scenario 3: PHASE_FAILED Handles Retry
```gherkin
Scenario: PHASE_FAILED schedules retry for retryable errors
  Given a sprint state with status "in-progress"
  And a compiled progress with retry configuration for "network" errors
  When a PHASE_FAILED event with category "network" is processed
  Then the next state should remain "in-progress"
  And the actions should include SCHEDULE_RETRY

Scenario: PHASE_FAILED transitions to blocked for non-retryable errors
  Given a sprint state with status "in-progress"
  And a compiled progress with retry configuration for "network" errors
  When a PHASE_FAILED event with category "logic" is processed
  Then the next state should have status "blocked"
  And the next state should include error and failedPhase
  And the actions should include WRITE_PROGRESS
```

**Verification:**
```bash
cd plugins/m42-sprint/runtime && node dist/transition.test.js 2>&1 | grep -E "✓ PHASE_FAILED:" | wc -l
# Pass: >= 5 (all PHASE_FAILED tests pass)
```

---

## Scenario 4: PAUSE and RESUME Lifecycle
```gherkin
Scenario: PAUSE transitions in-progress to paused
  Given a sprint state with status "in-progress" at phase 1 step 2
  When a PAUSE event with reason "User requested" is processed
  Then the next state should have status "paused"
  And pausedAt should equal the previous current pointer
  And pauseReason should be "User requested"
  And the actions should include WRITE_PROGRESS

Scenario: RESUME transitions paused to in-progress
  Given a sprint state with status "paused" at phase 2 step 3
  When a RESUME event is processed
  Then the next state should have status "in-progress"
  And current should equal the previous pausedAt
  And the actions should include SPAWN_CLAUDE
```

**Verification:**
```bash
cd plugins/m42-sprint/runtime && node dist/transition.test.js 2>&1 | grep -E "✓ (PAUSE|RESUME):" | wc -l
# Pass: >= 8 (all PAUSE and RESUME tests pass)
```

---

## Scenario 5: PROPOSE_STEPS Orchestration
```gherkin
Scenario: PROPOSE_STEPS with autoApprove creates INSERT_STEP actions
  Given a sprint state with status "in-progress"
  And a compiled progress with orchestration enabled and autoApprove true
  When a PROPOSE_STEPS event with 2 steps is processed
  Then 2 INSERT_STEP actions should be returned
  And each INSERT_STEP action should have a unique step ID

Scenario: PROPOSE_STEPS without autoApprove queues steps
  Given a sprint state with status "in-progress"
  And a compiled progress with orchestration enabled and autoApprove false
  When a PROPOSE_STEPS event with 1 step is processed
  Then the context should have a step-queue with 1 item
  And the queued step should have a unique ID and proposedAt timestamp
```

**Verification:**
```bash
cd plugins/m42-sprint/runtime && node dist/transition.test.js 2>&1 | grep -E "✓ PROPOSE_STEPS:" | wc -l
# Pass: >= 4 (all PROPOSE_STEPS tests pass)
```

---

## Scenario 6: Terminal Events (MAX_ITERATIONS, HUMAN_NEEDED)
```gherkin
Scenario: MAX_ITERATIONS_REACHED transitions to blocked
  Given a sprint state with status "in-progress" at iteration 100
  When a MAX_ITERATIONS_REACHED event is processed
  Then the next state should have status "blocked"
  And the error should mention iterations

Scenario: HUMAN_NEEDED transitions to needs-human
  Given a sprint state with status "in-progress"
  When a HUMAN_NEEDED event with reason and details is processed
  Then the next state should have status "needs-human"
  And the next state should include the reason and details
```

**Verification:**
```bash
cd plugins/m42-sprint/runtime && node dist/transition.test.js 2>&1 | grep -E "✓ (MAX_ITERATIONS|HUMAN_NEEDED):" | wc -l
# Pass: >= 4 (all terminal event tests pass)
```

---

## Scenario 7: Invalid Transitions Return Unchanged State
```gherkin
Scenario: Invalid transitions do not modify state
  Given various invalid state/event combinations:
    | State         | Event          |
    | not-started   | PHASE_COMPLETE |
    | completed     | PAUSE          |
    | blocked       | START          |
    | in-progress   | TICK           |
  When each combination is processed
  Then the next state should equal the input state
  And no actions should be returned
```

**Verification:**
```bash
cd plugins/m42-sprint/runtime && node dist/transition.test.js 2>&1 | grep -E "✓ Invalid:" | wc -l
# Pass: >= 4 (all invalid transition tests pass)
```

---

## Scenario 8: Helper Functions and Pure Function Properties
```gherkin
Scenario: advancePointer correctly navigates the phase hierarchy
  Given various pointer positions and progress structures
  When advancePointer is called
  Then it should correctly advance sub-phase, step, or phase
  And hasMore should be true unless at the end

Scenario: calculateBackoff returns appropriate delays
  Given retry configuration with backoffMs [1000, 2000, 4000]
  When calculateBackoff is called at various retry counts
  Then it should return the correct delay from the array
  And it should cap at the last value when beyond array length

Scenario: transition function is pure
  Given the same state, event, and context
  When transition is called multiple times
  Then it should produce identical outputs
  And it should not mutate the input state or context
```

**Verification:**
```bash
cd plugins/m42-sprint/runtime && node dist/transition.test.js 2>&1 | grep -E "✓ (advancePointer|calculateBackoff|getCurrentPhase|getCurrentStep|getCurrentSubPhase|transition: is pure|transition: does not mutate):" | wc -l
# Pass: >= 12 (all helper and pure function tests pass)
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| `plugins/m42-sprint/runtime/src/transition.test.ts` | 49 | 1, 2, 3, 4, 5, 6, 7, 8 |

### Test Categories

| Category | Count | Description |
|----------|-------|-------------|
| START Event | 5 | Transitions, actions, state initialization |
| PHASE_COMPLETE Event | 7 | Pointer advancement, completion detection |
| PHASE_FAILED Event | 5 | Retry handling, blocked transitions |
| PAUSE Event | 4 | State preservation, actions |
| RESUME Event | 4 | State restoration, actions |
| PROPOSE_STEPS Event | 4 | Auto-approve, queuing |
| MAX_ITERATIONS_REACHED | 2 | Blocked transition |
| HUMAN_NEEDED | 2 | Needs-human transition |
| Invalid Transitions | 4 | No-op verification |
| Helper Functions | 10 | advancePointer, calculateBackoff, getCurrentPhase/Step/SubPhase |
| Pure Function | 3 | Immutability, determinism |

---

## RED Phase Verification

Tests are expected to FAIL at this point because the implementation doesn't exist yet:

```bash
cd plugins/m42-sprint/runtime && npm run build && npm run test
# Expected: FAIL - Cannot find module './transition.js'
```

Or more specifically:

```bash
cd plugins/m42-sprint/runtime && npx tsc --noEmit src/transition.test.ts 2>&1
# Expected: FAIL - Cannot find module './transition.js' (import of non-existent file)
```

---

## Implementation Checklist (for GREEN phase)

When implementing `transition.ts`, ensure:

1. **Core Function Signature**
   - [ ] Export `transition(state, event, context): TransitionResult`
   - [ ] Handle all SprintEvent types with exhaustive switch
   - [ ] Return `{ nextState, actions, context }` for every case

2. **Event Handlers**
   - [ ] START: Initialize in-progress state with timestamp and iteration
   - [ ] PHASE_COMPLETE: Use advancePointer, handle completion
   - [ ] PHASE_FAILED: Check guards.isRetryable, schedule retry or block
   - [ ] PAUSE: Preserve pointer in pausedAt
   - [ ] RESUME: Restore pointer from pausedAt
   - [ ] PROPOSE_STEPS: Check orchestration config, auto-approve or queue
   - [ ] MAX_ITERATIONS_REACHED: Transition to blocked
   - [ ] HUMAN_NEEDED: Transition to needs-human
   - [ ] TICK: No-op (return unchanged)

3. **Helper Functions**
   - [ ] Export `advancePointer(current, context): { nextPointer, hasMore }`
   - [ ] Export `calculateBackoff(context): number`
   - [ ] Export `getCurrentPhase(progress): CompiledTopPhase | undefined`
   - [ ] Export `getCurrentStep(progress): CompiledStep | undefined`
   - [ ] Export `getCurrentSubPhase(progress): CompiledPhase | undefined`

4. **Guard Usage**
   - [ ] Import guards from `../../compiler/src/types.js`
   - [ ] Use `guards.hasMorePhases`, `guards.hasMoreSteps`, etc.
   - [ ] Use `guards.isRetryable` for PHASE_FAILED handling
   - [ ] Use `guards.orchestrationEnabled` and `guards.autoApproveEnabled` for PROPOSE_STEPS

5. **Pure Function Requirements**
   - [ ] Never mutate input state, event, or context
   - [ ] Use spread operators or Object.assign for new objects
   - [ ] Generate timestamps consistently (allow injection for testing)
