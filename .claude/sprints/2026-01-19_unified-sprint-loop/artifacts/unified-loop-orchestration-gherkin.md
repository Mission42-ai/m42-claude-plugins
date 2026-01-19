# Gherkin Scenarios: unified-loop-orchestration

## Step Task
GIVEN configurable prompts and workflow templates
WHEN implementing unified loop with orchestration
THEN enable dynamic step injection based on Claude's proposals

## Scope
- Unified run_loop() in sprint-loop.sh
- proposedSteps extraction from JSON result
- Step-queue management
- Orchestration iteration when step-queue not empty

## Acceptance Criteria

### Unified Loop (sprint-loop.sh)
- [ ] `run_loop()` function (replaces run_standard_loop)
- [ ] Iteration counter und progress tracking

### proposedSteps Extraction
- [ ] `extract_proposed_steps()` function
- [ ] Called after each iteration in main loop

### Step Queue Management
- [ ] `add_to_step_queue()` function
- [ ] Queue entries have: id, prompt, proposedBy, proposedAt, priority

### Orchestration
- [ ] `should_run_orchestration()` function
- [ ] `run_orchestration_iteration()` function
- [ ] `insert_step_at_position()` function
- [ ] Step-queue cleared after processing

### auto-approve Mode
- [ ] Steps inserted directly when autoApprove: true
- [ ] Uses insertStrategy for position

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Unified loop function exists
Given the sprint-loop.sh file exists
When I check for the run_loop function
Then the function is defined and replaces run_standard_loop

Verification: `grep -qE "^run_loop\(\)|^function run_loop" plugins/m42-sprint/scripts/sprint-loop.sh && ! grep -qE "^run_standard_loop\(\)|^function run_standard_loop" plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: extract_proposed_steps function exists
Given the sprint-loop.sh file exists
When I check for proposedSteps extraction
Then extract_proposed_steps function is defined

Verification: `grep -qE "^extract_proposed_steps\(\)|^function extract_proposed_steps" plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: add_to_step_queue function exists
Given the sprint-loop.sh file exists
When I check for step queue management
Then add_to_step_queue function is defined

Verification: `grep -qE "^add_to_step_queue\(\)|^function add_to_step_queue" plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: should_run_orchestration function exists
Given the sprint-loop.sh file exists
When I check for orchestration trigger logic
Then should_run_orchestration function is defined

Verification: `grep -qE "^should_run_orchestration\(\)|^function should_run_orchestration" plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: run_orchestration_iteration function exists
Given the sprint-loop.sh file exists
When I check for orchestration execution
Then run_orchestration_iteration function is defined

Verification: `grep -qE "^run_orchestration_iteration\(\)|^function run_orchestration_iteration" plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: insert_step_at_position function exists
Given the sprint-loop.sh file exists
When I check for step insertion logic
Then insert_step_at_position function is defined

Verification: `grep -qE "^insert_step_at_position\(\)|^function insert_step_at_position" plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: auto-approve mode implemented
Given the sprint-loop.sh file exists
When I check for auto-approve logic
Then the script checks orchestration.autoApprove and insertStrategy

Verification: `grep -q "autoApprove\|auto-approve\|auto_approve" plugins/m42-sprint/scripts/sprint-loop.sh && grep -q "insertStrategy\|insert-strategy\|insert_strategy" plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: run_loop is called in main execution
Given the sprint-loop.sh file exists
When I check the main execution flow
Then run_loop is invoked (not run_standard_loop)

Verification: `grep -E "^[[:space:]]*run_loop($|[[:space:]])" plugins/m42-sprint/scripts/sprint-loop.sh | grep -v "^#" | head -1 | grep -q "run_loop"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Summary

| # | Scenario | Verification Target |
|---|----------|---------------------|
| 1 | Unified loop function exists | run_loop() replaces run_standard_loop |
| 2 | extract_proposed_steps function exists | proposedSteps JSON extraction |
| 3 | add_to_step_queue function exists | Step queue management |
| 4 | should_run_orchestration function exists | Orchestration trigger logic |
| 5 | run_orchestration_iteration function exists | Orchestration execution |
| 6 | insert_step_at_position function exists | YAML step insertion |
| 7 | auto-approve mode implemented | autoApprove and insertStrategy checks |
| 8 | run_loop is called in main execution | Main loop invocation |
