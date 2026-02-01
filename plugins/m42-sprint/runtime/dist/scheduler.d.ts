/**
 * DAG-based Step Scheduler for Parallel Execution
 *
 * Manages step execution order based on dependency graphs from PROGRESS.yaml.
 * Provides methods for:
 * - Getting ready steps (all dependencies satisfied)
 * - Marking steps as in-progress/completed/failed
 * - Propagating failures to dependents
 * - Injecting new steps dynamically
 */
/** Phase status (from compiler types) */
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
/**
 * Compiled dependency graph node for PROGRESS.yaml
 */
export interface CompiledDependencyNode {
    id: string;
    'depends-on': string[];
    'blocked-by': string[];
}
/**
 * Dependency graph for a for-each phase
 */
export interface CompiledDependencyGraph {
    'phase-id': string;
    nodes: CompiledDependencyNode[];
}
/**
 * Configuration for parallel execution
 */
export interface ParallelExecutionConfig {
    enabled: boolean;
    maxConcurrency?: number;
    onDependencyFailure: 'skip-dependents' | 'fail-phase' | 'continue';
}
/**
 * A compiled step within a phase
 */
export interface CompiledStep {
    id: string;
    prompt: string;
    status: PhaseStatus;
    phases: {
        id: string;
        status: PhaseStatus;
        prompt: string;
    }[];
    'depends-on'?: string[];
}
/**
 * A compiled top-level phase that may contain steps
 */
export interface CompiledTopPhase {
    id: string;
    status: PhaseStatus;
    prompt?: string;
    steps?: CompiledStep[];
}
/**
 * Compiled progress from PROGRESS.yaml
 */
export interface CompiledProgress {
    'sprint-id': string;
    status: string;
    phases?: CompiledTopPhase[];
    current: {
        phase: number;
        step: number | null;
        'sub-phase': number | null;
    };
    stats: {
        'started-at': string | null;
        'total-phases': number;
        'completed-phases': number;
    };
    'dependency-graph'?: CompiledDependencyGraph[];
}
/** Status of a step in the scheduler's internal tracking */
export type SchedulerStepStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';
/** Internal node representation for the scheduler */
export interface SchedulerNode {
    /** Unique identifier (step ID) */
    id: string;
    /** Phase ID this step belongs to */
    phaseId: string;
    /** IDs of steps this depends on (original, immutable) */
    dependsOn: string[];
    /** IDs of steps currently blocking this (mutable, cleared as deps complete) */
    blockedBy: string[];
    /** IDs of steps that depend on this (reverse edges for failure propagation) */
    dependents: string[];
    /** Current status in the scheduler */
    status: SchedulerStepStatus;
    /** Worker ID if currently running */
    workerId?: string;
    /** When the step started (ISO timestamp) */
    startedAt?: string;
    /** When the step completed/failed (ISO timestamp) */
    completedAt?: string;
    /** Error message if failed */
    error?: string;
}
/** Options for scheduler initialization */
export interface SchedulerOptions {
    /** Failure handling policy */
    onDependencyFailure: 'skip-dependents' | 'fail-phase' | 'continue';
    /** Maximum concurrent step executions (0 = unlimited) */
    maxConcurrent: number;
}
/** Information about a step ready for execution */
export interface ReadyStep {
    /** Step ID */
    id: string;
    /** Phase ID */
    phaseId: string;
    /** The step index within the phase */
    stepIndex: number;
}
/** Result of injecting a new step */
export interface InjectResult {
    success: boolean;
    error?: string;
}
/**
 * DAG-based scheduler for managing step execution order
 *
 * The scheduler builds an internal dependency graph from PROGRESS.yaml
 * and provides methods for:
 * - Getting steps ready for execution (all deps satisfied)
 * - Managing step lifecycle (start, complete, fail)
 * - Propagating failures to dependent steps
 * - Dynamic step injection
 */
