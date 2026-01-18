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
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: WorkflowPhase has parallel property
  Given the types.ts file exists in the compiler
  When I check the WorkflowPhase interface
  Then it contains an optional parallel boolean property

Verification: `grep -Pzo "interface WorkflowPhase \{[^}]*parallel\?: boolean" plugins/m42-sprint/compiler/src/types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: WorkflowPhase has wait-for-parallel property
  Given the types.ts file exists in the compiler
  When I check the WorkflowPhase interface
  Then it contains an optional wait-for-parallel boolean property

Verification: `grep -Pzo "interface WorkflowPhase \{[^}]*'wait-for-parallel'\?: boolean" plugins/m42-sprint/compiler/src/types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: ParallelTask interface exists with required fields
  Given the types.ts file exists in the compiler
  When I check for the ParallelTask interface
  Then it exists with id, step-id, phase-id, and status fields

Verification: `grep -q "export interface ParallelTask" plugins/m42-sprint/compiler/src/types.ts && grep -q "'step-id':" plugins/m42-sprint/compiler/src/types.ts && grep -q "'phase-id':" plugins/m42-sprint/compiler/src/types.ts && grep -q "status:" plugins/m42-sprint/compiler/src/types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: ParallelTask has correct status union type
  Given the ParallelTask interface exists
  When I check the status field type
  Then it is a union of 'spawned', 'running', 'completed', 'failed'

Verification: `grep -E "'spawned'.*\|.*'running'.*\|.*'completed'.*\|.*'failed'" plugins/m42-sprint/compiler/src/types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: CompiledProgress has parallel-tasks array
  Given the types.ts file exists in the compiler
  When I check the CompiledProgress interface
  Then it contains an optional parallel-tasks array of ParallelTask

Verification: `grep -Pzo "interface CompiledProgress \{[^}]*'parallel-tasks'\?: ParallelTask\[\]" plugins/m42-sprint/compiler/src/types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: CompiledPhase has parallel execution properties
  Given the types.ts file exists in the compiler
  When I check the CompiledPhase interface
  Then it contains parallel and parallel-task-id optional properties

Verification: `grep -Pzo "interface CompiledPhase \{[^}]*parallel\?: boolean" plugins/m42-sprint/compiler/src/types.ts && grep -Pzo "interface CompiledPhase \{[^}]*'parallel-task-id'\?: string" plugins/m42-sprint/compiler/src/types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: CompiledTopPhase has wait-for-parallel property
  Given the types.ts file exists in the compiler
  When I check the CompiledTopPhase interface
  Then it contains an optional wait-for-parallel boolean property

Verification: `grep -Pzo "interface CompiledTopPhase \{[^}]*'wait-for-parallel'\?: boolean" plugins/m42-sprint/compiler/src/types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: TypeScript compiles without errors
  Given all type additions are complete
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
