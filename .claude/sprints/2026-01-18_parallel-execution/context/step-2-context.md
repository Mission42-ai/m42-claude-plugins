# Step Context: step-2

## Task
Update compiler/src/compile.ts to initialize parallel-tasks array:

1. In the compile() function around line 209 where CompiledProgress is built
2. Add initialization: `'parallel-tasks': []`
3. Propagate `wait-for-parallel` from WorkflowPhase to CompiledTopPhase in expandForEach and compileSimplePhase

Reference: context/implementation-plan.md section 4.C

## Related Code Patterns

### Similar Implementation: compile.ts:209-215
```typescript
// Current CompiledProgress initialization pattern
const progress: CompiledProgress = {
  'sprint-id': sprintId,
  status: 'not-started',
  phases: compiledPhases,
  current,
  stats
};
```
Adding `'parallel-tasks': []` follows this same object initialization pattern.

### Similar Implementation: expand-foreach.ts:117-122
```typescript
// CompiledPhase already propagates parallel from WorkflowPhase
return {
  id: phase.id,
  status: 'pending' as const,
  prompt,
  parallel: phase.parallel  // <-- Pattern to follow for wait-for-parallel
};
```

### Similar Implementation: expand-foreach.ts:217-221
```typescript
// expandForEach returns CompiledTopPhase - need to add wait-for-parallel
return {
  id: phase.id,
  status: 'pending' as const,
  steps: compiledSteps
  // Add: 'wait-for-parallel': phase['wait-for-parallel']
};
```

### Similar Implementation: expand-foreach.ts:247-251
```typescript
// compileSimplePhase returns CompiledTopPhase - need to add wait-for-parallel
return {
  id: phase.id,
  status: 'pending' as const,
  prompt
  // Add: 'wait-for-parallel': phase['wait-for-parallel']
};
```

## Required Imports
### Internal
- No new imports needed - all types already imported in both files

### External
- No new external packages required

## Types/Interfaces to Use
```typescript
// From types.ts - already defined
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  'parallel-tasks'?: ParallelTask[];  // Already in interface
}

interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;
  steps?: CompiledStep[];
  'wait-for-parallel'?: boolean;  // Already in interface (line 204)
  // ... other fields
}

interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;
  'wait-for-parallel'?: boolean;  // Already in interface (line 80)
}
```

## Integration Points
- **Called by**: index.ts CLI entry point calls compile()
- **Calls**: expandForEach() and compileSimplePhase() from expand-foreach.ts
- **Tests**: plugins/m42-sprint/compiler/src/validate.test.ts (existing tests should still pass)

## Implementation Notes
- The `ParallelTask[]` type is already defined in types.ts:106-127
- The `'parallel-tasks'` field is already optional in CompiledProgress (line 249)
- The `'wait-for-parallel'` field is already in CompiledTopPhase (line 204) and WorkflowPhase (line 80)
- Only need to initialize `'parallel-tasks': []` to ensure the field exists at runtime
- For wait-for-parallel propagation, use conditional spread or direct assignment:
  ```typescript
  // Option A: Conditional spread (cleaner for optional)
  ...(phase['wait-for-parallel'] && { 'wait-for-parallel': phase['wait-for-parallel'] })

  // Option B: Direct assignment (simpler, may include undefined)
  'wait-for-parallel': phase['wait-for-parallel']
  ```
- Prefer Option B for simplicity since the field is already optional

## Files to Modify
1. `plugins/m42-sprint/compiler/src/compile.ts` - Line 209-215: Add `'parallel-tasks': []`
2. `plugins/m42-sprint/compiler/src/expand-foreach.ts` - Line 217-221: Add `'wait-for-parallel'` to expandForEach return
3. `plugins/m42-sprint/compiler/src/expand-foreach.ts` - Line 247-251: Add `'wait-for-parallel'` to compileSimplePhase return

## Verification Commands
```bash
# Scenario 1: Check parallel-tasks initialization
grep -q "'parallel-tasks':\s*\[\]" plugins/m42-sprint/compiler/src/compile.ts

# Scenario 2: Check expandForEach propagation
grep -q "'wait-for-parallel'" plugins/m42-sprint/compiler/src/expand-foreach.ts

# Scenario 3: Check compileSimplePhase propagation
grep -A20 "function compileSimplePhase" plugins/m42-sprint/compiler/src/expand-foreach.ts | grep -q "'wait-for-parallel'"

# Scenario 4: TypeScript compiles
cd plugins/m42-sprint/compiler && npx tsc --noEmit

# Scenario 5: Compiled output test
cd plugins/m42-sprint/compiler && npm run build && node dist/index.js --sprint-dir ../../.claude/sprints/2026-01-18_parallel-execution --workflows-dir ../../.claude/workflows --dry-run | grep -q 'parallel-tasks'

# Scenario 6: Unit tests pass
cd plugins/m42-sprint/compiler && npm test
```
