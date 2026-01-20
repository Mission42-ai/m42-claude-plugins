# Gherkin Scenarios: step-3

## Step Task
Enable referencing another workflow for a single phase (not just for-each).

## Overview
Currently, `workflow:` can only be used with `for-each:` iterations:
```yaml
phases:
  - id: development
    for-each: step
    workflow: tdd-step-workflow  # Works - iterates steps through workflow
```

We want to also support workflow references WITHOUT for-each:
```yaml
phases:
  - id: documentation
    workflow: documentation-workflow  # NEW - run entire workflow as single phase
  - id: qa
    prompt: |
      Run QA checks...  # Regular inline phase
```

This makes workflows composable and reusable.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Expand workflow reference without for-each
```gherkin
Scenario: Workflow reference expands inline phases
  Given a SPRINT.yaml with workflow "test-workflow"
  And test-workflow has a phase with id "docs" and workflow "documentation-workflow" (no for-each)
  And documentation-workflow has phases: ["analyze", "user-guide", "reference"]
  When the compiler compiles the sprint
  Then PROGRESS.yaml contains phases with ids: ["docs-analyze", "docs-user-guide", "docs-reference"]
  And each expanded phase has a prompt from the referenced workflow
  And no phase has id "docs" as a simple phase
```

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/workflow-reference.test.js 2>&1 | grep -q "✓ Scenario 1"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Phase ID prefixing avoids collisions
```gherkin
Scenario: Child phase IDs are prefixed with parent phase ID
  Given a workflow with phase id "setup" referencing workflow "common-setup"
  And common-setup has phases: ["init", "validate", "ready"]
  When the compiler expands the workflow reference
  Then the expanded phase IDs are: ["setup-init", "setup-validate", "setup-ready"]
  And no collision occurs with other phases in the parent workflow
```

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/workflow-reference.test.js 2>&1 | grep -q "✓ Scenario 2"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Error when both prompt and workflow specified
```gherkin
Scenario: Mutual exclusivity of prompt and workflow
  Given a workflow with a phase that has both "prompt" and "workflow" fields
  When the compiler validates the workflow
  Then a validation error is returned with code "PROMPT_WORKFLOW_MUTUAL_EXCLUSIVE"
  And the error message indicates that prompt and workflow cannot both be specified
```

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/workflow-reference.test.js 2>&1 | grep -q "✓ Scenario 3"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Direct cycle detection (self-reference)
```gherkin
Scenario: Detect direct workflow self-reference
  Given workflow "workflow-a" with a phase that references "workflow-a"
  When the compiler attempts to expand the workflow
  Then a compiler error is returned with code "CYCLE_DETECTED"
  And the error message includes the cycle path: ["workflow-a"]
```

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/workflow-reference.test.js 2>&1 | grep -q "✓ Scenario 4"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Indirect cycle detection (A → B → A)
```gherkin
Scenario: Detect indirect workflow cycle
  Given workflow "workflow-a" references "workflow-b"
  And workflow "workflow-b" references "workflow-a"
  When the compiler attempts to compile with workflow-a as main
  Then a compiler error is returned with code "CYCLE_DETECTED"
  And the error includes the full cycle path: ["workflow-a", "workflow-b", "workflow-a"]
```

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/workflow-reference.test.js 2>&1 | grep -q "✓ Scenario 5"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Max depth limit enforcement
```gherkin
Scenario: Enforce maximum workflow nesting depth
  Given a chain of workflows: a → b → c → d → e → f (depth 6)
  And the maximum allowed depth is 5
  When the compiler attempts to expand the chain
  Then a compiler error is returned with code "MAX_DEPTH_EXCEEDED"
  And the error message indicates the depth limit of 5 was exceeded
```

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/workflow-reference.test.js 2>&1 | grep -q "✓ Scenario 6"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Mixed phases (inline prompts + workflow references)
```gherkin
Scenario: Support mixed inline and workflow-reference phases
  Given a workflow with:
    - phase "setup" with inline prompt
    - phase "docs" referencing "documentation-workflow"
    - phase "cleanup" with inline prompt
  And documentation-workflow has phases: ["analyze", "reference"]
  When the compiler compiles the sprint
  Then PROGRESS.yaml contains phases in order:
    - "setup" (with prompt)
    - "docs-analyze" (expanded)
    - "docs-reference" (expanded)
    - "cleanup" (with prompt)
```

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/workflow-reference.test.js 2>&1 | grep -q "✓ Scenario 7"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Nested workflow expansion (workflow within workflow)
```gherkin
Scenario: Support nested workflow references (within depth limit)
  Given workflow "main" references "parent" (no for-each)
  And workflow "parent" has phases: ["prep", "child-ref"]
  And phase "child-ref" references "child-workflow"
  And "child-workflow" has phases: ["step1", "step2"]
  When the compiler expands all references
  Then PROGRESS.yaml contains phases:
    - "parent-prep"
    - "parent-child-ref-step1"
    - "parent-child-ref-step2"
  And the total nesting depth is 2 (within limit)
```

Verification: `cd plugins/m42-sprint/compiler && npm run build && node dist/workflow-reference.test.js 2>&1 | grep -q "✓ Scenario 8"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| `compiler/src/workflow-reference.test.ts` | 8+ tests | 1, 2, 3, 4, 5, 6, 7, 8 |

## Test File Structure

### workflow-reference.test.ts
Tests for the new workflow reference expansion feature:
- `expandWorkflowReference()` - expands a single phase with workflow ref
- `prefixPhaseIds()` - prefixes child IDs with parent ID
- `validateMutualExclusive()` - validates prompt/workflow mutual exclusion
- `detectCycles()` - detects direct and indirect cycles
- `enforceMaxDepth()` - enforces nesting limit
- Integration with `compile()` - full compilation scenarios

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/compiler
npm run build && node dist/workflow-reference.test.js
# Expected: FAIL (no implementation yet)
```

The tests will fail because:
1. `expandWorkflowReference()` function doesn't exist yet
2. Validation for mutual exclusivity not implemented
3. Cycle detection for single-phase references not implemented
4. Max depth enforcement not implemented
