# Step Context: step-4

## Task
Implement configurable model selection with cascading override.

## Overview
Allow setting the Claude model (sonnet, opus, haiku) at different levels:
- workflow (default for all phases)
- sprint (overrides workflow)
- phase (overrides sprint)
- step (overrides phase) - highest priority

Override priority: step > phase > sprint > workflow

## Requirements

### 1. Schema Updates

**SPRINT.yaml schema** - add optional `model` field:
```yaml
workflow: plugin-development
model: sonnet  # Sprint-level default (optional)

steps:
  - prompt: |
      Complex task requiring more reasoning...
    model: opus  # Step-level override (optional)
  - prompt: |
      Simple task...
    # No model specified - inherits from sprint/workflow
```

**Workflow YAML schema** - add optional `model` field:
```yaml
name: My Workflow
model: sonnet  # Workflow-level default (optional)

phases:
  - id: planning
    model: opus  # Phase-level override (optional)
    prompt: |
      ...
  - id: implement
    # No model - inherits from workflow
    prompt: |
      ...
```

### 2. Compiler Changes (plugins/m42-sprint/compiler/)

Update the compiler to:
1. Parse `model` field from SPRINT.yaml at sprint level
2. Parse `model` field from each step
3. Parse `model` field from workflow YAML at workflow level
4. Parse `model` field from each phase
5. Store resolved model in PROGRESS.yaml for each phase

**Resolution logic**:
```typescript
function resolveModel(step, phase, sprint, workflow): string | undefined {
  return step?.model ?? phase?.model ?? sprint?.model ?? workflow?.model;
}
```

### 3. Runtime Changes (plugins/m42-sprint/runtime/)

Update the runtime loop to:
1. Read the `model` field from current phase in PROGRESS.yaml
2. Pass model to claude-runner when invoking Claude CLI
3. Use `--model` flag in Claude CLI invocation

**claude-runner.ts changes**:
```typescript
interface ClaudeRunOptions {
  // ... existing options
  model?: 'sonnet' | 'opus' | 'haiku';
}

// In runClaude():
const args = [
  '--print', 'text',
  // ... other args
];
if (options.model) {
  args.push('--model', options.model);
}
```

### 4. Dashboard Display (optional enhancement)

Show current model in the sprint detail page:
- Display model name next to phase in sidebar
- Different icon/color for each model tier

## Implementation Plan
Based on gherkin scenarios, implement in this order:
1. Add `ClaudeModel` type definition to compiler types (`'sonnet' | 'opus' | 'haiku'`)
2. Add `model` field to interface definitions (`SprintDefinition`, `SprintStep`, `WorkflowDefinition`, `WorkflowPhase`, `CompiledTopPhase`, `CompiledPhase`)
3. Create `resolveModel()` function in compiler
4. Update `compile.ts` to resolve and propagate model through compilation
5. Update `expand-foreach.ts` to propagate model to sub-phases
6. Add model validation to `validate.ts`
7. Update runtime `loop.ts` to read model from phase and pass to claude-runner
8. Verify `buildArgs` in `claude-runner.ts` already handles model (it does!)

## Related Code Patterns

### Pattern from: plugins/m42-sprint/compiler/src/compile.ts (lines 219-228)
```typescript
// Expand for-each phase into steps
const expandedPhase = expandForEach(
  phase,
  sprintDef.steps ?? [],
  config.workflowsDir,
  defaultStepWorkflow,
  context,
  errors
);
compiledPhases.push(expandedPhase);
```
This shows how phases are expanded - model needs to be passed through this chain.

### Pattern from: plugins/m42-sprint/compiler/src/expand-foreach.ts (lines 117-130)
```typescript
const compiledPhases: CompiledPhase[] = (workflow.phases ?? []).map((phase, phaseIndex) => {
  // ...
  return {
    id: phase.id,
    status: 'pending' as const,
    prompt,
    parallel: phase.parallel
    // ADD: model: resolvedModel
  };
});
```
This is where sub-phases are created - model resolution should happen here.

### Pattern from: plugins/m42-sprint/runtime/src/loop.ts (lines 583-590)
```typescript
// Execute SPAWN_CLAUDE action directly
const spawnResult = await deps.runClaude({
  prompt,
  cwd: sprintDir,
  outputFile,
  jsonSchema: SPRINT_RESULT_SCHEMA,
  // ADD: model: currentPhase.model ?? currentSubPhase.model
});
```
This is where model needs to be passed to claude-runner.

### Pattern from: plugins/m42-sprint/runtime/src/claude-runner.ts (lines 199-202)
```typescript
// Model (already implemented!)
if (options.model !== undefined) {
  args.push('--model', options.model);
}
```
The claude-runner already handles the `model` option - just need to pass it.

