# Gherkin Scenarios: type-system

## Step Task
GIVEN the current string-based status types in m42-sprint
WHEN applying XState-inspired patterns for type safety
THEN create discriminated unions and event types

## Scope
Enhance `plugins/m42-sprint/compiler/src/types.ts` only.
NO runtime changes - types only.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: SprintState Discriminated Union
```gherkin
Scenario: SprintState discriminated union provides type-safe state access
  Given the type system has SprintState discriminated union
  When I create a state with status 'in-progress'
  Then TypeScript requires current, iteration, and startedAt fields
  And when I create a state with status 'not-started'
  Then TypeScript only requires the status field
  And when I create a state with status 'blocked'
  Then TypeScript requires error, failedPhase, and blockedAt fields

Verification: `cd plugins/m42-sprint/compiler && npm run typecheck 2>&1 | grep -E "SprintState" || exit 0`
Pass: TypeScript compiles with no SprintState errors → Score 1
Fail: TypeScript errors about SprintState → Score 0
```

---

## Scenario 2: SprintEvent Union with Exhaustive Handling
```gherkin
Scenario: SprintEvent union enables exhaustive switch handling
  Given the type system has SprintEvent discriminated union
  When I handle all event types in a switch statement
  Then TypeScript can verify exhaustiveness with 'never' type
  And each event type has its specific required payload fields

Verification: `cd plugins/m42-sprint/compiler && npm run typecheck 2>&1 | grep -E "SprintEvent" || exit 0`
Pass: TypeScript compiles with no SprintEvent errors → Score 1
Fail: TypeScript errors about SprintEvent → Score 0
```

---

## Scenario 3: SprintAction Union for Side Effects
```gherkin
Scenario: SprintAction union describes all possible side effects
  Given the type system has SprintAction discriminated union
  When I create a LOG action
  Then TypeScript requires level (info|warn|error) and message
  And when I create a SPAWN_CLAUDE action
  Then TypeScript requires prompt, phaseId, and onComplete
  And when I create an INSERT_STEP action
  Then TypeScript requires step and position

Verification: `cd plugins/m42-sprint/compiler && npm run typecheck 2>&1 | grep -E "SprintAction" || exit 0`
Pass: TypeScript compiles with no SprintAction errors → Score 1
Fail: TypeScript errors about SprintAction → Score 0
```

---

## Scenario 4: TransitionResult Interface
```gherkin
Scenario: TransitionResult combines next state, actions, and context updates
  Given the type system has TransitionResult interface
  When I create a transition result
  Then it must have nextState of type SprintState
  And it must have actions array of SprintAction[]
  And it must have context of type Partial<CompiledProgress>

Verification: `cd plugins/m42-sprint/compiler && npm run typecheck 2>&1 | grep -E "TransitionResult" || exit 0`
Pass: TypeScript compiles with no TransitionResult errors → Score 1
Fail: TypeScript errors about TransitionResult → Score 0
```

---

## Scenario 5: Guard Functions Object
```gherkin
Scenario: Guard functions object provides reusable condition checks
  Given the type system has a guards object
  When I access guards.hasMorePhases
  Then it returns a function (SprintState, CompiledProgress, SprintEvent) => boolean
  And guards.hasMoreSteps, hasMoreSubPhases, isRetryable exist
  And guards.hasStepQueue, orchestrationEnabled, autoApproveEnabled exist

Verification: `cd plugins/m42-sprint/compiler && npm run typecheck 2>&1 | grep -E "guards" || exit 0`
Pass: TypeScript compiles with guards object → Score 1
Fail: TypeScript errors about guards → Score 0
```

---

## Scenario 6: Backwards Compatibility with Old Types
```gherkin
Scenario: Old SprintStatus type remains functional with deprecation
  Given the original SprintStatus string union type
  When I use SprintStatus in existing code
  Then it still type-checks as before
  And the type has @deprecated JSDoc annotation

Verification: `grep -q "@deprecated" plugins/m42-sprint/compiler/src/types.ts && cd plugins/m42-sprint/compiler && npm run typecheck`
Pass: @deprecated exists and typecheck passes → Score 1
Fail: Missing deprecation or typecheck fails → Score 0
```

---

## Scenario 7: Build Passes with New Types
```gherkin
Scenario: Full build succeeds with new type definitions
  Given all new discriminated unions are added to types.ts
  When I run npm run build in the compiler directory
  Then the build completes successfully
  And dist/types.js is generated

Verification: `cd plugins/m42-sprint/compiler && npm run build && test -f dist/types.js`
Pass: Build succeeds and dist/types.js exists → Score 1
Fail: Build fails or dist/types.js missing → Score 0
```

---

## Scenario 8: Unit Tests Pass for Type Definitions
```gherkin
Scenario: Type definition tests validate all new types
  Given the test file types.test.ts exists
  When I run npm run test
  Then all type definition tests pass
  And tests cover SprintState, SprintEvent, SprintAction, TransitionResult, guards

Verification: `cd plugins/m42-sprint/compiler && npm run test 2>&1 | grep -E "tests completed" || exit 1`
Pass: Tests complete successfully → Score 1
Fail: Tests fail → Score 0
```

---

## Acceptance Criteria Mapping

