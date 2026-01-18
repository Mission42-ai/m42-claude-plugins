# Gherkin Scenarios: step-3

## Step Task
Update compiler/src/validate.ts with parallel validation:

1. In validateWorkflowPhase() function (lines 174-235)
2. Add validation for `parallel` property (must be boolean if present)
3. Add validation for `wait-for-parallel` property (must be boolean if present)
4. Add warning if `parallel: true` is used on a for-each phase (not supported - should be used in step workflows only)

Reference: context/implementation-plan.md section 4.D

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: TypeScript compiles without errors
  Given the validate.ts file has been updated with parallel validation
  When I run the TypeScript compiler on the compiler project
  Then no compilation errors occur

Verification: `cd /home/konstantin/projects/.worktrees/m42-claude-plugins/parallel-execution/plugins/m42-sprint/compiler && npx tsc --noEmit`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Parallel property validation code exists
  Given validate.ts has been updated
  When I check for validation of the parallel property
  Then code exists to validate parallel is boolean when present

Verification: `grep -q "p\[.parallel.\].*boolean\|p\.parallel.*boolean\|parallel.*!==.*true.*!==.*false\|typeof.*parallel.*!==.*boolean" /home/konstantin/projects/.worktrees/m42-claude-plugins/parallel-execution/plugins/m42-sprint/compiler/src/validate.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Wait-for-parallel property validation code exists
  Given validate.ts has been updated
  When I check for validation of the wait-for-parallel property
  Then code exists to validate wait-for-parallel is boolean when present

Verification: `grep -q "wait-for-parallel" /home/konstantin/projects/.worktrees/m42-claude-plugins/parallel-execution/plugins/m42-sprint/compiler/src/validate.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Warning for parallel on for-each phase exists
  Given validate.ts has been updated
  When I check for the warning about parallel with for-each
  Then code exists to warn when parallel is used with for-each

Verification: `grep -q "for-each.*parallel\|parallel.*for-each" /home/konstantin/projects/.worktrees/m42-claude-plugins/parallel-execution/plugins/m42-sprint/compiler/src/validate.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Invalid parallel property returns validation error
  Given validate.ts has parallel validation implemented
  When I run the test suite for validation
  Then tests for invalid parallel type pass

Verification: `cd /home/konstantin/projects/.worktrees/m42-claude-plugins/parallel-execution/plugins/m42-sprint/compiler && npm test -- --testPathPattern="validate" 2>&1 | grep -q "PASS\|passing"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Error code for invalid parallel property exists
  Given validate.ts has been updated
  When I check for the INVALID_PARALLEL error code
  Then the error code is defined in the validation logic

Verification: `grep -q "INVALID_PARALLEL\|INVALID_WAIT_FOR_PARALLEL\|PARALLEL.*FOREACH" /home/konstantin/projects/.worktrees/m42-claude-plugins/parallel-execution/plugins/m42-sprint/compiler/src/validate.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
