# Gherkin Scenarios: executor

## Step Task
GIVEN the SprintAction types and support modules (yaml-ops, prompt-builder, claude-runner)
WHEN implementing the executor
THEN map each action type to its implementation

## Scope
Create NEW file: plugins/m42-sprint/runtime/src/executor.ts

## Acceptance Criteria

### Main Functions
- [ ] `executeAction(action: SprintAction, context: ExecutorContext)` → Promise<SprintEvent | null>
- [ ] `executeActions(actions: SprintAction[], context)` → Promise<SprintEvent[]>

### Action Implementations
- [ ] LOG → console.log/warn/error based on level
- [ ] SPAWN_CLAUDE → call claude-runner, return PHASE_COMPLETE or PHASE_FAILED
- [ ] WRITE_PROGRESS → call yaml-ops.writeProgressAtomic
- [ ] UPDATE_STATS → update in-memory context (will be persisted by WRITE_PROGRESS)
- [ ] EMIT_ACTIVITY → append to .sprint-activity.jsonl
- [ ] SCHEDULE_RETRY → sleep for delayMs, return event to retry
- [ ] INSERT_STEP → update progress.phases with new step

### ExecutorContext Interface
- [ ] sprintDir: string
- [ ] progress: CompiledProgress (mutable reference)
- [ ] verbose: boolean

### Type Safety
- [ ] Exhaustive switch with `never` check
- [ ] TypeScript error if action type missing

### Tests
- [ ] Unit test for each action type
- [ ] Mock claude-runner for SPAWN_CLAUDE tests
- [ ] Mock fs for WRITE_PROGRESS tests
- [ ] Test: executeActions runs in sequence

## Files to Create
- plugins/m42-sprint/runtime/src/executor.ts
- plugins/m42-sprint/runtime/src/executor.test.ts

## Context
Read: context/xstate-patterns-plan.md (Phase 3 section)

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: LOG action with info level
```gherkin
Scenario: LOG action logs message at info level
  Given an executor context with sprintDir and progress
  When executeAction is called with LOG action at info level
  Then console.log is called with the message
  And the function returns null

Verification: `cd plugins/m42-sprint/runtime && npm test 2>&1 | grep -q "LOG action with info level should call console.log"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: LOG action with warn/error levels
```gherkin
Scenario: LOG action logs message at warn level
  Given an executor context
  When executeAction is called with LOG action at warn level
  Then console.warn is called with the message
  And the function returns null

Scenario: LOG action logs message at error level
  Given an executor context
  When executeAction is called with LOG action at error level
  Then console.error is called with the message
  And the function returns null

Verification: `cd plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "(LOG action with warn|LOG action with error)" | wc -l | grep -q "2"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: SPAWN_CLAUDE returns appropriate events
```gherkin
Scenario: SPAWN_CLAUDE returns PHASE_COMPLETE on success
  Given an executor context with valid sprintDir
  And claude-runner is configured to return success
  When executeAction is called with SPAWN_CLAUDE action
  Then runClaude is called with the prompt
  And a PHASE_COMPLETE event is returned

Scenario: SPAWN_CLAUDE returns PHASE_FAILED on failure
  Given an executor context
  And claude-runner is configured to return failure
  When executeAction is called with SPAWN_CLAUDE action
  Then a PHASE_FAILED event is returned with error category

Verification: `cd plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "SPAWN_CLAUDE.*should return" | wc -l | grep -q "[12]"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: WRITE_PROGRESS calls yaml-ops
```gherkin
Scenario: WRITE_PROGRESS writes progress atomically
  Given an executor context with sprintDir and progress
  When executeAction is called with WRITE_PROGRESS action
  Then writeProgressAtomic is called with progress file path
  And the function returns null

Verification: `cd plugins/m42-sprint/runtime && npm test 2>&1 | grep -q "WRITE_PROGRESS action should call writeProgressAtomic"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: UPDATE_STATS modifies context in-memory
```gherkin
Scenario: UPDATE_STATS updates progress.stats
  Given an executor context with initial stats
  When executeAction is called with UPDATE_STATS action
  Then the progress.stats object is updated with new values
  And existing stats not in updates are preserved
  And the function returns null

Verification: `cd plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "UPDATE_STATS.*should (update|preserve)" | wc -l | grep -q "2"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: EMIT_ACTIVITY appends to activity file
```gherkin
Scenario: EMIT_ACTIVITY creates activity file if not exists
  Given an executor context with sprintDir
  And no .sprint-activity.jsonl file exists
  When executeAction is called with EMIT_ACTIVITY action
  Then a new .sprint-activity.jsonl file is created
  And it contains the activity entry as JSONL

Scenario: EMIT_ACTIVITY appends to existing activity file
  Given an executor context with sprintDir
  And .sprint-activity.jsonl file has existing entries
  When executeAction is called with EMIT_ACTIVITY action
  Then the new entry is appended to the file
  And existing entries are preserved

Verification: `cd plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "EMIT_ACTIVITY.*should (append|create)" | wc -l | grep -q "[12]"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: SCHEDULE_RETRY sleeps and returns event
```gherkin
Scenario: SCHEDULE_RETRY waits for specified delay
  Given an executor context
  When executeAction is called with SCHEDULE_RETRY action with delayMs=50
  Then the function waits at least 50ms before returning
  And an event is returned to trigger retry logic

Verification: `cd plugins/m42-sprint/runtime && npm test 2>&1 | grep -q "SCHEDULE_RETRY action should sleep"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: INSERT_STEP modifies progress.phases
```gherkin
Scenario: INSERT_STEP adds step after current position
  Given an executor context with progress having steps
  And current position is at step 0
  When executeAction is called with INSERT_STEP position="after-current"
  Then a new step is inserted at index 1
  And the step has correct id and prompt from StepQueueItem

Scenario: INSERT_STEP adds step at end of phase
  Given an executor context with progress having steps
  When executeAction is called with INSERT_STEP position="end-of-phase"
  Then the new step is appended at the end of steps array

Verification: `cd plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "INSERT_STEP.*should (add|insert)" | wc -l | grep -q "2"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 9: executeActions runs in sequence
```gherkin
Scenario: executeActions processes actions sequentially
  Given multiple actions in an array
  When executeActions is called with the array
  Then each action is executed in order
  And events from non-null results are collected
  And the collected events array is returned

Verification: `cd plugins/m42-sprint/runtime && npm test 2>&1 | grep -q "executeActions should run actions in sequence"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 10: Exhaustive type handling
```gherkin
Scenario: All action types are handled exhaustively
  Given the SprintAction discriminated union with 7 action types
  When executeAction is called with any valid action type
  Then the action is handled without throwing
  And TypeScript enforces exhaustive switch with `never` check

Verification: `cd plugins/m42-sprint/runtime && npm test 2>&1 | grep -q "executeAction should handle all action types"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| executor.test.ts | 18 | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 |