### Discriminated Union: SprintState
| Criterion | Test Case | Scenario |
|-----------|-----------|----------|
| `{ status: 'not-started' }` | SprintState: not-started state has only status field | 1 |
| `{ status: 'in-progress'; current; iteration; startedAt }` | SprintState: in-progress state requires... | 1 |
| `{ status: 'paused'; pausedAt; pauseReason }` | SprintState: paused state requires... | 1 |
| `{ status: 'blocked'; error; failedPhase; blockedAt }` | SprintState: blocked state requires... | 1 |
| `{ status: 'needs-human'; reason; details? }` | SprintState: needs-human state requires... | 1 |
| `{ status: 'completed'; summary?; completedAt; elapsed }` | SprintState: completed state requires... | 1 |

### Event Union: SprintEvent
| Criterion | Test Case | Scenario |
|-----------|-----------|----------|
| START, TICK, MAX_ITERATIONS_REACHED | SprintEvent: START/TICK/MAX_ITERATIONS events | 2 |
| PHASE_COMPLETE { summary, phaseId } | SprintEvent: PHASE_COMPLETE requires... | 2 |
| PHASE_FAILED { error, category, phaseId } | SprintEvent: PHASE_FAILED requires... | 2 |
| STEP_COMPLETE { summary, stepId } | SprintEvent: STEP_COMPLETE requires... | 2 |
| STEP_FAILED { error, category, stepId } | SprintEvent: STEP_FAILED requires... | 2 |
| PROPOSE_STEPS { steps, proposedBy } | SprintEvent: PROPOSE_STEPS requires... | 2 |
| PAUSE { reason }, RESUME | SprintEvent: PAUSE/RESUME events | 2 |
| HUMAN_NEEDED { reason, details? } | SprintEvent: HUMAN_NEEDED requires... | 2 |
| GOAL_COMPLETE { summary } | SprintEvent: GOAL_COMPLETE requires... | 2 |

### Action Union: SprintAction
| Criterion | Test Case | Scenario |
|-----------|-----------|----------|
| LOG { level, message } | SprintAction: LOG requires level and message | 3 |
| SPAWN_CLAUDE { prompt, phaseId, onComplete } | SprintAction: SPAWN_CLAUDE requires... | 3 |
| WRITE_PROGRESS | SprintAction: WRITE_PROGRESS has only type | 3 |
| UPDATE_STATS { updates } | SprintAction: UPDATE_STATS requires updates | 3 |
| EMIT_ACTIVITY { activity, data } | SprintAction: EMIT_ACTIVITY requires... | 3 |
| SCHEDULE_RETRY { phaseId, delayMs } | SprintAction: SCHEDULE_RETRY requires... | 3 |
| INSERT_STEP { step, position } | SprintAction: INSERT_STEP requires... | 3 |

### TransitionResult Interface
| Criterion | Test Case | Scenario |
|-----------|-----------|----------|
| nextState: SprintState | TransitionResult: has nextState | 4 |
| actions: SprintAction[] | TransitionResult: has actions | 4 |
| context: Partial<CompiledProgress> | TransitionResult: context is partial | 4 |

### Guard Functions
| Criterion | Test Case | Scenario |
|-----------|-----------|----------|
| hasMorePhases | guards: hasMorePhases returns true/false | 5 |
| hasMoreSteps | guards: hasMoreSteps returns true/false | 5 |
| hasMoreSubPhases | guards: hasMoreSubPhases returns true | 5 |
| isRetryable | guards: isRetryable returns true/false | 5 |
| hasStepQueue | guards: hasStepQueue returns true/false | 5 |
| orchestrationEnabled | guards: orchestrationEnabled returns true | 5 |
| autoApproveEnabled | guards: autoApproveEnabled returns true | 5 |

### Backwards Compatibility
| Criterion | Test Case | Scenario |
|-----------|-----------|----------|
| @deprecated JSDoc on old SprintStatus | Scenario 6 verification | 6 |
| Old types still work | SprintStatus/PhaseStatus old types work | 6 |
| npm run typecheck passes | Scenario 6, 7 verifications | 6, 7 |
| npm run build passes | Scenario 7 verification | 7 |

---

## Unit Test Coverage
| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| `plugins/m42-sprint/compiler/src/types.test.ts` | 38 | 1, 2, 3, 4, 5, 6 |

---

## RED Phase Verification

Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/compiler && npm run build
# Expected: FAIL (types SprintState, SprintEvent, SprintAction, etc. don't exist)

cd plugins/m42-sprint/compiler && npm run test
# Expected: FAIL (imports will fail, tests cannot run)
```

### Expected Errors
1. `Cannot find name 'SprintState'` - Type not yet defined
2. `Cannot find name 'SprintEvent'` - Type not yet defined
3. `Cannot find name 'SprintAction'` - Type not yet defined
4. `Cannot find name 'TransitionResult'` - Interface not yet defined
5. `Cannot find name 'guards'` - Guards object not yet exported
6. `Module '"./types.js"' has no exported member 'SprintState'` - Export missing

These failures confirm the RED phase is complete - tests exist but implementation does not.

---

## Implementation Notes (for GREEN phase)

Add to `plugins/m42-sprint/compiler/src/types.ts`:

1. **SprintState** - Discriminated union with 6 variants
2. **SprintEvent** - Discriminated union with 12 event types
3. **SprintAction** - Discriminated union with 7 action types
4. **TransitionResult** - Interface combining state, actions, context
5. **GuardFn** - Type alias for guard function signature
6. **guards** - Exported object with 7 guard functions
7. Add `@deprecated` JSDoc to existing `SprintStatus` type

---

## Document Metadata
- **Phase**: RED (Write failing tests)
- **Step**: type-system (1/9)
- **Sprint**: 2026-01-20_typescript-runtime-migration
- **Created**: 2026-01-19
- **Author**: Sprint Automation
