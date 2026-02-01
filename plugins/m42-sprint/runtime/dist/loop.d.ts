/**
 * Main Sprint Loop Module
 *
 * Implements the main execution loop that orchestrates sprint phases,
 * replacing sprint-loop.sh with TypeScript.
 */
import { SprintState, CompiledProgress, CompiledGate, GateTracking } from './transition.js';
import type { ClaudeResult, ClaudeRunOptions } from './claude-runner.js';
/**
 * Per-iteration hook configuration
 * Hooks run deterministically each iteration (e.g., learning extraction)
 */
export interface PerIterationHook {
    /** Unique identifier for this hook */
    id: string;
    /** Reference to workflow (e.g., "m42-signs:learning-extraction") */
    workflow?: string;
    /** Inline prompt alternative to workflow */
    prompt?: string;
    /** If true, runs non-blocking in background */
    parallel: boolean;
    /** Whether this hook is active */
    enabled: boolean;
}
/**
 * Tracking entry for per-iteration hook execution
 */
export interface HookTask {
    /** Which iteration this belongs to */
    iteration: number;
    /** Which hook this is */
    'hook-id': string;
    /** Current status */
    status: 'spawned' | 'running' | 'completed' | 'failed';
    /** Process ID if running */
    pid?: number;
    /** Path to transcript file */
    transcript?: string;
    /** When spawned (ISO timestamp) */
    'spawned-at'?: string;
    /** When completed (ISO timestamp) */
    'completed-at'?: string;
    /** Exit code if completed */
    'exit-code'?: number;
}
/**
 * Options for the main loop
 */
export interface LoopOptions {
    /** Max iterations (0 = unlimited, default 0) */
    maxIterations?: number;
    /** Delay between iterations in ms (default 2000) */
    delay?: number;
    /** Enable verbose logging (default false) */
    verbose?: boolean;
}
/**
 * Result from loop execution
 */
export interface LoopResult {
    /** Final sprint state */
    finalState: SprintState;
    /** Number of iterations run */
    iterations: number;
    /** Total elapsed time in ms */
    elapsedMs: number;
}
/**
 * Dependencies that can be injected for testing
 */
export interface LoopDependencies {
    runClaude: (options: ClaudeRunOptions) => Promise<ClaudeResult>;
}
/**
 * Check if a state is terminal (loop should stop)
 */
export declare function isTerminalState(state: SprintState): boolean;
/**
 * Result from running a gate check script
 */
export interface GateResult {
    /** Whether the gate check passed (exit code 0) */
    passed: boolean;
    /** Exit code from the script */
    exitCode: number;
    /** Combined stdout and stderr output */
    output: string;
    /** Error message if execution failed */
    error?: string;
}
/**
 * Run a gate check script and return the result
 *
 * @param gate - The compiled gate configuration
 * @param sprintDir - Sprint directory (working directory for script)
 * @param phaseId - Phase ID for environment variable
 * @param attemptNumber - Current attempt number for environment variable
 * @returns Promise resolving to GateResult
 */
export declare function runGateScript(gate: CompiledGate, sprintDir: string, phaseId: string, attemptNumber: number): Promise<GateResult>;
/**
 * Execute a gate check with retry loop
 *
 * @param gate - Gate configuration
 * @param tracking - Current tracking state (or undefined for first run)
 * @param sprintDir - Sprint directory
 * @param phaseId - Current phase ID
 * @param workingDir - Working directory for Claude execution
 * @param deps - Dependencies (runClaude function)
 * @param verbose - Enable verbose logging
 * @param progressPath - Path to PROGRESS.yaml for intermediate saves
 * @param progress - Progress object to update
 * @param outputDir - Directory for transcription logs
 * @param model - Model to use for fix iterations
 * @returns Updated tracking state (passed, blocked, or retrying)
 */
export declare function executeGateCheck(gate: CompiledGate, tracking: GateTracking | undefined, sprintDir: string, phaseId: string, workingDir: string, deps: LoopDependencies, verbose: boolean, progressPath: string, progress: CompiledProgress, outputDir: string, model?: string): Promise<GateTracking>;
/**
 * Progress type extended with typed hook fields
 * Overrides the unknown[] types from CompiledProgress with specific types
 */
export type ProgressWithHooks = Omit<CompiledProgress, 'per-iteration-hooks' | 'hook-tasks'> & {
    'per-iteration-hooks'?: PerIterationHook[];
    'hook-tasks'?: HookTask[];
};
/**
 * Template variables available for hook prompt substitution
 */
interface HookTemplateVars {
    /** Path to the current iteration's transcript log file */
    ITERATION_TRANSCRIPT: string;
    /** Sprint identifier */
    SPRINT_ID: string;
    /** Current iteration number (1-based) */
    ITERATION: number;
    /** Current phase identifier */
    PHASE_ID: string;
}
/**
 * Replace template variables in a hook prompt.
 *
 * Supported variables:
 * - $ITERATION_TRANSCRIPT → path to current iteration's transcript
 * - $SPRINT_ID → sprint identifier
 * - $ITERATION → iteration number
 * - $PHASE_ID → current phase identifier
 *
 * @param prompt - Hook prompt with template variables
 * @param vars - Variable values to substitute
 * @returns Prompt with variables replaced
 */
export declare function replaceHookTemplateVars(prompt: string, vars: HookTemplateVars): string;
/**
 * Execute all enabled per-iteration hooks after an iteration completes.
 *
 * For hooks with parallel: true, spawns them in background without blocking.
 * For hooks with parallel: false, waits for completion before returning.
 *
 * @param progress - Progress object with hooks configuration
 * @param iteration - Current iteration number
 * @param transcriptPath - Path to the current iteration's transcript file
 * @param phaseId - Current phase identifier
 * @param sprintDir - Sprint directory path
 * @param workingDir - Working directory for Claude execution
 * @param deps - Loop dependencies
 * @param verbose - Enable verbose logging
 */
export declare function executePerIterationHooks(progress: ProgressWithHooks, iteration: number, transcriptPath: string, phaseId: string, sprintDir: string, workingDir: string, deps: LoopDependencies, verbose: boolean): Promise<void>;
/**
 * Recover from interrupted transaction on startup.
 * Checks for backup file and restores if main file is corrupted.
 */
export declare function recoverFromInterrupt(progressPath: string): Promise<void>;
/**
 * Run the main sprint loop.
 *
 * @param sprintDir - Path to sprint directory
 * @param options - Loop options
 * @param deps - Optional dependencies for testing
 * @returns Promise resolving to LoopResult
 */
export declare function runLoop(sprintDir: string, options?: LoopOptions, deps?: LoopDependencies): Promise<LoopResult>;
export {};
//# sourceMappingURL=loop.d.ts.map