/**
 * Sprint State Machine Transition Function
 *
 * Pure function that computes state transitions based on events.
 * Follows XState-inspired patterns with discriminated unions.
 */
/** Log severity levels for LOG actions */
export type LogLevel = 'info' | 'warn' | 'error';
/** Step insertion position strategies */
export type InsertPosition = 'after-current' | 'end-of-phase';
/** Error category types for classification and retry configuration */
export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';
/** Phase status */
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
/** Sprint status (deprecated, use SprintState) */
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'paused-at-breakpoint' | 'needs-human';
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
export type SprintState = {
    status: 'not-started';
} | {
    status: 'in-progress';
    current: CurrentPointer;
    iteration: number;
    startedAt: string;
} | {
    status: 'paused';
    pausedAt: CurrentPointer;
    pauseReason: string;
} | {
    status: 'paused-at-breakpoint';
    pausedAt: CurrentPointer;
    breakpointPhaseId: string;
} | {
    status: 'blocked';
    error: string;
    failedPhase: string;
    blockedAt: string;
} | {
    status: 'needs-human';
    reason: string;
    details?: string;
} | {
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
export type SprintEvent = {
    type: 'START';
} | {
    type: 'TICK';
} | {
    type: 'MAX_ITERATIONS_REACHED';
} | {
    type: 'PHASE_COMPLETE';
    summary: string;
    phaseId: string;
} | {
    type: 'PHASE_FAILED';
    error: string;
    category: ErrorCategory;
    phaseId: string;
} | {
    type: 'STEP_COMPLETE';
    summary: string;
    stepId: string;
} | {
    type: 'STEP_FAILED';
    error: string;
    category: ErrorCategory;
    stepId: string;
} | {
    type: 'PROPOSE_STEPS';
    steps: ProposedStep[];
    proposedBy: string;
} | {
    type: 'PAUSE';
    reason: string;
} | {
    type: 'BREAKPOINT_REACHED';
    phaseId: string;
} | {
    type: 'RESUME';
} | {
    type: 'HUMAN_NEEDED';
    reason: string;
    details?: string;
} | {
    type: 'GOAL_COMPLETE';
    summary: string;
};
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
export type SprintAction = {
    type: 'LOG';
    level: LogLevel;
    message: string;
} | {
    type: 'SPAWN_CLAUDE';
    prompt: string;
    phaseId: string;
    onComplete: SprintEvent['type'];
} | {
    type: 'WRITE_PROGRESS';
} | {
    type: 'UPDATE_STATS';
    updates: Partial<SprintStats>;
} | {
    type: 'EMIT_ACTIVITY';
    activity: string;
    data: unknown;
} | {
    type: 'SCHEDULE_RETRY';
    phaseId: string;
    delayMs: number;
} | {
    type: 'INSERT_STEP';
    step: StepQueueItem;
    position: InsertPosition;
};
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
 * Gate check status for tracking
 */
export type GateStatus = 'pending' | 'running' | 'passed' | 'retrying' | 'failed' | 'blocked';
/**
 * Gate tracking state
 */
export interface GateTracking {
    attempts: number;
    status: GateStatus;
    'last-output'?: string;
    'last-exit-code'?: number;
    error?: string;
}
/**
 * Compiled gate configuration
 */
export interface CompiledGate {
    script: string;
    'on-fail-prompt': string;
    'max-retries': number;
    timeout: number;
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
    gate?: CompiledGate;
    'gate-tracking'?: GateTracking;
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
    /** If true, pause execution after this phase completes for human review */
    break?: boolean;
    /** Quality gate configuration */
    gate?: CompiledGate;
    /** Gate check tracking state */
    'gate-tracking'?: GateTracking;
}
/** Worktree cleanup mode */
export type WorktreeCleanup = 'never' | 'on-complete' | 'on-merge';
/**
 * Compiled worktree configuration in PROGRESS.yaml
 */
export interface CompiledWorktreeConfig {
    enabled: boolean;
    branch: string;
    path: string;
    cleanup: WorktreeCleanup;
    'created-at'?: string;
    'cleaned-up'?: boolean;
    /** Working directory for Claude execution (worktree root or project root) */
    'working-dir'?: string;
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
    goal?: string;
    'dynamic-steps'?: unknown[];
    'hook-tasks'?: unknown[];
    'per-iteration-hooks'?: unknown[];
    orchestration?: OrchestrationConfig;
    'step-queue'?: StepQueueItem[];
    prompts?: unknown;
    retry?: RetryConfig;
    worktree?: CompiledWorktreeConfig;
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
export type GuardFn = (state: SprintState, context: CompiledProgress, event: SprintEvent) => boolean;
/**
 * Guard functions for conditional transitions
 */
export declare const guards: Record<string, GuardFn>;
/**
 * Get the current phase from compiled progress.
 */
export declare function getCurrentPhase(progress: CompiledProgress): CompiledTopPhase | undefined;
/**
 * Get the current step from compiled progress.
 * Returns undefined if no steps exist or step index is null.
 */
export declare function getCurrentStep(progress: CompiledProgress): CompiledStep | undefined;
/**
 * Get the current sub-phase from compiled progress.
 * Returns undefined if no sub-phases exist or sub-phase index is null.
 */
export declare function getCurrentSubPhase(progress: CompiledProgress): CompiledPhase | undefined;
/**
 * Advance the pointer to the next position in the phase hierarchy.
 * Priority: sub-phase → step → phase
 * BUG-002 FIX: Skips over phases marked as 'skipped'
 */
export declare function advancePointer(current: CurrentPointer, context: CompiledProgress): {
    nextPointer: CurrentPointer;
    hasMore: boolean;
};
/**
 * Calculate backoff delay for retry based on retry count.
 * Uses the backoffMs array from retry config, capping at the last value.
 */
export declare function calculateBackoff(context: CompiledProgress): number;
/**
 * Pure transition function for sprint state machine.
 *
 * @param state - Current sprint state
 * @param event - Event to process
 * @param context - Compiled progress context
 * @returns TransitionResult with nextState, actions, and context updates
 */
export declare function transition(state: SprintState, event: SprintEvent, context: CompiledProgress): TransitionResult;
//# sourceMappingURL=transition.d.ts.map