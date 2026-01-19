# Gherkin Scenarios: ralph-cleanup

## Step Task
GIVEN the extended TypeScript schema
WHEN removing Ralph mode completely
THEN prepare clean codebase for unified loop

## Scope
This step REMOVES code only - no new functionality.

## Acceptance Criteria

### sprint-loop.sh Entfernungen
- [ ] `run_ralph_loop()` function entfernt (ca. Zeilen 1165-1327)
- [ ] `process_ralph_result()` function entfernt (ca. Zeilen 887-1035)
- [ ] Mode dispatch entfernt (`case "$SPRINT_MODE"`)
- [ ] Ralph-spezifische Variablen und Checks entfernt

### File Deletions
- [ ] `plugins/m42-sprint/scripts/build-ralph-prompt.sh` gelöscht
- [ ] `.claude/workflows/ralph.yaml` gelöscht (falls vorhanden)
- [ ] `.claude/workflows/ralph-with-bookends.yaml` gelöscht

### Verification
- [ ] `grep -ri "ralph" plugins/m42-sprint/scripts/` returns nothing
- [ ] Gelöschte Dateien existieren nicht mehr
- [ ] Sprint mit Standard-Workflow läuft weiterhin

## Files to modify
- plugins/m42-sprint/scripts/sprint-loop.sh

## Files to delete
- plugins/m42-sprint/scripts/build-ralph-prompt.sh
- .claude/workflows/ralph.yaml (if exists)
- .claude/workflows/ralph-with-bookends.yaml


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: build-ralph-prompt.sh file deleted
```gherkin
Scenario: build-ralph-prompt.sh file is removed
  Given the file plugins/m42-sprint/scripts/build-ralph-prompt.sh existed before cleanup
  When the Ralph cleanup step is complete
  Then the file no longer exists

Verification: `test ! -f plugins/m42-sprint/scripts/build-ralph-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: ralph.yaml workflow deleted
```gherkin
Scenario: ralph.yaml workflow file is removed
  Given the file .claude/workflows/ralph.yaml may have existed
  When the Ralph cleanup step is complete
  Then the file no longer exists

Verification: `test ! -f .claude/workflows/ralph.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: ralph-with-bookends.yaml workflow deleted
```gherkin
Scenario: ralph-with-bookends.yaml workflow file is removed
  Given the file .claude/workflows/ralph-with-bookends.yaml existed
  When the Ralph cleanup step is complete
  Then the file no longer exists

Verification: `test ! -f .claude/workflows/ralph-with-bookends.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: No Ralph references in sprint scripts
```gherkin
Scenario: No Ralph references remain in sprint scripts directory
  Given Ralph-related code existed in plugins/m42-sprint/scripts/
  When the Ralph cleanup step is complete
  Then grep finds no matches for "ralph" (case-insensitive)

Verification: `! grep -ri "ralph" plugins/m42-sprint/scripts/`
Pass: Exit code = 0 (no matches found) → Score 1
Fail: Exit code ≠ 0 (matches found) → Score 0
```

---

## Scenario 5: run_ralph_loop function removed from sprint-loop.sh
```gherkin
Scenario: run_ralph_loop function no longer exists
  Given run_ralph_loop() was defined in sprint-loop.sh
  When the Ralph cleanup step is complete
  Then the function definition is removed

Verification: `! grep -q "run_ralph_loop" plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 (function not found) → Score 1
Fail: Exit code ≠ 0 (function still exists) → Score 0
```

---

## Scenario 6: process_ralph_result function removed from sprint-loop.sh
```gherkin
Scenario: process_ralph_result function no longer exists
  Given process_ralph_result() was defined in sprint-loop.sh
  When the Ralph cleanup step is complete
  Then the function definition is removed

Verification: `! grep -q "process_ralph_result" plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 (function not found) → Score 1
Fail: Exit code ≠ 0 (function still exists) → Score 0
```

---

## Scenario 7: sprint-loop.sh remains syntactically valid
```gherkin
Scenario: sprint-loop.sh has valid bash syntax after cleanup
  Given sprint-loop.sh has been modified to remove Ralph code
  When I check the script syntax
  Then bash reports no syntax errors

Verification: `bash -n plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Summary

| # | Scenario | Verification Command |
|---|----------|---------------------|
| 1 | build-ralph-prompt.sh deleted | `test ! -f plugins/m42-sprint/scripts/build-ralph-prompt.sh` |
| 2 | ralph.yaml deleted | `test ! -f .claude/workflows/ralph.yaml` |
| 3 | ralph-with-bookends.yaml deleted | `test ! -f .claude/workflows/ralph-with-bookends.yaml` |
| 4 | No ralph references in scripts | `! grep -ri "ralph" plugins/m42-sprint/scripts/` |
| 5 | run_ralph_loop removed | `! grep -q "run_ralph_loop" plugins/m42-sprint/scripts/sprint-loop.sh` |
| 6 | process_ralph_result removed | `! grep -q "process_ralph_result" plugins/m42-sprint/scripts/sprint-loop.sh` |
| 7 | sprint-loop.sh syntax valid | `bash -n plugins/m42-sprint/scripts/sprint-loop.sh` |

All 7 scenarios must pass for the step to be considered complete.
