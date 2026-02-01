/**
 * Tests for BUG-004, BUG-008, BUG-009: Null/Undefined Access Safety
 *
 * These tests verify proper handling of edge cases where arrays may be empty
 * or indices may be out of bounds.
 *
 * RED PHASE: These tests should FAIL until the bugs are fixed.
 */
import { advancePointer } from './transition.js';
// ============================================================================
// Test Utilities
// ============================================================================
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    }
    catch (error) {
        console.error(`✗ ${name}`);
        console.error(`  ${error}`);
        process.exitCode = 1;
    }
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
function assertNotThrows(fn, message) {
    try {
        fn();
    }
    catch (error) {
        throw new Error(message ?? `Expected not to throw, but threw: ${error}`);
    }
}
// ============================================================================
// Test Fixtures
// ============================================================================
/**
 * Creates a context with NO phases (empty array)
 * Used to test BUG-004: empty phases array handling
 */
function createContextWithEmptyPhases() {
    return {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 0,
            'completed-phases': 0,
        },
        phases: [], // Empty phases array
    };
}
/**
 * Creates a context where phase index is out of bounds
 * Used to test BUG-004: out-of-bounds index handling
 */
function createContextWithIndexOutOfBounds() {
    return {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 99, step: null, 'sub-phase': null }, // Index 99 doesn't exist
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 2,
            'completed-phases': 0,
        },
        phases: [
            { id: 'phase-0', status: 'pending', prompt: 'Phase 0' },
            { id: 'phase-1', status: 'pending', prompt: 'Phase 1' },
        ],
    };
}
/**
 * Creates a context where the NEXT step has NO sub-phases
 * Used to test BUG-008: sub-phase should be null, not 0
 */
function createContextWithStepWithoutSubPhases() {
    return {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 1 }, // On last sub-phase of step 0
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 1,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'First step with sub-phases',
                        status: 'in-progress',
                        phases: [
                            { id: 'sub-0', status: 'completed', prompt: 'Sub 0' },
                            { id: 'sub-1', status: 'in-progress', prompt: 'Sub 1' },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Second step WITHOUT sub-phases',
                        status: 'pending',
                        phases: [], // Empty sub-phases array - BUG-008 trigger
                    },
                ],
            },
        ],
    };
}
/**
 * Creates a context where step[0] has undefined phases
 * Used to test BUG-009: non-null assertion safety
 */
function createContextWithStepUndefinedPhases() {
    return {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 1,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'phase-with-steps',
                status: 'pending',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Step with no phases property',
                        status: 'pending',
                        // phases is undefined - BUG-009 trigger
                    },
                ],
            },
        ],
    };
}
/**
 * Creates a context for advancing to a next phase that has steps without sub-phases
 * Used to test BUG-008 when createPointerForPhase is called during phase advance
 */
