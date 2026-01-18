# Step Context: step-1

## Task
Update compiler/src/expand-foreach.ts to propagate parallel flag:

1. In expandStep() function (lines 84-130)
2. When creating CompiledPhase objects in the map (line 117-121)
3. Add: `parallel: phase.parallel` to propagate the flag from WorkflowPhase to CompiledPhase

This ensures sub-phases marked as parallel in workflow definitions are compiled with the parallel flag.

Reference: context/implementation-plan.md section 4.B

## Related Code Patterns

### Similar Implementation: types.ts (lines 68-81)
```typescript
// WorkflowPhase already has the parallel property defined
export interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;           // <-- Source of truth
  'wait-for-parallel'?: boolean;
}
```

### Target Interface: types.ts (lines 131-153)
```typescript
// CompiledPhase already has the parallel property defined
export interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  // ... timing and error fields ...
  parallel?: boolean;           // <-- Target field (needs to be set)
  'parallel-task-id'?: string;
}
```

### Current Implementation: expand-foreach.ts (lines 103-122)
```typescript
// Expand each phase in the step's workflow
const compiledPhases: CompiledPhase[] = workflow.phases.map((phase, phaseIndex) => {
  const phaseContext: TemplateContext = {
    ...stepContext,
    phase: {
      id: phase.id,
      index: phaseIndex
    }
  };

  // Substitute variables in the prompt
  const prompt = phase.prompt
    ? substituteTemplateVars(phase.prompt, phaseContext)
    : `Execute phase: ${phase.id}`;

  return {
    id: phase.id,
    status: 'pending' as const,
    prompt
    // <-- Missing: parallel: phase.parallel
  };
});
```

## Required Imports
### Internal
- No new imports needed - `WorkflowPhase` is already imported (line 8)
- `CompiledPhase` is already imported (line 13)

### External
- No new external packages needed

## Types/Interfaces to Use
```typescript
// From types.ts - WorkflowPhase (source)
interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;  // <-- Access this
  'wait-for-parallel'?: boolean;
}

// From types.ts - CompiledPhase (target)
interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  parallel?: boolean;  // <-- Set this
  'parallel-task-id'?: string;
  // ... other fields
}
```

## Integration Points
- Called by: `expandForEach()` function in same file (line 212)
- Calls: `substituteTemplateVars()` for prompt expansion
- Tests: No formal test files - verification through gherkin scenarios in artifacts/step-1-gherkin.md

## Implementation Notes
- The change is a single line addition to the return object literal
- Property should be `parallel: phase.parallel` (undefined propagates correctly for optional props)
- No conditional logic needed - TypeScript handles undefined optional properties
- The `phase` variable in the map callback is typed as `WorkflowPhase` which already has `parallel?: boolean`
- The return type is implicitly `CompiledPhase` which already accepts `parallel?: boolean`

## Exact Edit Location
File: `plugins/m42-sprint/compiler/src/expand-foreach.ts`
Lines: 117-121

Current:
```typescript
    return {
      id: phase.id,
      status: 'pending' as const,
      prompt
    };
```

Target:
```typescript
    return {
      id: phase.id,
      status: 'pending' as const,
      prompt,
      parallel: phase.parallel
    };
```

Note: Add comma after `prompt` and add the new `parallel` property.

## Verification Commands
```bash
# TypeScript compilation check
cd plugins/m42-sprint/compiler && npm run typecheck

# Build the compiler
cd plugins/m42-sprint/compiler && npm run build

# Verify the pattern exists
grep -E "parallel:\s*phase\.parallel" plugins/m42-sprint/compiler/src/expand-foreach.ts
```
