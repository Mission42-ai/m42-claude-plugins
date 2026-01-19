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

Verification: `grep -q "export interface OrchestrationConfig" plugins/m42-sprint/compiler/src/types.ts`
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

Verification: `grep -q "export interface ProposedStep" plugins/m42-sprint/compiler/src/types.ts`
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

Verification: `grep -q "export interface StepQueueItem" plugins/m42-sprint/compiler/src/types.ts`
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

Verification: `grep -q "export interface SprintPrompts" plugins/m42-sprint/compiler/src/types.ts`
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

Verification: `grep -A 30 "export interface WorkflowDefinition" plugins/m42-sprint/compiler/src/types.ts | grep -q "orchestration.*OrchestrationConfig"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: SprintDefinition extended with prompts
```gherkin
Scenario: SprintDefinition includes optional prompts field
  Given the SprintDefinition interface exists
  When I check for prompts support
  Then the interface has an optional prompts field of type SprintPrompts
```

Verification: `grep -A 40 "export interface SprintDefinition" plugins/m42-sprint/compiler/src/types.ts | grep -q "prompts.*SprintPrompts"`
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

Verification: `cd plugins/m42-sprint/compiler && npm run build`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: TypeScript type checking passes
```gherkin
Scenario: TypeScript type checking succeeds
  Given all type changes maintain backward compatibility
  When I run npm run typecheck in the compiler directory
  Then type checking completes without errors
```

Verification: `cd plugins/m42-sprint/compiler && npm run typecheck`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
