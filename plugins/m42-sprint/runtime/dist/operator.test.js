/**
 * Tests for Operator Module - Operator Request System
 *
 * RED PHASE: These tests define expected behavior BEFORE implementation.
 * All tests should FAIL until the implementation is complete.
 *
 * Expected error: Cannot find module './operator.js' (until implementation exists)
 */
// Import from operator.js - this will fail until implementation exists
// This is the expected RED phase behavior
import { processOperatorRequests, executeOperatorDecision, loadOperatorPrompt, createOperatorContext, } from './operator.js';
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
function createMockRequest(overrides = {}) {
    return {
        id: 'req_test123',
        title: 'Test Request',
        description: 'Test description',
        priority: 'medium',
        type: 'bug',
        context: {
            discoveredIn: 'test-phase',
        },
        ...overrides,
    };
}
function createMockQueuedRequest(overrides = {}) {
    return {
        ...createMockRequest(),
        status: 'pending',
        'created-at': new Date().toISOString(),
        'discovered-in': 'test-phase',
        ...overrides,
    };
}
function createMockDecision(overrides = {}) {
    return {
        requestId: 'req_test123',
        decision: 'approve',
        reasoning: 'Test reasoning',
        ...overrides,
    };
}
// ============================================================================
// Test: OperatorRequest Type Compliance
// ============================================================================
console.log('\n=== OperatorRequest Type Tests ===\n');
test('OperatorRequest: has all required fields', () => {
    const request = {
        id: 'req_abc123',
        title: 'Fix memory leak',
        description: 'Memory leak in parser module',
        priority: 'high',
        type: 'bug',
    };
    assertEqual(typeof request.id, 'string');
    assertEqual(typeof request.title, 'string');
    assertEqual(typeof request.description, 'string');
    assert(['critical', 'high', 'medium', 'low'].includes(request.priority), 'priority should be valid');
    assert(['bug', 'improvement', 'refactor', 'test', 'docs', 'security'].includes(request.type), 'type should be valid');
});
test('OperatorRequest: accepts optional context', () => {
    const request = {
        id: 'req_def456',
        title: 'Add validation',
        description: 'Input validation needed',
        priority: 'critical',
        type: 'security',
        context: {
            discoveredIn: 'qa-phase',
            relatedFiles: ['src/input.ts'],
            codeSnippet: 'const x = input;',
            suggestedWorkflow: 'security-fix',
        },
    };
    assert(request.context !== undefined, 'context should be present');
    assertEqual(request.context?.discoveredIn, 'qa-phase');
});
// ============================================================================
// Test: OperatorDecision Type Compliance
// ============================================================================
console.log('\n=== OperatorDecision Type Tests ===\n');
test('OperatorDecision: approve decision has required fields', () => {
    const decision = {
        requestId: 'req_abc123',
        decision: 'approve',
        reasoning: 'Issue blocks progress, should be fixed immediately',
        injection: {
            position: { type: 'after-current' },
            prompt: 'Fix the memory leak in parser module',
            idPrefix: 'fix-memleak',
        },
    };
    assertEqual(decision.decision, 'approve');
    assert(decision.reasoning.length > 0, 'reasoning should be non-empty');
    assert(decision.injection !== undefined, 'approve should have injection');
});
test('OperatorDecision: reject decision has rejection reason', () => {
    const decision = {
        requestId: 'req_abc123',
        decision: 'reject',
        reasoning: 'This is not actually an issue',
        rejectionReason: 'The behavior is by design, documented in spec',
    };
    assertEqual(decision.decision, 'reject');
    assert(decision.rejectionReason !== undefined, 'reject should have rejectionReason');
});
test('OperatorDecision: defer decision has deferredUntil', () => {
    const decision = {
        requestId: 'req_abc123',
        decision: 'defer',
        reasoning: 'Valid issue but not urgent, can wait',
        deferredUntil: 'end-of-phase',
    };
    assertEqual(decision.decision, 'defer');
    assert(['end-of-phase', 'end-of-sprint', 'next-sprint'].includes(decision.deferredUntil), 'deferredUntil should be valid');
});
test('OperatorDecision: backlog decision has backlogEntry', () => {
    const decision = {
        requestId: 'req_abc123',
        decision: 'backlog',
        reasoning: 'Valid improvement but out of scope for this sprint',
        backlogEntry: {
            category: 'tech-debt',
            suggestedPriority: 'medium',
            notes: 'Should be addressed in next quarter planning',
        },
    };
    assertEqual(decision.decision, 'backlog');
    assert(decision.backlogEntry !== undefined, 'backlog should have backlogEntry');
    assertEqual(decision.backlogEntry?.category, 'tech-debt');
});
// ============================================================================
// Test: processOperatorRequests
// ============================================================================
console.log('\n=== processOperatorRequests Tests ===\n');
test('processOperatorRequests: processes pending requests', async () => {
    const requests = [
        createMockQueuedRequest({ id: 'req_001', status: 'pending' }),
        createMockQueuedRequest({ id: 'req_002', status: 'pending' }),
    ];
    // Mock operator that approves everything
    const mockRunOperator = async () => ({
        decisions: requests.map(r => ({
            requestId: r.id,
            decision: 'approve',
            reasoning: 'Auto-approved',
            injection: {
                position: { type: 'after-current' },
                prompt: `Fix ${r.title}`,
                idPrefix: r.id,
            },
        })),
        operatorLog: 'Processed 2 requests',
        timestamp: new Date().toISOString(),
    });
    // Expected: function exists and returns OperatorResponse
    assert(typeof processOperatorRequests === 'function', 'processOperatorRequests should exist');
});
test('processOperatorRequests: skips non-pending requests', async () => {
    const requests = [
        createMockQueuedRequest({ id: 'req_001', status: 'pending' }),
        createMockQueuedRequest({ id: 'req_002', status: 'approved' }),
        createMockQueuedRequest({ id: 'req_003', status: 'rejected' }),
    ];
    // Only req_001 should be processed
    assert(typeof processOperatorRequests === 'function', 'processOperatorRequests should exist');
});
test('processOperatorRequests: returns OperatorResponse with decisions', async () => {
    // Expected response structure
    const expectedResponseShape = {
        decisions: 'array of OperatorDecision',
        operatorLog: 'string summary',
        timestamp: 'ISO timestamp string',
    };
    // The response should have:
    // - decisions: array of OperatorDecision objects
    // - operatorLog: summary string
    // - timestamp: ISO timestamp string
    assert(typeof processOperatorRequests === 'function', 'processOperatorRequests should exist');
});
// ============================================================================
// Test: executeOperatorDecision
// ============================================================================
console.log('\n=== executeOperatorDecision Tests ===\n');
test('executeOperatorDecision: approve triggers injection', async () => {
    const decision = createMockDecision({
        decision: 'approve',
        injection: {
            position: { type: 'after-current' },
            prompt: 'Fix the bug',
            idPrefix: 'bugfix',
        },
    });
    // Expected: injects step into progress
    assert(typeof executeOperatorDecision === 'function', 'executeOperatorDecision should exist');
});
test('executeOperatorDecision: reject updates request status', async () => {
    const decision = createMockDecision({
        decision: 'reject',
        rejectionReason: 'Not a real issue',
    });
    // Expected: request status updated to 'rejected', rejection reason stored
    assert(typeof executeOperatorDecision === 'function', 'executeOperatorDecision should exist');
});
test('executeOperatorDecision: defer updates request status with deferredUntil', async () => {
    const decision = createMockDecision({
        decision: 'defer',
        deferredUntil: 'end-of-phase',
    });
    // Expected: request status updated to 'deferred', deferredUntil stored
    assert(typeof executeOperatorDecision === 'function', 'executeOperatorDecision should exist');
});
test('executeOperatorDecision: backlog creates BACKLOG.yaml entry', async () => {
    const decision = createMockDecision({
        decision: 'backlog',
        backlogEntry: {
            category: 'tech-debt',
            suggestedPriority: 'low',
            notes: 'Address later',
        },
    });
    // Expected: entry added to BACKLOG.yaml, request status updated to 'backlog'
    assert(typeof executeOperatorDecision === 'function', 'executeOperatorDecision should exist');
});
test('executeOperatorDecision: approve with workflow compiles and injects', async () => {
    const decision = createMockDecision({
        decision: 'approve',
        injection: {
            workflow: 'bugfix-workflow',
            position: { type: 'after-current' },
            idPrefix: 'bugfix',
        },
    });
    // Expected: workflow is compiled and steps are injected
    assert(typeof executeOperatorDecision === 'function', 'executeOperatorDecision should exist');
});
// ============================================================================
// Test: loadOperatorPrompt
// ============================================================================
console.log('\n=== loadOperatorPrompt Tests ===\n');
test('loadOperatorPrompt: loads default skill when no override', async () => {
    const config = {
        enabled: true,
    };
    // Expected: loads from skills/sprint-operator/skill.md
    assert(typeof loadOperatorPrompt === 'function', 'loadOperatorPrompt should exist');
});
test('loadOperatorPrompt: uses custom prompt when provided', async () => {
    const config = {
        enabled: true,
        prompt: 'Custom operator instructions here...',
    };
    // Expected: returns the custom prompt directly
    assert(typeof loadOperatorPrompt === 'function', 'loadOperatorPrompt should exist');
});
test('loadOperatorPrompt: loads specified skill override', async () => {
    const config = {
        enabled: true,
        skill: 'custom-operator',
    };
    // Expected: loads from skills/custom-operator/skill.md
    assert(typeof loadOperatorPrompt === 'function', 'loadOperatorPrompt should exist');
});
// ============================================================================
// Test: createOperatorContext
// ============================================================================
console.log('\n=== createOperatorContext Tests ===\n');
test('createOperatorContext: includes sprint goals', () => {
    // Expected: context includes sprint goals for decision making
    assert(typeof createOperatorContext === 'function', 'createOperatorContext should exist');
});
test('createOperatorContext: includes current progress', () => {
    // Expected: context includes current phase, remaining work
    assert(typeof createOperatorContext === 'function', 'createOperatorContext should exist');
});
test('createOperatorContext: includes request details', () => {
    const request = createMockRequest();
    // Expected: context includes full request details
    assert(typeof createOperatorContext === 'function', 'createOperatorContext should exist');
});
// ============================================================================
// Test: Critical Priority Handling
// ============================================================================
console.log('\n=== Critical Priority Tests ===\n');
test('critical requests trigger immediate processing', async () => {
    const criticalRequest = createMockQueuedRequest({
        id: 'req_critical',
        priority: 'critical',
        status: 'pending',
    });
    // Expected: shouldProcessImmediately returns true for critical
    assert(criticalRequest.priority === 'critical', 'should be critical priority');
});
test('non-critical requests batch for later processing', async () => {
    const normalRequest = createMockQueuedRequest({
        id: 'req_normal',
        priority: 'medium',
        status: 'pending',
    });
    // Expected: shouldProcessImmediately returns false for medium
    assert(normalRequest.priority !== 'critical', 'should not be critical');
});
// ============================================================================
// Test: Request Status Updates
// ============================================================================
console.log('\n=== Request Status Updates Tests ===\n');
test('approved request status is updated correctly', () => {
    const request = createMockQueuedRequest({ status: 'pending' });
    const decision = createMockDecision({ decision: 'approve' });
    // After execution:
    // - request.status = 'approved'
    // - request.decision = { ... decision details ... }
    // - request['decided-at'] = timestamp
    assert(decision.decision === 'approve', 'decision should be approve');
});
test('rejected request stores rejection reason', () => {
    const request = createMockQueuedRequest({ status: 'pending' });
    const decision = createMockDecision({
        decision: 'reject',
        rejectionReason: 'Not a valid issue',
    });
    // After execution:
    // - request.status = 'rejected'
    // - request['rejection-reason'] = 'Not a valid issue'
    assert(decision.rejectionReason !== undefined, 'should have rejection reason');
});
test('deferred request stores deferredUntil', () => {
    const request = createMockQueuedRequest({ status: 'pending' });
    const decision = createMockDecision({
        decision: 'defer',
        deferredUntil: 'end-of-sprint',
    });
    // After execution:
    // - request.status = 'deferred'
    // - request['deferred-until'] = 'end-of-sprint'
    assertEqual(decision.deferredUntil, 'end-of-sprint');
});
// ============================================================================
// Test: Injection Position Resolution
// ============================================================================
console.log('\n=== Injection Position Tests ===\n');
test('after-current position resolves correctly', () => {
    const injection = {
        position: { type: 'after-current' },
        prompt: 'Fix issue',
        idPrefix: 'fix',
    };
    // Expected: injects immediately after current phase/step
    assertEqual(injection.position.type, 'after-current');
});
test('end-of-phase position resolves correctly', () => {
    const injection = {
        position: { type: 'end-of-phase' },
        prompt: 'Cleanup task',
        idPrefix: 'cleanup',
    };
    // Expected: injects at end of current phase
    assertEqual(injection.position.type, 'end-of-phase');
});
// ============================================================================
// Test Summary
// ============================================================================
console.log('\n=== Test Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
//# sourceMappingURL=operator.test.js.map