# Gherkin Scenarios: step-8

## Step Task
Update skills/creating-workflows/references/workflow-schema.md:

Document new properties:
1. `parallel?: boolean` on WorkflowPhase
   - Description: Run this phase in background, don't block next step
   - Use case: Documentation updates, learning loops
   - Note: Only works in step workflows, not on for-each phases

2. `wait-for-parallel?: boolean` on top-level WorkflowPhase
   - Description: Wait for all parallel tasks to complete before continuing
   - Use case: Sync points before QA or deployment phases

Add usage examples from the plan.

Reference: context/implementation-plan.md section 5

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Schema file exists and contains parallel property documentation
```gherkin
Scenario: parallel property is documented in workflow-schema.md
  Given workflow-schema.md exists
  When I search for parallel property documentation
  Then the parallel property is documented with its type and description

Verification: `grep -q "parallel.*boolean" plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: wait-for-parallel property is documented
```gherkin
Scenario: wait-for-parallel property is documented in workflow-schema.md
  Given workflow-schema.md exists
  When I search for wait-for-parallel property documentation
  Then the wait-for-parallel property is documented with its type and description

Verification: `grep -q "wait-for-parallel.*boolean" plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: TypeScript interface includes parallel property
```gherkin
Scenario: TypeScript interface shows parallel property
  Given the TypeScript interface section exists in workflow-schema.md
  When I check the WorkflowPhase interface
  Then it includes the parallel?: boolean property

Verification: `grep -A 20 "interface WorkflowPhase" plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md | grep -q "parallel.*:.*boolean"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: TypeScript interface includes wait-for-parallel property
```gherkin
Scenario: TypeScript interface shows wait-for-parallel property
  Given the TypeScript interface section exists in workflow-schema.md
  When I check the WorkflowPhase interface
  Then it includes the wait-for-parallel?: boolean property

Verification: `grep -A 20 "interface WorkflowPhase" plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md | grep -q "'wait-for-parallel'.*:.*boolean"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Usage example for parallel sub-phase exists
```gherkin
Scenario: Parallel sub-phase usage example is provided
  Given the workflow-schema.md has examples section
  When I search for parallel usage examples
  Then a YAML example shows parallel: true on a sub-phase

Verification: `grep -B 2 -A 5 "parallel: true" plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md | grep -q "prompt:"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Usage example for wait-for-parallel sync point exists
```gherkin
Scenario: Wait-for-parallel sync point example is provided
  Given the workflow-schema.md has examples section
  When I search for wait-for-parallel usage examples
  Then a YAML example shows wait-for-parallel: true for a sync phase

Verification: `grep -B 2 -A 5 "wait-for-parallel: true" plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md | grep -q "id:"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```