export declare class StepScheduler {
    /** All nodes in the graph, keyed by step ID */
    private nodes;
    /** Reverse lookup: phase ID to step IDs */
    private phaseSteps;
    /** Configuration options */
    private options;
    /** Number of currently running steps */
    private runningCount;
    /**
     * Create a new scheduler from PROGRESS.yaml data
     *
     * @param progress - The compiled progress with dependency graphs
     * @param config - Parallel execution configuration (optional)
     */
    constructor(progress: CompiledProgress, config?: Partial<ParallelExecutionConfig>);
    /**
     * Build the internal dependency graph from PROGRESS.yaml
     */
    private buildGraph;
    /**
     * Map PhaseStatus to SchedulerStepStatus
     */
    private mapPhaseStatus;
    /**
     * Get all steps that are ready to execute
     *
     * A step is ready when:
     * 1. Its status is 'ready' (all dependencies completed)
     * 2. max-concurrent limit hasn't been reached
     *
     * @returns Array of ready steps with metadata
     */
    getReadySteps(): ReadyStep[];
    /**
     * Mark a step as started (in-progress)
     *
     * @param stepId - ID of the step to start
     * @param workerId - Optional worker identifier
     * @returns True if successful, false if step not found or not ready
     */
    startStep(stepId: string, workerId?: string): boolean;
    /**
     * Mark a step as completed
     *
     * This will:
     * 1. Update the step's status to 'completed'
     * 2. Remove this step from blockedBy of all dependents
     * 3. Mark newly unblocked dependents as 'ready'
     *
     * @param stepId - ID of the step that completed
     * @returns True if successful, false if step not found or not running
     */
    completeStep(stepId: string): boolean;
    /**
     * Mark a step as failed
     *
     * Based on the failure policy:
     * - 'skip-dependents': Mark all transitive dependents as skipped
     * - 'fail-phase': Mark the entire phase as failed (not implemented at scheduler level)
     * - 'continue': Do nothing, let other steps continue
     *
     * @param stepId - ID of the step that failed
     * @param error - Optional error message
     * @returns True if successful, false if step not found or not running
     */
    failStep(stepId: string, error?: string): boolean;
    /**
     * Recursively skip all dependents of a failed step
     */
    private skipDependents;
    /**
     * Inject a new step into the graph
     *
     * The step can have dependencies on existing steps, and existing
     * steps can depend on it (though this requires careful coordination).
     *
     * @param step - The step to inject
     * @param phaseId - Phase to add the step to
     * @param dependsOn - IDs of steps this depends on (optional)
     * @returns Result indicating success or failure with reason
     */
    injectStep(step: {
        id: string;
        prompt: string;
    }, phaseId: string, dependsOn?: string[]): InjectResult;
    /**
     * Check if all steps are complete (or skipped/failed)
     *
     * @returns True if no steps are pending, ready, or running
     */
    isComplete(): boolean;
    /**
     * Check if the scheduler has failed steps
     *
     * @returns True if any step has failed
     */
    hasFailed(): boolean;
    /**
     * Get status summary of all steps
     *
     * @returns Object with counts by status
     */
    getStatusSummary(): Record<SchedulerStepStatus, number>;
    /**
     * Get the internal node for a step (for testing/debugging)
     *
     * @param stepId - The step ID
     * @returns The scheduler node or undefined
     */
    getNode(stepId: string): SchedulerNode | undefined;
    /**
     * Get all nodes (for testing/debugging)
     *
     * @returns Map of all scheduler nodes
     */
    getAllNodes(): Map<string, SchedulerNode>;
    /**
     * Get the number of currently running steps
     */
    getRunningCount(): number;
    /**
     * Get the max concurrent limit
     */
    getMaxConcurrent(): number;
    /**
     * Update the blocked-by list in PROGRESS.yaml format
     *
     * @returns Array of dependency graphs with updated blocked-by
     */
    exportDependencyGraphs(): CompiledDependencyGraph[];
}
//# sourceMappingURL=scheduler.d.ts.map