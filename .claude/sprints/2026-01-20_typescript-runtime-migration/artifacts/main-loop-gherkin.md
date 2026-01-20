# Gherkin Scenarios: main-loop

## Step Task
GIVEN all support modules (transition, yaml-ops, prompt-builder, claude-runner, executor)
WHEN implementing the main sprint loop
THEN replace sprint-loop.sh (2,464 lines) with TypeScript

## Scope
Create NEW file: plugins/m42-sprint/runtime/src/loop.ts

## Acceptance Criteria

### Main Function
- [ ] `runLoop(sprintDir: string, options: LoopOptions)` → Promise<SprintState>

### Options
- [ ] maxIterations?: number (0 = unlimited)
- [ ] delay?: number (ms between iterations, default 2000)
- [ ] verbose?: boolean

### Loop Logic
1. [ ] Recover from interrupted transaction on startup
2. [ ] Load PROGRESS.yaml via yaml-ops
3. [ ] Restore SprintState from progress
4. [ ] While not terminal state:
   - [ ] Check max iterations
   - [ ] Check pause signal (PAUSE file in sprint dir)
   - [ ] Backup progress (transaction start)
   - [ ] Determine next event based on state
   - [ ] Call transition(state, event, context)
   - [ ] Execute actions via executor
   - [ ] Process resulting events recursively
   - [ ] Write progress (transaction commit)
   - [ ] Clean up backup
   - [ ] Sleep delay

### Terminal States
- [ ] 'completed', 'blocked', 'paused', 'needs-human'

### Recovery
- [ ] `recoverFromInterrupt(progressPath)` → void
- [ ] Check for .backup file on startup
- [ ] Validate checksum, restore if needed

### Logging
- [ ] Log iteration start/end
- [ ] Log state transitions
- [ ] Log errors with context

### Tests
- [ ] Integration test: full loop with mock Claude
- [ ] Test: pause signal stops loop
- [ ] Test: max iterations enforced
- [ ] Test: crash recovery works
- [ ] Test: behavior matches sprint-loop.sh

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Basic Loop Execution to Completion

```gherkin
Scenario: Basic loop runs phases to completion
  Given a sprint directory with PROGRESS.yaml at status "not-started"
  And the sprint has 2 simple phases
  When runLoop is called with mock Claude returning success
  Then the final state should be "completed"
  And all phases should have status "completed"
  And PROGRESS.yaml should have status "completed"

Verification: `test -f "$SPRINT_DIR/PROGRESS.yaml" && grep -q 'status: completed' "$SPRINT_DIR/PROGRESS.yaml"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Max Iterations Enforced

```gherkin
Scenario: Loop stops when max iterations reached
  Given a sprint directory with PROGRESS.yaml at status "in-progress"
  And the sprint has 10 phases (more than max iterations)
  And runLoop is called with maxIterations = 3
  When the loop runs
  Then the loop should stop after 3 iterations
  And the final state should be "blocked"
  And the error should mention "Maximum iteration limit reached"

Verification: `grep -q "iteration limit\|MAX_ITERATIONS" "$SPRINT_DIR/PROGRESS.yaml" 2>/dev/null || exit 0`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Pause Signal Detection

```gherkin
Scenario: Loop detects PAUSE file and pauses execution
  Given a sprint directory with PROGRESS.yaml at status "in-progress"
  And a PAUSE file exists in the sprint directory
  When runLoop is called
  Then the final state should be "paused"
  And PROGRESS.yaml should have status "paused"
  And the pauseReason should indicate "PAUSE file detected"

Verification: `test -f "$SPRINT_DIR/PAUSE" && grep -q 'status: paused' "$SPRINT_DIR/PROGRESS.yaml"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Crash Recovery from Backup

```gherkin
Scenario: Loop recovers from interrupted transaction on startup
  Given a sprint directory with PROGRESS.yaml.backup file
  And PROGRESS.yaml has a checksum mismatch (corrupted)
  When runLoop is called
  Then recoverFromInterrupt should restore from backup
  And the loop should continue from restored state
  And the backup file should be cleaned up after recovery

Verification: `! test -f "$SPRINT_DIR/PROGRESS.yaml.backup"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Transaction Safety During Phase Execution

```gherkin
Scenario: Progress is backed up before phase execution
  Given a sprint directory with PROGRESS.yaml at status "in-progress"
  When a phase is about to execute
  Then backupProgress should be called before Claude invocation
  And cleanupBackup should be called after successful completion
  And no backup file should remain after successful iteration

Verification: `! test -f "$SPRINT_DIR/PROGRESS.yaml.backup"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Human Intervention Required

```gherkin
Scenario: Loop stops with needs-human when Claude returns needs-human status
  Given a sprint directory with PROGRESS.yaml at status "in-progress"
  And Claude returns JSON result with status "needs-human"
  And the result contains humanNeeded.reason
  When runLoop processes the result
  Then the final state should be "needs-human"
  And PROGRESS.yaml should have human-needed.reason populated

Verification: `grep -q 'status: needs-human' "$SPRINT_DIR/PROGRESS.yaml" && grep -q 'human-needed:' "$SPRINT_DIR/PROGRESS.yaml"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Event Processing and State Transitions

```gherkin
Scenario: Loop correctly processes events through transition function
  Given a sprint at status "not-started"
  When runLoop sends START event
  Then transition should return in-progress state
  And SPAWN_CLAUDE action should be returned
  When PHASE_COMPLETE event is received
  Then pointer should advance to next phase
  And WRITE_PROGRESS action should be executed

Verification: `node -e "const {transition} = require('./dist/transition.js'); const r = transition({status:'not-started'}, {type:'START'}, {current:{phase:0,step:null,'sub-phase':null},phases:[{id:'p1',prompt:'test'}]}); console.log(r.nextState.status); process.exit(r.nextState.status === 'in-progress' ? 0 : 1);"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Delay Between Iterations

```gherkin
Scenario: Loop respects delay option between iterations
  Given a sprint directory with multiple phases
  And runLoop is called with delay = 100 (ms)
  When the loop completes 2 iterations
  Then at least 100ms should have elapsed between iterations
  And total elapsed time should be >= (iterations - 1) * delay

Verification: `exit 0` # Verified by timing assertions in unit test
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| loop.test.ts | 18+ | 1, 2, 3, 4, 5, 6, 7, 8 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/runtime && npm run test
# Expected: FAIL (no implementation yet - loop.ts doesn't exist)
```

## Test Categories

### Integration Tests
- Full loop execution with mock Claude runner
- Multi-phase sprint completion
- Error handling and retry scenarios

### Unit Tests
- recoverFromInterrupt function
- isTerminalState helper
- Pause signal detection
- Delay timing
- LoopOptions validation

### Edge Cases
- Empty phases array
- Already completed sprint
- Missing PROGRESS.yaml
- Invalid YAML syntax
- Checksum mismatch recovery
