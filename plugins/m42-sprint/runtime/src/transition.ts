/**
 * Sprint State Machine Transition Function
 *
 * Pure function that computes state transitions based on events.
 * Follows XState-inspired patterns with discriminated unions.
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Type Definitions (copied from compiler for ESM compatibility)
// ============================================================================

/** Log severity levels for LOG actions */
export type LogLevel = 'info' | 'warn' | 'error';

/** Step insertion position strategies */
export type InsertPosition = 'after-current' | 'end-of-phase';

/** Error category types for classification and retry configuration */
export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';

/** Phase status */
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';

/** Sprint status (deprecated, use SprintState) */
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

/**
 * Current position pointer in the workflow
 */
export interface CurrentPointer {
  phase: number;
  step: number | null;
  'sub-phase': number | null;
}

/**
 * Discriminated union for sprint state
 */
export type SprintState =
  | { status: 'not-started' }
  | {
      status: 'in-progress';
      current: CurrentPointer;
      iteration: number;
      startedAt: string;
    }
  | {
      status: 'paused';
      pausedAt: CurrentPointer;
      pauseReason: string;
    }
  | {
      status: 'blocked';
      error: string;
      failedPhase: string;
      blockedAt: string;
    }
  | {
      status: 'needs-human';
      reason: string;
      details?: string;
    }
  | {
      status: 'completed';
      summary?: string;
      completedAt: string;
      elapsed: string;
    };

/**
 * A step proposed by Claude via JSON result
 */
export interface ProposedStep {
  prompt: string;
  reasoning?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  insertAfter?: string;
}

/**
 * Discriminated union for sprint events
 */
export type SprintEvent =
  | { type: 'START' }
  | { type: 'TICK' }
  | { type: 'MAX_ITERATIONS_REACHED' }
  | { type: 'PHASE_COMPLETE'; summary: string; phaseId: string }
  | { type: 'PHASE_FAILED'; error: string; category: ErrorCategory; phaseId: string }
  | { type: 'STEP_COMPLETE'; summary: string; stepId: string }
  | { type: 'STEP_FAILED'; error: string; category: ErrorCategory; stepId: string }
  | { type: 'PROPOSE_STEPS'; steps: ProposedStep[]; proposedBy: string }
  | { type: 'PAUSE'; reason: string }
  | { type: 'RESUME' }
  | { type: 'HUMAN_NEEDED'; reason: string; details?: string }
  | { type: 'GOAL_COMPLETE'; summary: string };

/**
 * A queued step waiting for orchestration
 */
export interface StepQueueItem {
  id: string;
  prompt: string;
  proposedBy: string;
  proposedAt: string;
  reasoning?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Discriminated union for sprint actions
 */
export type SprintAction =
  | { type: 'LOG'; level: LogLevel; message: string }
  | { type: 'SPAWN_CLAUDE'; prompt: string; phaseId: string; onComplete: SprintEvent['type'] }
  | { type: 'WRITE_PROGRESS' }
  | { type: 'UPDATE_STATS'; updates: Partial<SprintStats> }
  | { type: 'EMIT_ACTIVITY'; activity: string; data: unknown }
  | { type: 'SCHEDULE_RETRY'; phaseId: string; delayMs: number }
  | { type: 'INSERT_STEP'; step: StepQueueItem; position: InsertPosition };

/**
 * Execution statistics
 */
export interface SprintStats {
  'started-at': string | null;
  'completed-at'?: string | null;
  'total-phases': number;
  'completed-phases': number;
  'total-steps'?: number;
  'completed-steps'?: number;
  elapsed?: string;
  'current-iteration'?: number;
  'max-iterations'?: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number[];
  retryOn: ErrorCategory[];
}

/**
 * Orchestration configuration
 */
export interface OrchestrationConfig {
  enabled: boolean;
  prompt?: string;
  insertStrategy: 'after-current' | 'end-of-phase' | 'custom';
  autoApprove: boolean;
}

/**
 * A compiled phase (leaf node)
 */
export interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
  error?: string;
  'retry-count'?: number;
  'next-retry-at'?: string;
  'error-category'?: ErrorCategory;
  parallel?: boolean;
  'parallel-task-id'?: string;
}

/**
 * A compiled step (contains sub-phases)
 */
export interface CompiledStep {
  id: string;
  prompt: string;
  status: PhaseStatus;
  phases: CompiledPhase[];
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  error?: string;
  'retry-count'?: number;
  'next-retry-at'?: string;
  'error-category'?: ErrorCategory;
}

