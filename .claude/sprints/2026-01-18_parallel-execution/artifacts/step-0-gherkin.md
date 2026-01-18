# Gherkin Scenarios: step-0

## Step Task
Add parallel execution types to compiler/src/types.ts:

1. Add `parallel?: boolean` to WorkflowPhase interface (lines 68-77)
2. Add `wait-for-parallel?: boolean` to WorkflowPhase interface
3. Create new ParallelTask interface with fields:
   - id, step-id, phase-id
   - status: 'spawned' | 'running' | 'completed' | 'failed'
   - pid, log-file, spawned-at, completed-at, exit-code, error
4. Add `parallel-tasks?: ParallelTask[]` to CompiledProgress (lines 202-211)
5. Add `parallel?: boolean` and `parallel-task-id?: string` to CompiledPhase (lines 101-119)
6. Add `wait-for-parallel?: boolean` to CompiledTopPhase (lines 148-168)

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: WorkflowPhase has parallel property
  Given the types.ts file exists
  When I check the WorkflowPhase interface
  Then it contains an optional `parallel` boolean property

Verification: `grep -E "parallel\?.*:.*boolean" plugins/m42-sprint/compiler/src/types.ts | grep -v "wait-for-parallel" | grep -v "parallel-task" | head -1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: WorkflowPhase has wait-for-parallel property
  Given the types.ts file exists
  When I check the WorkflowPhase interface
  Then it contains an optional `wait-for-parallel` boolean property

Verification: `grep -E "'wait-for-parallel'\?.*:.*boolean" plugins/m42-sprint/compiler/src/types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: ParallelTask interface exists with required fields
  Given the types.ts file exists
  When I check for the ParallelTask interface
  Then it has id, step-id, phase-id, status, and spawned-at fields

Verification: `grep -A 15 "export interface ParallelTask" plugins/m42-sprint/compiler/src/types.ts | grep -E "(id:|'step-id':|'phase-id':|status:|'spawned-at':)" | wc -l | grep -q "^5$" && echo "pass"`
Pass: Output contains "pass" → Score 1
Fail: Output does not contain "pass" → Score 0

---

## Scenario 4: ParallelTask status has correct union type
  Given the ParallelTask interface exists
  When I check the status field type
  Then it is a union of 'spawned' | 'running' | 'completed' | 'failed'

Verification: `grep -A 15 "export interface ParallelTask" plugins/m42-sprint/compiler/src/types.ts | grep -E "status.*'spawned'.*'running'.*'completed'.*'failed'"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: CompiledProgress has parallel-tasks array
  Given the types.ts file exists
  When I check the CompiledProgress interface
  Then it contains an optional `parallel-tasks` array of ParallelTask

Verification: `grep -A 15 "export interface CompiledProgress" plugins/m42-sprint/compiler/src/types.ts | grep -E "'parallel-tasks'\?.*:.*ParallelTask\[\]"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: CompiledPhase has parallel execution fields
  Given the types.ts file exists
  When I check the CompiledPhase interface
  Then it contains optional `parallel` boolean and `parallel-task-id` string properties

Verification: `grep -A 25 "export interface CompiledPhase" plugins/m42-sprint/compiler/src/types.ts | grep -E "(parallel\?.*boolean|'parallel-task-id'\?.*string)" | wc -l | grep -q "^2$" && echo "pass"`
Pass: Output contains "pass" → Score 1
Fail: Output does not contain "pass" → Score 0

---

## Scenario 7: CompiledTopPhase has wait-for-parallel property
  Given the types.ts file exists
  When I check the CompiledTopPhase interface
  Then it contains an optional `wait-for-parallel` boolean property

Verification: `grep -A 25 "export interface CompiledTopPhase" plugins/m42-sprint/compiler/src/types.ts | grep -E "'wait-for-parallel'\?.*:.*boolean"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: TypeScript compiles without errors
  Given all type changes have been made
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npm run typecheck 2>&1; echo "EXIT:$?"`
Pass: Last line contains "EXIT:0" → Score 1
Fail: Last line does not contain "EXIT:0" → Score 0
