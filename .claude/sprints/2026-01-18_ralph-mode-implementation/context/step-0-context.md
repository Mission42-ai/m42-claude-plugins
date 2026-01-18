# Step Context: step-0

## Task
Erweitere das Compiler-System für Ralph Mode Support.

### 1. Types erweitern (plugins/m42-sprint/compiler/src/types.ts)
- Add `PerIterationHook` interface
- Extend `WorkflowDefinition` with Ralph mode fields
- Extend `SprintDefinition` with `goal` field
- Extend `CompiledProgress` with Ralph mode structure

### 2. Compile.ts erweitern (plugins/m42-sprint/compiler/src/compile.ts)
- Add Ralph mode detection logic
- Generate Ralph-specific PROGRESS.yaml structure
- Implement per-iteration hooks merging

### 3. Validierung (plugins/m42-sprint/compiler/src/validate.ts)
- Ralph mode workflows don't require `phases` array
- SPRINT.yaml with Ralph workflow must have `goal` field
- Per-iteration hooks must have either `workflow` or `prompt`

## Related Code Patterns

### Existing Interface Pattern: types.ts:86-93
```typescript
// WorkflowDefinition - extend this with Ralph fields
export interface WorkflowDefinition {
  name: string;
  description?: string;
  phases: WorkflowPhase[];  // Will become optional for Ralph mode
}
```

### Existing Interface Pattern: types.ts:41-59
```typescript
// SprintDefinition - add goal field here
export interface SprintDefinition {
  workflow: string;
  steps: SprintStep[];
  'sprint-id'?: string;
  name?: string;
  created?: string;
  owner?: string;
  config?: { ... };
  retry?: RetryConfig;
  // ADD: goal?: string;
  // ADD: 'per-iteration-hooks'?: Record<string, { enabled: boolean }>;
}
```

### Existing Interface Pattern: types.ts:239-250
```typescript
// CompiledProgress - add Ralph mode fields
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases: CompiledTopPhase[];  // Optional for Ralph mode
  current: CurrentPointer;
  stats: SprintStats;
  'parallel-tasks'?: ParallelTask[];
  // ADD: mode?: 'standard' | 'ralph';
  // ADD: goal?: string;
  // ADD: 'dynamic-steps'?: DynamicStep[];
  // ADD: 'hook-tasks'?: HookTask[];
  // ADD: 'per-iteration-hooks'?: PerIterationHook[];
  // ADD: ralph?: RalphConfig;
}
```

### Workflow Validation Pattern: validate.ts:116-163
```typescript
// Current validation requires phases array
// Ralph mode workflows need alternative validation path
export function validateWorkflowDefinition(workflow: unknown, name: string): CompilerError[] {
  // Check for mode: ralph first, then use different validation
  // If mode: ralph, phases is NOT required
  // If mode: standard or undefined, phases IS required
}
```

### Sprint Validation Pattern: validate.ts:23-60
```typescript
// Add goal validation for Ralph mode
export function validateSprintDefinition(sprint: unknown): CompilerError[] {
  // After loading workflow, check if it's Ralph mode
  // If Ralph mode, require goal field
}
```

### Compile Pattern: compile.ts:73-244
```typescript
// Main compilation function - add Ralph branch
export async function compile(config: CompilerConfig): Promise<CompilerResult> {
  // After loading workflow, check mode
  // if (mainWorkflow.definition.mode === 'ralph') {
  //   return compileRalphMode(sprintDef, mainWorkflow, config, errors, warnings);
  // }
  // else continue with standard compilation
}
```

## Required Imports
### Internal
- `types.js`: Add new interfaces (PerIterationHook, DynamicStep, HookTask, RalphConfig)
- `validate.js`: Export new validation functions for Ralph mode

### External
- No new external packages needed
- Existing: `js-yaml`, `fs`, `path`

## Types/Interfaces to Add

### PerIterationHook (new interface)
```typescript
export interface PerIterationHook {
  /** Unique identifier for this hook */
  id: string;
  /** Reference to workflow (e.g., "m42-signs:learning-extraction") */
  workflow?: string;
  /** Inline prompt alternative to workflow */
  prompt?: string;
  /** If true, runs non-blocking in background */
  parallel: boolean;
  /** Whether this hook is active */
  enabled: boolean;
}
```

### DynamicStep (for Ralph mode PROGRESS.yaml)
```typescript
export interface DynamicStep {
  /** Unique identifier */
  id: string;
  /** The task prompt */
  prompt: string;
  /** Current status */
  status: PhaseStatus;
  /** When added (ISO timestamp) */
  'added-at': string;
  /** Which iteration added this step */
  'added-in-iteration': number;
}
```

### HookTask (for tracking per-iteration hook execution)
```typescript
export interface HookTask {
  /** Which iteration this belongs to */
  iteration: number;
  /** Which hook this is */
  'hook-id': string;
  /** Current status */
  status: ParallelTaskStatus;
  /** Process ID if running */
  pid?: number;
  /** Path to transcript file */
  transcript?: string;
}
```

