# Gherkin Scenarios: step-5

## Step Task
Update scripts/sprint-loop.sh with parallel task management:

Add new helper functions:
1. is_parallel_subphase() - Check if current sub-phase has parallel flag
2. spawn_parallel_task() - Spawn task in background, register in PROGRESS.yaml
3. is_wait_for_parallel_phase() - Check if phase has wait-for-parallel flag
4. wait_for_parallel_tasks() - Block until all parallel tasks complete
5. update_parallel_task_statuses() - Poll and update status of running tasks

Update main loop:
- When processing sub-phase, check if parallel - if yes, spawn and continue
- When processing top-level phase, check wait-for-parallel - if yes, wait
- Call update_parallel_task_statuses() periodically

Reference: context/implementation-plan.md section 4.E

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: is_parallel_subphase function exists
  Given scripts/sprint-loop.sh exists
  When I search for the is_parallel_subphase function
  Then the function is defined with correct signature

Verification: `grep -q 'is_parallel_subphase()' plugins/m42-sprint/scripts/sprint-loop.sh && grep -A5 'is_parallel_subphase()' plugins/m42-sprint/scripts/sprint-loop.sh | grep -q 'parallel'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: spawn_parallel_task function exists
  Given scripts/sprint-loop.sh exists
  When I search for the spawn_parallel_task function
  Then the function is defined and spawns background processes

Verification: `grep -q 'spawn_parallel_task()' plugins/m42-sprint/scripts/sprint-loop.sh && sed -n '/^spawn_parallel_task()/,/^[a-z_]*() {$/p' plugins/m42-sprint/scripts/sprint-loop.sh | grep -qE '\) &$'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: is_wait_for_parallel_phase function exists
  Given scripts/sprint-loop.sh exists
  When I search for the is_wait_for_parallel_phase function
  Then the function is defined with correct yq query

Verification: `grep -q 'is_wait_for_parallel_phase()' plugins/m42-sprint/scripts/sprint-loop.sh && sed -n '/^is_wait_for_parallel_phase()/,/^[a-z_]*() {$/p' plugins/m42-sprint/scripts/sprint-loop.sh | grep -q 'wait-for-parallel'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: wait_for_parallel_tasks function exists
  Given scripts/sprint-loop.sh exists
  When I search for the wait_for_parallel_tasks function
  Then the function is defined with polling loop

Verification: `grep -q 'wait_for_parallel_tasks()' plugins/m42-sprint/scripts/sprint-loop.sh && grep -A20 'wait_for_parallel_tasks()' plugins/m42-sprint/scripts/sprint-loop.sh | grep -qE 'while|sleep'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: update_parallel_task_statuses function exists
  Given scripts/sprint-loop.sh exists
  When I search for the update_parallel_task_statuses function
  Then the function is defined and checks process status

Verification: `grep -q 'update_parallel_task_statuses()' plugins/m42-sprint/scripts/sprint-loop.sh && grep -A30 'update_parallel_task_statuses()' plugins/m42-sprint/scripts/sprint-loop.sh | grep -qE 'kill -0|parallel-tasks'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Main loop checks for parallel sub-phases
  Given scripts/sprint-loop.sh exists with parallel functions
  When I check the main loop logic
  Then it calls is_parallel_subphase and conditionally spawns

Verification: `grep -E 'is_parallel_subphase|spawn_parallel_task' plugins/m42-sprint/scripts/sprint-loop.sh | grep -v '^#' | grep -v '()' | wc -l | grep -qE '[1-9]'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Main loop handles wait-for-parallel phases
  Given scripts/sprint-loop.sh exists with parallel functions
  When I check the main loop logic
  Then it calls is_wait_for_parallel_phase and conditionally waits

Verification: `grep -E 'is_wait_for_parallel_phase|wait_for_parallel_tasks' plugins/m42-sprint/scripts/sprint-loop.sh | grep -v '^#' | grep -v '()' | wc -l | grep -qE '[1-9]'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: spawn_parallel_task registers tasks in PROGRESS.yaml
  Given spawn_parallel_task function exists
  When I examine the function body
  Then it updates parallel-tasks array with proper schema fields

Verification: `grep -A60 'spawn_parallel_task()' plugins/m42-sprint/scripts/sprint-loop.sh | grep -qE 'parallel-tasks.*\+=' && grep -A60 'spawn_parallel_task()' plugins/m42-sprint/scripts/sprint-loop.sh | grep -qE 'spawned-at'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---
