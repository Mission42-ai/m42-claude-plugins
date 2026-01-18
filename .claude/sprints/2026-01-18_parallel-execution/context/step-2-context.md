# Step Context: step-2

## Task
Update compiler/src/compile.ts to initialize parallel-tasks array:

1. In the compile() function around line 209 where CompiledProgress is built
2. Add initialization: `'parallel-tasks': []`
3. Propagate `wait-for-parallel` from WorkflowPhase to CompiledTopPhase in expandForEach and compileSimplePhase

Reference: context/implementation-plan.md section 4.C

## Related Code Patterns

### Pattern 1: CompiledProgress Object Creation (compile.ts:209-215)
```typescript
// Current implementation - missing 'parallel-tasks' initialization
const progress: CompiledProgress = {
  'sprint-id': sprintId,
  status: 'not-started',
  phases: compiledPhases,
  current,
  stats
};
```

### Pattern 2: expandForEach Return Object (expand-foreach.ts:217-221)
```typescript
// Current implementation - missing 'wait-for-parallel' propagation
return {
  id: phase.id,
  status: 'pending' as const,
  steps: compiledSteps
};
```

### Pattern 3: compileSimplePhase Return Object (expand-foreach.ts:247-251)
```typescript
// Current implementation - missing 'wait-for-parallel' propagation
return {
  id: phase.id,
  status: 'pending' as const,
  prompt
};
```

### Pattern 4: Property Propagation in expandStep (expand-foreach.ts:117-122)
```typescript
// Existing pattern for propagating 'parallel' property to CompiledPhase
return {
  id: phase.id,
  status: 'pending' as const,
  prompt,
  parallel: phase.parallel  // This pattern should be followed for wait-for-parallel
};
```

## Required Imports

### Internal
Already imported in both files:
- `compile.ts`: `CompiledProgress`, `CompiledTopPhase` from `./types.js`
- `expand-foreach.ts`: `WorkflowPhase`, `CompiledTopPhase` from `./types.js`

### External
No new external packages needed.

## Types/Interfaces to Use

### From types.ts (already defined)
```typescript
// CompiledProgress (lines 238-249) - already has parallel-tasks field
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  'parallel-tasks'?: ParallelTask[];  // Already defined, needs initialization
}

// CompiledTopPhase (lines 182-204) - already has wait-for-parallel field
export interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;
  steps?: CompiledStep[];
  // ... timing fields ...
  'wait-for-parallel'?: boolean;  // Already defined, needs propagation
}

// WorkflowPhase (lines 68-81) - already has wait-for-parallel field
export interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;
  'wait-for-parallel'?: boolean;  // Source property for propagation
}
```

## Integration Points

### Called by
- `compile()` is called by:
  - `compileFromPaths()` in compile.ts:319
  - CLI in cli.ts (not shown, but typical entry point)

### Calls
- `compile()` calls:
  - `expandForEach()` for for-each phases (line 182-190)
  - `compileSimplePhase()` for simple phases (line 193)

### Tests
- No formal test files exist (manual verification via sprint execution)
- Gherkin scenarios in `artifacts/step-2-gherkin.md` define verification commands

## Implementation Notes

1. **parallel-tasks initialization location**: Line 209 in compile.ts, add `'parallel-tasks': []` to the progress object literal

2. **wait-for-parallel propagation in expandForEach**:
   - Line 217-221 in expand-foreach.ts
   - Add `'wait-for-parallel': phase['wait-for-parallel']` to the return object
   - The `phase` parameter is of type `WorkflowPhase` which already has this property

3. **wait-for-parallel propagation in compileSimplePhase**:
   - Line 247-251 in expand-foreach.ts
   - Add `'wait-for-parallel': phase['wait-for-parallel']` to the return object
   - The `phase` parameter is of type `WorkflowPhase` which already has this property

4. **Property format**: Use bracket notation `phase['wait-for-parallel']` since property name contains hyphen

5. **Optional property handling**: TypeScript will correctly handle undefined values - the property will simply not be included in YAML output if undefined

6. **Type safety**: All types are already defined correctly in types.ts, no type changes needed
