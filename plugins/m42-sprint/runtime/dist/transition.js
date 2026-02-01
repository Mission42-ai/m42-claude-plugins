/**
 * Sprint State Machine Transition Function
 *
 * Pure function that computes state transitions based on events.
 * Follows XState-inspired patterns with discriminated unions.
 */
import { randomUUID } from 'crypto';
/**
 * Guard functions for conditional transitions
 */
export const guards = {
    hasMorePhases: (_state, ctx, _event) => {
        return ctx.current.phase < (ctx.phases?.length ?? 0) - 1;
    },
    hasMoreSteps: (_state, ctx, _event) => {
        if (ctx.current.step === null)
            return false;
        const phase = ctx.phases?.[ctx.current.phase];
        if (!phase?.steps)
            return false;
        return ctx.current.step < phase.steps.length - 1;
    },
    hasMoreSubPhases: (_state, ctx, _event) => {
        if (ctx.current.step === null || ctx.current['sub-phase'] === null)
            return false;
        const phase = ctx.phases?.[ctx.current.phase];
        const step = phase?.steps?.[ctx.current.step];
        if (!step?.phases)
            return false;
        return ctx.current['sub-phase'] < step.phases.length - 1;
    },
    isRetryable: (_state, ctx, event) => {
        if (event.type !== 'PHASE_FAILED' && event.type !== 'STEP_FAILED')
            return false;
        if (!ctx.retry?.retryOn)
            return false;
        return ctx.retry.retryOn.includes(event.category);
    },
    hasStepQueue: (_state, ctx, _event) => {
        return (ctx['step-queue']?.length ?? 0) > 0;
    },
    orchestrationEnabled: (_state, ctx, _event) => {
        return ctx.orchestration?.enabled === true;
    },
    autoApproveEnabled: (_state, ctx, _event) => {
        return ctx.orchestration?.autoApprove === true;
    },
};
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Get the current phase from compiled progress.
 */
export function getCurrentPhase(progress) {
    return progress.phases?.[progress.current.phase];
}
/**
 * Get the current step from compiled progress.
 * Returns undefined if no steps exist or step index is null.
 */
export function getCurrentStep(progress) {
    if (progress.current.step === null)
        return undefined;
    const phase = getCurrentPhase(progress);
    return phase?.steps?.[progress.current.step];
}
/**
 * Get the current sub-phase from compiled progress.
 * Returns undefined if no sub-phases exist or sub-phase index is null.
 */
export function getCurrentSubPhase(progress) {
    if (progress.current['sub-phase'] === null)
        return undefined;
    const step = getCurrentStep(progress);
    return step?.phases?.[progress.current['sub-phase']];
}
/**
 * Create the initial pointer for a given phase index.
 * Determines step/sub-phase based on phase structure.
 */
function createPointerForPhase(phaseIndex, context) {
    const phase = context.phases?.[phaseIndex];
    const hasSteps = phase?.steps && phase.steps.length > 0;
    const firstStepPhases = phase?.steps?.[0]?.phases;
    const hasSubPhases = hasSteps && firstStepPhases && firstStepPhases.length > 0;
    return {
        phase: phaseIndex,
        step: hasSteps ? 0 : null,
        'sub-phase': hasSubPhases ? 0 : null,
    };
}
/**
 * Find the next phase that is not skipped, starting from a given index.
 * Returns the index of the next non-skipped phase, or -1 if none exists.
 * BUG-002 FIX: This ensures skipped phases are not executed.
 */
function findNextNonSkippedPhase(startIndex, context) {
    const phases = context.phases;
    if (!phases)
        return -1;
    for (let i = startIndex; i < phases.length; i++) {
        const phase = phases[i];
        if (phase.status !== 'skipped') {
            return i;
        }
    }
    return -1;
}
/**
 * Advance the pointer to the next position in the phase hierarchy.
 * Priority: sub-phase → step → phase
 * BUG-002 FIX: Skips over phases marked as 'skipped'
 */
