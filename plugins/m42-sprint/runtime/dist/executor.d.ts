/**
 * Executor Module - Action Execution for Sprint State Machine
 *
 * Maps SprintAction discriminated union to side effect implementations.
 * Actions describe effects; this module executes them.
 */
import { ClaudeResult, ClaudeRunOptions } from './claude-runner.js';
export type { LogLevel, InsertPosition, ErrorCategory, PhaseStatus, SprintStatus, StepQueueItem, SprintStats, CurrentPointer, CompiledPhase, CompiledStep, CompiledTopPhase, CompiledProgress, SprintAction, SprintEvent, } from './transition.js';
import type { CompiledProgress, SprintAction, SprintEvent } from './transition.js';
/**
 * Context for action execution - provides access to sprint state and configuration.
 */
export interface ExecutorContext {
    /** Path to sprint directory */
    sprintDir: string;
    /** Mutable reference to progress state */
    progress: CompiledProgress;
    /** Enable verbose logging */
    verbose: boolean;
}
/**
 * Dependencies that can be injected for testing
 */
export interface ExecutorDependencies {
    runClaude: (options: ClaudeRunOptions) => Promise<ClaudeResult>;
}
/**
 * Execute a single action and return any resulting event.
 *
 * @param action - The action to execute
 * @param context - Executor context with sprint state
 * @param deps - Optional dependencies for testing
 * @returns Promise resolving to SprintEvent or null
 */
export declare function executeAction(action: SprintAction, context: ExecutorContext, deps?: ExecutorDependencies): Promise<SprintEvent | null>;
/**
 * Execute multiple actions in sequence and collect resulting events.
 *
 * @param actions - Array of actions to execute
 * @param context - Executor context with sprint state
 * @param deps - Optional dependencies for testing
 * @returns Promise resolving to array of non-null events
 */
export declare function executeActions(actions: SprintAction[], context: ExecutorContext, deps?: ExecutorDependencies): Promise<SprintEvent[]>;
//# sourceMappingURL=executor.d.ts.map