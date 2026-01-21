"use strict";
/**
 * Tests for Operator Queue Transforms
 *
 * RED PHASE: These tests define expected behavior BEFORE implementation.
 * All tests should FAIL until the implementation is complete.
 *
 * Expected error: Cannot find module './operator-queue-transforms.js' (until implementation exists)
 */
Object.defineProperty(exports, "__esModule", { value: true });
// ============================================================================
// Test Utilities
// ============================================================================
function test(name, fn) {
    Promise.resolve()
        .then(() => fn())
        .then(() => {
        console.log(`✓ ${name}`);
    })
        .catch((error) => {
        console.error(`✗ ${name}`);
        console.error(`  ${error}`);
        process.exitCode = 1;
    });
}
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
function assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual, null, 2);
    const expectedStr = JSON.stringify(expected, null, 2);
    if (actualStr !== expectedStr) {
        throw new Error(message ?? `Expected:\n${expectedStr}\n\nGot:\n${actualStr}`);
    }
}
// ============================================================================
// Test Fixtures
// ============================================================================
function createMockProgressWithQueue() {
    return {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        'operator-queue': [
            {
                id: 'req_001',
                title: 'Fix critical bug',
                description: 'Critical bug found',
                priority: 'critical',
                type: 'bug',
                status: 'pending',
                'created-at': new Date().toISOString(),
                'discovered-in': 'step-1',
            },
            {
                id: 'req_002',
                title: 'Approved request',
                description: 'Already approved',
                priority: 'high',
                type: 'bug',
                status: 'approved',
                'created-at': new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                'discovered-in': 'step-2',
                'decided-at': new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                decision: {
                    requestId: 'req_002',
                    decision: 'approve',
                    reasoning: 'Approved for immediate fix',
                },
            },
            {
                id: 'req_003',
                title: 'Rejected request',
                description: 'Was rejected',
                priority: 'low',
                type: 'refactor',
                status: 'rejected',
                'created-at': new Date(Date.now() - 15 * 60 * 1000).toISOString(),
                'discovered-in': 'step-3',
                'decided-at': new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                decision: {
                    requestId: 'req_003',
                    decision: 'reject',
                    reasoning: 'Not needed',
                },
            },
        ],
    };
}
function createMockBacklogFile() {
    return {
        items: [
            {
                id: 'back_001',
                title: 'Backlog item 1',
                description: 'First backlog item',
                category: 'tech-debt',
                'suggested-priority': 'medium',
                'operator-notes': 'Added for later review',
                source: {
                    'request-id': 'req_orig',
                    'discovered-in': 'step-1',
                    'discovered-at': new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                },
                'created-at': new Date(Date.now() - 15 * 60 * 1000).toISOString(),
                status: 'pending-review',
            },
        ],
    };
}
// ============================================================================
// Import Tests
// ============================================================================
console.log('\n=== Module Import Tests ===\n');
test('operator-queue-transforms module should be importable', async () => {
    const module = await import('./operator-queue-transforms.js');
    assert(typeof module.toOperatorQueueData === 'function', 'toOperatorQueueData should be exported');
    assert(typeof module.formatRelativeTime === 'function', 'formatRelativeTime should be exported');
    assert(typeof module.calculateQueueStats === 'function', 'calculateQueueStats should be exported');
    assert(typeof module.applyManualDecision === 'function', 'applyManualDecision should be exported');
});
// ============================================================================
// toOperatorQueueData Tests
// ============================================================================
console.log('\n=== toOperatorQueueData Tests ===\n');
test('toOperatorQueueData separates pending from history', async () => {
    const { toOperatorQueueData } = await import('./operator-queue-transforms.js');
    const progress = createMockProgressWithQueue();
    const backlog = createMockBacklogFile();
    const result = toOperatorQueueData(progress, backlog);
    assertEqual(result.pending.length, 1, 'should have 1 pending request');
    assertEqual(result.history.length, 2, 'should have 2 history items');
    assertEqual(result.pending[0].id, 'req_001', 'pending should be req_001');
});
test('toOperatorQueueData includes backlog items', async () => {
    const { toOperatorQueueData } = await import('./operator-queue-transforms.js');
    const progress = createMockProgressWithQueue();
    const backlog = createMockBacklogFile();
    const result = toOperatorQueueData(progress, backlog);
    assertEqual(result.backlog.length, 1, 'should have 1 backlog item');
    assertEqual(result.backlog[0].id, 'back_001', 'should include backlog item');
});
test('toOperatorQueueData calculates correct stats', async () => {
    const { toOperatorQueueData } = await import('./operator-queue-transforms.js');
    const progress = createMockProgressWithQueue();
    const backlog = createMockBacklogFile();
    const result = toOperatorQueueData(progress, backlog);
    assertEqual(result.stats.pending, 1, 'pending count should be 1');
    assertEqual(result.stats.approved, 1, 'approved count should be 1');
    assertEqual(result.stats.rejected, 1, 'rejected count should be 1');
    assertEqual(result.stats.deferred, 0, 'deferred count should be 0');
    assertEqual(result.stats.backlog, 1, 'backlog count should be 1');
});
test('toOperatorQueueData handles empty queue', async () => {
    const { toOperatorQueueData } = await import('./operator-queue-transforms.js');
    const progress = { 'sprint-id': 'test', status: 'in-progress' };
    const backlog = { items: [] };
    const result = toOperatorQueueData(progress, backlog);
    assertEqual(result.pending.length, 0, 'pending should be empty');
    assertEqual(result.history.length, 0, 'history should be empty');
    assertEqual(result.backlog.length, 0, 'backlog should be empty');
    assertEqual(result.stats.pending, 0, 'all stats should be 0');
});
test('toOperatorQueueData sorts history by decided-at descending', async () => {
    const { toOperatorQueueData } = await import('./operator-queue-transforms.js');
    const progress = createMockProgressWithQueue();
    const backlog = createMockBacklogFile();
    const result = toOperatorQueueData(progress, backlog);
    // req_002 was decided more recently than req_003
    assertEqual(result.history[0].id, 'req_002', 'most recent decision should be first');
    assertEqual(result.history[1].id, 'req_003', 'older decision should be second');
});
test('toOperatorQueueData sorts pending by priority', async () => {
    const { toOperatorQueueData } = await import('./operator-queue-transforms.js');
    const progress = {
        'sprint-id': 'test',
        status: 'in-progress',
        'operator-queue': [
            {
                id: 'req_low',
                title: 'Low priority',
                description: 'Low',
                priority: 'low',
                type: 'improvement',
                status: 'pending',
                'created-at': new Date().toISOString(),
                'discovered-in': 'step-1',
            },
            {
                id: 'req_critical',
                title: 'Critical priority',
                description: 'Critical',
                priority: 'critical',
                type: 'security',
                status: 'pending',
                'created-at': new Date().toISOString(),
                'discovered-in': 'step-2',
            },
            {
                id: 'req_high',
                title: 'High priority',
                description: 'High',
                priority: 'high',
                type: 'bug',
                status: 'pending',
                'created-at': new Date().toISOString(),
                'discovered-in': 'step-3',
            },
        ],
    };
    const result = toOperatorQueueData(progress, { items: [] });
    assertEqual(result.pending[0].id, 'req_critical', 'critical should be first');
    assertEqual(result.pending[1].id, 'req_high', 'high should be second');
    assertEqual(result.pending[2].id, 'req_low', 'low should be last');
});
// ============================================================================
// calculateQueueStats Tests
// ============================================================================
console.log('\n=== calculateQueueStats Tests ===\n');
test('calculateQueueStats counts all statuses correctly', async () => {
    const { calculateQueueStats } = await import('./operator-queue-transforms.js');
    const queue = [
        { id: '1', status: 'pending' },
        { id: '2', status: 'pending' },
        { id: '3', status: 'approved' },
        { id: '4', status: 'rejected' },
        { id: '5', status: 'deferred' },
        { id: '6', status: 'deferred' },
        { id: '7', status: 'backlog' },
    ];
    const backlog = [{ id: 'b1' }, { id: 'b2' }];
    const stats = calculateQueueStats(queue, backlog);
    assertEqual(stats.pending, 2, 'pending count');
    assertEqual(stats.approved, 1, 'approved count');
    assertEqual(stats.rejected, 1, 'rejected count');
    assertEqual(stats.deferred, 2, 'deferred count');
    assertEqual(stats.backlog, 2, 'backlog count from backlog array');
});
// ============================================================================
// formatRelativeTime Tests
// ============================================================================
console.log('\n=== formatRelativeTime Tests ===\n');
test('formatRelativeTime returns just now for recent times', async () => {
    const { formatRelativeTime } = await import('./operator-queue-transforms.js');
    const now = new Date();
    const result = formatRelativeTime(now.toISOString());
    assert(result.includes('just now') || result.includes('0') || result.includes('now'), 'should show "just now" or similar for current time');
});
test('formatRelativeTime formats minutes correctly', async () => {
    const { formatRelativeTime } = await import('./operator-queue-transforms.js');
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = formatRelativeTime(fiveMinAgo.toISOString());
    assert(result.includes('5'), 'should include number 5');
    assert(result.includes('min'), 'should include "min"');
});
test('formatRelativeTime formats hours correctly', async () => {
    const { formatRelativeTime } = await import('./operator-queue-transforms.js');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = formatRelativeTime(twoHoursAgo.toISOString());
    assert(result.includes('2'), 'should include number 2');
    assert(result.includes('hour') || result.includes('hr'), 'should include "hour" or "hr"');
});
test('formatRelativeTime formats days correctly', async () => {
    const { formatRelativeTime } = await import('./operator-queue-transforms.js');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(threeDaysAgo.toISOString());
    assert(result.includes('3'), 'should include number 3');
    assert(result.includes('day'), 'should include "day"');
});
// ============================================================================
// applyManualDecision Tests
// ============================================================================
console.log('\n=== applyManualDecision Tests ===\n');
test('applyManualDecision sets approve status correctly', async () => {
    const { applyManualDecision } = await import('./operator-queue-transforms.js');
    const request = {
        id: 'req_001',
        title: 'Test request',
        description: 'Test',
        priority: 'high',
        type: 'bug',
        status: 'pending',
        'created-at': new Date().toISOString(),
        'discovered-in': 'step-1',
    };
    const decision = {
        decision: 'approve',
        reasoning: 'Manual approval',
    };
    const result = applyManualDecision(request, decision);
    assertEqual(result.status, 'approved', 'status should be approved');
    assert(result.decision !== undefined, 'should have decision');
    assertEqual(result.decision?.decision, 'approve', 'decision.decision should be approve');
    assert(result['decided-at'] !== undefined, 'should have decided-at');
});
test('applyManualDecision sets reject status with reason', async () => {
    const { applyManualDecision } = await import('./operator-queue-transforms.js');
    const request = {
        id: 'req_001',
        title: 'Test request',
        description: 'Test',
        priority: 'low',
        type: 'refactor',
        status: 'pending',
        'created-at': new Date().toISOString(),
        'discovered-in': 'step-1',
    };
    const decision = {
        decision: 'reject',
        reasoning: 'Not needed for this sprint',
    };
    const result = applyManualDecision(request, decision);
    assertEqual(result.status, 'rejected', 'status should be rejected');
    assert(result.decision?.reasoning.includes('Not needed') === true, 'should include rejection reasoning');
});
test('applyManualDecision sets defer status with timing', async () => {
    const { applyManualDecision } = await import('./operator-queue-transforms.js');
    const request = {
        id: 'req_001',
        title: 'Test request',
        description: 'Test',
        priority: 'medium',
        type: 'improvement',
        status: 'pending',
        'created-at': new Date().toISOString(),
        'discovered-in': 'step-1',
    };
    const decision = {
        decision: 'defer',
        reasoning: 'Will revisit later',
        deferredUntil: 'end-of-phase',
    };
    const result = applyManualDecision(request, decision);
    assertEqual(result.status, 'deferred', 'status should be deferred');
    assertEqual(result['deferred-until'], 'end-of-phase', 'should have deferred-until');
});
test('applyManualDecision marks source as manual', async () => {
    const { applyManualDecision } = await import('./operator-queue-transforms.js');
    const request = {
        id: 'req_001',
        title: 'Test request',
        description: 'Test',
        priority: 'high',
        type: 'bug',
        status: 'pending',
        'created-at': new Date().toISOString(),
        'discovered-in': 'step-1',
    };
    const decision = {
        decision: 'approve',
        reasoning: 'Manual override',
    };
    const result = applyManualDecision(request, decision);
    // Decision should indicate it was manual (implementation detail)
    assert(result.decision?.reasoning.includes('manual') ||
        result.decision?.reasoning.includes('Manual') ||
        result['decision-source'] === 'manual', 'should mark decision as manual');
});
// ============================================================================
// Priority Sorting Tests
// ============================================================================
console.log('\n=== Priority Sorting Tests ===\n');
test('sortByPriority orders correctly', async () => {
    const { sortByPriority } = await import('./operator-queue-transforms.js');
    const requests = [
        { id: '1', priority: 'low' },
        { id: '2', priority: 'critical' },
        { id: '3', priority: 'medium' },
        { id: '4', priority: 'high' },
    ];
    const sorted = sortByPriority(requests);
    assertEqual(sorted[0].id, '2', 'critical should be first');
    assertEqual(sorted[1].id, '4', 'high should be second');
    assertEqual(sorted[2].id, '3', 'medium should be third');
    assertEqual(sorted[3].id, '1', 'low should be last');
});
// ============================================================================
// Test Summary
// ============================================================================
console.log('\n=== Test Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
//# sourceMappingURL=operator-queue-transforms.test.js.map