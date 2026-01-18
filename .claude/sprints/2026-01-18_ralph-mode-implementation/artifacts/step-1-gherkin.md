# Gherkin Scenarios: step-1

## Step Task
Implementiere die Ralph Loop Funktion in sprint-loop.sh.

## Kontext
- Implementierungsplan: context/implementation-plan.md
- Bestehende sprint-loop.sh: plugins/m42-sprint/scripts/sprint-loop.sh

## Aufgaben

### 1. Mode Detection am Loop-Start
Refaktoriere bestehende Loop-Logik in `run_standard_loop()` Funktion und füge Ralph-Mode-Erkennung hinzu.

### 2. run_ralph_loop() Funktion
Implementiere die Endlosschleife mit:
- Modus-Bestimmung (planning/executing/reflecting)
- Prompt-Generierung via build-ralph-prompt.sh
- Per-iteration hooks spawning
- RALPH_COMPLETE: Erkennung

### 3. spawn_per_iteration_hooks() Funktion
Iteriere über enabled hooks aus PROGRESS.yaml.

### 4. record_ralph_completion() Funktion
Extrahiere Summary und setze Exit-Daten.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Script Syntax Validation

```gherkin
Scenario: sprint-loop.sh has valid bash syntax
  Given the sprint-loop.sh file exists
  When I run bash syntax check
  Then no syntax errors are reported
```

**Verification:** `bash -n plugins/m42-sprint/scripts/sprint-loop.sh`
**Pass:** Exit code = 0 → Score 1
**Fail:** Exit code ≠ 0 → Score 0

---

## Scenario 2: run_standard_loop Function Exists

```gherkin
Scenario: run_standard_loop function is defined
  Given sprint-loop.sh has been refactored
  When I check for the run_standard_loop function definition
  Then the function is found in the script
```

**Verification:** `grep -qE '^run_standard_loop\s*\(\)|^function run_standard_loop' plugins/m42-sprint/scripts/sprint-loop.sh`
**Pass:** Exit code = 0 → Score 1
**Fail:** Exit code ≠ 0 → Score 0

---

## Scenario 3: run_ralph_loop Function Exists

```gherkin
Scenario: run_ralph_loop function is defined
  Given sprint-loop.sh has Ralph mode support
  When I check for the run_ralph_loop function definition
  Then the function is found in the script
```

**Verification:** `grep -qE '^run_ralph_loop\s*\(\)|^function run_ralph_loop' plugins/m42-sprint/scripts/sprint-loop.sh`
**Pass:** Exit code = 0 → Score 1
**Fail:** Exit code ≠ 0 → Score 0

---

## Scenario 4: Mode Detection Logic Exists

```gherkin
Scenario: Ralph mode detection reads from PROGRESS.yaml
  Given sprint-loop.sh has mode branching logic
  When I check for mode detection code
  Then the script reads mode from PROGRESS.yaml and branches accordingly
```

**Verification:** `grep -q '.mode // "standard"' plugins/m42-sprint/scripts/sprint-loop.sh && grep -qE 'if.*ralph.*run_ralph_loop|"ralph".*\).*run_ralph_loop' plugins/m42-sprint/scripts/sprint-loop.sh`
**Pass:** Exit code = 0 → Score 1
**Fail:** Exit code ≠ 0 → Score 0

---

## Scenario 5: spawn_per_iteration_hooks Function Exists

```gherkin
Scenario: spawn_per_iteration_hooks function is defined
  Given sprint-loop.sh supports per-iteration hooks
  When I check for the spawn_per_iteration_hooks function definition
  Then the function is found in the script
```

**Verification:** `grep -qE '^spawn_per_iteration_hooks\s*\(\)|^function spawn_per_iteration_hooks' plugins/m42-sprint/scripts/sprint-loop.sh`
**Pass:** Exit code = 0 → Score 1
**Fail:** Exit code ≠ 0 → Score 0

---

## Scenario 6: record_ralph_completion Function Exists

```gherkin
Scenario: record_ralph_completion function is defined
  Given sprint-loop.sh handles Ralph completion
  When I check for the record_ralph_completion function definition
  Then the function is found in the script
```

**Verification:** `grep -qE '^record_ralph_completion\s*\(\)|^function record_ralph_completion' plugins/m42-sprint/scripts/sprint-loop.sh`
**Pass:** Exit code = 0 → Score 1
**Fail:** Exit code ≠ 0 → Score 0

---

## Scenario 7: RALPH_COMPLETE Detection Logic

```gherkin
Scenario: run_ralph_loop detects RALPH_COMPLETE marker
  Given the run_ralph_loop function exists
  When I check for RALPH_COMPLETE detection logic
  Then grep pattern for RALPH_COMPLETE is present in the script
```

**Verification:** `grep -qE 'RALPH_COMPLETE' plugins/m42-sprint/scripts/sprint-loop.sh && grep -qE 'grep.*RALPH_COMPLETE|record_ralph_completion' plugins/m42-sprint/scripts/sprint-loop.sh`
**Pass:** Exit code = 0 → Score 1
**Fail:** Exit code ≠ 0 → Score 0

---

## Scenario 8: build-ralph-prompt.sh Integration

```gherkin
Scenario: run_ralph_loop calls build-ralph-prompt.sh
  Given the run_ralph_loop function exists
  When I check for build-ralph-prompt.sh invocation
  Then the script calls build-ralph-prompt.sh to generate prompts
```

**Verification:** `grep -qE 'build-ralph-prompt\.sh' plugins/m42-sprint/scripts/sprint-loop.sh`
**Pass:** Exit code = 0 → Score 1
**Fail:** Exit code ≠ 0 → Score 0

---

## Summary

| # | Scenario | Verification Target |
|---|----------|---------------------|
| 1 | Syntax validation | bash -n check |
| 2 | run_standard_loop | Function definition |
| 3 | run_ralph_loop | Function definition |
| 4 | Mode detection | yq read + conditional |
| 5 | spawn_per_iteration_hooks | Function definition |
| 6 | record_ralph_completion | Function definition |
| 7 | RALPH_COMPLETE detection | grep pattern matching |
| 8 | build-ralph-prompt.sh | Script invocation |

All 8 scenarios must pass for step-1 to be considered complete.
