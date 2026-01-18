# Gherkin Scenarios: step-6

## Step Task
Update scripts/build-sprint-prompt.sh to skip parallel sub-phases:

When building prompts for the main loop, skip sub-phases that:
- Have status 'spawned' (already running in background)
- Have parallel-task-id set (reference to parallel-tasks entry)

This prevents re-executing tasks that are already running in parallel.

Reference: context/implementation-plan.md section 5 (Files to Modify table)


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Script exists and is executable
  Given the build-sprint-prompt.sh script was modified
  When I check the script exists
  Then the script file exists and is executable

Verification: `test -x plugins/m42-sprint/scripts/build-sprint-prompt.sh`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Scenario 2: Script checks for spawned status
  Given the script is updated
  When I search for spawned status check logic
  Then the script contains code to detect spawned sub-phases

Verification: `grep -q 'spawned' plugins/m42-sprint/scripts/build-sprint-prompt.sh`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Scenario 3: Script checks for parallel-task-id
  Given the script is updated
  When I search for parallel-task-id detection
  Then the script contains code to detect parallel-task-id property

Verification: `grep -q 'parallel-task-id' plugins/m42-sprint/scripts/build-sprint-prompt.sh`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Scenario 4: Script exits cleanly for spawned sub-phases
  Given a PROGRESS.yaml with a sub-phase that has status 'spawned'
  When I run the build-sprint-prompt.sh script
  Then the script exits with code 0 (no prompt generated, skip this sub-phase)

Verification: `cd plugins/m42-sprint && ./scripts/test-skip-spawned.sh`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Scenario 5: Script exits cleanly for sub-phases with parallel-task-id
  Given a PROGRESS.yaml with a sub-phase that has parallel-task-id set
  When I run the build-sprint-prompt.sh script
  Then the script exits with code 0 (no prompt generated, skip this sub-phase)

Verification: `cd plugins/m42-sprint && ./scripts/test-skip-parallel-task-id.sh`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Scenario 6: Script still generates prompt for normal pending sub-phases
  Given a PROGRESS.yaml with a normal pending sub-phase (no parallel flags)
  When I run the build-sprint-prompt.sh script
  Then the script outputs a prompt (non-empty output)

Verification: `cd plugins/m42-sprint && ./scripts/test-normal-subphase.sh`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
