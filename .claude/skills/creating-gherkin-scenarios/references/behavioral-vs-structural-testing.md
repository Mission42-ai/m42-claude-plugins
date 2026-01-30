---
title: Behavioral vs Structural Testing Decision Guide
description: Decision logic for choosing behavioral verification over structural checks when writing Gherkin scenarios
keywords: behavioral testing, structural testing, verification, gherkin, test strategy
file-type: reference
skill: creating-gherkin-scenarios
---

# Behavioral vs Structural Testing

## Core Principle

**Test observable behavior, not code structure.**

## Decision Matrix

| What You Want to Verify | ❌ Structural (Wrong) | ✅ Behavioral (Correct) |
|-------------------------|----------------------|------------------------|
| Function exists and works | `grep "function_name"` in codebase | Call function with input → verify output |
| Hook executes on event | File contains hook registration code | Trigger event → verify hook transcript exists |
| Config affects behavior | Config file has correct key/value | Apply config → run feature → verify outcome |
| Module imports correctly | `import X` appears in file | Import and use module → verify no errors |
| Process spawns | Code contains spawn logic | Execute trigger → verify process ID/output file |
| State persists | Variable assignment exists | Modify state → restart → verify state retained |

## Anti-Patterns (Structural Verification)

### Pattern: Code Existence Checks
```gherkin
# ❌ WRONG - Only tests that code exists
Scenario: Hook registration exists
  Given the codebase
  When I search for "register_hook"
  Then the pattern is found in hooks.ts
```

**Problem:** Code can exist but never execute, execute incorrectly, or fail silently.

**Fix:** Test execution and outcome.

### Pattern: Static Analysis Only
```gherkin
# ❌ WRONG - Only verifies structure
Scenario: Module exports function
  Given the module file
  When I parse the exports
  Then spawn_process is exported
```

**Problem:** Export exists but function may be broken, never called, or have wrong signature.

**Fix:** Import and invoke with realistic inputs.

### Pattern: Compilation Success
```gherkin
# ❌ WRONG - Passing build ≠ working feature
Scenario: Code compiles without errors
  Given the updated codebase
  When I run tsc
  Then no type errors are reported
```

**Problem:** Type-correct code can have logic bugs, runtime errors, or incorrect behavior.

**Fix:** Execute the feature end-to-end.

## Correct Patterns (Behavioral Verification)

### Pattern: End-to-End Execution
```gherkin
# ✅ CORRECT - Tests actual behavior
Scenario: Learning hook executes after iteration
  Given a sprint with learning extraction enabled
  When an iteration completes successfully
  Then a hook process is spawned
  And the hook transcript file exists at .claude/sprints/{sprint}/hooks/learning/iteration-{n}.md
  And the transcript contains extracted learnings
```

**Verifies:** Hook registration, spawning logic, file creation, output capture.

### Pattern: Observable State Changes
```gherkin
# ✅ CORRECT - Tests persistent state
Scenario: External PROGRESS.yaml modifications are preserved
  Given a running sprint with PROGRESS.yaml
  When I modify PROGRESS.yaml externally (add custom field)
  And the sprint loop continues execution
  Then the custom field remains in PROGRESS.yaml
  And no checksum errors are reported
```

**Verifies:** File watching, merge logic, checksum handling, state preservation.

### Pattern: Input → Output Verification
```gherkin
# ✅ CORRECT - Tests deterministic output
Scenario: Compilation produces valid PROGRESS.yaml
  Given a SPRINT.yaml with 3 tasks
  When I run compile workflow
  Then PROGRESS.yaml is created
  And PROGRESS.yaml contains 3 task entries
  And each task has status: pending
  And PROGRESS.yaml schema validation passes
```

**Verifies:** Compilation logic, schema correctness, data transformation.

## When Structural Checks Are Acceptable

**Only as supplementary verification** after behavioral tests pass:

```gherkin
Scenario: Hook integration is complete
  # Primary behavioral verification
  When the learning hook is triggered
  Then learnings are extracted and stored

  # Supplementary structural check
  And the codebase contains hook registration in src/hooks/registry.ts
```

**Use case:** Documentation of implementation details, not primary verification.

## Selection Logic

```
Need to verify feature works?
├─ Yes → Behavioral test (execute and verify outcome)
└─ No (just documenting structure) → Structural check acceptable

Behavioral test possible?
├─ Yes → Required
└─ No (external system, non-deterministic) → Mock/stub or capability test

Feature has observable output?
├─ Yes → Verify the output
└─ No → Reconsider what "working" means (find observable effect)
```
