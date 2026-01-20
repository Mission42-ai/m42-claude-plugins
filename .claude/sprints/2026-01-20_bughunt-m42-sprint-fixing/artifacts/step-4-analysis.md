# Bug Analysis: BUG-004 + BUG-008 + BUG-009 - Null/Undefined Access Safety

## Executive Summary

Three related null/undefined access safety issues exist in the sprint runtime transition logic and compiler's foreach expansion. These bugs can cause runtime crashes when encountering edge cases like empty phase arrays, steps without sub-phases, or value changes between truthiness checks and access.

---

## Root Cause Analysis

### BUG-004: Empty Phases Array Access

**Location**:
- **File**: `runtime/src/transition.ts`
- **Function**: `createPointerForPhase()`
- **Lines**: 330-339

**Root Cause**: The function accesses `phases[phaseIndex]` without verifying:
1. The `phases` array exists and is non-empty
2. The `phaseIndex` is within bounds

```typescript
function createPointerForPhase(phaseIndex: number, context: CompiledProgress): CurrentPointer {
  const phase = context.phases?.[phaseIndex];  // ✓ Uses optional chaining
  const hasSteps = phase?.steps && phase.steps.length > 0;
  const hasSubPhases = hasSteps && phase.steps![0].phases && phase.steps![0].phases.length > 0;
  //                              ^^^^^^^ BUG: Non-null assertion without bounds check
  //                                                        ^^^^^^^ BUG: Same issue
  return {
    phase: phaseIndex,
    step: hasSteps ? 0 : null,
    'sub-phase': hasSubPhases ? 0 : null,
  };
}
```

**Issue Details**: While `context.phases?.[phaseIndex]` uses optional chaining, the subsequent `phase.steps![0]` uses a non-null assertion that could fail if:
- `phases` is undefined or empty
- `phaseIndex` is out of bounds (e.g., -1 or >= phases.length)

---

### BUG-008: Sub-Phase Index Set When No Sub-Phases Exist

**Location**:
- **File**: `runtime/src/transition.ts`
- **Function**: `advancePointer()`
- **Lines**: 384-390

**Root Cause**: When advancing to the next step, the code unconditionally sets `'sub-phase': 0` without checking if the target step has sub-phases.

```typescript
// Try to advance step (reset sub-phase to 0)
const steps = phase?.steps;
if (steps && current.step < steps.length - 1) {
  return {
    nextPointer: { ...current, step: current.step + 1, 'sub-phase': 0 },
    //                                                  ^^^^^^^^^^^ BUG: Always sets to 0
    hasMore: true,
  };
}
```

**Issue Details**: The next step (`steps[current.step + 1]`) may have:
- No `phases` array at all
- An empty `phases` array

Setting `'sub-phase': 0` when no sub-phases exist creates an inconsistent pointer state that could cause issues when the pointer is later used to access `step.phases[0]`.

---

### BUG-009: Non-Null Assertion After Truthiness Check

**Location**:
- **File**: `runtime/src/transition.ts`
- **Function**: `createPointerForPhase()`
- **Lines**: 332-333

**Secondary Location**:
- **File**: `compiler/src/expand-foreach.ts`
- **Line**: 103

**Root Cause**: Code uses a truthiness check followed by a non-null assertion, which could fail in concurrent scenarios or if the value changes between check and use.

```typescript
// transition.ts:332-333
const hasSteps = phase?.steps && phase.steps.length > 0;
const hasSubPhases = hasSteps && phase.steps![0].phases && phase.steps![0].phases.length > 0;
//                              ^^^^^^^ Safe here IF hasSteps is true, but pattern is fragile
```

```typescript
// expand-foreach.ts:103
const compiledPhases: CompiledPhase[] = (workflow.phases ?? []).map((phase, phaseIndex) => {
//                                       ^^^^^^^^^^^^^^^^^^^^^^^^ Actually safe - uses nullish coalescing
```

**Issue Details**: While the `expand-foreach.ts` reference in the bug report actually uses safe patterns (`workflow.phases ?? []`), the `transition.ts` pattern is problematic because:
1. TypeScript's narrowing doesn't persist across the `&&` chain reliably
2. The pattern relies on the programmer's understanding, not the type system

---

## Conditions That Trigger the Bugs

### BUG-004 Trigger Conditions

