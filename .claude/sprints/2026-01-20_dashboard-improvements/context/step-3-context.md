# Step Context: step-3

## Task
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

## Implementation Plan
Based on gherkin scenarios, implement in this order:
1. **Validation** (Scenario 3): Add mutual exclusivity check for `prompt` and `workflow` in `validateWorkflowPhase()`
2. **Phase type detection** (Scenario 1, 7): Update `compile.ts` to detect `workflow:` without `for-each:`
3. **Workflow expansion** (Scenario 1, 2, 7): Create `expandWorkflowReference()` function to expand referenced workflow phases with ID prefixing
4. **Cycle detection** (Scenario 4, 5): Update `resolveWorkflowRefs()` to handle single-phase workflow references
5. **Max depth limit** (Scenario 6): Add depth tracking during expansion with limit of 5
6. **Nested expansion** (Scenario 8): Ensure recursive expansion works with cumulative ID prefixes

## Related Code Patterns

### Pattern from: compile.ts (phase compilation loop)
```typescript
// Lines 215-232: Current phase handling
for (const phase of workflowPhases) {
  if (phase['for-each'] === 'step') {
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
  } else {
    // Simple phase with prompt
    const simplePhase = compileSimplePhase(phase, context);
    compiledPhases.push(simplePhase);
  }
}
```

### Pattern from: resolve-workflows.ts (cycle detection)
```typescript
// Lines 94-151: resolveWorkflowRefs with cycle detection
export function resolveWorkflowRefs(
  workflow: WorkflowDefinition,
  workflowsDir: string,
  visited: Set<string> = new Set(),
  errors: CompilerError[] = []
): Map<string, LoadedWorkflow> {
  const resolved = new Map<string, LoadedWorkflow>();

  for (const phase of workflow.phases ?? []) {
    if (phase.workflow) {
      // Check for cycles
      if (visited.has(phase.workflow)) {
        errors.push({
          code: 'CYCLE_DETECTED',
          message: `Circular workflow reference detected: ${phase.workflow}`,
          path: `phases[${phase.id}].workflow`,
          details: { cycle: Array.from(visited).concat(phase.workflow) }
        });
        continue;
      }
      // ... load and recursively resolve
    }
  }
}
```

### Pattern from: expand-foreach.ts (template substitution)
```typescript
// Lines 34-62: substituteTemplateVars for variable replacement
export function substituteTemplateVars(
  template: string,
  context: TemplateContext
): string {
  let result = template;
  if (context.step) {
    result = result.replace(/\{\{step\.prompt\}\}/g, context.step.prompt);
    result = result.replace(/\{\{step\.id\}\}/g, context.step.id);
    // ...
  }
  return result;
}
```

### Pattern from: validate.ts (phase validation)
```typescript
// Lines 354-442: validateWorkflowPhase - where to add mutual exclusivity check
export function validateWorkflowPhase(
  phase: unknown,
  index: number,
  workflowName: string,
  existingIds: Set<string>
): CompilerError[] {
  const errors: CompilerError[] = [];
  // ...
  const hasPrompt = p.prompt && typeof p.prompt === 'string';
  const hasForEach = p['for-each'] === 'step';
  const hasWorkflow = p.workflow && typeof p.workflow === 'string';

  if (!hasPrompt && !hasForEach) {
    errors.push({
      code: 'PHASE_MISSING_ACTION',
      message: `Phase '${p.id || index}' in ${workflowName} must have either 'prompt' or 'for-each: step'`,
      path: `${workflowName}.phases[${index}]`
    });
  }
  // ...
}
```

## Required Imports
### Internal
- `types.ts`: `WorkflowPhase`, `CompiledTopPhase`, `TemplateContext`, `CompilerError`, `LoadedWorkflow`
- `resolve-workflows.ts`: `loadWorkflow`, `resolveWorkflowRefs`, `clearWorkflowCache`
- `expand-foreach.ts`: `substituteTemplateVars`, `compileSimplePhase`
- `validate.ts`: `validateWorkflowPhase` (modify)

### External
- `js-yaml`: Already imported in compile.ts
- `fs`, `path`: Already imported

## Types/Interfaces to Use
```typescript
// From types.ts - WorkflowPhase (no changes needed - already has workflow field)
interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;  // Already exists
  parallel?: boolean;
  'wait-for-parallel'?: boolean;
}

// New interface for expansion context
interface WorkflowExpansionContext {
  workflowsDir: string;
  templateContext: TemplateContext;
  visitedWorkflows: Set<string>;  // For cycle detection
  currentDepth: number;           // For max depth enforcement
  parentPhasePrefix: string;      // For ID prefixing
  errors: CompilerError[];
}
```

## Integration Points
- Called by: `compile()` in compile.ts during phase compilation loop
- Calls: `loadWorkflow()` from resolve-workflows.ts, `substituteTemplateVars()` from expand-foreach.ts
- Modified: `validateWorkflowPhase()` in validate.ts for mutual exclusivity validation

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `compiler/src/validate.ts` | Modify | Add PROMPT_WORKFLOW_MUTUAL_EXCLUSIVE error, update PHASE_MISSING_ACTION logic |
| `compiler/src/compile.ts` | Modify | Add workflow reference expansion in phase compilation loop |
| `compiler/src/expand-foreach.ts` | Modify | Add `expandWorkflowReference()` function |
| `compiler/src/resolve-workflows.ts` | Modify | Update cycle detection to handle non-for-each references, add depth tracking |

## Error Codes to Add
- `PROMPT_WORKFLOW_MUTUAL_EXCLUSIVE`: Phase has both prompt and workflow
- `MAX_DEPTH_EXCEEDED`: Workflow nesting exceeds 5 levels
- `CYCLE_DETECTED`: Already exists, but message may need adjustment

## Constants
```typescript
const MAX_WORKFLOW_DEPTH = 5;
```

## Test File
The test file `compiler/src/workflow-reference.test.ts` already exists with 8 scenarios:
1. ✗ Scenario 1: Workflow reference expands inline phases
2. ✗ Scenario 2: Phase IDs are prefixed with parent phase ID
3. ✗ Scenario 3: Error when both prompt and workflow specified
4. ✗ Scenario 4: Detect direct workflow self-reference
5. ✗ Scenario 5: Detect indirect workflow cycle (A → B → A)
6. ✗ Scenario 6: Enforce maximum workflow nesting depth
7. ✗ Scenario 7: Mixed inline and workflow-reference phases
8. ✗ Scenario 8: Nested workflow references within depth limit

## Implementation Notes

### ID Prefixing Strategy
- Pattern: `{parent-phase-id}-{child-phase-id}`
- Nested: `{grandparent}-{parent}-{child}`
- Example: `docs-analyze`, `parent-child-ref-step1`

### Depth Tracking
- Main workflow = depth 0
- Each workflow reference = depth + 1
- Fail when depth > MAX_WORKFLOW_DEPTH (5)

### Validation Order
1. Mutual exclusivity check (prompt vs workflow) - in validateWorkflowPhase
2. Phase action check (must have prompt OR for-each OR workflow)
3. Cycle detection - during resolveWorkflowRefs
4. Max depth - during expansion

### Backward Compatibility
- Existing `for-each: step` + `workflow:` behavior must remain unchanged
- Tests verify this with "Edge case: Workflow reference with for-each should still work"
