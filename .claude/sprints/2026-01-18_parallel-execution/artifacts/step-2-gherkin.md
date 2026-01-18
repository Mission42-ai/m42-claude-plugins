# Gherkin Scenarios: step-2

## Step Task
Update compiler/src/compile.ts to initialize parallel-tasks array:

1. In the compile() function around line 209 where CompiledProgress is built
2. Add initialization: `'parallel-tasks': []`
3. Propagate `wait-for-parallel` from WorkflowPhase to CompiledTopPhase in expandForEach and compileSimplePhase

Reference: context/implementation-plan.md section 4.C

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Parallel-tasks array initialized in compile.ts
  Given the compile.ts file exists
  When I check for parallel-tasks initialization in CompiledProgress
  Then the 'parallel-tasks': [] property is present in the progress object

Verification: `grep -q "'parallel-tasks': \[\]" plugins/m42-sprint/compiler/src/compile.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: expandForEach propagates wait-for-parallel
  Given the expand-foreach.ts file exists
  When I check the expandForEach function return object
  Then wait-for-parallel is copied from the phase parameter

Verification: `grep -q "'wait-for-parallel': phase\['wait-for-parallel'\]" plugins/m42-sprint/compiler/src/expand-foreach.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: compileSimplePhase propagates wait-for-parallel
  Given the expand-foreach.ts file exists
  When I check the compileSimplePhase function return object
  Then wait-for-parallel is copied from the phase parameter

Verification: `grep -A20 "function compileSimplePhase" plugins/m42-sprint/compiler/src/expand-foreach.ts | grep -q "'wait-for-parallel'"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: TypeScript compiles without errors
  Given the implementation is complete
  When I run the TypeScript compiler in the compiler directory
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0

---

## Scenario 5: CompiledProgress type includes parallel-tasks field
  Given the types.ts source file exists
  When I check the CompiledProgress interface definition
  Then it includes the parallel-tasks property with ParallelTask[] type

Verification: `grep -q "'parallel-tasks'.*ParallelTask\[\]" plugins/m42-sprint/compiler/src/types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Unit tests pass
  Given the implementation is complete
  When I run the test suite
  Then all tests pass

Verification: `cd plugins/m42-sprint/compiler && npm test 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0