export function advancePointer(current, context) {
    const phase = context.phases?.[current.phase];
    // In a step with sub-phases
    if (current.step !== null && current['sub-phase'] !== null) {
        const step = phase?.steps?.[current.step];
        const subPhases = step?.phases;
        // Try to advance sub-phase
        if (subPhases && current['sub-phase'] < subPhases.length - 1) {
            return {
                nextPointer: { ...current, 'sub-phase': current['sub-phase'] + 1 },
                hasMore: true,
            };
        }
        // Try to advance step (set sub-phase based on next step's phases)
        const steps = phase?.steps;
        if (steps && current.step < steps.length - 1) {
            const nextStep = steps[current.step + 1];
            const nextStepHasSubPhases = nextStep?.phases && nextStep.phases.length > 0;
            return {
                nextPointer: { ...current, step: current.step + 1, 'sub-phase': nextStepHasSubPhases ? 0 : null },
                hasMore: true,
            };
        }
        // Try to advance to next non-skipped phase (BUG-002 FIX)
        const nextPhaseIndex = findNextNonSkippedPhase(current.phase + 1, context);
        if (nextPhaseIndex >= 0) {
            return {
                nextPointer: createPointerForPhase(nextPhaseIndex, context),
                hasMore: true,
            };
        }
        return { nextPointer: current, hasMore: false };
    }
    // In a step without sub-phases
    if (current.step !== null) {
        const steps = phase?.steps;
        if (steps && current.step < steps.length - 1) {
            return {
                nextPointer: { ...current, step: current.step + 1 },
                hasMore: true,
            };
        }
        // Try to advance to next non-skipped phase (BUG-002 FIX)
        const nextPhaseIndex = findNextNonSkippedPhase(current.phase + 1, context);
        if (nextPhaseIndex >= 0) {
            return {
                nextPointer: createPointerForPhase(nextPhaseIndex, context),
                hasMore: true,
            };
        }
        return { nextPointer: current, hasMore: false };
    }
    // Simple phase without steps - try to advance to next non-skipped phase (BUG-002 FIX)
    const nextPhaseIndex = findNextNonSkippedPhase(current.phase + 1, context);
    if (nextPhaseIndex >= 0) {
        return {
            nextPointer: createPointerForPhase(nextPhaseIndex, context),
            hasMore: true,
        };
    }
    return { nextPointer: current, hasMore: false };
}
/**
 * Calculate backoff delay for retry based on retry count.
 * Uses the backoffMs array from retry config, capping at the last value.
 */
export function calculateBackoff(context) {
    const backoffMs = context.retry?.backoffMs ?? [1000];
    const phase = getCurrentPhase(context);
    const retryCount = phase?.['retry-count'] ?? 0;
    // Cap at the last value in the array
    const index = Math.min(retryCount, backoffMs.length - 1);
    return backoffMs[index];
}
/**
 * Get the prompt for the current position.
 */
function getCurrentPrompt(context) {
    const subPhase = getCurrentSubPhase(context);
    if (subPhase)
        return subPhase.prompt;
    const step = getCurrentStep(context);
    if (step)
        return step.prompt;
    const phase = getCurrentPhase(context);
    return phase?.prompt ?? '';
}
/**
 * Get the phase ID for the current position.
 */
function getCurrentPhaseId(context) {
    const subPhase = getCurrentSubPhase(context);
    if (subPhase)
        return subPhase.id;
    const step = getCurrentStep(context);
    if (step)
        return step.id;
    const phase = getCurrentPhase(context);
    return phase?.id ?? '';
}
/**
 * Calculate elapsed time between two ISO timestamps.
 */
function calculateElapsed(startedAt, completedAt) {
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const diffMs = end - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}
// ============================================================================
// Internal Helpers
// ============================================================================
/**
 * Creates a no-op transition result (unchanged state, no actions).
 */
function createNoOp(state) {
    return { nextState: state, actions: [], context: {} };
}
/**
 * Handles completion events (PHASE_COMPLETE, STEP_COMPLETE, GOAL_COMPLETE).
 * Advances pointer or transitions to completed state.
 */
function handleCompletion(state, context, summary, now) {
    const { nextPointer, hasMore } = advancePointer(state.current, context);
    if (hasMore) {
        // Advance to next phase/step/sub-phase
        const updatedContext = { ...context, current: nextPointer };
        return {
            nextState: {
                status: 'in-progress',
                current: nextPointer,
                iteration: state.iteration + 1,
                startedAt: state.startedAt,
            },
            actions: [
                { type: 'WRITE_PROGRESS' },
                {
                    type: 'SPAWN_CLAUDE',
                    prompt: getCurrentPrompt(updatedContext),
                    phaseId: getCurrentPhaseId(updatedContext),
                    onComplete: 'PHASE_COMPLETE',
                },
            ],
            context: {},
        };
    }
    // Sprint completed
    const elapsed = calculateElapsed(state.startedAt, now);
    return {
        nextState: {
            status: 'completed',
            summary,
            completedAt: now,
            elapsed,
        },
        actions: [{ type: 'WRITE_PROGRESS' }],
        context: {},
    };
}
/**
 * Handles failure events (PHASE_FAILED, STEP_FAILED).
 * Either schedules retry or transitions to blocked state.
 */
