# Gherkin Scenarios: step-2

## Step Task
Erstelle das Prompt-Builder Script und die Ralph Workflow-Datei.

## Scope
- Create `plugins/m42-sprint/scripts/build-ralph-prompt.sh` with three modes (planning, executing, reflecting)
- Create `.claude/workflows/ralph.yaml` with mode: ralph and per-iteration-hooks
- Make script executable

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Script File Exists
```gherkin
Scenario: build-ralph-prompt.sh script file exists
  Given the project structure is set up
  When I check for the prompt builder script
  Then plugins/m42-sprint/scripts/build-ralph-prompt.sh exists

Verification: `test -f plugins/m42-sprint/scripts/build-ralph-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Script Is Executable
```gherkin
Scenario: build-ralph-prompt.sh is executable
  Given plugins/m42-sprint/scripts/build-ralph-prompt.sh exists
  When I check the file permissions
  Then the script has execute permission

Verification: `test -x plugins/m42-sprint/scripts/build-ralph-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Script Passes Syntax Check
```gherkin
Scenario: Script has valid bash syntax
  Given plugins/m42-sprint/scripts/build-ralph-prompt.sh exists
  When I run bash syntax check
  Then no syntax errors are reported

Verification: `bash -n plugins/m42-sprint/scripts/build-ralph-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Workflow File Exists
```gherkin
Scenario: ralph.yaml workflow file exists
  Given the project structure is set up
  When I check for the Ralph workflow definition
  Then .claude/workflows/ralph.yaml exists

Verification: `test -f .claude/workflows/ralph.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Workflow Has Valid YAML Syntax
```gherkin
Scenario: ralph.yaml has valid YAML syntax
  Given .claude/workflows/ralph.yaml exists
  When I validate with yq
  Then the YAML is syntactically correct

Verification: `yq '.' .claude/workflows/ralph.yaml > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Workflow Contains mode: ralph
```gherkin
Scenario: Workflow specifies Ralph mode
  Given .claude/workflows/ralph.yaml exists
  When I check the mode field
  Then mode is set to "ralph"

Verification: `yq -e '.mode == "ralph"' .claude/workflows/ralph.yaml > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Workflow Contains per-iteration-hooks Array
```gherkin
Scenario: Workflow defines per-iteration-hooks
  Given .claude/workflows/ralph.yaml exists
  When I check for per-iteration-hooks
  Then the array exists with at least one hook defined

Verification: `yq -e '.per-iteration-hooks | length >= 1' .claude/workflows/ralph.yaml > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Script Handles All Three Modes
```gherkin
Scenario: Script contains handling for planning, executing, and reflecting modes
  Given plugins/m42-sprint/scripts/build-ralph-prompt.sh exists
  When I check for mode handling
  Then the script contains case statements for all three modes

Verification: `grep -q 'planning)' plugins/m42-sprint/scripts/build-ralph-prompt.sh && grep -q 'executing)' plugins/m42-sprint/scripts/build-ralph-prompt.sh && grep -q 'reflecting)' plugins/m42-sprint/scripts/build-ralph-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Summary

| # | Scenario | Verification |
|---|----------|--------------|
| 1 | Script file exists | `test -f plugins/m42-sprint/scripts/build-ralph-prompt.sh` |
| 2 | Script is executable | `test -x plugins/m42-sprint/scripts/build-ralph-prompt.sh` |
| 3 | Script has valid syntax | `bash -n plugins/m42-sprint/scripts/build-ralph-prompt.sh` |
| 4 | Workflow file exists | `test -f .claude/workflows/ralph.yaml` |
| 5 | Workflow has valid YAML | `yq '.' .claude/workflows/ralph.yaml > /dev/null 2>&1` |
| 6 | Workflow has mode: ralph | `yq -e '.mode == "ralph"' .claude/workflows/ralph.yaml > /dev/null 2>&1` |
| 7 | Workflow has per-iteration-hooks | `yq -e '.per-iteration-hooks | length >= 1' .claude/workflows/ralph.yaml > /dev/null 2>&1` |
| 8 | Script handles all modes | `grep -q 'planning)' ... && grep -q 'executing)' ... && grep -q 'reflecting)' ...` |
