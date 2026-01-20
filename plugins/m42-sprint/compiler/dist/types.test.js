"use strict";
/**
 * Tests for XState-inspired type system enhancements
 *
 * RED PHASE: These tests will FAIL until implementation is complete.
 * Tests validate discriminated unions, events, actions, and guard functions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Simple test runner (matches project pattern)
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`); // intentional
    }
    catch (error) {
        console.error(`✗ ${name}`);
        console.error(`  ${error}`);
        process.exitCode = 1;
    }
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
// Helper to check if a type is assignable (compile-time check via runtime proxy)
function assertTypeExists(value) {
    return value;
}
// =============================================================================
// SprintState Discriminated Union Tests
// =============================================================================
console.log('\n--- SprintState Discriminated Union Tests ---\n'); // intentional
test('SprintState: not-started state has only status field', () => {
    const state = { status: 'not-started' };
    assert(state.status === 'not-started', 'Status should be not-started');
    // TypeScript should allow only status field for not-started
});
test('SprintState: in-progress state requires current, iteration, startedAt', () => {
    const pointer = { phase: 0, step: null, 'sub-phase': null };
    const state = {
        status: 'in-progress',
        current: pointer,
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    assert(state.status === 'in-progress', 'Status should be in-progress');
    assert(state.current === pointer, 'Should have current pointer');
    assert(state.iteration === 1, 'Should have iteration number');
    assert(state.startedAt === '2026-01-19T10:00:00Z', 'Should have startedAt timestamp');
});
test('SprintState: paused state requires pausedAt pointer and pauseReason', () => {
    const pointer = { phase: 2, step: 1, 'sub-phase': null };
    const state = {
        status: 'paused',
        pausedAt: pointer,
        pauseReason: 'User requested pause'
    };
    assert(state.status === 'paused', 'Status should be paused');
    assert(state.pausedAt === pointer, 'Should have pausedAt pointer');
    assert(state.pauseReason === 'User requested pause', 'Should have pause reason');
});
test('SprintState: blocked state requires error, failedPhase, blockedAt', () => {
    const state = {
        status: 'blocked',
        error: 'Network timeout',
        failedPhase: 'development',
        blockedAt: '2026-01-19T11:30:00Z'
    };
    assert(state.status === 'blocked', 'Status should be blocked');
    assert(state.error === 'Network timeout', 'Should have error message');
    assert(state.failedPhase === 'development', 'Should have failed phase ID');
    assert(state.blockedAt === '2026-01-19T11:30:00Z', 'Should have blockedAt timestamp');
});
test('SprintState: needs-human state requires reason, optional details', () => {
    const state = {
        status: 'needs-human',
        reason: 'Ambiguous requirements',
        details: 'Need clarification on API design'
    };
    assert(state.status === 'needs-human', 'Status should be needs-human');
    assert(state.reason === 'Ambiguous requirements', 'Should have reason');
    assert(state.details === 'Need clarification on API design', 'Should have optional details');
});
test('SprintState: needs-human state works without details', () => {
    const state = {
        status: 'needs-human',
        reason: 'Manual review required'
    };
    assert(state.status === 'needs-human', 'Status should be needs-human');
    assert(state.reason === 'Manual review required', 'Should have reason');
    assert(state.details === undefined, 'Details should be undefined');
});
test('SprintState: completed state requires completedAt, elapsed, optional summary', () => {
    const state = {
        status: 'completed',
        summary: 'All phases completed successfully',
        completedAt: '2026-01-19T15:00:00Z',
        elapsed: '4h 30m'
    };
    assert(state.status === 'completed', 'Status should be completed');
    assert(state.completedAt === '2026-01-19T15:00:00Z', 'Should have completedAt');
    assert(state.elapsed === '4h 30m', 'Should have elapsed time');
    assert(state.summary === 'All phases completed successfully', 'Should have optional summary');
});
test('SprintState: completed state works without summary', () => {
    const state = {
        status: 'completed',
        completedAt: '2026-01-19T15:00:00Z',
        elapsed: '4h 30m'
    };
    assert(state.status === 'completed', 'Status should be completed');
    assert(state.summary === undefined, 'Summary should be undefined');
});
// =============================================================================
// SprintEvent Union Tests
// =============================================================================
console.log('\n--- SprintEvent Union Tests ---\n'); // intentional
test('SprintEvent: START event has only type field', () => {
    const event = { type: 'START' };
    assert(event.type === 'START', 'Event type should be START');
});
test('SprintEvent: TICK event has only type field', () => {
    const event = { type: 'TICK' };
    assert(event.type === 'TICK', 'Event type should be TICK');
});
test('SprintEvent: MAX_ITERATIONS_REACHED event has only type field', () => {
    const event = { type: 'MAX_ITERATIONS_REACHED' };
    assert(event.type === 'MAX_ITERATIONS_REACHED', 'Event type should be MAX_ITERATIONS_REACHED');
});
test('SprintEvent: PHASE_COMPLETE requires summary and phaseId', () => {
    const event = {
        type: 'PHASE_COMPLETE',
        summary: 'Phase completed successfully',
        phaseId: 'preflight'
    };
    assert(event.type === 'PHASE_COMPLETE', 'Event type should be PHASE_COMPLETE');
    assert(event.summary === 'Phase completed successfully', 'Should have summary');
    assert(event.phaseId === 'preflight', 'Should have phaseId');
});
test('SprintEvent: PHASE_FAILED requires error, category, phaseId', () => {
    const event = {
        type: 'PHASE_FAILED',
        error: 'Test failure',
        category: 'validation',
        phaseId: 'testing'
    };
    assert(event.type === 'PHASE_FAILED', 'Event type should be PHASE_FAILED');
    assert(event.error === 'Test failure', 'Should have error');
    assert(event.category === 'validation', 'Should have category');
    assert(event.phaseId === 'testing', 'Should have phaseId');
});
test('SprintEvent: STEP_COMPLETE requires summary and stepId', () => {
    const event = {
        type: 'STEP_COMPLETE',
        summary: 'Step completed',
        stepId: 'step-001'
    };
    assert(event.type === 'STEP_COMPLETE', 'Event type should be STEP_COMPLETE');
    assert(event.summary === 'Step completed', 'Should have summary');
    assert(event.stepId === 'step-001', 'Should have stepId');
});
test('SprintEvent: STEP_FAILED requires error, category, stepId', () => {
    const event = {
        type: 'STEP_FAILED',
        error: 'Compilation error',
        category: 'logic',
        stepId: 'step-002'
    };
    assert(event.type === 'STEP_FAILED', 'Event type should be STEP_FAILED');
    assert(event.error === 'Compilation error', 'Should have error');
    assert(event.category === 'logic', 'Should have category');
    assert(event.stepId === 'step-002', 'Should have stepId');
});
test('SprintEvent: PROPOSE_STEPS requires steps array and proposedBy', () => {
    const event = {
        type: 'PROPOSE_STEPS',
        steps: [
            { prompt: 'Add error handling', reasoning: 'Improve robustness', priority: 'high' }
        ],
        proposedBy: 'development-phase'
    };
    assert(event.type === 'PROPOSE_STEPS', 'Event type should be PROPOSE_STEPS');
    assert(Array.isArray(event.steps), 'Should have steps array');
    assert(event.steps.length === 1, 'Should have one step');
    assert(event.proposedBy === 'development-phase', 'Should have proposedBy');
});
test('SprintEvent: PAUSE requires reason', () => {
    const event = {
        type: 'PAUSE',
        reason: 'User requested pause for review'
    };
    assert(event.type === 'PAUSE', 'Event type should be PAUSE');
    assert(event.reason === 'User requested pause for review', 'Should have reason');
});
test('SprintEvent: RESUME has only type field', () => {
    const event = { type: 'RESUME' };
    assert(event.type === 'RESUME', 'Event type should be RESUME');
});
test('SprintEvent: HUMAN_NEEDED requires reason, optional details', () => {
    const event = {
        type: 'HUMAN_NEEDED',
        reason: 'Security review required',
        details: 'Changes affect authentication system'
    };
    assert(event.type === 'HUMAN_NEEDED', 'Event type should be HUMAN_NEEDED');
    assert(event.reason === 'Security review required', 'Should have reason');
    assert(event.details === 'Changes affect authentication system', 'Should have details');
});
test('SprintEvent: GOAL_COMPLETE requires summary', () => {
    const event = {
        type: 'GOAL_COMPLETE',
        summary: 'All sprint objectives achieved'
    };
    assert(event.type === 'GOAL_COMPLETE', 'Event type should be GOAL_COMPLETE');
    assert(event.summary === 'All sprint objectives achieved', 'Should have summary');
});
// =============================================================================
// SprintAction Union Tests
// =============================================================================
console.log('\n--- SprintAction Union Tests ---\n'); // intentional
test('SprintAction: LOG requires level and message', () => {
    const action = {
        type: 'LOG',
        level: 'info',
        message: 'Sprint started'
    };
    assert(action.type === 'LOG', 'Action type should be LOG');
    assert(action.level === 'info', 'Should have log level');
    assert(action.message === 'Sprint started', 'Should have message');
});
test('SprintAction: LOG supports all log levels', () => {
    const infoAction = { type: 'LOG', level: 'info', message: 'Info' };
    const warnAction = { type: 'LOG', level: 'warn', message: 'Warning' };
    const errorAction = { type: 'LOG', level: 'error', message: 'Error' };
    assert(infoAction.level === 'info', 'Should support info level');
    assert(warnAction.level === 'warn', 'Should support warn level');
    assert(errorAction.level === 'error', 'Should support error level');
});
test('SprintAction: SPAWN_CLAUDE requires prompt, phaseId, onComplete', () => {
    const action = {
        type: 'SPAWN_CLAUDE',
        prompt: 'Execute phase tasks',
        phaseId: 'development',
        onComplete: 'PHASE_COMPLETE'
    };
    assert(action.type === 'SPAWN_CLAUDE', 'Action type should be SPAWN_CLAUDE');
    assert(action.prompt === 'Execute phase tasks', 'Should have prompt');
    assert(action.phaseId === 'development', 'Should have phaseId');
    assert(action.onComplete === 'PHASE_COMPLETE', 'Should have onComplete event type');
});
test('SprintAction: WRITE_PROGRESS has only type field', () => {
    const action = { type: 'WRITE_PROGRESS' };
    assert(action.type === 'WRITE_PROGRESS', 'Action type should be WRITE_PROGRESS');
});
test('SprintAction: UPDATE_STATS requires updates object', () => {
    const action = {
        type: 'UPDATE_STATS',
        updates: {
            'completed-phases': 2,
            'current-iteration': 3
        }
    };
    assert(action.type === 'UPDATE_STATS', 'Action type should be UPDATE_STATS');
    assert(typeof action.updates === 'object', 'Should have updates object');
});
test('SprintAction: EMIT_ACTIVITY requires activity and data', () => {
    const action = {
        type: 'EMIT_ACTIVITY',
        activity: 'phase-started',
        data: { phaseId: 'development', timestamp: '2026-01-19T10:00:00Z' }
    };
    assert(action.type === 'EMIT_ACTIVITY', 'Action type should be EMIT_ACTIVITY');
    assert(action.activity === 'phase-started', 'Should have activity name');
    assert(typeof action.data === 'object', 'Should have data payload');
});
test('SprintAction: SCHEDULE_RETRY requires phaseId and delayMs', () => {
    const action = {
        type: 'SCHEDULE_RETRY',
        phaseId: 'failed-phase',
        delayMs: 5000
    };
    assert(action.type === 'SCHEDULE_RETRY', 'Action type should be SCHEDULE_RETRY');
    assert(action.phaseId === 'failed-phase', 'Should have phaseId');
    assert(action.delayMs === 5000, 'Should have delay in milliseconds');
});
test('SprintAction: INSERT_STEP requires step and position', () => {
    const step = {
        id: 'step-001',
        prompt: 'New step to insert',
        proposedBy: 'orchestration',
        proposedAt: '2026-01-19T10:00:00Z',
        priority: 'high'
    };
    const action = {
        type: 'INSERT_STEP',
        step,
        position: 'after-current'
    };
    assert(action.type === 'INSERT_STEP', 'Action type should be INSERT_STEP');
    assert(action.step === step, 'Should have step');
    assert(action.position === 'after-current', 'Should have position');
});
test('SprintAction: INSERT_STEP supports both position values', () => {
    const step = {
        id: 'step-002',
        prompt: 'Another step',
        proposedBy: 'orchestration',
        proposedAt: '2026-01-19T10:00:00Z',
        priority: 'medium'
    };
    const afterCurrent = { type: 'INSERT_STEP', step, position: 'after-current' };
    const endOfPhase = { type: 'INSERT_STEP', step, position: 'end-of-phase' };
    assert(afterCurrent.position === 'after-current', 'Should support after-current');
    assert(endOfPhase.position === 'end-of-phase', 'Should support end-of-phase');
});
// =============================================================================
// TransitionResult Interface Tests
// =============================================================================
console.log('\n--- TransitionResult Interface Tests ---\n'); // intentional
test('TransitionResult: has nextState, actions, and context', () => {
    const pointer = { phase: 1, step: null, 'sub-phase': null };
    const result = {
        nextState: {
            status: 'in-progress',
            current: pointer,
            iteration: 2,
            startedAt: '2026-01-19T10:00:00Z'
        },
        actions: [
            { type: 'LOG', level: 'info', message: 'Transitioned' },
            { type: 'WRITE_PROGRESS' }
        ],
        context: { current: pointer }
    };
    assert(result.nextState.status === 'in-progress', 'Should have nextState');
    assert(Array.isArray(result.actions), 'Should have actions array');
    assert(result.actions.length === 2, 'Should have two actions');
    assert(typeof result.context === 'object', 'Should have context object');
});
test('TransitionResult: context is partial CompiledProgress', () => {
    const result = {
        nextState: { status: 'not-started' },
        actions: [],
        context: {
            'sprint-id': 'test-sprint',
            // Only partial update - other fields not required
        }
    };
    assert(result.context['sprint-id'] === 'test-sprint', 'Should accept partial context');
});
// =============================================================================
// Guard Functions Tests
// =============================================================================
console.log('\n--- Guard Functions Tests ---\n'); // intentional
// Import guards object (will be created in types.ts)
const types_js_1 = require("./types.js");
test('guards: hasMorePhases returns true when phases remain', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        phases: [
            { id: 'phase-1', status: 'completed', prompt: 'First' },
            { id: 'phase-2', status: 'pending', prompt: 'Second' }
        ],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 2, 'completed-phases': 0 }
    };
    const event = { type: 'TICK' };
    const result = types_js_1.guards.hasMorePhases(state, context, event);
    assert(result === true, 'Should return true when current phase < total phases - 1');
});
test('guards: hasMorePhases returns false at last phase', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 1, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 1, step: null, 'sub-phase': null },
        phases: [
            { id: 'phase-1', status: 'completed', prompt: 'First' },
            { id: 'phase-2', status: 'in-progress', prompt: 'Second' }
        ],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 2, 'completed-phases': 1 }
    };
    const event = { type: 'TICK' };
    const result = types_js_1.guards.hasMorePhases(state, context, event);
    assert(result === false, 'Should return false when at last phase');
});
test('guards: hasMoreSteps returns true when steps remain in current phase', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': null },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': null },
        phases: [{
                id: 'phase-1',
                status: 'in-progress',
                steps: [
                    { id: 'step-1', prompt: 'First step', status: 'completed', phases: [] },
                    { id: 'step-2', prompt: 'Second step', status: 'pending', phases: [] }
                ]
            }],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 1, 'completed-phases': 0 }
    };
    const event = { type: 'TICK' };
    const result = types_js_1.guards.hasMoreSteps(state, context, event);
    assert(result === true, 'Should return true when more steps exist');
});
test('guards: hasMoreSteps returns false when step is null', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        phases: [{ id: 'phase-1', status: 'in-progress', prompt: 'Simple phase' }],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 1, 'completed-phases': 0 }
    };
    const event = { type: 'TICK' };
    const result = types_js_1.guards.hasMoreSteps(state, context, event);
    assert(result === false, 'Should return false when step index is null');
});
test('guards: hasMoreSubPhases returns true when sub-phases remain', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 0 },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 0 },
        phases: [{
                id: 'phase-1',
                status: 'in-progress',
                steps: [{
                        id: 'step-1',
                        prompt: 'Step with sub-phases',
                        status: 'in-progress',
                        phases: [
                            { id: 'sub-1', status: 'completed', prompt: 'First sub' },
                            { id: 'sub-2', status: 'pending', prompt: 'Second sub' }
                        ]
                    }]
            }],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 1, 'completed-phases': 0 }
    };
    const event = { type: 'TICK' };
    const result = types_js_1.guards.hasMoreSubPhases(state, context, event);
    assert(result === true, 'Should return true when more sub-phases exist');
});
test('guards: isRetryable returns true for retryable error categories', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        phases: [{ id: 'phase-1', status: 'in-progress', prompt: 'Test' }],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 1, 'completed-phases': 0 },
        retry: {
            maxAttempts: 3,
            backoffMs: [1000, 2000, 4000],
            retryOn: ['network', 'rate-limit', 'timeout']
        }
    };
    const event = {
        type: 'PHASE_FAILED',
        error: 'Network error',
        category: 'network',
        phaseId: 'phase-1'
    };
    const result = types_js_1.guards.isRetryable(state, context, event);
    assert(result === true, 'Should return true for network error when retry configured');
});
test('guards: isRetryable returns false for non-retryable categories', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        phases: [{ id: 'phase-1', status: 'in-progress', prompt: 'Test' }],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 1, 'completed-phases': 0 },
        retry: {
            maxAttempts: 3,
            backoffMs: [1000, 2000, 4000],
            retryOn: ['network', 'timeout']
        }
    };
    const event = {
        type: 'PHASE_FAILED',
        error: 'Logic error',
        category: 'logic',
        phaseId: 'phase-1'
    };
    const result = types_js_1.guards.isRetryable(state, context, event);
    assert(result === false, 'Should return false for logic error when not in retryOn list');
});
test('guards: hasStepQueue returns true when step-queue has items', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        phases: [{ id: 'phase-1', status: 'in-progress', prompt: 'Test' }],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 1, 'completed-phases': 0 },
        'step-queue': [{
                id: 'queued-1',
                prompt: 'Queued step',
                proposedBy: 'orchestration',
                proposedAt: '2026-01-19T10:00:00Z',
                priority: 'medium'
            }]
    };
    const event = { type: 'TICK' };
    const result = types_js_1.guards.hasStepQueue(state, context, event);
    assert(result === true, 'Should return true when step-queue has items');
});
test('guards: hasStepQueue returns false when step-queue is empty', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        phases: [{ id: 'phase-1', status: 'in-progress', prompt: 'Test' }],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 1, 'completed-phases': 0 },
        'step-queue': []
    };
    const event = { type: 'TICK' };
    const result = types_js_1.guards.hasStepQueue(state, context, event);
    assert(result === false, 'Should return false when step-queue is empty');
});
test('guards: orchestrationEnabled returns true when orchestration.enabled is true', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        phases: [{ id: 'phase-1', status: 'in-progress', prompt: 'Test' }],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 1, 'completed-phases': 0 },
        orchestration: {
            enabled: true,
            insertStrategy: 'after-current',
            autoApprove: false
        }
    };
    const event = { type: 'TICK' };
    const result = types_js_1.guards.orchestrationEnabled(state, context, event);
    assert(result === true, 'Should return true when orchestration enabled');
});
test('guards: autoApproveEnabled returns true when orchestration.autoApprove is true', () => {
    const state = {
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: '2026-01-19T10:00:00Z'
    };
    const context = {
        'sprint-id': 'test',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        phases: [{ id: 'phase-1', status: 'in-progress', prompt: 'Test' }],
        stats: { 'started-at': '2026-01-19T10:00:00Z', 'total-phases': 1, 'completed-phases': 0 },
        orchestration: {
            enabled: true,
            insertStrategy: 'after-current',
            autoApprove: true
        }
    };
    const event = { type: 'TICK' };
    const result = types_js_1.guards.autoApproveEnabled(state, context, event);
    assert(result === true, 'Should return true when autoApprove enabled');
});
// =============================================================================
// Backwards Compatibility Tests
// =============================================================================
console.log('\n--- Backwards Compatibility Tests ---\n'); // intentional
test('SprintStatus: old string type still works', () => {
    const status = 'in-progress';
    const validStatuses = [
        'not-started',
        'in-progress',
        'completed',
        'blocked',
        'paused',
        'needs-human'
    ];
    assert(validStatuses.includes(status), 'Old SprintStatus type should still work');
});
test('PhaseStatus: old string type still works', () => {
    const status = 'pending';
    const validStatuses = [
        'pending',
        'in-progress',
        'completed',
        'blocked',
        'skipped',
        'failed'
    ];
    assert(validStatuses.includes(status), 'Old PhaseStatus type should still work');
});
// =============================================================================
// Type Safety Tests (Compile-Time)
// =============================================================================
console.log('\n--- Type Safety Verification ---\n'); // intentional
test('Type safety: SprintState discriminated union exhaustiveness', () => {
    // This function tests exhaustiveness - TypeScript should error if a case is missing
    function handleState(state) {
        switch (state.status) {
            case 'not-started':
                return 'Starting...';
            case 'in-progress':
                return `Running iteration ${state.iteration}`;
            case 'paused':
                return `Paused: ${state.pauseReason}`;
            case 'blocked':
                return `Blocked at ${state.failedPhase}: ${state.error}`;
            case 'needs-human':
                return `Human needed: ${state.reason}`;
            case 'completed':
                return `Completed in ${state.elapsed}`;
            default:
                // Exhaustiveness check - this line should be unreachable
                const _exhaustive = state;
                throw new Error(`Unhandled state: ${JSON.stringify(_exhaustive)}`);
        }
    }
    const testStates = [
        { status: 'not-started' },
        { status: 'in-progress', current: { phase: 0, step: null, 'sub-phase': null }, iteration: 1, startedAt: '2026-01-19T10:00:00Z' },
        { status: 'paused', pausedAt: { phase: 0, step: null, 'sub-phase': null }, pauseReason: 'Test' },
        { status: 'blocked', error: 'Test', failedPhase: 'test', blockedAt: '2026-01-19T10:00:00Z' },
        { status: 'needs-human', reason: 'Test' },
        { status: 'completed', completedAt: '2026-01-19T10:00:00Z', elapsed: '1h' }
    ];
    for (const state of testStates) {
        const result = handleState(state);
        assert(typeof result === 'string', `handleState should return string for ${state.status}`);
    }
});
test('Type safety: SprintEvent discriminated union exhaustiveness', () => {
    function handleEvent(event) {
        switch (event.type) {
            case 'START':
                return 'Started';
            case 'TICK':
                return 'Tick';
            case 'MAX_ITERATIONS_REACHED':
                return 'Max iterations';
            case 'PHASE_COMPLETE':
                return `Phase ${event.phaseId} complete`;
            case 'PHASE_FAILED':
                return `Phase ${event.phaseId} failed`;
            case 'STEP_COMPLETE':
                return `Step ${event.stepId} complete`;
            case 'STEP_FAILED':
                return `Step ${event.stepId} failed`;
            case 'PROPOSE_STEPS':
                return `${event.steps.length} steps proposed`;
            case 'PAUSE':
                return `Paused: ${event.reason}`;
            case 'RESUME':
                return 'Resumed';
            case 'HUMAN_NEEDED':
                return `Human needed: ${event.reason}`;
            case 'GOAL_COMPLETE':
                return `Goal complete: ${event.summary}`;
            default:
                const _exhaustive = event;
                throw new Error(`Unhandled event: ${JSON.stringify(_exhaustive)}`);
        }
    }
    const event = { type: 'START' };
    const result = handleEvent(event);
    assert(result === 'Started', 'Should handle START event');
});
console.log('\nType system tests completed.'); // intentional
//# sourceMappingURL=types.test.js.map