function handleFailure(state, context, event, now) {
    const failedId = event.phaseId ?? event.stepId ?? '';
    const isRetryable = guards.isRetryable(state, context, event);
    if (isRetryable) {
        // Schedule retry, stay in current state
        const delayMs = calculateBackoff(context);
        return {
            nextState: state,
            actions: [{ type: 'SCHEDULE_RETRY', phaseId: failedId, delayMs }],
            context: {},
        };
    }
    // Transition to blocked
    return {
        nextState: {
            status: 'blocked',
            error: event.error,
            failedPhase: failedId,
            blockedAt: now,
        },
        actions: [{ type: 'WRITE_PROGRESS' }],
        context: {},
    };
}
// ============================================================================
// Transition Function
// ============================================================================
/**
 * Pure transition function for sprint state machine.
 *
 * @param state - Current sprint state
 * @param event - Event to process
 * @param context - Compiled progress context
 * @returns TransitionResult with nextState, actions, and context updates
 */
export function transition(state, event, context) {
    const now = new Date().toISOString();
    switch (event.type) {
        // ========================================================================
        // START Event
        // ========================================================================
        case 'START': {
            if (state.status !== 'not-started') {
                return createNoOp(state);
            }
            return {
                nextState: {
                    status: 'in-progress',
                    current: context.current,
                    iteration: 1,
                    startedAt: now,
                },
                actions: [
                    {
                        type: 'SPAWN_CLAUDE',
                        prompt: getCurrentPrompt(context),
                        phaseId: getCurrentPhaseId(context),
                        onComplete: 'PHASE_COMPLETE',
                    },
                ],
                context: {},
            };
        }
        // ========================================================================
        // PHASE_COMPLETE Event
        // ========================================================================
        case 'PHASE_COMPLETE': {
            if (state.status !== 'in-progress') {
                return createNoOp(state);
            }
            return handleCompletion(state, context, event.summary, now);
        }
        // ========================================================================
        // PHASE_FAILED Event
        // ========================================================================
        case 'PHASE_FAILED': {
            if (state.status !== 'in-progress') {
                return createNoOp(state);
            }
            return handleFailure(state, context, event, now);
        }
        // ========================================================================
        // PAUSE Event
        // ========================================================================
        case 'PAUSE': {
            if (state.status !== 'in-progress') {
                return createNoOp(state);
            }
            return {
                nextState: {
                    status: 'paused',
                    pausedAt: state.current,
                    pauseReason: event.reason,
                },
                actions: [{ type: 'WRITE_PROGRESS' }],
                context: {},
            };
        }
        // ========================================================================
        // BREAKPOINT_REACHED Event
        // ========================================================================
        case 'BREAKPOINT_REACHED': {
            if (state.status !== 'in-progress') {
                return createNoOp(state);
            }
            return {
                nextState: {
                    status: 'paused-at-breakpoint',
                    pausedAt: state.current,
                    breakpointPhaseId: event.phaseId,
                },
                actions: [{ type: 'WRITE_PROGRESS' }],
                context: {},
            };
        }
        // ========================================================================
        // RESUME Event
        // ========================================================================
        case 'RESUME': {
            if (state.status !== 'paused' && state.status !== 'paused-at-breakpoint') {
                return createNoOp(state);
            }
            const restoredContext = { ...context, current: state.pausedAt };
            // For breakpoint resume, advance to the next phase/step/sub-phase
            if (state.status === 'paused-at-breakpoint') {
                const { nextPointer, hasMore } = advancePointer(state.pausedAt, context);
                if (!hasMore) {
                    // Breakpoint was on the last phase - sprint is complete
                    return {
                        nextState: {
                            status: 'completed',
                            summary: 'Sprint completed after breakpoint',
                            completedAt: now,
                            elapsed: '0s',
                        },
                        actions: [{ type: 'WRITE_PROGRESS' }],
                        context: {},
                    };
                }
                const advancedContext = { ...context, current: nextPointer };
                return {
                    nextState: {
                        status: 'in-progress',
                        current: nextPointer,
                        iteration: 1,
                        startedAt: now,
                    },
                    actions: [
                        {
                            type: 'SPAWN_CLAUDE',
                            prompt: getCurrentPrompt(advancedContext),
                            phaseId: getCurrentPhaseId(advancedContext),
                            onComplete: 'PHASE_COMPLETE',
                        },
                    ],
                    context: {},
                };
            }
            // For regular pause resume, continue from the same position
            return {
                nextState: {
                    status: 'in-progress',
                    current: state.pausedAt,
                    iteration: 1, // Resume starts a new iteration sequence
                    startedAt: now,
                },
                actions: [
                    {
                        type: 'SPAWN_CLAUDE',
                        prompt: getCurrentPrompt(restoredContext),
                        phaseId: getCurrentPhaseId(restoredContext),
                        onComplete: 'PHASE_COMPLETE',
                    },
                ],
                context: {},
            };
        }
        // ========================================================================
        // PROPOSE_STEPS Event
        // ========================================================================
        case 'PROPOSE_STEPS': {
            if (state.status !== 'in-progress') {
                return createNoOp(state);
            }
            if (!guards.orchestrationEnabled(state, context, event)) {
                return createNoOp(state);
            }
            const autoApprove = guards.autoApproveEnabled(state, context, event);
            if (autoApprove) {
                // Create INSERT_STEP actions for each proposed step
                const actions = event.steps.map((step) => ({
                    type: 'INSERT_STEP',
                    step: {
                        id: randomUUID(),
                        prompt: step.prompt,
                        proposedBy: event.proposedBy,
                        proposedAt: now,
                        reasoning: step.reasoning,
                        priority: step.priority ?? 'medium',
                    },
                    position: context.orchestration?.insertStrategy === 'end-of-phase'
                        ? 'end-of-phase'
                        : 'after-current',
                }));
                return { nextState: state, actions, context: {} };
            }
            else {
                // Queue steps for orchestration iteration
                const queueItems = event.steps.map((step) => ({
                    id: randomUUID(),
                    prompt: step.prompt,
                    proposedBy: event.proposedBy,
                    proposedAt: now,
                    reasoning: step.reasoning,
                    priority: step.priority ?? 'medium',
                }));
                // Merge with existing queue
                const existingQueue = context['step-queue'] ?? [];
                const newQueue = [...existingQueue, ...queueItems];
                return {
                    nextState: state,
                    actions: [],
                    context: { 'step-queue': newQueue },
                };
            }
        }
        // ========================================================================
        // MAX_ITERATIONS_REACHED Event
        // ========================================================================
        case 'MAX_ITERATIONS_REACHED': {
            if (state.status !== 'in-progress') {
                return createNoOp(state);
            }
            return {
                nextState: {
                    status: 'blocked',
                    error: `Maximum iteration limit reached (iteration ${state.iteration})`,
                    failedPhase: getCurrentPhaseId(context),
                    blockedAt: now,
                },
                actions: [{ type: 'WRITE_PROGRESS' }],
                context: {},
            };
        }
        // ========================================================================
        // HUMAN_NEEDED Event
        // ========================================================================
        case 'HUMAN_NEEDED': {
            if (state.status !== 'in-progress') {
                return createNoOp(state);
            }
            return {
                nextState: {
                    status: 'needs-human',
                    reason: event.reason,
                    details: event.details,
                },
                actions: [{ type: 'WRITE_PROGRESS' }],
                context: {},
            };
        }
        // ========================================================================
        // TICK Event (no-op)
        // ========================================================================
        case 'TICK': {
            return createNoOp(state);
        }
        // ========================================================================
        // STEP_COMPLETE Event
        // ========================================================================
        case 'STEP_COMPLETE': {
            if (state.status !== 'in-progress') {
                return createNoOp(state);
            }
            return handleCompletion(state, context, event.summary, now);
        }
        // ========================================================================
        // STEP_FAILED Event
        // ========================================================================
        case 'STEP_FAILED': {
            if (state.status !== 'in-progress') {
                return createNoOp(state);
            }
            return handleFailure(state, context, event, now);
        }
        // ========================================================================
        // GOAL_COMPLETE Event
        // ========================================================================
        case 'GOAL_COMPLETE': {
            if (state.status !== 'in-progress') {
                return createNoOp(state);
            }
            return handleCompletion(state, context, event.summary, now);
        }
        // Exhaustive check - TypeScript will error if any event type is missed
        default: {
            const _exhaustive = event;
            return createNoOp(state);
        }
    }
}
//# sourceMappingURL=transition.js.map