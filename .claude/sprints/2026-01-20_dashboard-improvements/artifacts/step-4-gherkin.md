# Gherkin Scenarios: step-4

## Step Task
Implement configurable model selection with cascading override.

## Overview
Allow setting the Claude model (sonnet, opus, haiku) at different levels:
- workflow (default for all phases)
- sprint (overrides workflow)
- phase (overrides sprint)
- step (overrides phase) - highest priority

Override priority: step > phase > sprint > workflow

## Requirements Summary

### Schema Updates
- SPRINT.yaml: add optional `model` field at sprint level and per step
- Workflow YAML: add optional `model` field at workflow level and per phase

### Compiler Changes
- Parse `model` field from SPRINT.yaml (sprint and step level)
- Parse `model` field from workflow YAML (workflow and phase level)
- Store resolved model in PROGRESS.yaml for each phase

### Runtime Changes
- Read `model` field from current phase in PROGRESS.yaml
- Pass model to claude-runner when invoking Claude CLI
- Use `--model` flag in Claude CLI invocation

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Model specified at workflow level

```gherkin
Scenario: Workflow-level model is applied to all phases
  Given a workflow YAML with model: sonnet
  And a SPRINT.yaml referencing this workflow
  When the compiler compiles the sprint
  Then all phases in PROGRESS.yaml should have model: sonnet

Verification: `node -e "const y=require('js-yaml');const p=y.load(require('fs').readFileSync('PROGRESS.yaml'));const models=p.phases.map(ph=>ph.model);process.exit(models.every(m=>m==='sonnet')?0:1)"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Sprint-level model overrides workflow-level

```gherkin
Scenario: Sprint-level model overrides workflow default
  Given a workflow YAML with model: haiku
  And a SPRINT.yaml with model: sonnet referencing this workflow
  When the compiler compiles the sprint
  Then all phases in PROGRESS.yaml should have model: sonnet

Verification: `node -e "const y=require('js-yaml');const p=y.load(require('fs').readFileSync('PROGRESS.yaml'));const models=p.phases.map(ph=>ph.model);process.exit(models.every(m=>m==='sonnet')?0:1)"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Phase-level model overrides sprint-level

```gherkin
Scenario: Phase-level model overrides sprint default
  Given a workflow YAML with phases where one has model: opus
  And a SPRINT.yaml with model: sonnet referencing this workflow
  When the compiler compiles the sprint
  Then the phase with explicit model should have model: opus
  And other phases should have model: sonnet

Verification: `node -e "const y=require('js-yaml');const p=y.load(require('fs').readFileSync('PROGRESS.yaml'));const explicit=p.phases.find(ph=>ph.id==='explicit-phase');const others=p.phases.filter(ph=>ph.id!=='explicit-phase');process.exit(explicit?.model==='opus'&&others.every(o=>o.model==='sonnet')?0:1)"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Step-level model overrides all other levels

```gherkin
Scenario: Step-level model has highest priority
  Given a workflow YAML with model: haiku
  And a SPRINT.yaml with model: sonnet
  And a step in SPRINT.yaml with model: opus
  When the compiler compiles the sprint
  Then sub-phases from that step should have model: opus
  And other phases should have model: sonnet

Verification: `node -e "const y=require('js-yaml');const p=y.load(require('fs').readFileSync('PROGRESS.yaml'));const stepPhase=p.phases.find(ph=>ph.steps);const stepModel=stepPhase?.steps?.[0]?.phases?.[0]?.model;process.exit(stepModel==='opus'?0:1)"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: No model specified uses undefined (inherits default)

```gherkin
Scenario: Phases without model inherit undefined
  Given a workflow YAML without model specified
  And a SPRINT.yaml without model specified
  When the compiler compiles the sprint
  Then phases in PROGRESS.yaml should have model: undefined

Verification: `node -e "const y=require('js-yaml');const p=y.load(require('fs').readFileSync('PROGRESS.yaml'));const models=p.phases.map(ph=>ph.model);process.exit(models.every(m=>m===undefined)?0:1)"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Runtime passes model to claude-runner

```gherkin
Scenario: Runtime loop passes model from PROGRESS.yaml to claude-runner
  Given a PROGRESS.yaml with a phase containing model: opus
  When the runtime loop executes the phase
  Then claude-runner should receive model: opus in options

Verification: (Unit test - claude-runner receives model option)
Pass: Test passes → Score 1
Fail: Test fails → Score 0
```

---

## Scenario 7: Claude-runner includes --model flag

```gherkin
Scenario: Claude-runner builds args with --model flag
  Given a ClaudeRunOptions with model: sonnet
  When buildArgs is called
  Then the resulting args should contain ['--model', 'sonnet']

Verification: `node -e "const {buildArgs}=require('./dist/claude-runner.js');const args=buildArgs({prompt:'test',model:'sonnet'});process.exit(args.includes('--model')&&args.includes('sonnet')?0:1)"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Model validation accepts only valid values

```gherkin
Scenario: Compiler validates model values
  Given a SPRINT.yaml with model: invalid-model
  When the compiler validates the sprint
  Then validation should fail with an error about invalid model

Verification: (Unit test - validation rejects invalid model values)
Pass: Test passes → Score 1
Fail: Test fails → Score 0
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| compiler/src/model-selection.test.ts | 12 | 1, 2, 3, 4, 5, 8 |
| runtime/src/loop-model.test.ts | 4 | 6 |
| runtime/src/claude-runner.test.ts | 2 (existing + additions) | 7 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/compiler && npm run build && npm test
cd plugins/m42-sprint/runtime && npm run build && npm test
# Expected: FAIL (no implementation yet for model fields)
```

## Test Implementation Details

### Model Resolution Function (to be tested)
```typescript
function resolveModel(
  step?: { model?: ClaudeModel },
  phase?: { model?: ClaudeModel },
  sprint?: { model?: ClaudeModel },
  workflow?: { model?: ClaudeModel }
): ClaudeModel | undefined {
  return step?.model ?? phase?.model ?? sprint?.model ?? workflow?.model;
}
```

### Type Definition (to be added)
```typescript
type ClaudeModel = 'sonnet' | 'opus' | 'haiku';
```
