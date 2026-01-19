# Gherkin Scenarios: foundation

## Step Task
GIVEN the current Sprint system without orchestration support
WHEN extending TypeScript types for unified loop and configurable prompts
THEN create the foundation for dynamic step injection and prompt customization

## Scope
TypeScript schema changes only - no bash scripts yet.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: OrchestrationConfig interface exists
```gherkin
Scenario: OrchestrationConfig interface is defined
  Given the types.ts file exists in the compiler
  When I check for the OrchestrationConfig interface
  Then the interface is exported with required fields (enabled, insertStrategy, autoApprove)
```

Verification: `grep -q "export.*interface OrchestrationConfig" plugins/m42-sprint/compiler/src/types.ts && grep -A10 "interface OrchestrationConfig" plugins/m42-sprint/compiler/src/types.ts | grep -q "enabled.*boolean" && grep -A10 "interface OrchestrationConfig" plugins/m42-sprint/compiler/src/types.ts | grep -q "insertStrategy" && grep -A10 "interface OrchestrationConfig" plugins/m42-sprint/compiler/src/types.ts | grep -q "autoApprove.*boolean"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: ProposedStep interface exists
```gherkin
Scenario: ProposedStep interface is defined for JSON results
  Given the types.ts file exists in the compiler
  When I check for the ProposedStep interface
  Then the interface is exported with fields for prompt, reasoning, and priority
```

Verification: `grep -q "export.*interface ProposedStep" plugins/m42-sprint/compiler/src/types.ts && grep -A10 "interface ProposedStep" plugins/m42-sprint/compiler/src/types.ts | grep -q "prompt.*string" && grep -A10 "interface ProposedStep" plugins/m42-sprint/compiler/src/types.ts | grep -q "priority"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: StepQueueItem interface exists
```gherkin
Scenario: StepQueueItem interface is defined for PROGRESS.yaml step-queue
  Given the types.ts file exists in the compiler
  When I check for the StepQueueItem interface
  Then the interface is exported with fields for id, prompt, proposedBy, proposedAt
```

Verification: `grep -q "export.*interface StepQueueItem" plugins/m42-sprint/compiler/src/types.ts && grep -A15 "interface StepQueueItem" plugins/m42-sprint/compiler/src/types.ts | grep -q "proposedBy"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: SprintPrompts interface exists
```gherkin
Scenario: SprintPrompts interface is defined for customizable prompts
  Given the types.ts file exists in the compiler
  When I check for the SprintPrompts interface
  Then the interface is exported with optional fields for header, position, instructions
```

Verification: `grep -q "export.*interface SprintPrompts" plugins/m42-sprint/compiler/src/types.ts && grep -A15 "interface SprintPrompts" plugins/m42-sprint/compiler/src/types.ts | grep -q "header\|position\|instructions"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: WorkflowDefinition extended with orchestration
```gherkin
Scenario: WorkflowDefinition includes optional orchestration field
  Given the WorkflowDefinition interface exists
  When I check for orchestration support
  Then the interface has an optional orchestration field of type OrchestrationConfig
```

Verification: `grep -A30 "interface WorkflowDefinition" plugins/m42-sprint/compiler/src/types.ts | grep -q "orchestration.*OrchestrationConfig\|orchestration?.*OrchestrationConfig"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: CompiledProgress extended with stepQueue
```gherkin
Scenario: CompiledProgress includes stepQueue field
  Given the CompiledProgress interface exists
  When I check for step-queue support
  Then the interface has a stepQueue field of type StepQueueItem[]
```

Verification: `grep -A50 "interface CompiledProgress" plugins/m42-sprint/compiler/src/types.ts | grep -q "stepQueue.*StepQueueItem"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: TypeScript compiles without errors
```gherkin
Scenario: TypeScript compilation succeeds
  Given all type definitions are in place
  When I run the TypeScript compiler in the compiler directory
  Then no compilation errors occur
```

Verification: `cd plugins/m42-sprint/compiler && npm run build 2>&1 | tail -1 | grep -v "error\|Error" || test $? -eq 0`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Existing tests still pass
```gherkin
Scenario: Existing test suite passes
  Given the type changes maintain backward compatibility
  When I run the existing test suite
  Then all tests pass without errors
```

Verification: `cd plugins/m42-sprint/compiler && npm test 2>&1; echo "EXIT:$?"`
Pass: Last line contains "EXIT:0" → Score 1
Fail: Last line does not contain "EXIT:0" → Score 0
