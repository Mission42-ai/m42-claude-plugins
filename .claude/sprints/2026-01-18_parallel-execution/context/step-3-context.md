# Step Context: step-3

## Task
Update compiler/src/validate.ts with parallel validation:

1. In validateWorkflowPhase() function (lines 174-235)
2. Add validation for `parallel` property (must be boolean if present)
3. Add validation for `wait-for-parallel` property (must be boolean if present)
4. Add warning if `parallel: true` is used on a for-each phase (not supported - should be used in step workflows only)

Reference: context/implementation-plan.md section 4.D

## Related Code Patterns

### Similar Implementation: validate.ts lines 226-232
```typescript
// Validate for-each value (existing pattern for property validation)
if (p['for-each'] !== undefined && p['for-each'] !== 'step') {
  errors.push({
    code: 'INVALID_FOREACH',
    message: `for-each must be 'step' (got '${p['for-each']}')`,
    path: `${workflowName}.phases[${index}].for-each`
  });
}
```

### Similar Implementation: validate.ts lines 97-104
```typescript
// Validate optional workflow override (existing optional property validation)
if (s.workflow !== undefined && typeof s.workflow !== 'string') {
  errors.push({
    code: 'INVALID_STEP_WORKFLOW',
    message: `Step ${index} workflow must be a string`,
    path: `steps[${index}].workflow`
  });
}
```

### Similar Implementation: validate.ts lines 213-215
```typescript
// Checking boolean/existence pattern
const hasPrompt = p.prompt && typeof p.prompt === 'string';
const hasForEach = p['for-each'] === 'step';
const hasWorkflow = p.workflow && typeof p.workflow === 'string';
```

## Required Imports
### Internal
- No new imports needed - all types already imported at lines 7-14:
  - `CompilerError` for error objects
  - `WorkflowPhase` for type reference (though validation uses `unknown`)

### External
- None needed

## Types/Interfaces to Use
```typescript
// From types.ts - already defined
interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;           // ✅ Already defined
  'wait-for-parallel'?: boolean; // ✅ Already defined
}

// From types.ts - error structure
interface CompilerError {
  code: string;
  message: string;
  path?: string;
}
```

## Integration Points
- Called by: `validateWorkflowDefinition()` (validate.ts:157)
- Calls: Nothing new - uses existing error array pattern
- Tests: `compiler/src/validate.test.ts` - should add new test cases

## Implementation Notes

### Error Codes to Add
Based on gherkin scenario 6, use these error codes:
- `INVALID_PARALLEL` - when parallel is not boolean
- `INVALID_WAIT_FOR_PARALLEL` - when wait-for-parallel is not boolean
- `PARALLEL_FOREACH_WARNING` - when parallel: true used with for-each

### Location in validateWorkflowPhase()
Add validation AFTER the existing for-each validation (line 232) and BEFORE the return statement (line 234).

### Validation Logic
```typescript
// 1. Validate parallel property
if (p.parallel !== undefined && typeof p.parallel !== 'boolean') {
  errors.push({
    code: 'INVALID_PARALLEL',
    message: `parallel must be a boolean (got ${typeof p.parallel})`,
    path: `${workflowName}.phases[${index}].parallel`
  });
}

// 2. Validate wait-for-parallel property
if (p['wait-for-parallel'] !== undefined && typeof p['wait-for-parallel'] !== 'boolean') {
  errors.push({
    code: 'INVALID_WAIT_FOR_PARALLEL',
    message: `wait-for-parallel must be a boolean (got ${typeof p['wait-for-parallel']})`,
    path: `${workflowName}.phases[${index}].wait-for-parallel`
  });
}

// 3. Warn if parallel used with for-each (not supported)
if (p.parallel === true && p['for-each'] === 'step') {
  errors.push({
    code: 'PARALLEL_FOREACH_WARNING',
    message: `parallel: true on for-each phase is not supported; use parallel in step workflow phases instead`,
    path: `${workflowName}.phases[${index}]`
  });
}
```

### Test Cases to Add
Following the existing test pattern in validate.test.ts:
1. Test INVALID_PARALLEL when parallel is not boolean (e.g., string "true")
2. Test INVALID_WAIT_FOR_PARALLEL when wait-for-parallel is not boolean
3. Test PARALLEL_FOREACH_WARNING when parallel: true with for-each: step
4. Test valid cases pass (parallel: true without for-each, wait-for-parallel: true)

### Gherkin Verification Requirements
From artifacts/step-3-gherkin.md:
1. TypeScript compiles without errors
2. Parallel property validation code exists (grep pattern)
3. Wait-for-parallel validation code exists (grep pattern)
4. Warning for parallel on for-each exists (grep pattern)
5. Tests pass
6. Error codes defined (grep for INVALID_PARALLEL|INVALID_WAIT_FOR_PARALLEL|PARALLEL_FOREACH)