### RalphConfig (Ralph mode configuration)
```typescript
export interface RalphConfig {
  /** Iterations without progress before reflection */
  'idle-threshold'?: number;
}
```

### RalphExitInfo (for tracking completion)
```typescript
export interface RalphExitInfo {
  /** When RALPH_COMPLETE was detected */
  'detected-at'?: string;
  /** Which iteration completed */
  iteration?: number;
  /** Final summary from Claude */
  'final-summary'?: string;
}
```

### Extended WorkflowDefinition
```typescript
export interface WorkflowDefinition {
  name: string;
  description?: string;
  phases?: WorkflowPhase[];  // NOW OPTIONAL for Ralph mode

  // Ralph mode fields
  mode?: 'standard' | 'ralph';
  'goal-prompt'?: string;
  'reflection-prompt'?: string;
  'per-iteration-hooks'?: PerIterationHook[];
}
```

### Extended SprintDefinition
```typescript
export interface SprintDefinition {
  workflow: string;
  steps?: SprintStep[];  // Optional for Ralph mode
  'sprint-id'?: string;
  name?: string;
  // ... existing fields

  // Ralph mode fields
  goal?: string;
  'per-iteration-hooks'?: Record<string, { enabled: boolean }>;
}
```

### Extended CompiledProgress
```typescript
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases?: CompiledTopPhase[];  // Optional for Ralph mode
  current: CurrentPointer;
  stats: SprintStats;
  'parallel-tasks'?: ParallelTask[];

  // Ralph mode fields
  mode?: 'standard' | 'ralph';
  goal?: string;
  'dynamic-steps'?: DynamicStep[];
  'hook-tasks'?: HookTask[];
  'per-iteration-hooks'?: PerIterationHook[];
  ralph?: RalphConfig;
  'ralph-exit'?: RalphExitInfo;
}
```

## Integration Points
- **Called by**: `plugins/m42-sprint/compiler/src/index.ts` (CLI entry)
- **Calls**:
  - `validate.ts` for validation
  - `resolve-workflows.ts` for workflow loading
- **Tests**: `plugins/m42-sprint/compiler/src/validate.test.ts` (extend for Ralph validation)

## Hook Merging Logic (compile.ts)

The per-iteration hooks from workflow and SPRINT.yaml need to be merged:

```typescript
function mergePerIterationHooks(
  workflowHooks: PerIterationHook[],
  sprintOverrides: Record<string, { enabled: boolean }> | undefined
): PerIterationHook[] {
  return workflowHooks.map(hook => {
    const override = sprintOverrides?.[hook.id];
    if (override) {
      return { ...hook, enabled: override.enabled };
    }
    return hook;
  });
}
```

## Validation Rules for Ralph Mode

### In validateWorkflowDefinition (validate.ts)
```typescript
// If mode: ralph
// - phases is NOT required
// - goal-prompt, reflection-prompt are optional but recommended
// - per-iteration-hooks must validate each hook

// If mode is undefined or 'standard'
// - phases IS required (existing validation)
```

### In validateSprintDefinition (validate.ts)
```typescript
// After loading workflow (needs workflow reference):
// - If workflow.mode === 'ralph', goal field is REQUIRED
// - steps array is optional for Ralph mode
// - per-iteration-hooks overrides must reference valid hook ids
```

### New validatePerIterationHook function
```typescript
function validatePerIterationHook(hook: unknown, index: number): CompilerError[] {
  // Must have id (string)
  // Must have either workflow OR prompt (but not both, not neither)
  // parallel must be boolean
  // enabled must be boolean
}
```

## Implementation Notes

1. **Backwards Compatibility**: All new fields are optional, existing sprints continue to work unchanged

2. **Mode Detection Flow**:
   ```
   Load SPRINT.yaml
   → Load workflow
   → Check workflow.mode
   → If 'ralph': validate goal, compile Ralph mode
   → If undefined/'standard': existing compilation path
   ```

3. **File Naming**: kebab-case for YAML fields (`per-iteration-hooks`, `goal-prompt`)

4. **Error Codes**: Use pattern `RALPH_*` for Ralph-specific errors:
   - `RALPH_MISSING_GOAL`: "Ralph mode requires goal field in SPRINT.yaml"
   - `RALPH_INVALID_HOOK`: "Per-iteration hook must have workflow or prompt"

5. **TypeScript Exports**: All new interfaces should be exported for use in other modules

6. **Gherkin Coverage**: 8 scenarios total (see artifacts/step-0-gherkin.md):
   - PerIterationHook interface exists
   - WorkflowDefinition has Ralph fields
   - SprintDefinition has goal field
   - TypeScript compiles
   - CompiledProgress has Ralph fields
   - compile.ts detects Ralph mode
   - validate.ts enforces goal for Ralph
   - Hook merging logic exists