/**
 * A top-level phase that may contain steps
 */
export interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;
  steps?: CompiledStep[];
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
  error?: string;
  'retry-count'?: number;
  'next-retry-at'?: string;
  'error-category'?: ErrorCategory;
  'wait-for-parallel'?: boolean;
}

/**
 * Compiled Progress - the runtime format
 */
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases?: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  'parallel-tasks'?: unknown[];
  mode?: 'standard' | 'ralph';
  goal?: string;
  'dynamic-steps'?: unknown[];
  'hook-tasks'?: unknown[];
  'per-iteration-hooks'?: unknown[];
  ralph?: unknown;
  'ralph-exit'?: unknown;
  orchestration?: OrchestrationConfig;
  'step-queue'?: StepQueueItem[];
  prompts?: unknown;
  retry?: RetryConfig;
}

/**
 * Result of a state transition
 */
export interface TransitionResult {
  nextState: SprintState;
  actions: SprintAction[];
  context: Partial<CompiledProgress>;
}

/**
 * Type alias for guard functions
 */
export type GuardFn = (
  state: SprintState,
  context: CompiledProgress,
  event: SprintEvent
) => boolean;

/**
 * Guard functions for conditional transitions
 */
export const guards: Record<string, GuardFn> = {
  hasMorePhases: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    return ctx.current.phase < (ctx.phases?.length ?? 0) - 1;
  },

  hasMoreSteps: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    if (ctx.current.step === null) return false;
    const phase = ctx.phases?.[ctx.current.phase];
    if (!phase?.steps) return false;
    return ctx.current.step < phase.steps.length - 1;
  },

  hasMoreSubPhases: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    if (ctx.current.step === null || ctx.current['sub-phase'] === null) return false;
    const phase = ctx.phases?.[ctx.current.phase];
    const step = phase?.steps?.[ctx.current.step];
    if (!step?.phases) return false;
    return ctx.current['sub-phase'] < step.phases.length - 1;
  },

  isRetryable: (_state: SprintState, ctx: CompiledProgress, event: SprintEvent): boolean => {
    if (event.type !== 'PHASE_FAILED' && event.type !== 'STEP_FAILED') return false;
    if (!ctx.retry?.retryOn) return false;
    return ctx.retry.retryOn.includes(event.category);
  },

  hasStepQueue: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    return (ctx['step-queue']?.length ?? 0) > 0;
  },

  orchestrationEnabled: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    return ctx.orchestration?.enabled === true;
  },

  autoApproveEnabled: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    return ctx.orchestration?.autoApprove === true;
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the current phase from compiled progress.
 */
export function getCurrentPhase(progress: CompiledProgress): CompiledTopPhase | undefined {
  return progress.phases?.[progress.current.phase];
}

/**
 * Get the current step from compiled progress.
 * Returns undefined if no steps exist or step index is null.
 */
export function getCurrentStep(progress: CompiledProgress): CompiledStep | undefined {
  if (progress.current.step === null) return undefined;
  const phase = getCurrentPhase(progress);
  return phase?.steps?.[progress.current.step];
}

/**
 * Get the current sub-phase from compiled progress.
 * Returns undefined if no sub-phases exist or sub-phase index is null.
 */
export function getCurrentSubPhase(progress: CompiledProgress): CompiledPhase | undefined {
  if (progress.current['sub-phase'] === null) return undefined;
  const step = getCurrentStep(progress);
  return step?.phases?.[progress.current['sub-phase']];
}

/**
 * Advance the pointer to the next position in the phase hierarchy.
 * Priority: sub-phase → step → phase
 */
