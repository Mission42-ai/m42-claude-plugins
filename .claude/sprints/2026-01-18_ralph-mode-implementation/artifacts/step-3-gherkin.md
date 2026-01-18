# Gherkin Scenarios: step-3

## Step Task
Integriere Ralph Mode und erstelle Dokumentation.

## Scope
1. Create `plugins/m42-sprint/docs/concepts/ralph-mode.md` with Ralph Mode documentation
2. Extend `plugins/m42-sprint/skills/orchestrating-sprints/references/progress-schema.md` with Ralph-specific fields
3. Extend `plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md` with Ralph mode fields
4. Update `plugins/m42-sprint/skills/orchestrating-sprints/SKILL.md` with Ralph Mode reference
5. Update `plugins/m42-sprint/skills/creating-workflows/SKILL.md` with Ralph Mode documentation
6. Rebuild compiler

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Ralph Mode Documentation Exists
```gherkin
Scenario: ralph-mode.md documentation file exists
  Given the project structure is set up
  When I check for the Ralph Mode documentation
  Then plugins/m42-sprint/docs/concepts/ralph-mode.md exists

Verification: `test -f plugins/m42-sprint/docs/concepts/ralph-mode.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Ralph Mode Docs Contains Overview Section
```gherkin
Scenario: Documentation contains Ralph Mode overview
  Given plugins/m42-sprint/docs/concepts/ralph-mode.md exists
  When I check for overview content
  Then the file contains an overview section explaining Ralph Mode

Verification: `grep -qi 'overview\|what is ralph mode\|was ist ralph mode' plugins/m42-sprint/docs/concepts/ralph-mode.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Ralph Mode Docs Contains Architecture Diagram
```gherkin
Scenario: Documentation contains architecture diagram
  Given plugins/m42-sprint/docs/concepts/ralph-mode.md exists
  When I check for architecture visualization
  Then the file contains a diagram (ASCII art or structured text)

Verification: `grep -qE '┌|├|─|▼|RALPH.*LOOP|PROGRESS\.yaml' plugins/m42-sprint/docs/concepts/ralph-mode.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Ralph Mode Docs Contains SPRINT.yaml Example
```gherkin
Scenario: Documentation contains SPRINT.yaml example
  Given plugins/m42-sprint/docs/concepts/ralph-mode.md exists
  When I check for example configuration
  Then the file contains a SPRINT.yaml example with workflow: ralph

Verification: `grep -qE 'workflow:\s*ralph' plugins/m42-sprint/docs/concepts/ralph-mode.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Progress Schema Includes Ralph Mode Fields
```gherkin
Scenario: Progress schema documents Ralph mode fields
  Given plugins/m42-sprint/skills/orchestrating-sprints/references/progress-schema.md exists
  When I check for Ralph mode field documentation
  Then the file documents dynamic-steps, hook-tasks, and ralph-exit fields

Verification: `grep -q 'dynamic-steps' plugins/m42-sprint/skills/orchestrating-sprints/references/progress-schema.md && grep -q 'hook-tasks' plugins/m42-sprint/skills/orchestrating-sprints/references/progress-schema.md && grep -q 'ralph-exit\|ralph exit' plugins/m42-sprint/skills/orchestrating-sprints/references/progress-schema.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Workflow Schema Includes Ralph Mode Fields
```gherkin
Scenario: Workflow schema documents Ralph mode fields
  Given plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md exists
  When I check for Ralph mode field documentation
  Then the file documents mode, goal-prompt, and per-iteration-hooks fields

Verification: `grep -qE 'mode.*ralph|mode:\s*ralph' plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md && grep -q 'goal-prompt' plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md && grep -q 'per-iteration-hooks' plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Compiler Builds Successfully
```gherkin
Scenario: Compiler builds without errors
  Given the compiler source code is complete
  When I run npm run build in the compiler directory
  Then the build succeeds with exit code 0

Verification: `cd plugins/m42-sprint/compiler && npm run build > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Compiler Passes TypeScript Type Checking
```gherkin
Scenario: Compiler passes typecheck
  Given the compiler source code is complete
  When I run npm run typecheck in the compiler directory
  Then no type errors are reported

Verification: `cd plugins/m42-sprint/compiler && npm run typecheck > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Summary

| # | Scenario | Verification |
|---|----------|--------------|
| 1 | Ralph Mode docs exists | `test -f plugins/m42-sprint/docs/concepts/ralph-mode.md` |
| 2 | Docs contains overview | `grep -qi 'overview\|what is ralph mode' ...` |
| 3 | Docs contains architecture diagram | `grep -qE '┌\|├\|─\|▼\|RALPH.*LOOP' ...` |
| 4 | Docs contains SPRINT.yaml example | `grep -qE 'workflow:\s*ralph' ...` |
| 5 | Progress schema has Ralph fields | `grep dynamic-steps && grep hook-tasks && grep ralph-exit` |
| 6 | Workflow schema has Ralph fields | `grep mode.*ralph && grep goal-prompt && grep per-iteration-hooks` |
| 7 | Compiler builds | `cd plugins/m42-sprint/compiler && npm run build` |
| 8 | Compiler typecheck passes | `cd plugins/m42-sprint/compiler && npm run typecheck` |
