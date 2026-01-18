# Gherkin Scenarios: step-9

## Step Task
Create integration test for parallel execution:

1. Create test workflow with parallel sub-phase in step workflow
2. Create test sprint with 2-3 steps using this workflow
3. Run compilation and verify:
   - parallel-tasks array is initialized
   - parallel flag propagates to compiled sub-phases
   - wait-for-parallel flag appears on sync phases

4. Test execution (manual or automated):
   - Verify parallel tasks spawn as background processes
   - Verify main loop advances without waiting
   - Verify wait-for-parallel blocks until completion
   - Check parallel task logs are created
   - Test failure handling (kill a parallel task, check status)

Reference: context/implementation-plan.md section 8 (Verification Plan)


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Test step workflow with parallel sub-phase exists
```gherkin
Scenario: Test step workflow with parallel sub-phase exists
  Given the parallel execution feature is implemented
  When I check for the test step workflow
  Then .claude/workflows/test-parallel-step.yaml exists with a parallel sub-phase

Verification: `test -f .claude/workflows/test-parallel-step.yaml && grep -q "parallel: true" .claude/workflows/test-parallel-step.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Test main workflow with wait-for-parallel sync phase exists
```gherkin
Scenario: Test main workflow with wait-for-parallel sync phase exists
  Given the parallel execution feature is implemented
  When I check for the test main workflow
  Then .claude/workflows/test-parallel-main.yaml exists with wait-for-parallel phase

Verification: `test -f .claude/workflows/test-parallel-main.yaml && grep -q "wait-for-parallel: true" .claude/workflows/test-parallel-main.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Test sprint definition with multiple steps exists
```gherkin
Scenario: Test sprint definition with multiple steps exists
  Given the test workflows exist
  When I check for the test sprint definition
  Then .claude/sprints/test-parallel-execution/SPRINT.yaml exists with at least 2 steps

Verification: `test -f .claude/sprints/test-parallel-execution/SPRINT.yaml && yq -e '.steps | length >= 2' .claude/sprints/test-parallel-execution/SPRINT.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Compiled PROGRESS.yaml initializes parallel-tasks array
```gherkin
Scenario: Compiled PROGRESS.yaml initializes parallel-tasks array
  Given the test sprint is compiled
  When I check the compiled PROGRESS.yaml
  Then parallel-tasks array is initialized as empty array

Verification: `test -f .claude/sprints/test-parallel-execution/PROGRESS.yaml && yq -e '."parallel-tasks" == []' .claude/sprints/test-parallel-execution/PROGRESS.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Parallel flag propagates to compiled sub-phases
```gherkin
Scenario: Parallel flag propagates to compiled sub-phases
  Given the test sprint is compiled
  When I search for parallel sub-phases in PROGRESS.yaml
  Then at least one compiled sub-phase has parallel: true

Verification: `yq -e '[.phases[].steps[]?.phases[]? | select(.parallel == true)] | length > 0' .claude/sprints/test-parallel-execution/PROGRESS.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Wait-for-parallel flag appears on sync phase
```gherkin
Scenario: Wait-for-parallel flag appears on sync phase
  Given the test sprint is compiled
  When I search for wait-for-parallel phases in PROGRESS.yaml
  Then at least one top-level phase has wait-for-parallel: true

Verification: `yq -e '[.phases[] | select(."wait-for-parallel" == true)] | length > 0' .claude/sprints/test-parallel-execution/PROGRESS.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Sprint loop parallel helper functions exist
```gherkin
Scenario: Sprint loop parallel helper functions exist
  Given the sprint loop script exists
  When I check for parallel management functions
  Then is_parallel_subphase, spawn_parallel_task, wait_for_parallel_tasks functions are defined

Verification: `grep -q "is_parallel_subphase()" plugins/m42-sprint/scripts/sprint-loop.sh && grep -q "spawn_parallel_task()" plugins/m42-sprint/scripts/sprint-loop.sh && grep -q "wait_for_parallel_tasks()" plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Build parallel prompt script exists and is executable
```gherkin
Scenario: Build parallel prompt script exists and is executable
  Given the parallel execution feature is implemented
  When I check for the parallel prompt builder script
  Then plugins/m42-sprint/scripts/build-parallel-prompt.sh exists and is executable

Verification: `test -x plugins/m42-sprint/scripts/build-parallel-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```
