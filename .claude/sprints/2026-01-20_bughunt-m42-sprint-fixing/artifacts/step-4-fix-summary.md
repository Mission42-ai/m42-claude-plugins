# Step 4 Fix Summary: BUG-004 + BUG-008 + BUG-009 (Null/Undefined Access Safety)

**Date**: 2026-01-20
**Bugs Fixed**: BUG-004, BUG-008, BUG-009
**Severity**: medium (BUG-004, BUG-008), low (BUG-009)
**Feature**: runtime/transition, compiler/expand-foreach

## Root Causes

### BUG-004: Empty Phases Array Access
The `createPointerForPhase` function used a non-null assertion (`phase.steps![0].phases`) after a truthiness check, which could fail if:
- The phases array is empty
- The phaseIndex is out of bounds
- The first step exists but has no phases property

### BUG-008: Invalid Sub-Phase Assignment
When `advancePointer` moved to the next step after completing sub-phases, it unconditionally set `sub-phase: 0` without checking if the next step actually has sub-phases. This created invalid pointers when steps had empty or undefined `phases` arrays.

### BUG-009: Non-Null Assertion Bypass
TypeScript non-null assertions (`!`) bypass compile-time safety checks, allowing runtime failures if the assumption is violated. The pattern `phase.steps![0].phases` could throw if `steps` became undefined between the check and use.

## Solution Implemented

### File Modified
`runtime/src/transition.ts`

### BUG-004 Fix (lines 330-341)
Replaced unsafe non-null assertions with optional chaining:

**Before:**
```typescript
const hasSteps = phase?.steps && phase.steps.length > 0;
const hasSubPhases = hasSteps && phase.steps![0].phases && phase.steps![0].phases.length > 0;
```

**After:**
```typescript
const hasSteps = phase?.steps && phase.steps.length > 0;
const firstStepPhases = phase?.steps?.[0]?.phases;
const hasSubPhases = hasSteps && firstStepPhases && firstStepPhases.length > 0;
```

### BUG-008 Fix (lines 385-394)
Added check for next step's sub-phases before setting sub-phase value:

**Before:**
```typescript
if (steps && current.step < steps.length - 1) {
  return {
    nextPointer: { ...current, step: current.step + 1, 'sub-phase': 0 },
    hasMore: true,
  };
}
```

**After:**
```typescript
if (steps && current.step < steps.length - 1) {
  const nextStep = steps[current.step + 1];
  const nextStepHasSubPhases = nextStep?.phases && nextStep.phases.length > 0;
  return {
    nextPointer: { ...current, step: current.step + 1, 'sub-phase': nextStepHasSubPhases ? 0 : null },
    hasMore: true,
  };
}
```

### BUG-009 Fix
Same as BUG-004 - replaced non-null assertions with optional chaining pattern.

## Tests Added

New test file: `runtime/src/null-safety.test.ts`

### BUG-004 Tests (4 tests)
1. `advancePointer handles empty phases array without throwing`
2. `advancePointer returns hasMore=false for empty phases`
3. `advancePointer handles out-of-bounds phase index without throwing`
4. `advancePointer returns hasMore=false for out-of-bounds index`

### BUG-008 Tests (2 tests)
1. `advancePointer sets sub-phase=null when next step has empty phases array`
2. `createPointerForPhase sets sub-phase=null for phase with steps but no sub-phases`

### BUG-009 Tests (2 tests)
1. `advancePointer handles step with undefined phases property`
2. `pointer for phase with steps but undefined phases in first step`

### Combined Edge Case Tests (2 tests)
1. `advancing through multiple phases with varying structures`
2. `phase with undefined phases property`

## Verification Results

### Test Suite Execution
```
=== BUG-004: Empty Phases Array Tests ===
✓ BUG-004: advancePointer handles empty phases array without throwing
✓ BUG-004: advancePointer returns hasMore=false for empty phases
✓ BUG-004: advancePointer handles out-of-bounds phase index without throwing
✓ BUG-004: advancePointer returns hasMore=false for out-of-bounds index

=== BUG-008: Sub-phase Set to 0 for Stepless Steps ===
✓ BUG-008: advancePointer sets sub-phase=null when next step has empty phases array
✓ BUG-008: createPointerForPhase sets sub-phase=null for phase with steps but no sub-phases

=== BUG-009: Non-null Assertion Safety ===
✓ BUG-009: advancePointer handles step with undefined phases property
✓ BUG-009: pointer for phase with steps but undefined phases in first step

=== Combined Edge Cases ===
✓ Edge case: advancing through multiple phases with varying structures
✓ Edge case: phase with undefined phases property

Tests completed. Exit code: 0
```

### Full Test Suite
All existing tests continue to pass:
- `transition.test.js`: 52 tests passed
- `yaml-ops.test.js`: 33 tests passed
- `prompt-builder.test.js`: 45 tests passed
- `claude-runner.test.js`: 40 tests passed
- `executor.test.js`: 18 tests passed
- `loop.test.js`: 31 tests passed
- `cli.test.js`: 30 tests passed

## Follow-Up Items

1. **Consider adding guards in `createPointerForPhase`**: While the function now handles edge cases gracefully, consider adding a guard clause that returns a "fallback" pointer or throws a descriptive error when called with invalid indices.

2. **Compiler side note**: The `expand-foreach.ts` file already uses safe patterns (`workflow.phases ?? []`), so no changes were needed there. The bug description incorrectly attributed the issue to that file.

3. **Documentation**: The `CurrentPointer` type correctly allows `null` for `step` and `sub-phase` fields, which aligns with the fix behavior.

## Conclusion

All three bugs have been fixed with a consistent approach: replacing non-null assertions with optional chaining and adding explicit checks before array access. The fixes are defensive and handle edge cases gracefully by returning appropriate null values rather than throwing runtime errors.