1. **Empty Sprint Definition**: A sprint with `phases: []` or missing phases
2. **Invalid Phase Index**: Calling `createPointerForPhase(-1, context)` or with an index >= phases.length
3. **Runtime Corruption**: If `phases` gets set to undefined after initial validation

```yaml
# Trigger example: Empty phases
sprint-id: test
status: in-progress
phases: []  # BUG-004 triggers when createPointerForPhase(0, context) is called
```

### BUG-008 Trigger Conditions

1. **Mixed Step Structure**: A phase where some steps have sub-phases and others don't
2. **Step Advancement**: Advancing from a step with sub-phases to a step without sub-phases

```yaml
phases:
  - id: development
    steps:
      - id: step-0
        phases:            # Has sub-phases
          - id: prepare
          - id: execute
      - id: step-1
        prompt: "Simple"   # NO sub-phases - BUG-008 triggers when advancing here
```

### BUG-009 Trigger Conditions

1. **Type System Edge Cases**: When TypeScript's type narrowing doesn't protect against undefined access
2. **Object Mutation**: If the object is mutated between the truthiness check and property access (theoretical in current single-threaded code, but bad pattern)

---

## What a Proper Test Should Verify

### Test 1: Empty Phases Array Handling (BUG-004)

```typescript
describe('createPointerForPhase with empty phases', () => {
  it('returns safe default pointer when phases is empty', () => {
    const context: CompiledProgress = {
      'sprint-id': 'test',
      status: 'in-progress',
      phases: [],  // Empty!
      current: { phase: 0, step: null, 'sub-phase': null },
      stats: { 'started-at': null, 'total-phases': 0, 'completed-phases': 0 }
    };

    // Should NOT throw, should return a safe pointer or handle gracefully
    const pointer = createPointerForPhase(0, context);

    // Assert safe behavior
    expect(pointer.phase).toBe(0);
    expect(pointer.step).toBeNull();
    expect(pointer['sub-phase']).toBeNull();
  });

  it('returns safe default pointer when phases is undefined', () => {
    const context: CompiledProgress = {
      'sprint-id': 'test',
      status: 'in-progress',
      // phases: undefined - missing
      current: { phase: 0, step: null, 'sub-phase': null },
      stats: { 'started-at': null, 'total-phases': 0, 'completed-phases': 0 }
    } as CompiledProgress;

    const pointer = createPointerForPhase(0, context);

    expect(pointer.step).toBeNull();
    expect(pointer['sub-phase']).toBeNull();
  });

  it('handles out-of-bounds phase index gracefully', () => {
    const context: CompiledProgress = {
      'sprint-id': 'test',
      status: 'in-progress',
      phases: [{ id: 'only-phase', status: 'pending' }],  // Only 1 phase
      current: { phase: 0, step: null, 'sub-phase': null },
      stats: { 'started-at': null, 'total-phases': 1, 'completed-phases': 0 }
    };

    // Index 5 is out of bounds
    const pointer = createPointerForPhase(5, context);

    expect(pointer.step).toBeNull();
    expect(pointer['sub-phase']).toBeNull();
  });
});
```

### Test 2: Step Advancement Without Sub-Phases (BUG-008)

```typescript
describe('advancePointer with mixed step structures', () => {
  it('sets sub-phase to null when advancing to step without sub-phases', () => {
    const context: CompiledProgress = {
      'sprint-id': 'test',
      status: 'in-progress',
      phases: [{
        id: 'dev',
        status: 'in-progress',
        steps: [
          {
            id: 'step-0',
            prompt: 'With sub-phases',
            status: 'completed',
            phases: [
              { id: 'prepare', status: 'completed', prompt: 'Prepare' },
              { id: 'execute', status: 'completed', prompt: 'Execute' }
            ]
          },
          {
            id: 'step-1',
            prompt: 'Without sub-phases',
            status: 'pending',
            phases: []  // Empty - no sub-phases!
          }
        ]
      }],
      current: { phase: 0, step: 0, 'sub-phase': 1 },  // At step-0, last sub-phase
      stats: { 'started-at': null, 'total-phases': 1, 'completed-phases': 0 }
    };

    const { nextPointer, hasMore } = advancePointer(context.current, context);

    expect(hasMore).toBe(true);
    expect(nextPointer.step).toBe(1);
    // CRITICAL: sub-phase should be null, NOT 0
    expect(nextPointer['sub-phase']).toBeNull();
  });

  it('handles step with undefined phases array', () => {
    const context: CompiledProgress = {
      'sprint-id': 'test',
      status: 'in-progress',
      phases: [{
        id: 'dev',
        status: 'in-progress',
        steps: [
          {
            id: 'step-0',
            prompt: 'Has phases',
            status: 'completed',
            phases: [{ id: 'p1', status: 'completed', prompt: 'P1' }]
          },
          {
            id: 'step-1',
            prompt: 'No phases property',
            status: 'pending'
            // phases property completely missing
          } as any
        ]
      }],
      current: { phase: 0, step: 0, 'sub-phase': 0 },
      stats: { 'started-at': null, 'total-phases': 1, 'completed-phases': 0 }
    };

    const { nextPointer } = advancePointer(context.current, context);

    expect(nextPointer['sub-phase']).toBeNull();
  });
});
```

