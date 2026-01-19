# Gherkin Scenarios: prompt-builder

## Step Task
GIVEN build-sprint-prompt.sh (354 lines) and build-parallel-prompt.sh (82 lines)
WHEN migrating to TypeScript
THEN create unified prompt builder with template support

## Scope
Create NEW file: plugins/m42-sprint/runtime/src/prompt-builder.ts

## Acceptance Criteria

### Main Function
- [ ] `buildPrompt(progress, sprintDir, customPrompts?)` → string
- [ ] Handles regular phases, for-each steps, and sub-phases

### Template Variables
- [ ] {{sprint.id}}, {{sprint.name}}
- [ ] {{iteration}}
- [ ] {{phase.id}}, {{phase.index}}, {{phase.total}}
- [ ] {{step.id}}, {{step.prompt}}, {{step.index}}, {{step.total}}
- [ ] {{sub-phase.id}}, {{sub-phase.index}}, {{sub-phase.total}}
- [ ] {{retry-count}}, {{error}}

### Prompt Sections
- [ ] Header: sprint info, iteration count
- [ ] Position: phase/step/sub-phase indicator
- [ ] Retry Warning: if retryCount > 0
- [ ] Context: load and concatenate context/*.md files
- [ ] Task: the actual prompt from phase/step
- [ ] Instructions: general guidelines
- [ ] Result Reporting: JSON format instructions

### Custom Prompts Override
- [ ] Read prompts.header from SPRINT.yaml
- [ ] Read prompts.position, prompts.instructions, etc.
- [ ] Fall back to defaults if not specified

### Parallel Support
- [ ] `buildParallelPrompt(...)` for parallel phases
- [ ] Include parallel task ID in prompt

### Tests
- [ ] Test: all template variables substituted
- [ ] Test: custom prompts override defaults
- [ ] Test: context files loaded correctly
- [ ] Test: output matches build-sprint-prompt.sh output

## Files to Create
- plugins/m42-sprint/runtime/src/prompt-builder.ts
- plugins/m42-sprint/runtime/src/prompt-builder.test.ts

## Reference
Read: plugins/m42-sprint/scripts/build-sprint-prompt.sh
Read: plugins/m42-sprint/scripts/build-parallel-prompt.sh


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Template Variable Substitution
Scenario: All template variables are correctly substituted in output

```gherkin
Given a PROGRESS.yaml with:
  - sprint-id: "test-sprint-2026"
  - current.phase: 1
  - current.step: 2
  - current.sub-phase: 0
  - stats.current-iteration: 3
When buildPrompt is called with the progress and sprintDir
Then the output contains "test-sprint-2026" (sprint ID)
And the output contains "3" (iteration count)
And the output contains phase index indicators
And no template patterns like "{{" remain in output
```

Verification: `cd plugins/m42-sprint/runtime && npm run build && node -e "import('./dist/prompt-builder.test.js')"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Simple Phase Prompt Generation
Scenario: Simple phase (no steps) generates correct prompt structure

```gherkin
Given a PROGRESS.yaml with a simple phase (no for-each):
  - phases[0].id: "prepare"
  - phases[0].prompt: "Prepare the environment"
  - phases[0].status: "pending"
When buildPrompt is called
Then the output includes "## Your Task"
And the output includes "Prepare the environment"
And the output includes position indicator with phase index
And the output does NOT include step/sub-phase indicators
```

Verification: `cd plugins/m42-sprint/runtime && npm run test 2>&1 | grep -q "simple phase prompt"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: For-Each Phase with Sub-Phases
Scenario: For-each phase generates correct hierarchical prompt

```gherkin
Given a PROGRESS.yaml with a for-each phase:
  - phases[0].id: "development"
  - phases[0].steps[0].id: "feature-a"
  - phases[0].steps[0].prompt: "Implement feature A"
  - phases[0].steps[0].phases[0].id: "red"
  - phases[0].steps[0].phases[0].prompt: "Write failing tests"
When buildPrompt is called with current pointing to sub-phase
Then the output includes "## Step Context" with step prompt
And the output includes "## Your Task: red"
And the output includes "Write failing tests"
And the position shows phase/step/sub-phase hierarchy
```

Verification: `cd plugins/m42-sprint/runtime && npm run test 2>&1 | grep -q "for-each phase"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Custom Prompts Override Defaults
Scenario: Custom prompts from SPRINT.yaml override defaults

```gherkin
Given a SPRINT.yaml with custom prompts:
  prompts:
    header: "# Custom Sprint Header"
    instructions: "## Custom Instructions\nDo it this way."
When buildPrompt is called with customPrompts parameter
Then the output starts with "# Custom Sprint Header"
And the output includes "## Custom Instructions"
And default header and instructions are NOT present
```

Verification: `cd plugins/m42-sprint/runtime && npm run test 2>&1 | grep -q "custom prompts override"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Retry Warning Included When Retry Count > 0
Scenario: Retry attempts show warning with previous error

```gherkin
Given a PROGRESS.yaml with:
  - current sub-phase has retry-count: 2
  - current sub-phase has error: "Test failed: assertion error"
When buildPrompt is called
Then the output includes "## Warning: RETRY ATTEMPT 2"
And the output includes "Test failed: assertion error"
And retry warning appears before task section
```

Verification: `cd plugins/m42-sprint/runtime && npm run test 2>&1 | grep -q "retry warning"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Context Files Loaded and Concatenated
Scenario: Context files from sprint directory are included

```gherkin
Given a sprint directory with context files:
  - context/_shared.md: "## Shared Context\nProject patterns..."
When buildPrompt is called
Then the output includes "## Shared Context"
And the output includes "Project patterns..."
And context appears at the end of the prompt
```

Verification: `cd plugins/m42-sprint/runtime && npm run test 2>&1 | grep -q "context files"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Parallel Task Prompt Generation
Scenario: buildParallelPrompt generates simplified prompt for background tasks

```gherkin
Given PROGRESS.yaml with step and sub-phase indices
And a task ID "parallel-task-001"
When buildParallelPrompt is called with phaseIdx, stepIdx, subIdx, taskId
Then the output includes "# Parallel Task Execution"
And the output includes "Task ID: parallel-task-001"
And the output includes the sub-phase prompt
And the output does NOT include progress file modification instructions
And the output includes simplified result reporting format
```

Verification: `cd plugins/m42-sprint/runtime && npm run test 2>&1 | grep -q "parallel task prompt"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Result Reporting Section Present
Scenario: All prompts include result reporting instructions

```gherkin
Given any valid PROGRESS.yaml
When buildPrompt is called
Then the output includes "## Result Reporting"
And the output includes JSON format examples
And the output includes "completed", "failed", "needs-human" status options
And the output warns NOT to modify PROGRESS.yaml directly
```

Verification: `cd plugins/m42-sprint/runtime && npm run test 2>&1 | grep -q "result reporting section"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| prompt-builder.test.ts | 15 | 1, 2, 3, 4, 5, 6, 7, 8 |

### Test Cases Detail

1. `substituteVariables: replaces all template variables` (Scenario 1)
2. `substituteVariables: no unsubstituted patterns remain` (Scenario 1)
3. `buildPrompt: simple phase generates correct structure` (Scenario 2)
4. `buildPrompt: simple phase includes Your Task section` (Scenario 2)
5. `buildPrompt: for-each phase with sub-phases` (Scenario 3)
6. `buildPrompt: includes Step Context for sub-phases` (Scenario 3)
7. `buildPrompt: custom prompts override header` (Scenario 4)
8. `buildPrompt: custom prompts override instructions` (Scenario 4)
9. `buildPrompt: includes retry warning when retry-count > 0` (Scenario 5)
10. `buildPrompt: retry warning includes error message` (Scenario 5)
11. `buildPrompt: loads context files from sprint directory` (Scenario 6)
12. `buildParallelPrompt: generates parallel task header` (Scenario 7)
13. `buildParallelPrompt: includes task ID` (Scenario 7)
14. `buildPrompt: includes result reporting section` (Scenario 8)
15. `buildPrompt: result reporting warns against PROGRESS.yaml modification` (Scenario 8)

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/runtime && npm run build && node dist/prompt-builder.test.js
# Expected: FAIL (no implementation yet)
# Error: Cannot find module './prompt-builder.js'
```

## Edge Cases (Additional Tests)

1. **Empty phases array**: Should return empty string or throw meaningful error
2. **Missing optional fields**: Should handle missing `retry-count`, `error`, etc.
3. **Special characters in prompts**: Should not break template substitution
4. **Missing context directory**: Should skip context section gracefully
5. **Null step/sub-phase indices**: Should handle simple phase case correctly
