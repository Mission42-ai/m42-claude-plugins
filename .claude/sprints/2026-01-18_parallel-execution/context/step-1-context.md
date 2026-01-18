# Step Context: step-1

## Task
Update compiler/src/expand-foreach.ts to propagate parallel flag:

1. In expandStep() function (lines 84-130)
2. When creating CompiledPhase objects in the map (line 117-121)
3. Add: `parallel: phase.parallel` to propagate the flag from WorkflowPhase to CompiledPhase

This ensures sub-phases marked as parallel in workflow definitions are compiled with the parallel flag.

## Related Code Patterns

### Target Code: plugins/m42-sprint/compiler/src/expand-foreach.ts:117-121
```typescript
// Current implementation - missing parallel propagation
return {
  id: phase.id,
  status: 'pending' as const,
  prompt
};
```

### Similar Implementation: expand-foreach.ts compileSimplePhase()
The `compileSimplePhase()` function (lines 230-251) follows the same pattern of creating a compiled phase object from a WorkflowPhase:
```typescript
export function compileSimplePhase(
  phase: WorkflowPhase,
  context: TemplateContext
): CompiledTopPhase {
  // ... context setup and prompt substitution ...
  return {
    id: phase.id,
    status: 'pending' as const,
    prompt
  };
}
```
Note: This function may also need parallel propagation if applicable to top-level phases.

## Required Imports
### Internal
- Already imported: `WorkflowPhase`, `CompiledPhase` from `./types.js`
- No new imports needed

### External
- None needed

## Types/Interfaces to Use
```typescript
// From types.ts - WorkflowPhase (input)
interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;           // Source of the flag (line 78)
  'wait-for-parallel'?: boolean;
}

// From types.ts - CompiledPhase (output)
interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  // ... timing fields ...
  parallel?: boolean;           // Target field to set (line 151)
  'parallel-task-id'?: string;
}
```

## Integration Points
- **Called by**: `expandForEach()` in the same file (line 212)
- **Called from**: `compile()` in `compile.ts` (line 182)
- **Tests**: No existing tests for expand-foreach.ts, but `validate.test.ts` exists
- **Gherkin verifies**: Node.js runtime tests defined in `artifacts/step-1-gherkin.md`

## Implementation Notes
- Only propagate `parallel` when `phase.parallel` is truthy to avoid adding `parallel: undefined` to output
- Use conditional spread or explicit check: `...(phase.parallel && { parallel: phase.parallel })`
- Alternative: `parallel: phase.parallel` (TypeScript will include `undefined` which YAML serialization may omit)
- The gherkin scenarios explicitly test that non-parallel phases have `parallel === undefined`, not `false`
- Must rebuild (`npm run build`) before running node verification tests since they use dist/

## Key Lines in expand-foreach.ts
- **Line 103-122**: The `workflow.phases.map()` callback where CompiledPhase objects are created
- **Line 117-121**: The return statement that needs the `parallel` field added
- **Line 84-130**: Full `expandStep()` function scope

## Verification Commands
```bash
# Check code was added correctly
grep -E "parallel:\s*phase\.parallel" plugins/m42-sprint/compiler/src/expand-foreach.ts

# TypeScript compilation
cd plugins/m42-sprint/compiler && npx tsc --noEmit

# Build for runtime tests
cd plugins/m42-sprint/compiler && npm run build

# Run gherkin verification (from artifacts/step-1-gherkin.md)
# Scenario 4, 5, 6 verify runtime behavior
```