export function advancePointer(
  current: CurrentPointer,
  context: CompiledProgress
): { nextPointer: CurrentPointer; hasMore: boolean } {
  const phase = context.phases?.[current.phase];

  // Check if we're in a step with sub-phases
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

    // Sub-phases exhausted, try to advance step
    const steps = phase?.steps;
    if (steps && current.step < steps.length - 1) {
      return {
        nextPointer: { ...current, step: current.step + 1, 'sub-phase': 0 },
        hasMore: true,
      };
    }

    // Steps exhausted, try to advance phase
    if (context.phases && current.phase < context.phases.length - 1) {
      const nextPhase = context.phases[current.phase + 1];
      const hasSteps = nextPhase?.steps && nextPhase.steps.length > 0;
      const hasSubPhases = hasSteps && nextPhase.steps![0].phases && nextPhase.steps![0].phases.length > 0;
      return {
        nextPointer: {
          phase: current.phase + 1,
          step: hasSteps ? 0 : null,
          'sub-phase': hasSubPhases ? 0 : null,
        },
        hasMore: true,
      };
    }

    // No more phases
    return { nextPointer: current, hasMore: false };
  }

  // Check if we're in a step without sub-phases (step is non-null, sub-phase is null)
  if (current.step !== null) {
    const steps = phase?.steps;
    if (steps && current.step < steps.length - 1) {
      return {
        nextPointer: { ...current, step: current.step + 1 },
        hasMore: true,
      };
    }

    // Steps exhausted, try to advance phase
    if (context.phases && current.phase < context.phases.length - 1) {
      const nextPhase = context.phases[current.phase + 1];
      const hasSteps = nextPhase?.steps && nextPhase.steps.length > 0;
      return {
        nextPointer: {
          phase: current.phase + 1,
          step: hasSteps ? 0 : null,
          'sub-phase': null,
        },
        hasMore: true,
      };
    }

    return { nextPointer: current, hasMore: false };
  }

  // Simple phase without steps
  if (context.phases && current.phase < context.phases.length - 1) {
    const nextPhase = context.phases[current.phase + 1];
    const hasSteps = nextPhase?.steps && nextPhase.steps.length > 0;
    const hasSubPhases = hasSteps && nextPhase.steps![0].phases && nextPhase.steps![0].phases.length > 0;
    return {
      nextPointer: {
        phase: current.phase + 1,
        step: hasSteps ? 0 : null,
        'sub-phase': hasSubPhases ? 0 : null,
      },
      hasMore: true,
    };
  }

  return { nextPointer: current, hasMore: false };
}

/**
 * Calculate backoff delay for retry based on retry count.
 * Uses the backoffMs array from retry config, capping at the last value.
 */
export function calculateBackoff(context: CompiledProgress): number {
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
function getCurrentPrompt(context: CompiledProgress): string {
  const subPhase = getCurrentSubPhase(context);
  if (subPhase) return subPhase.prompt;

  const step = getCurrentStep(context);
  if (step) return step.prompt;

  const phase = getCurrentPhase(context);
  return phase?.prompt ?? '';
}

/**
 * Get the phase ID for the current position.
 */
function getCurrentPhaseId(context: CompiledProgress): string {
  const subPhase = getCurrentSubPhase(context);
  if (subPhase) return subPhase.id;

  const step = getCurrentStep(context);
  if (step) return step.id;

  const phase = getCurrentPhase(context);
  return phase?.id ?? '';
}

/**
 * Calculate elapsed time between two ISO timestamps.
 */
function calculateElapsed(startedAt: string, completedAt: string): string {
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
function createNoOp(state: SprintState): TransitionResult {
  return { nextState: state, actions: [], context: {} };
}

/**
 * Handles completion events (PHASE_COMPLETE, STEP_COMPLETE, GOAL_COMPLETE).
 * Advances pointer or transitions to completed state.
 */
function handleCompletion(
  state: SprintState & { status: 'in-progress' },
  context: CompiledProgress,
  summary: string,
  now: string
): TransitionResult {
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
function handleFailure(
  state: SprintState,
  context: CompiledProgress,
  event: { error: string; category: ErrorCategory; phaseId?: string; stepId?: string },
  now: string
): TransitionResult {
  const failedId = event.phaseId ?? event.stepId ?? '';
  const isRetryable = guards.isRetryable(state, context, event as SprintEvent);

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
export function transition(
  state: SprintState,
  event: SprintEvent,
  context: CompiledProgress
): TransitionResult {
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
    // RESUME Event
    // ========================================================================
    case 'RESUME': {
      if (state.status !== 'paused') {
        return createNoOp(state);
      }

      const restoredContext = { ...context, current: state.pausedAt };

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
        const actions: SprintAction[] = event.steps.map((step) => ({
          type: 'INSERT_STEP' as const,
          step: {
            id: randomUUID(),
            prompt: step.prompt,
            proposedBy: event.proposedBy,
            proposedAt: now,
            reasoning: step.reasoning,
            priority: step.priority ?? 'medium',
          },
          position: context.orchestration?.insertStrategy === 'end-of-phase'
            ? 'end-of-phase' as const
            : 'after-current' as const,
        }));

        return { nextState: state, actions, context: {} };
      } else {
        // Queue steps for orchestration iteration
        const queueItems: StepQueueItem[] = event.steps.map((step) => ({
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
      const _exhaustive: never = event;
      return createNoOp(state);
    }
  }
}
