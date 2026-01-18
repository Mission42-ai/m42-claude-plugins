# Gherkin Scenarios: step-7

## Step Task
Update commands/sprint-status.md to display parallel task status:

Add new section after step/phase display:
```
Parallel Tasks:
[~] step-0-update-docs-1705123456 (running, 2m elapsed)
    Step: Implement user authentication
    Phase: update-docs
    PID: 12345 | Log: logs/step-0-update-docs-1705123456.log
[x] step-1-update-docs-1705123789 (completed, 1m 23s)
```

Show:
- Task ID, status, elapsed time
- Which step/phase spawned it
- PID and log file location

Reference: context/implementation-plan.md section 4.G

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: sprint-status.md file exists
  Given the m42-sprint plugin is set up
  When I check for the sprint-status command file
  Then plugins/m42-sprint/commands/sprint-status.md exists

Verification: `test -f plugins/m42-sprint/commands/sprint-status.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Documentation mentions parallel-tasks section
  Given sprint-status.md exists
  When I check for parallel tasks documentation
  Then the file contains instructions to display parallel tasks

Verification: `grep -qi "parallel.task" plugins/m42-sprint/commands/sprint-status.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Documentation shows task ID display format
  Given sprint-status.md includes parallel task section
  When I check for task ID format instructions
  Then the file shows how to display task ID with status indicator

Verification: `grep -E "\[.?\].*step-.*-.*[0-9]+" plugins/m42-sprint/commands/sprint-status.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Documentation shows elapsed time display
  Given sprint-status.md includes parallel task section
  When I check for elapsed time instructions
  Then the file shows how to display elapsed time for tasks

Verification: `grep -qi "elapsed" plugins/m42-sprint/commands/sprint-status.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Documentation shows PID and log file location
  Given sprint-status.md includes parallel task section
  When I check for PID and log file display instructions
  Then the file shows how to display PID and log file path

Verification: `grep -Ei "pid.*log|log.*pid" plugins/m42-sprint/commands/sprint-status.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Documentation shows step and phase context for parallel tasks
  Given sprint-status.md includes parallel task section
  When I check for step/phase context instructions
  Then the file shows how to display which step/phase spawned the task

Verification: `grep -E "step-id|phase-id|Step:.*Phase:" plugins/m42-sprint/commands/sprint-status.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