### Test 3: Non-Null Assertion Safety (BUG-009)

```typescript
describe('createPointerForPhase type safety', () => {
  it('safely handles steps with empty phases array', () => {
    const context: CompiledProgress = {
      'sprint-id': 'test',
      status: 'in-progress',
      phases: [{
        id: 'dev',
        status: 'pending',
        steps: [{
          id: 'step-0',
          prompt: 'Test',
          status: 'pending',
          phases: []  // Steps exist but phases is empty
        }]
      }],
      current: { phase: 0, step: null, 'sub-phase': null },
      stats: { 'started-at': null, 'total-phases': 1, 'completed-phases': 0 }
    };

    // Should NOT throw when accessing phase.steps![0].phases
    const pointer = createPointerForPhase(0, context);

    expect(pointer.step).toBe(0);  // Has steps
    expect(pointer['sub-phase']).toBeNull();  // But no sub-phases
  });
});
```

---

## Recommended Fix Approach

### Fix for BUG-004 + BUG-009: Replace Non-Null Assertions with Safe Access

```typescript
function createPointerForPhase(phaseIndex: number, context: CompiledProgress): CurrentPointer {
  // Guard: Check phases array exists and index is valid
  const phases = context.phases;
  if (!phases || phases.length === 0 || phaseIndex < 0 || phaseIndex >= phases.length) {
    return {
      phase: phaseIndex,
      step: null,
      'sub-phase': null,
    };
  }

  const phase = phases[phaseIndex];
  const steps = phase?.steps;
  const hasSteps = steps && steps.length > 0;

  // Safe access: use optional chaining throughout
  const firstStepPhases = steps?.[0]?.phases;
  const hasSubPhases = hasSteps && firstStepPhases && firstStepPhases.length > 0;

  return {
    phase: phaseIndex,
    step: hasSteps ? 0 : null,
    'sub-phase': hasSubPhases ? 0 : null,
  };
}
```

### Fix for BUG-008: Check Target Step Structure Before Setting Sub-Phase

```typescript
// In advancePointer(), when advancing to next step:
const steps = phase?.steps;
if (steps && current.step < steps.length - 1) {
  const nextStepIndex = current.step + 1;
  const nextStep = steps[nextStepIndex];
  const nextStepHasSubPhases = nextStep?.phases && nextStep.phases.length > 0;

  return {
    nextPointer: {
      ...current,
      step: nextStepIndex,
      'sub-phase': nextStepHasSubPhases ? 0 : null  // Conditional based on target step
    },
    hasMore: true,
  };
}
```

---

## Files Requiring Modification

1. **`runtime/src/transition.ts`**
   - `createPointerForPhase()` (lines 330-339): Add bounds checking and replace non-null assertions
   - `advancePointer()` (lines 384-390): Conditionally set sub-phase based on target step structure

2. **`compiler/src/expand-foreach.ts`**
   - Line 103: Already uses safe pattern (`workflow.phases ?? []`), no change needed

---

## Test File Location

Add tests to: `runtime/src/transition.test.ts`

Dependencies:
- No external mocking needed - these are pure functions
- Can use direct unit tests with crafted CompiledProgress objects

---

## Priority and Risk Assessment

| Bug | Severity | Likelihood | Risk |
|-----|----------|------------|------|
| BUG-004 | Medium | Low | Edge case - empty sprints are caught earlier |
| BUG-008 | Medium | Medium | Real - mixed step structures are common |
| BUG-009 | Low | Low | Pattern issue - current code is single-threaded |

**Recommendation**: Fix all three together since they're in the same file and share similar patterns. The fixes are low-risk and improve code robustness.
