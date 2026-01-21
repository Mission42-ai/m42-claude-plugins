# Gherkin Scenarios: step-6

## Step Task
Implement dynamic step injection into running sprints.

## Overview
Allow adding steps to PROGRESS.yaml at runtime:
- Add single steps to a specific position
- Compile a workflow to add multiple steps
- Choose insertion point (after current, end of phase, specific position)

This is required for the operator and suggested-steps features.

## API Design

### Single Step Injection

```typescript
interface StepInjection {
  step: {
    id: string;
    prompt: string;
    model?: string;
  };
  position: InsertPosition;
}

type InsertPosition =
  | { type: 'after-current' }                    // After currently executing step
  | { type: 'after-step'; stepId: string }      // After specific step
  | { type: 'end-of-phase'; phaseId: string }   // At end of specific phase
  | { type: 'end-of-workflow' }                 // At very end
  | { type: 'before-step'; stepId: string };    // Before specific step
```

### Workflow-Based Injection

```typescript
interface WorkflowInjection {
  workflow: string;           // Workflow name to compile
  context?: {                 // Context for the workflow
    step?: StepDefinition;    // If workflow uses for-each: step
    variables?: Record<string, any>;
  };
  position: InsertPosition;
  idPrefix: string;           // Prefix for generated phase IDs
}
```

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Single step injection at after-current position
Given a PROGRESS.yaml with 3 phases where phase 0 is in-progress
When I inject a step with position { type: 'after-current' }
Then the new step is inserted at index 1 (after the current phase)
And the new step has `injected: true` flag
And the new step has `injected-at` timestamp
And stats.total-phases is incremented by 1

Verification: `node plugins/m42-sprint/runtime/dist/progress-injector.test.js 2>&1 | grep -q "✓ injectStep: inserts at after-current position"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Single step injection at end-of-workflow position
Given a PROGRESS.yaml with 3 phases
When I inject a step with position { type: 'end-of-workflow' }
Then the new step is inserted at the end (index 3)
And stats.total-phases equals original + 1

Verification: `node plugins/m42-sprint/runtime/dist/progress-injector.test.js 2>&1 | grep -q "✓ injectStep: inserts at end-of-workflow position"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Single step injection with after-step position
Given a PROGRESS.yaml with phases [A, B, C]
When I inject a step with position { type: 'after-step', stepId: 'B' }
Then the new step is inserted at index 2 (after B)
And phases are now [A, B, NEW, C]

Verification: `node plugins/m42-sprint/runtime/dist/progress-injector.test.js 2>&1 | grep -q "✓ injectStep: inserts at after-step position"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Single step injection with before-step position
Given a PROGRESS.yaml with phases [A, B, C]
When I inject a step with position { type: 'before-step', stepId: 'B' }
Then the new step is inserted at index 1 (before B)
And phases are now [A, NEW, B, C]

Verification: `node plugins/m42-sprint/runtime/dist/progress-injector.test.js 2>&1 | grep -q "✓ injectStep: inserts at before-step position"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Position resolution throws for non-existent step
Given a PROGRESS.yaml with phases [A, B, C]
When I inject a step with position { type: 'after-step', stepId: 'NONEXISTENT' }
Then an error is thrown with message containing "Step not found"

Verification: `node plugins/m42-sprint/runtime/dist/progress-injector.test.js 2>&1 | grep -q "✓ resolvePosition: throws for non-existent step"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Workflow injection compiles and injects multiple phases
Given a workflow named "bugfix-workflow" with 2 phases [analyze, fix]
When I inject the workflow with position { type: 'after-current' } and idPrefix 'hotfix'
Then 2 new phases are inserted
And their IDs are prefixed: 'hotfix-analyze', 'hotfix-fix'
And each has `injected: true` flag
And stats.total-phases is incremented by 2

Verification: `node plugins/m42-sprint/runtime/dist/progress-injector.test.js 2>&1 | grep -q "✓ injectWorkflow: injects compiled workflow phases"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: updateStats recalculates correctly after injection
Given a PROGRESS.yaml with stats { total-phases: 3, completed-phases: 1 }
When I inject 2 new steps
Then stats.total-phases is 5
And stats.completed-phases remains 1

Verification: `node plugins/m42-sprint/runtime/dist/progress-injector.test.js 2>&1 | grep -q "✓ updateStats: recalculates stats after injection"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Unit Test Coverage
| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| runtime/src/progress-injector.test.ts | 17 | 1, 2, 3, 4, 5, 6, 7 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/runtime && npm run build
# Expected: FAIL with TS2307: Cannot find module './progress-injector.js'
# This confirms RED phase - implementation doesn't exist yet
```

## RED Phase Output (Captured)
```
src/progress-injector.test.ts(22,8): error TS2307: Cannot find module './progress-injector.js' or its corresponding type declarations.
```

## Edge Cases Covered in Tests
1. Empty phases array
2. Non-existent step ID for position resolution
3. Position resolution for nested steps within for-each phases
4. Current pointer at various depths (phase/step/sub-phase)
5. Multiple injections in sequence
6. PROGRESS.yaml file not found
7. Checksum validation during read/write