function createContextAdvancingToStepsNoSubPhases() {
    return {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null }, // At simple phase 0
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 2,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'simple-phase',
                status: 'in-progress',
                prompt: 'Simple phase without steps',
            },
            {
                id: 'phase-with-stepless-steps',
                status: 'pending',
                steps: [
                    {
                        id: 'step-no-subphases',
                        prompt: 'Step with empty phases array',
                        status: 'pending',
                        phases: [], // No sub-phases!
                    },
                ],
            },
        ],
    };
}
// ============================================================================
// BUG-004 Tests: createPointerForPhase empty/OOB array access
// ============================================================================
console.log('\n=== BUG-004: Empty Phases Array Tests ===\n');
test('BUG-004: advancePointer handles empty phases array without throwing', () => {
    const current = { phase: 0, step: null, 'sub-phase': null };
    const context = createContextWithEmptyPhases();
    // This should NOT throw, even though phases is empty
    assertNotThrows(() => {
        advancePointer(current, context);
    }, 'advancePointer should handle empty phases array gracefully');
});
test('BUG-004: advancePointer returns hasMore=false for empty phases', () => {
    const current = { phase: 0, step: null, 'sub-phase': null };
    const context = createContextWithEmptyPhases();
    const result = advancePointer(current, context);
    assertEqual(result.hasMore, false, 'Should have no more phases when phases array is empty');
});
test('BUG-004: advancePointer handles out-of-bounds phase index without throwing', () => {
    const current = { phase: 99, step: null, 'sub-phase': null };
    const context = createContextWithIndexOutOfBounds();
    // This should NOT throw
    assertNotThrows(() => {
        advancePointer(current, context);
    }, 'advancePointer should handle out-of-bounds index gracefully');
});
test('BUG-004: advancePointer returns hasMore=false for out-of-bounds index', () => {
    const current = { phase: 99, step: null, 'sub-phase': null };
    const context = createContextWithIndexOutOfBounds();
    const result = advancePointer(current, context);
    assertEqual(result.hasMore, false, 'Should have no more phases when index is out of bounds');
});
// ============================================================================
// BUG-008 Tests: advancePointer sets sub-phase=0 even when step has no sub-phases
// ============================================================================
console.log('\n=== BUG-008: Sub-phase Set to 0 for Stepless Steps ===\n');
test('BUG-008: advancePointer sets sub-phase=null when next step has empty phases array', () => {
    // Current position: step 0, sub-phase 1 (last sub-phase of step 0)
    const current = { phase: 0, step: 0, 'sub-phase': 1 };
    const context = createContextWithStepWithoutSubPhases();
    const result = advancePointer(current, context);
    // Should advance to step 1
    assertEqual(result.nextPointer.step, 1, 'Should advance to step 1');
    // BUG-008: Currently sets sub-phase to 0, but it should be null
    // because step-1 has an empty phases array
    assertEqual(result.nextPointer['sub-phase'], null, 'BUG-008: sub-phase should be null when next step has no sub-phases (empty array)');
});
test('BUG-008: createPointerForPhase sets sub-phase=null for phase with steps but no sub-phases', () => {
    const current = { phase: 0, step: null, 'sub-phase': null };
    const context = createContextAdvancingToStepsNoSubPhases();
    const result = advancePointer(current, context);
    // Should advance to phase 1
    assertEqual(result.nextPointer.phase, 1, 'Should advance to phase 1');
    // Phase 1 has steps, so step should be 0
    assertEqual(result.nextPointer.step, 0, 'Should set step to 0 for phase with steps');
    // BUG-008: The step at phase 1 has an EMPTY phases array
    // So sub-phase should be null, not 0
    assertEqual(result.nextPointer['sub-phase'], null, 'BUG-008: sub-phase should be null when step has empty phases array');
});
// ============================================================================
// BUG-009 Tests: Non-null assertion after truthiness check
// ============================================================================
console.log('\n=== BUG-009: Non-null Assertion Safety ===\n');
test('BUG-009: advancePointer handles step with undefined phases property', () => {
    const current = { phase: 0, step: null, 'sub-phase': null };
    const context = createContextWithStepUndefinedPhases();
    // This tests creating a pointer for the current phase which has steps
    // but the step's phases property is undefined
    // Should NOT throw due to non-null assertion
    assertNotThrows(() => {
        // When advancing, it needs to create a pointer for phase 0
        // which has steps but step[0].phases is undefined
        advancePointer({ phase: -1, step: null, 'sub-phase': null }, {
            ...context,
            phases: [
                ...context.phases,
                { id: 'dummy', status: 'pending', prompt: 'dummy' }, // Add a phase before
            ],
            current: { phase: 0, step: null, 'sub-phase': null },
        });
    }, 'BUG-009: Should not throw when step.phases is undefined');
});
test('BUG-009: pointer for phase with steps but undefined phases in first step', () => {
    // Context where phase has steps, but first step has no phases property
    const context = {
        'sprint-id': 'test-sprint',
        status: 'not-started',
        current: { phase: 0, step: null, 'sub-phase': null },
        stats: {
            'started-at': null,
            'total-phases': 2,
            'completed-phases': 0,
        },
        phases: [
            { id: 'phase-0', status: 'pending', prompt: 'Simple phase' },
            {
                id: 'phase-1',
                status: 'pending',
                steps: [
                    {
                        id: 'step-without-phases',
                        prompt: 'This step has no phases property',
                        status: 'pending',
                        // phases is intentionally missing
                    },
                ],
            },
        ],
    };
    const current = { phase: 0, step: null, 'sub-phase': null };
    // When we advance from phase 0 to phase 1, createPointerForPhase is called
    // It should handle step.phases being undefined without throwing
    let result;
    assertNotThrows(() => {
        result = advancePointer(current, context);
    }, 'BUG-009: Should handle undefined phases in step without throwing');
    // Verify the result is sensible
    if (result !== undefined) {
        assertEqual(result.nextPointer.phase, 1, 'Should advance to phase 1');
        assertEqual(result.nextPointer.step, 0, 'Should set step to 0');
        assertEqual(result.nextPointer['sub-phase'], null, 'BUG-009: sub-phase should be null when step.phases is undefined');
    }
});
// ============================================================================
// Combined Edge Case Tests
// ============================================================================
console.log('\n=== Combined Edge Cases ===\n');
test('Edge case: advancing through multiple phases with varying structures', () => {
    // Complex scenario: phase 0 (simple) -> phase 1 (steps, no sub-phases) -> phase 2 (steps with sub-phases)
    const context = {
        'sprint-id': 'complex-sprint',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 3,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'simple-phase',
                status: 'in-progress',
                prompt: 'Simple phase',
            },
            {
                id: 'steps-no-subphases',
                status: 'pending',
                steps: [
                    { id: 'step-a', prompt: 'Step A', status: 'pending', phases: [] },
                    { id: 'step-b', prompt: 'Step B', status: 'pending', phases: [] },
                ],
            },
            {
                id: 'steps-with-subphases',
                status: 'pending',
                steps: [
                    {
                        id: 'step-c',
                        prompt: 'Step C',
                        status: 'pending',
                        phases: [
                            { id: 'sub-c1', status: 'pending', prompt: 'Sub C1' },
                            { id: 'sub-c2', status: 'pending', prompt: 'Sub C2' },
                        ],
                    },
                ],
            },
        ],
    };
    // Advance from phase 0 to phase 1
    let current = { phase: 0, step: null, 'sub-phase': null };
    let result = advancePointer(current, context);
    assertEqual(result.nextPointer.phase, 1, 'First advance: should go to phase 1');
    assertEqual(result.nextPointer.step, 0, 'First advance: should have step 0');
    // BUG-008: This should be null because phase 1's steps have empty phases arrays
    assertEqual(result.nextPointer['sub-phase'], null, 'First advance: sub-phase should be null for steps without sub-phases');
});
test('Edge case: phase with undefined phases property', () => {
    const context = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 1,
            'completed-phases': 0,
        },
        // phases is undefined
    };
    const current = { phase: 0, step: null, 'sub-phase': null };
    assertNotThrows(() => {
        advancePointer(current, context);
    }, 'Should handle undefined context.phases');
    const result = advancePointer(current, context);
    assertEqual(result.hasMore, false, 'Should return hasMore=false when phases is undefined');
});
// ============================================================================
// Summary
// ============================================================================
console.log('\n=== Null Safety Tests Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
//# sourceMappingURL=null-safety.test.js.map