# Step Context: step-1

## Task
Update compiler/src/expand-foreach.ts to propagate parallel flag:

1. In expandStep() function (lines 84-130)
2. When creating CompiledPhase objects in the map (line 117-121)
3. Add: `parallel: phase.parallel` to propagate the flag from WorkflowPhase to CompiledPhase

This ensures sub-phases marked as parallel in workflow definitions are compiled with the parallel flag.

Reference: context/implementation-plan.md section 4.B

## Related Code Patterns

### ALREADY IMPLEMENTED: expand-foreach.ts:117-122
The parallel flag propagation is **already present** in the code:
```typescript
// plugins/m42-sprint/compiler/src/expand-foreach.ts lines 117-122
return {
  id: phase.id,
  status: 'pending' as const,
  prompt,
  parallel: phase.parallel  // ✅ Line 121 - ALREADY IMPLEMENTED
};
```

### Similar Implementation: wait-for-parallel propagation
```typescript
// expand-foreach.ts line 217-222 - in expandForEach()
return {
  id: phase.id,
  status: 'pending' as const,
  steps: compiledSteps,
  'wait-for-parallel': phase['wait-for-parallel']
};

// expand-foreach.ts line 248-253 - in compileSimplePhase()
return {
  id: phase.id,
  status: 'pending' as const,
  prompt,
  'wait-for-parallel': phase['wait-for-parallel']
};
```

## Required Imports
### Internal
- `types.js`: WorkflowPhase, CompiledPhase (already imported at lines 7-17)

### External
- None - all needed imports already present

## Types/Interfaces to Use
```typescript
// From types.ts lines 68-81
interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;           // Source field
  'wait-for-parallel'?: boolean;
}

// From types.ts lines 132-154
interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  parallel?: boolean;           // Target field - already defined
  'parallel-task-id'?: string;
}
```

## Integration Points
- **Called by**: `compile.ts` via `expandForEach()` which calls `expandStep()`
- **Calls**: `substituteTemplateVars()` for prompt processing
- **Tests**: Scenarios defined in artifacts/step-1-gherkin.md

## Implementation Notes

### CRITICAL: Step is ALREADY COMPLETE

According to `_shared-context.md`:

> **Already Complete**
> 1. **types.ts** - All parallel execution types are defined (lines 68-81, 101, 106-127, 132-154, 183-205, 239-250)
> 2. **expand-foreach.ts** - `parallel` flag propagation (line 121: `parallel: phase.parallel`)
> 3. **expand-foreach.ts** - `wait-for-parallel` propagation in expandForEach (line 221) and compileSimplePhase (line 252)
> 4. **compile.ts** - `parallel-tasks: []` initialization (line 215)

The implementation was completed in step-0.

### Verification Required

The gherkin scenarios (6 total) will verify:
1. File exists
2. `parallel: phase.parallel` code pattern exists
3. TypeScript compiles without errors
4. Runtime test: parallel: true propagates
5. Runtime test: undefined when not set
6. Runtime test: mixed phases preserve individual flags

Since the implementation already exists, step-1 should pass all verification scenarios without code changes.

## Action Plan

1. **Build the compiler** to ensure dist/ is up to date
2. **Run gherkin scenarios** to verify existing implementation passes
3. If all pass → step is complete (no code changes needed)
4. If any fail → investigate and fix

## Verification Commands
```bash
# Check code was added correctly
grep -E "parallel:\s*phase\.parallel" plugins/m42-sprint/compiler/src/expand-foreach.ts

# TypeScript compilation
cd plugins/m42-sprint/compiler && npx tsc --noEmit

# Build for runtime tests
cd plugins/m42-sprint/compiler && npm run build

# Run gherkin verification (from artifacts/step-1-gherkin.md)
# Scenarios 4, 5, 6 verify runtime behavior
```
