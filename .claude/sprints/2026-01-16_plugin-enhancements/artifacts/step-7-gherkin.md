# Gherkin Scenarios: step-7

## Step Task
Track C - Step 4: Integrate Hook Auto-Configuration in run-sprint

Automatically configure and inject sprint activity hook during sprint execution.

Requirements:
- Modify .claude/commands/m42-sprint/run-sprint command
- Generate .sprint-hooks.json in sprint directory before execution
- Hook config format: {"hooks":{"PostToolCall":[{"command":"bash $PLUGIN_DIR/hooks/sprint-activity-hook.sh $SPRINT_DIR"}]}}
- Pass --hook-config flag to claude -p invocations in sprint-loop.sh
- Clean up hook config file on sprint completion/stop
- Ensure PLUGIN_DIR environment variable is available to hook
- Add verbosity level detection from status page preferences (or default to "basic")
- Document hook configuration in USER-GUIDE.md

Files to modify:
- plugins/m42-sprint/commands/run-sprint.md
- plugins/m42-sprint/scripts/sprint-loop.sh

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: run-sprint command documents hook config generation
  Given the run-sprint.md command exists
  When I check for hook configuration instructions
  Then the command mentions generating .sprint-hooks.json before execution

Verification: `grep -q '\.sprint-hooks\.json' plugins/m42-sprint/commands/run-sprint.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: sprint-loop.sh accepts --hook-config flag
  Given the sprint-loop.sh script exists
  When I check for hook config parameter parsing
  Then the script parses and stores a --hook-config option

Verification: `grep -q '\-\-hook-config' plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: sprint-loop.sh passes hook config to claude invocations
  Given the sprint-loop.sh script exists
  When I check the claude CLI invocation
  Then it includes conditional --hook-config flag passing

Verification: `grep -E 'claude.*-p.*--hook-config|--hook-config.*claude.*-p' plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: sprint-loop.sh sets PLUGIN_DIR environment variable
  Given the sprint-loop.sh script exists
  When I check for PLUGIN_DIR handling
  Then the script defines or exports PLUGIN_DIR for the hook

Verification: `grep -q 'PLUGIN_DIR\|CLAUDE_PLUGIN_ROOT' plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: sprint-loop.sh cleans up hook config on completion
  Given the sprint-loop.sh script exists
  When I check for cleanup logic
  Then the script removes .sprint-hooks.json on completion or stop

Verification: `grep -E 'rm.*\.sprint-hooks\.json|cleanup.*hook|clean.*hook' plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: run-sprint command sets verbosity environment variable
  Given the run-sprint.md command exists
  When I check for verbosity configuration
  Then the command mentions SPRINT_ACTIVITY_VERBOSITY or verbosity level

Verification: `grep -E 'SPRINT_ACTIVITY_VERBOSITY|verbosity' plugins/m42-sprint/commands/run-sprint.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: USER-GUIDE.md documents hook configuration
  Given the USER-GUIDE.md file exists
  When I check for hook documentation
  Then it documents the sprint activity hook and auto-configuration

Verification: `grep -E 'hook|activity.*log|PostToolCall' plugins/m42-sprint/docs/USER-GUIDE.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Hook config format matches expected schema
  Given the run-sprint.md command documents hook generation
  When I check for the hook configuration structure
  Then it specifies PostToolCall hook with sprint-activity-hook.sh

Verification: `grep -E 'PostToolCall.*sprint-activity-hook|sprint-activity-hook.*PostToolCall' plugins/m42-sprint/commands/run-sprint.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