## Required Imports
### Internal
- `compile.ts`: Import `WorkflowDefinition`, `SprintDefinition`, `WorkflowPhase`
- `types.ts`: Define/export `ClaudeModel` type
- `expand-foreach.ts`: Add model resolution in expandStep and expandForEach
- `validate.ts`: Add model validation function

### External
- None needed - all dependencies already in place

## Types/Interfaces to Use

### From types.ts (to be added)
```typescript
/** Valid Claude model identifiers */
export type ClaudeModel = 'sonnet' | 'opus' | 'haiku';

// Add to existing interfaces:
export interface SprintDefinition {
  // ... existing fields
  model?: ClaudeModel;  // Sprint-level default model
}

export interface SprintStep {
  // ... existing fields
  model?: ClaudeModel;  // Step-level model override
}

export interface WorkflowDefinition {
  // ... existing fields
  model?: ClaudeModel;  // Workflow-level default model
}

export interface WorkflowPhase {
  // ... existing fields
  model?: ClaudeModel;  // Phase-level model override
}

export interface CompiledTopPhase {
  // ... existing fields
  model?: ClaudeModel;  // Resolved model for execution
}

export interface CompiledPhase {
  // ... existing fields
  model?: ClaudeModel;  // Resolved model for execution
}

export interface CompiledStep {
  // ... existing fields
  model?: ClaudeModel;  // Step-level model (for sub-phase resolution)
}
```

### From claude-runner.ts (already exists)
```typescript
export interface ClaudeRunOptions {
  model?: string;  // Already supports model - just pass it!
}
```

## Integration Points
- **Called by**: `loop.ts` (runtime) reads model from `CompiledProgress` phases
- **Calls**: `claude-runner.ts` receives model in `ClaudeRunOptions`
- **Produces**: `PROGRESS.yaml` contains resolved `model` field on each phase

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `compiler/src/types.ts` | Modify | Add `ClaudeModel` type and `model` field to interfaces |
| `compiler/src/compile.ts` | Modify | Pass model context through compilation, add resolveModel function |
| `compiler/src/expand-foreach.ts` | Modify | Propagate model to expanded sub-phases |
| `compiler/src/validate.ts` | Modify | Add model validation (valid enum values) |
| `runtime/src/loop.ts` | Modify | Read model from phase and pass to runClaude |

## Existing Tests (RED phase)

Tests already written that should pass after implementation:

### Compiler Tests (`model-selection.test.ts`)
- `compile: workflow-level model is applied to all phases`
- `compile: phases without explicit model inherit workflow model`
- `compile: sprint-level model overrides workflow-level model`
- `compile: sprint model applies when workflow has no model`
- `compile: phase-level model overrides sprint-level model`
- `compile: step-level model has highest priority`
- `compile: phases without model have undefined model`
- `compile: resolves model with correct priority order`
- `compile: rejects invalid model values in SPRINT.yaml`
- `compile: rejects invalid model values in workflow`
- `compile: accepts all valid model values`
- `compile: model field is included in PROGRESS.yaml phases`

### Runtime Tests (`loop-model.test.ts`)
- `loop: passes model from phase to claude-runner`
- `loop: passes different models for different phases`
- `loop: does not pass model when phase has no model`
- `loop: passes model from sub-phase in for-each step`

### Claude Runner Tests (`claude-runner.test.ts`)
- `buildArgs: includes model when specified` (already passes!)

## Verification Commands

```bash
# Run compiler tests
cd plugins/m42-sprint/compiler && npm run build && npm test

# Run runtime tests
cd plugins/m42-sprint/runtime && npm run build && npm test

# Check specific model selection tests
cd plugins/m42-sprint/compiler && npm run build && node dist/model-selection.test.js
cd plugins/m42-sprint/runtime && npm run build && node dist/loop-model.test.js
```

## Key Implementation Notes

1. **claude-runner already supports model** - the `buildArgs` function already handles `options.model`, so no changes needed there.

2. **Model resolution order** (highest to lowest priority):
   - Step-level model (from `SprintStep.model`)
   - Phase-level model (from `WorkflowPhase.model`)
   - Sprint-level model (from `SprintDefinition.model`)
   - Workflow-level model (from `WorkflowDefinition.model`)
   - `undefined` if none specified

3. **Model propagation during compilation**:
   - For simple phases: resolve using `phase.model ?? sprint.model ?? workflow.model`
   - For for-each phases: each sub-phase gets `step.model ?? phase.model ?? sprint.model ?? workflow.model`

4. **Type-safe model validation**: Use the `ClaudeModel` union type and validate during compilation to reject invalid values early.
