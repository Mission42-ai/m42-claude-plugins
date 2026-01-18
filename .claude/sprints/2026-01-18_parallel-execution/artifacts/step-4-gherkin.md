# Gherkin Scenarios: step-4

## Step Task
Create new script: scripts/build-parallel-prompt.sh

This script builds the prompt for parallel tasks spawned in background.

Parameters:
- SPRINT_DIR, PHASE_IDX, STEP_IDX, SUB_IDX, TASK_ID

Output format:
```
# Parallel Task Execution
Task ID: $TASK_ID

## Context
Step: [step prompt from PROGRESS.yaml]

## Your Task: [sub-phase-id]
[sub-phase prompt from PROGRESS.yaml]

## Instructions
1. Execute this task independently
2. This runs in background - main workflow continues without waiting
3. Focus on completing this specific task
4. Commit changes when done

Note: Do NOT modify PROGRESS.yaml - the main loop tracks completion via process exit.
```

Reference: context/implementation-plan.md section 4.F

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Script file exists
```gherkin
Scenario: Script file exists
  Given the sprint repository is set up
  When I check for the build-parallel-prompt script
  Then plugins/m42-sprint/scripts/build-parallel-prompt.sh exists
```

Verification: `test -f plugins/m42-sprint/scripts/build-parallel-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Script is executable
```gherkin
Scenario: Script is executable
  Given the build-parallel-prompt.sh script exists
  When I check its permissions
  Then the script has execute permission
```

Verification: `test -x plugins/m42-sprint/scripts/build-parallel-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Script uses bash strict mode
```gherkin
Scenario: Script uses bash strict mode
  Given the build-parallel-prompt.sh script exists
  When I check for bash strict mode
  Then set -euo pipefail or equivalent is present
```

Verification: `grep -qE 'set -[a-z]*e[a-z]*u[a-z]*o pipefail|set -euo pipefail' plugins/m42-sprint/scripts/build-parallel-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Script outputs correct Task ID header
```gherkin
Scenario: Script outputs correct Task ID header
  Given the build-parallel-prompt.sh script exists
  When I search for the Task ID output pattern
  Then the script outputs "Task ID:" with the TASK_ID parameter
```

Verification: `grep -q 'Task ID:.*TASK_ID\|Task ID: \$TASK_ID\|Task ID: \${TASK_ID}' plugins/m42-sprint/scripts/build-parallel-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Script reads step prompt from PROGRESS.yaml
```gherkin
Scenario: Script reads step prompt from PROGRESS.yaml
  Given the build-parallel-prompt.sh script exists
  When I check how it retrieves the step prompt
  Then it uses yq to read from .phases[].steps[].prompt
```

Verification: `grep -qE 'yq.*\.phases\[.*\]\.steps\[.*\]\.prompt' plugins/m42-sprint/scripts/build-parallel-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Script reads sub-phase prompt from PROGRESS.yaml
```gherkin
Scenario: Script reads sub-phase prompt from PROGRESS.yaml
  Given the build-parallel-prompt.sh script exists
  When I check how it retrieves the sub-phase prompt
  Then it uses yq to read from .phases[].steps[].phases[].prompt
```

Verification: `grep -qE 'yq.*\.phases\[.*\]\.steps\[.*\]\.phases\[.*\]\.prompt' plugins/m42-sprint/scripts/build-parallel-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
