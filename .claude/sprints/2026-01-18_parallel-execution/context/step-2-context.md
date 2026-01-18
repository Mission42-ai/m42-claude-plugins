# Step Context: step-2

## Task
Update compiler/src/compile.ts to initialize parallel-tasks array:

1. In the compile() function around line 209 where CompiledProgress is built
2. Add initialization: `'parallel-tasks': []`
3. Propagate `wait-for-parallel` from WorkflowPhase to CompiledTopPhase in expandForEach and compileSimplePhase

Reference: context/implementation-plan.md section 4.C

## Implementation Status: ALREADY COMPLETE

All three requirements for this step are already implemented in the codebase:

### 1. parallel-tasks initialization (compile.ts:215)
```typescript
// Build compiled progress - lines 209-216
const progress: CompiledProgress = {
  'sprint-id': sprintId,
  status: 'not-started',
  phases: compiledPhases,
  current,
  stats,
  'parallel-tasks': []  // ✅ Already present at line 215
};
```

### 2. expandForEach propagation (expand-foreach.ts:221)
```typescript
// Return statement in expandForEach - lines 217-222
return {
  id: phase.id,
  status: 'pending' as const,
  steps: compiledSteps,
  'wait-for-parallel': phase['wait-for-parallel']  // ✅ Already present at line 221
};
```

### 3. compileSimplePhase propagation (expand-foreach.ts:252)
```typescript
// Return statement in compileSimplePhase - lines 248-253
return {
  id: phase.id,
  status: 'pending' as const,
  prompt,
  'wait-for-parallel': phase['wait-for-parallel']  // ✅ Already present at line 252
};
```

## Related Code Patterns

### Pattern: Type-safe optional properties
```typescript
// From types.ts - optional properties use `?`
'wait-for-parallel'?: boolean;  // line 80, 204
'parallel-tasks'?: ParallelTask[];  // line 249
```

### Pattern: Property propagation in compile functions
```typescript
// From expand-foreach.ts:117-122 - parallel flag propagation
return {
  id: phase.id,
  status: 'pending' as const,
  prompt,
  parallel: phase.parallel  // Direct copy from source
};
```

## Required Imports
### Internal
- `types.ts`: CompiledProgress, CompiledTopPhase, ParallelTask already imported in compile.ts
- No new imports needed - all types already imported in both files

### External
- No new external packages required

## Types/Interfaces to Use
```typescript
// From types.ts:106-127
interface ParallelTask {
  id: string;
  'step-id': string;
  'phase-id': string;
  status: ParallelTaskStatus;
  pid?: number;
  'log-file'?: string;
  'spawned-at'?: string;
  'completed-at'?: string;
  'exit-code'?: number;
  error?: string;
}

// From types.ts:239-250
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  'parallel-tasks'?: ParallelTask[];  // Already defined
}

// From types.ts:183-205
interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;
  steps?: CompiledStep[];
  'wait-for-parallel'?: boolean;  // Already defined
  // ... timing and error fields
}
```

## Integration Points
- **Called by**: index.ts CLI entry point calls compile()
- **Calls**: expandForEach() and compileSimplePhase() from expand-foreach.ts
- **Tests**: plugins/m42-sprint/compiler/src/validate.test.ts (existing tests should still pass)

## Implementation Notes
- All three requirements are already implemented in the current codebase
- The _shared-context.md file confirms this in "Already Complete" section (lines 146-149)
- No code changes are required for this step
- Proceed directly to gherkin verification to confirm implementation works

## Gherkin Verification Commands
All 6 scenarios from step-2-gherkin.md should pass:

```bash
# Scenario 1: Check parallel-tasks initialization
grep -q "'parallel-tasks': \[\]" plugins/m42-sprint/compiler/src/compile.ts

# Scenario 2: Check expandForEach propagation
grep -q "'wait-for-parallel': phase\['wait-for-parallel'\]" plugins/m42-sprint/compiler/src/expand-foreach.ts

# Scenario 3: Check compileSimplePhase propagation
grep -A20 "function compileSimplePhase" plugins/m42-sprint/compiler/src/expand-foreach.ts | grep -q "'wait-for-parallel'"

# Scenario 4: TypeScript compiles
cd plugins/m42-sprint/compiler && npx tsc --noEmit

# Scenario 5: Check types definition
grep -q "'parallel-tasks'.*ParallelTask\[\]" plugins/m42-sprint/compiler/src/types.ts

# Scenario 6: Unit tests pass
cd plugins/m42-sprint/compiler && npm test
```
