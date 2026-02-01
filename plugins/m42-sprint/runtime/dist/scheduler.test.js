/**
 * Tests for DAG-based Step Scheduler
 *
 * Tests the StepScheduler class that manages step execution order
 * based on dependency graphs from PROGRESS.yaml.
 */
import { StepScheduler, } from './scheduler.js';
// ============================================================================
// Test Infrastructure
// ============================================================================
let testsPassed = 0;
let testsFailed = 0;
const originalConsole = { log: console.log, error: console.error };
const testQueue = [];
let testsStarted = false;
function test(name, fn) {
    testQueue.push({ name, fn });
    if (!testsStarted) {
        testsStarted = true;
        setImmediate(runTests);
    }
}
async function runTests() {
    for (const { name, fn } of testQueue) {
        try {
            await fn();
            testsPassed++;
            originalConsole.log(`✓ ${name}`);
        }
        catch (error) {
            testsFailed++;
            originalConsole.error(`✗ ${name}`);
            originalConsole.error(`  ${error}`);
        }
    }
    originalConsole.log('');
    originalConsole.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
    if (testsFailed > 0) {
        process.exitCode = 1;
    }
}
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
function assertEqual(actual, expected, message) {
    const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    if (actual !== expected)
        throw new Error(msg);
}
function assertArrayEqual(actual, expected, message) {
    const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    if (actual.length !== expected.length)
        throw new Error(msg);
    for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i])
            throw new Error(msg);
    }
}
// ============================================================================
// Test Fixtures
// ============================================================================
function createStep(id, status = 'pending', dependsOn) {
    return {
        id,
        prompt: `Task for ${id}`,
        status,
        phases: [{ id: 'execute', status, prompt: `Execute ${id}` }],
        'depends-on': dependsOn,
    };
}
function createPhase(id, steps) {
    return {
        id,
        status: 'pending',
        steps,
    };
}
function createProgress(phases, dependencyGraphs) {
    return {
        'sprint-id': 'test-sprint',
        status: 'not-started',
        phases,
        current: { phase: 0, step: 0, 'sub-phase': 0 },
        stats: {
            'started-at': null,
            'total-phases': phases.length,
            'completed-phases': 0,
        },
        'dependency-graph': dependencyGraphs,
    };
}
// ============================================================================
// Test: Basic Graph Building
// ============================================================================
test('builds graph from PROGRESS.yaml with no dependencies', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-1'),
            createStep('step-2'),
            createStep('step-3'),
        ]),
    ]);
    const scheduler = new StepScheduler(progress);
    // All steps should be ready (no dependencies)
    const ready = scheduler.getReadySteps();
    assertEqual(ready.length, 3, 'All 3 steps should be ready');
    assertEqual(ready[0].id, 'step-1');
    assertEqual(ready[1].id, 'step-2');
    assertEqual(ready[2].id, 'step-3');
});
test('builds graph from PROGRESS.yaml with dependencies', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-a'),
            createStep('step-b', 'pending', ['step-a']),
            createStep('step-c', 'pending', ['step-a']),
            createStep('step-d', 'pending', ['step-b', 'step-c']),
        ]),
    ], [
        {
            'phase-id': 'dev',
            nodes: [
                { id: 'step-a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-b', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
                { id: 'step-c', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
                { id: 'step-d', 'depends-on': ['step-b', 'step-c'], 'blocked-by': ['step-b', 'step-c'] },
            ],
        },
    ]);
    const scheduler = new StepScheduler(progress);
    // Only step-a should be ready
    const ready = scheduler.getReadySteps();
    assertEqual(ready.length, 1, 'Only step-a should be ready');
    assertEqual(ready[0].id, 'step-a');
    // Verify node states
    const nodeA = scheduler.getNode('step-a');
    const nodeB = scheduler.getNode('step-b');
    const nodeD = scheduler.getNode('step-d');
    assertEqual(nodeA?.status, 'ready');
    assertEqual(nodeB?.status, 'pending');
    assertEqual(nodeD?.status, 'pending');
    assertArrayEqual(nodeB?.blockedBy ?? [], ['step-a']);
    assertArrayEqual(nodeD?.blockedBy ?? [], ['step-b', 'step-c']);
});
test('builds reverse edges (dependents) correctly', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-a'),
            createStep('step-b', 'pending', ['step-a']),
            createStep('step-c', 'pending', ['step-a']),
        ]),
    ], [
        {
            'phase-id': 'dev',
            nodes: [
                { id: 'step-a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-b', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
                { id: 'step-c', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
            ],
        },
    ]);
    const scheduler = new StepScheduler(progress);
    const nodeA = scheduler.getNode('step-a');
    // step-a should have both step-b and step-c as dependents
    assertEqual(nodeA?.dependents.length, 2);
    assert(nodeA?.dependents.includes('step-b') ?? false, 'step-a should have step-b as dependent');
    assert(nodeA?.dependents.includes('step-c') ?? false, 'step-a should have step-c as dependent');
});
// ============================================================================
// Test: Step Lifecycle
// ============================================================================
test('startStep marks step as running', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    const result = scheduler.startStep('step-1', 'worker-1');
    assertEqual(result, true);
    assertEqual(scheduler.getNode('step-1')?.status, 'running');
    assertEqual(scheduler.getNode('step-1')?.workerId, 'worker-1');
    assertEqual(scheduler.getRunningCount(), 1);
});
test('startStep fails for non-ready step', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-a'),
            createStep('step-b', 'pending', ['step-a']),
        ]),
    ], [
        {
            'phase-id': 'dev',
            nodes: [
                { id: 'step-a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-b', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
            ],
        },
    ]);
    const scheduler = new StepScheduler(progress);
    const result = scheduler.startStep('step-b');
    assertEqual(result, false, 'Should fail to start blocked step');
    assertEqual(scheduler.getNode('step-b')?.status, 'pending');
});
test('completeStep updates status and unblocks dependents', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-a'),
            createStep('step-b', 'pending', ['step-a']),
            createStep('step-c', 'pending', ['step-a']),
        ]),
    ], [
        {
            'phase-id': 'dev',
            nodes: [
                { id: 'step-a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-b', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
                { id: 'step-c', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
            ],
        },
    ]);
    const scheduler = new StepScheduler(progress);
    // Start and complete step-a
    scheduler.startStep('step-a');
    const result = scheduler.completeStep('step-a');
    assertEqual(result, true);
    assertEqual(scheduler.getNode('step-a')?.status, 'completed');
    assertEqual(scheduler.getRunningCount(), 0);
    // Both step-b and step-c should now be ready
    assertEqual(scheduler.getNode('step-b')?.status, 'ready');
    assertEqual(scheduler.getNode('step-c')?.status, 'ready');
    assertEqual(scheduler.getNode('step-b')?.blockedBy.length, 0);
    assertEqual(scheduler.getNode('step-c')?.blockedBy.length, 0);
    const ready = scheduler.getReadySteps();
    assertEqual(ready.length, 2);
});
test('completeStep with multiple dependencies', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-a'),
            createStep('step-b'),
            createStep('step-c', 'pending', ['step-a', 'step-b']),
        ]),
    ], [
        {
            'phase-id': 'dev',
            nodes: [
                { id: 'step-a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-b', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-c', 'depends-on': ['step-a', 'step-b'], 'blocked-by': ['step-a', 'step-b'] },
            ],
        },
    ]);
    const scheduler = new StepScheduler(progress);
    // Complete step-a - step-c should still be blocked by step-b
    scheduler.startStep('step-a');
    scheduler.completeStep('step-a');
    assertEqual(scheduler.getNode('step-c')?.status, 'pending');
    assertEqual(scheduler.getNode('step-c')?.blockedBy.length, 1);
    assertArrayEqual(scheduler.getNode('step-c')?.blockedBy ?? [], ['step-b']);
    // Complete step-b - step-c should now be ready
    scheduler.startStep('step-b');
    scheduler.completeStep('step-b');
    assertEqual(scheduler.getNode('step-c')?.status, 'ready');
    assertEqual(scheduler.getNode('step-c')?.blockedBy.length, 0);
});
// ============================================================================
// Test: Failure Propagation
// ============================================================================
test('failStep with skip-dependents policy', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-a'),
            createStep('step-b', 'pending', ['step-a']),
            createStep('step-c', 'pending', ['step-b']),
        ]),
    ], [
        {
            'phase-id': 'dev',
            nodes: [
                { id: 'step-a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-b', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
                { id: 'step-c', 'depends-on': ['step-b'], 'blocked-by': ['step-b'] },
            ],
        },
    ]);
    const scheduler = new StepScheduler(progress, { onDependencyFailure: 'skip-dependents' });
    // Start and fail step-a
    scheduler.startStep('step-a');
    scheduler.failStep('step-a', 'Test failure');
    assertEqual(scheduler.getNode('step-a')?.status, 'failed');
    assertEqual(scheduler.getNode('step-a')?.error, 'Test failure');
    // Both step-b and step-c should be skipped (transitive)
    assertEqual(scheduler.getNode('step-b')?.status, 'skipped');
    assertEqual(scheduler.getNode('step-c')?.status, 'skipped');
    assert(scheduler.getNode('step-b')?.error?.includes('step-a') ?? false, 'Error should reference failed step');
});
test('failStep with continue policy', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-a'),
            createStep('step-b', 'pending', ['step-a']),
            createStep('step-c'),
        ]),
    ], [
        {
            'phase-id': 'dev',
            nodes: [
                { id: 'step-a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-b', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
                { id: 'step-c', 'depends-on': [], 'blocked-by': [] },
            ],
        },
    ]);
    const scheduler = new StepScheduler(progress, { onDependencyFailure: 'continue' });
    // Start and fail step-a
    scheduler.startStep('step-a');
    scheduler.failStep('step-a', 'Test failure');
    assertEqual(scheduler.getNode('step-a')?.status, 'failed');
    // step-b should remain pending (not skipped)
    assertEqual(scheduler.getNode('step-b')?.status, 'pending');
    // step-c should still be ready
    assertEqual(scheduler.getNode('step-c')?.status, 'ready');
});
// ============================================================================
// Test: Max Concurrent Limiting
// ============================================================================
test('respects max-concurrent limit', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-1'),
            createStep('step-2'),
            createStep('step-3'),
        ]),
    ]);
    const scheduler = new StepScheduler(progress, { maxConcurrency: 2 });
    // All steps are ready, but only 2 should be returned
    let ready = scheduler.getReadySteps();
    assertEqual(ready.length, 2, 'Should only return 2 steps due to max-concurrent');
    // Start both
    scheduler.startStep('step-1');
    scheduler.startStep('step-2');
    assertEqual(scheduler.getRunningCount(), 2);
    // No more ready steps (at limit)
    ready = scheduler.getReadySteps();
    assertEqual(ready.length, 0, 'Should return 0 when at max-concurrent');
    // Complete one
    scheduler.completeStep('step-1');
    assertEqual(scheduler.getRunningCount(), 1);
    // Now one more should be available
    ready = scheduler.getReadySteps();
    assertEqual(ready.length, 1);
    assertEqual(ready[0].id, 'step-3');
});
test('unlimited concurrent when maxConcurrency is 0', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-1'),
            createStep('step-2'),
            createStep('step-3'),
            createStep('step-4'),
            createStep('step-5'),
        ]),
    ]);
    const scheduler = new StepScheduler(progress, { maxConcurrency: 0 });
    // All 5 steps should be returned
    const ready = scheduler.getReadySteps();
    assertEqual(ready.length, 5, 'Should return all 5 steps when unlimited');
});
// ============================================================================
// Test: Dynamic Step Injection
// ============================================================================
test('injectStep adds step to graph', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    const result = scheduler.injectStep({ id: 'step-new', prompt: 'New task' }, 'dev');
    assertEqual(result.success, true);
    assert(scheduler.getNode('step-new') !== undefined, 'New step should exist');
    assertEqual(scheduler.getNode('step-new')?.status, 'ready');
});
test('injectStep with dependencies', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    // Inject step that depends on step-1
    const result = scheduler.injectStep({ id: 'step-new', prompt: 'New task' }, 'dev', ['step-1']);
    assertEqual(result.success, true);
    assertEqual(scheduler.getNode('step-new')?.status, 'pending');
    assertArrayEqual(scheduler.getNode('step-new')?.blockedBy ?? [], ['step-1']);
    // step-1 should have step-new as dependent
    assert(scheduler.getNode('step-1')?.dependents.includes('step-new') ?? false, 'step-1 should have step-new as dependent');
});
test('injectStep with completed dependencies is ready', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1', 'completed')]),
    ]);
    const scheduler = new StepScheduler(progress);
    const result = scheduler.injectStep({ id: 'step-new', prompt: 'New task' }, 'dev', ['step-1']);
    assertEqual(result.success, true);
    // Since step-1 is completed, step-new should be ready
    assertEqual(scheduler.getNode('step-new')?.status, 'ready');
});
test('injectStep fails for duplicate ID', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    const result = scheduler.injectStep({ id: 'step-1', prompt: 'Duplicate' }, 'dev');
    assertEqual(result.success, false);
    assert(result.error?.includes('already exists') ?? false, 'Error should mention duplicate');
});
test('injectStep fails for missing dependency', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    const result = scheduler.injectStep({ id: 'step-new', prompt: 'New task' }, 'dev', ['nonexistent']);
    assertEqual(result.success, false);
    assert(result.error?.includes('not found') ?? false, 'Error should mention missing dependency');
});
test('injectStep fails for self-reference', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    const result = scheduler.injectStep({ id: 'step-new', prompt: 'New task' }, 'dev', ['step-new']);
    assertEqual(result.success, false);
    assert(result.error?.includes('itself') ?? false, 'Error should mention self-reference');
});
// ============================================================================
// Test: Completion Checks
// ============================================================================
test('isComplete returns true when all steps done', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-1', 'completed'),
            createStep('step-2', 'completed'),
        ]),
    ]);
    const scheduler = new StepScheduler(progress);
    assertEqual(scheduler.isComplete(), true);
});
test('isComplete returns false when steps pending', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-1', 'completed'),
            createStep('step-2', 'pending'),
        ]),
    ]);
    const scheduler = new StepScheduler(progress);
    assertEqual(scheduler.isComplete(), false);
});
test('isComplete returns true with skipped steps', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-1', 'failed'),
            createStep('step-2', 'skipped'),
        ]),
    ]);
    const scheduler = new StepScheduler(progress);
    assertEqual(scheduler.isComplete(), true);
});
test('hasFailed returns true when any step failed', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-1', 'completed'),
            createStep('step-2', 'failed'),
        ]),
    ]);
    const scheduler = new StepScheduler(progress);
    assertEqual(scheduler.hasFailed(), true);
});
test('hasFailed returns false when no failures', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-1', 'completed'),
            createStep('step-2', 'completed'),
        ]),
    ]);
    const scheduler = new StepScheduler(progress);
    assertEqual(scheduler.hasFailed(), false);
});
// ============================================================================
// Test: Status Summary
// ============================================================================
test('getStatusSummary returns correct counts', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-1', 'completed'),
            createStep('step-2', 'completed'),
            createStep('step-3', 'failed'),
            createStep('step-4', 'skipped'),
            createStep('step-5', 'pending'),
        ]),
    ]);
    const scheduler = new StepScheduler(progress);
    const summary = scheduler.getStatusSummary();
    assertEqual(summary.completed, 2);
    assertEqual(summary.failed, 1);
    assertEqual(summary.skipped, 1);
    // step-5 has no dependencies so it should be ready, not pending
    assertEqual(summary.ready, 1);
    assertEqual(summary.pending, 0);
    assertEqual(summary.running, 0);
});
// ============================================================================
// Test: Multiple Phases
// ============================================================================
test('handles multiple phases correctly', () => {
    const progress = createProgress([
        createPhase('phase-1', [
            createStep('step-1a'),
            createStep('step-1b'),
        ]),
        createPhase('phase-2', [
            createStep('step-2a'),
            createStep('step-2b', 'pending', ['step-2a']),
        ]),
    ]);
    progress['dependency-graph'] = [
        {
            'phase-id': 'phase-2',
            nodes: [
                { id: 'step-2a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-2b', 'depends-on': ['step-2a'], 'blocked-by': ['step-2a'] },
            ],
        },
    ];
    const scheduler = new StepScheduler(progress);
    // Steps from both phases should be tracked
    assert(scheduler.getNode('step-1a') !== undefined, 'step-1a should exist');
    assert(scheduler.getNode('step-2b') !== undefined, 'step-2b should exist');
    // step-1a, step-1b, step-2a should be ready (no deps)
    const ready = scheduler.getReadySteps();
    assertEqual(ready.length, 3);
    // step-2b should be pending
    assertEqual(scheduler.getNode('step-2b')?.status, 'pending');
});
// ============================================================================
// Test: Export Dependency Graphs
// ============================================================================
test('exportDependencyGraphs returns updated blocked-by', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-a'),
            createStep('step-b', 'pending', ['step-a']),
        ]),
    ], [
        {
            'phase-id': 'dev',
            nodes: [
                { id: 'step-a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-b', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
            ],
        },
    ]);
    const scheduler = new StepScheduler(progress);
    // Complete step-a
    scheduler.startStep('step-a');
    scheduler.completeStep('step-a');
    // Export should show cleared blocked-by for step-b
    const exported = scheduler.exportDependencyGraphs();
    assertEqual(exported.length, 1);
    assertEqual(exported[0]['phase-id'], 'dev');
    const nodeB = exported[0].nodes.find((n) => n.id === 'step-b');
    assertArrayEqual(nodeB?.['depends-on'] ?? [], ['step-a']); // Original preserved
    assertArrayEqual(nodeB?.['blocked-by'] ?? [], []); // Cleared
});
// ============================================================================
// Test: Edge Cases
// ============================================================================
test('handles empty phases gracefully', () => {
    const progress = createProgress([
        createPhase('empty', []),
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    // Should only have step-1
    assertEqual(scheduler.getAllNodes().size, 1);
    assertEqual(scheduler.getReadySteps().length, 1);
});
test('handles progress with no phases', () => {
    const progress = createProgress([]);
    const scheduler = new StepScheduler(progress);
    assertEqual(scheduler.getAllNodes().size, 0);
    assertEqual(scheduler.getReadySteps().length, 0);
    assertEqual(scheduler.isComplete(), true);
});
test('handles progress with no dependency graph', () => {
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-1'),
            createStep('step-2', 'pending', ['step-1']),
        ]),
    ]);
    // No dependency-graph in progress, but steps have depends-on
    const scheduler = new StepScheduler(progress);
    // Should still build graph from step-level depends-on
    assertEqual(scheduler.getNode('step-1')?.status, 'ready');
    assertEqual(scheduler.getNode('step-2')?.status, 'pending');
    assertArrayEqual(scheduler.getNode('step-2')?.blockedBy ?? [], ['step-1']);
});
test('startStep returns false for nonexistent step', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    const result = scheduler.startStep('nonexistent');
    assertEqual(result, false);
});
test('completeStep returns false for nonexistent step', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    const result = scheduler.completeStep('nonexistent');
    assertEqual(result, false);
});
test('failStep returns false for nonexistent step', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    const result = scheduler.failStep('nonexistent');
    assertEqual(result, false);
});
test('completeStep fails for non-running step', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    // step-1 is ready, not running
    const result = scheduler.completeStep('step-1');
    assertEqual(result, false);
});
test('failStep fails for non-running step', () => {
    const progress = createProgress([
        createPhase('dev', [createStep('step-1')]),
    ]);
    const scheduler = new StepScheduler(progress);
    // step-1 is ready, not running
    const result = scheduler.failStep('step-1');
    assertEqual(result, false);
});
// ============================================================================
// Test: Complex DAG Scenarios
// ============================================================================
test('diamond dependency pattern', () => {
    // Diamond: A -> B, A -> C, B -> D, C -> D
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-a'),
            createStep('step-b', 'pending', ['step-a']),
            createStep('step-c', 'pending', ['step-a']),
            createStep('step-d', 'pending', ['step-b', 'step-c']),
        ]),
    ], [
        {
            'phase-id': 'dev',
            nodes: [
                { id: 'step-a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-b', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
                { id: 'step-c', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
                { id: 'step-d', 'depends-on': ['step-b', 'step-c'], 'blocked-by': ['step-b', 'step-c'] },
            ],
        },
    ]);
    const scheduler = new StepScheduler(progress);
    // Initially only A is ready
    let ready = scheduler.getReadySteps();
    assertEqual(ready.length, 1);
    assertEqual(ready[0].id, 'step-a');
    // Complete A - B and C become ready
    scheduler.startStep('step-a');
    scheduler.completeStep('step-a');
    ready = scheduler.getReadySteps();
    assertEqual(ready.length, 2);
    assert(ready.some((r) => r.id === 'step-b'), 'step-b should be ready');
    assert(ready.some((r) => r.id === 'step-c'), 'step-c should be ready');
    // Complete B - D still blocked by C
    scheduler.startStep('step-b');
    scheduler.completeStep('step-b');
    assertEqual(scheduler.getNode('step-d')?.status, 'pending');
    assertArrayEqual(scheduler.getNode('step-d')?.blockedBy ?? [], ['step-c']);
    // Complete C - D becomes ready
    scheduler.startStep('step-c');
    scheduler.completeStep('step-c');
    assertEqual(scheduler.getNode('step-d')?.status, 'ready');
    assertEqual(scheduler.getNode('step-d')?.blockedBy.length, 0);
});
test('parallel chains pattern', () => {
    // Two independent chains: A -> B -> C and X -> Y -> Z
    const progress = createProgress([
        createPhase('dev', [
            createStep('step-a'),
            createStep('step-b', 'pending', ['step-a']),
            createStep('step-c', 'pending', ['step-b']),
            createStep('step-x'),
            createStep('step-y', 'pending', ['step-x']),
            createStep('step-z', 'pending', ['step-y']),
        ]),
    ], [
        {
            'phase-id': 'dev',
            nodes: [
                { id: 'step-a', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-b', 'depends-on': ['step-a'], 'blocked-by': ['step-a'] },
                { id: 'step-c', 'depends-on': ['step-b'], 'blocked-by': ['step-b'] },
                { id: 'step-x', 'depends-on': [], 'blocked-by': [] },
                { id: 'step-y', 'depends-on': ['step-x'], 'blocked-by': ['step-x'] },
                { id: 'step-z', 'depends-on': ['step-y'], 'blocked-by': ['step-y'] },
            ],
        },
    ]);
    const scheduler = new StepScheduler(progress);
    // A and X should both be ready
    let ready = scheduler.getReadySteps();
    assertEqual(ready.length, 2);
    // Run both chains in parallel
    scheduler.startStep('step-a');
    scheduler.startStep('step-x');
    scheduler.completeStep('step-a');
    scheduler.completeStep('step-x');
    // B and Y should be ready
    ready = scheduler.getReadySteps();
    assertEqual(ready.length, 2);
    assert(ready.some((r) => r.id === 'step-b'), 'step-b should be ready');
    assert(ready.some((r) => r.id === 'step-y'), 'step-y should be ready');
});
//# sourceMappingURL=scheduler.test.js.map