## Test Categories

### LOG Action Tests (3 tests)
1. LOG action with info level should call console.log
2. LOG action with warn level should call console.warn
3. LOG action with error level should call console.error

### SPAWN_CLAUDE Action Tests (2 tests)
4. SPAWN_CLAUDE action should return PHASE_COMPLETE on successful Claude run
5. SPAWN_CLAUDE action should return PHASE_FAILED on Claude failure

### WRITE_PROGRESS Action Tests (1 test)
6. WRITE_PROGRESS action should call writeProgressAtomic

### UPDATE_STATS Action Tests (2 tests)
7. UPDATE_STATS action should update progress.stats in context
8. UPDATE_STATS action should preserve existing stats not in updates

### EMIT_ACTIVITY Action Tests (2 tests)
9. EMIT_ACTIVITY action should append to .sprint-activity.jsonl
10. EMIT_ACTIVITY action should append to existing file

### SCHEDULE_RETRY Action Tests (1 test)
11. SCHEDULE_RETRY action should sleep for delayMs

### INSERT_STEP Action Tests (2 tests)
12. INSERT_STEP action should add step to progress after current position
13. INSERT_STEP action with end-of-phase should add step at end

### executeActions Tests (2 tests)
14. executeActions should run actions in sequence
15. executeActions should collect non-null events from actions

### Type Safety Tests (2 tests)
16. executeAction should handle all action types (exhaustive)
17. ExecutorContext should have required properties

### Verbose Mode Tests (1 test)
18. LOG action in verbose mode should include prefix

## RED Phase Verification

Tests are expected to FAIL at this point because the implementation doesn't exist yet:

```bash
cd plugins/m42-sprint/runtime && npm run build && npm test
# Expected: FAIL (executor.ts does not exist)
```

The test file imports from `./executor.js` which does not exist, causing immediate failure.

## Implementation Notes

### ExecutorContext Interface
```typescript
export interface ExecutorContext {
  sprintDir: string;              // Path to sprint directory
  progress: CompiledProgress;     // Mutable reference to progress state
  verbose: boolean;               // Enable verbose logging
}
```

### Expected Function Signatures
```typescript
export async function executeAction(
  action: SprintAction,
  context: ExecutorContext
): Promise<SprintEvent | null>;

export async function executeActions(
  actions: SprintAction[],
  context: ExecutorContext
): Promise<SprintEvent[]>;
```

### Exhaustive Switch Pattern
```typescript
switch (action.type) {
  case 'LOG': /* ... */ break;
  case 'SPAWN_CLAUDE': /* ... */ break;
  case 'WRITE_PROGRESS': /* ... */ break;
  case 'UPDATE_STATS': /* ... */ break;
  case 'EMIT_ACTIVITY': /* ... */ break;
  case 'SCHEDULE_RETRY': /* ... */ break;
  case 'INSERT_STEP': /* ... */ break;
  default:
    const _exhaustive: never = action;
    throw new Error(`Unhandled action type: ${JSON.stringify(action)}`);
}
```
