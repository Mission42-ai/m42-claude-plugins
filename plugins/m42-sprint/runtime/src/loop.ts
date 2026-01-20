/**
 * Main Sprint Loop Module
 *
 * Implements the main execution loop that orchestrates sprint phases,
 * replacing sprint-loop.sh with TypeScript.
 */

import * as fs from 'fs';
import * as path from 'path';

// Import from transition module
import {
  SprintState,
  SprintEvent,
  CompiledProgress,
  transition,
} from './transition.js';

// Import from yaml-ops module
import {
  readProgress as readProgressYaml,
  writeProgressAtomic as writeProgressYamlAtomic,
  backupProgress,
  restoreProgress,
  cleanupBackup,
  CompiledProgress as YamlOpsProgress,
} from './yaml-ops.js';

// Import from executor module
import {
  ExecutorContext,
  executeActions,
} from './executor.js';

// Import from claude-runner module
import { runClaude as defaultRunClaude } from './claude-runner.js';
import type { ClaudeResult, ClaudeRunOptions } from './claude-runner.js';

// ============================================================================
// Progress File Operations (wrapper to handle type differences)
// ============================================================================

/**
 * Read progress from file with proper typing and checksum validation
 */
function readProgress(filePath: string): CompiledProgress {
  // Use yaml-ops readProgress which validates checksum
  return readProgressYaml(filePath) as unknown as CompiledProgress;
}

/**
 * Write progress atomically
 */
async function writeProgressAtomic(filePath: string, progress: CompiledProgress): Promise<void> {
  await writeProgressYamlAtomic(filePath, progress as unknown as YamlOpsProgress);
}

// ============================================================================
// Types
// ============================================================================

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

/** Default dependencies using real implementations */
const defaultLoopDeps: LoopDependencies = {
  runClaude: defaultRunClaude,
};

// ============================================================================
// Constants
// ============================================================================

const TERMINAL_STATES = ['completed', 'blocked', 'paused', 'needs-human'] as const;
const PAUSE_FILENAME = 'PAUSE';
const PROGRESS_FILENAME = 'PROGRESS.yaml';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a state is terminal (loop should stop)
 */
export function isTerminalState(state: SprintState): boolean {
  return TERMINAL_STATES.includes(state.status as typeof TERMINAL_STATES[number]);
}

/**
 * Check if PAUSE file exists in sprint directory
 */
function checkPauseSignal(sprintDir: string): boolean {
  const pausePath = path.join(sprintDir, PAUSE_FILENAME);
  return fs.existsSync(pausePath);
}

/**
 * Restore SprintState from CompiledProgress
 */
function restoreStateFromProgress(progress: CompiledProgress): SprintState {
  switch (progress.status) {
    case 'not-started':
      return { status: 'not-started' };

    case 'in-progress':
      return {
        status: 'in-progress',
        current: progress.current,
        iteration: progress.stats['current-iteration'] ?? 1,
        startedAt: progress.stats['started-at'] ?? new Date().toISOString(),
      };

    case 'paused':
      return {
        status: 'paused',
        pausedAt: progress.current,
        pauseReason: (progress as unknown as { 'pause-reason'?: string })['pause-reason'] ?? 'Unknown',
      };

    case 'blocked':
      return {
        status: 'blocked',
        error: (progress as unknown as { error?: string }).error ?? 'Unknown error',
        failedPhase: (progress as unknown as { 'failed-phase'?: string })['failed-phase'] ?? '',
        blockedAt: (progress as unknown as { 'blocked-at'?: string })['blocked-at'] ?? new Date().toISOString(),
      };

    case 'needs-human':
      const humanNeeded = (progress as unknown as { 'human-needed'?: { reason?: string; details?: string } })['human-needed'];
      return {
        status: 'needs-human',
        reason: humanNeeded?.reason ?? 'Unknown reason',
        details: humanNeeded?.details,
      };

    case 'completed':
      return {
        status: 'completed',
        summary: (progress as unknown as { summary?: string }).summary,
        completedAt: progress.stats['completed-at'] ?? new Date().toISOString(),
        elapsed: progress.stats.elapsed ?? '0s',
      };

    default:
      return { status: 'not-started' };
  }
}

/**
 * Update CompiledProgress from SprintState
 */
function updateProgressFromState(progress: CompiledProgress, state: SprintState): void {
  progress.status = state.status;

  switch (state.status) {
    case 'in-progress':
      progress.current = state.current;
      progress.stats['started-at'] = state.startedAt;
      progress.stats['current-iteration'] = state.iteration;
      break;

    case 'paused':
      progress.current = state.pausedAt;
      (progress as unknown as { 'pause-reason': string })['pause-reason'] = state.pauseReason;
      break;

    case 'blocked':
      (progress as unknown as { error: string }).error = state.error;
      (progress as unknown as { 'failed-phase': string })['failed-phase'] = state.failedPhase;
      (progress as unknown as { 'blocked-at': string })['blocked-at'] = state.blockedAt;
      break;

    case 'needs-human':
      (progress as unknown as { 'human-needed': { reason: string; details?: string } })['human-needed'] = {
        reason: state.reason,
        details: state.details,
      };
      break;

    case 'completed':
      progress.stats['completed-at'] = state.completedAt;
      progress.stats.elapsed = state.elapsed;
      if (state.summary) {
        (progress as unknown as { summary: string }).summary = state.summary;
      }
      // Mark all phases as completed
      if (progress.phases) {
        for (const phase of progress.phases) {
          phase.status = 'completed';
        }
      }
      break;
  }
}

/**
 * Recover from interrupted transaction on startup.
 * Checks for backup file and restores if main file is corrupted.
 */
export async function recoverFromInterrupt(progressPath: string): Promise<void> {
  const backupPath = `${progressPath}.backup`;

  // If no backup exists, nothing to recover
  if (!fs.existsSync(backupPath)) {
    return;
  }

  // Try to read the main file
  try {
    readProgress(progressPath);
    // Main file is valid, just clean up backup
    cleanupBackup(progressPath);
    return;
  } catch {
    // Main file is corrupted or missing, restore from backup
    const restored = restoreProgress(progressPath);
    if (restored) {
      // Backup was renamed to main file, no need to cleanup
      return;
    }
  }
}

// ============================================================================
// Main Loop
// ============================================================================

/**
 * Run the main sprint loop.
 *
 * @param sprintDir - Path to sprint directory
 * @param options - Loop options
 * @param deps - Optional dependencies for testing
 * @returns Promise resolving to LoopResult
 */
export async function runLoop(
  sprintDir: string,
  options: LoopOptions = {},
  deps: LoopDependencies = defaultLoopDeps
): Promise<LoopResult> {
  const startTime = Date.now();
  const maxIterations = options.maxIterations ?? 0;
  const delay = options.delay ?? 2000;
  const verbose = options.verbose ?? false;

  const progressPath = path.join(sprintDir, PROGRESS_FILENAME);
  let iterations = 0;

  // 1. Recover from any interrupted transaction
  await recoverFromInterrupt(progressPath);

  // 2. Load progress
  const progress = readProgress(progressPath);

  // 3. Restore state from progress
  let state = restoreStateFromProgress(progress);

  // If already in terminal state, return immediately
  if (isTerminalState(state)) {
    return {
      finalState: state,
      iterations: 0,
      elapsedMs: Date.now() - startTime,
    };
  }

  // Create executor context
  const context: ExecutorContext = {
    sprintDir,
    progress,
    verbose,
  };

  // 4. If not-started, check for empty phases first
  if (state.status === 'not-started') {
    // Check if there are phases to execute
    if (!progress.phases || progress.phases.length === 0) {
      // No phases - complete immediately
      state = {
        status: 'completed',
        completedAt: new Date().toISOString(),
        elapsed: '0s',
      };
      updateProgressFromState(progress, state);
      await writeProgressAtomic(progressPath, progress);
      return {
        finalState: state,
        iterations: 0,
        elapsedMs: Date.now() - startTime,
      };
    }

    // Transition to in-progress
    const result = transition(state, { type: 'START' }, progress);
    state = result.nextState;
    updateProgressFromState(progress, state);
    await writeProgressAtomic(progressPath, progress);
  }

  // 5. Main loop
  while (!isTerminalState(state) && state.status === 'in-progress') {
    // Check max iterations
    if (maxIterations > 0 && iterations >= maxIterations) {
      const result = transition(state, { type: 'MAX_ITERATIONS_REACHED' }, progress);
      state = result.nextState;
      updateProgressFromState(progress, state);
      await writeProgressAtomic(progressPath, progress);
      break;
    }

    // Check pause signal
    if (checkPauseSignal(sprintDir)) {
      const result = transition(state, { type: 'PAUSE', reason: 'PAUSE file detected' }, progress);
      state = result.nextState;
      updateProgressFromState(progress, state);
      await writeProgressAtomic(progressPath, progress);
      break;
    }

    iterations++;

    if (verbose) {
      console.log(`[loop] Iteration ${iterations}: executing phase`);
    }

    // Transaction: backup before Claude execution
    backupProgress(progressPath);

    // Get the current phase/step/sub-phase
    const currentPhase = progress.phases?.[progress.current.phase];
    const currentStep = currentPhase?.steps?.[progress.current.step ?? -1];
    const currentSubPhase = currentStep?.phases?.[progress.current['sub-phase'] ?? -1];

    const prompt = currentSubPhase?.prompt ?? currentStep?.prompt ?? currentPhase?.prompt ?? '';
    const phaseId = currentSubPhase?.id ?? currentStep?.id ?? currentPhase?.id ?? '';

    // Execute SPAWN_CLAUDE action directly
    const spawnResult = await deps.runClaude({
      prompt,
      cwd: sprintDir,
    });

    // Process result
    let event: SprintEvent;
    if (spawnResult?.success) {
      const jsonResult = spawnResult.jsonResult as {
        status?: string;
        summary?: string;
        humanNeeded?: { reason?: string; details?: string };
      } | undefined;

      if (jsonResult?.status === 'needs-human') {
        event = {
          type: 'HUMAN_NEEDED',
          reason: jsonResult.humanNeeded?.reason ?? 'Human intervention required',
          details: jsonResult.humanNeeded?.details,
        };
      } else {
        const summary = jsonResult?.summary ?? 'Phase completed';
        event = { type: 'PHASE_COMPLETE', summary, phaseId };
      }
    } else {
      event = {
        type: 'PHASE_FAILED',
        error: spawnResult?.error ?? 'Unknown error',
        category: 'logic',
        phaseId,
      };
    }

    // Process event through transition
    const result = transition(state, event, progress);
    state = result.nextState;
    updateProgressFromState(progress, state);

    // Execute any resulting actions (excluding SPAWN_CLAUDE since we already did it)
    const nonSpawnActions = result.actions.filter(a => a.type !== 'SPAWN_CLAUDE');
    await executeActions(nonSpawnActions, context, deps);

    // Commit transaction
    await writeProgressAtomic(progressPath, progress);
    cleanupBackup(progressPath);

    if (verbose) {
      console.log(`[loop] Iteration ${iterations}: ${state.status}`);
    }

    // Delay between iterations (only if not terminal and will continue)
    if (delay > 0 && !isTerminalState(state)) {
      await sleep(delay);
    }
  }

  return {
    finalState: state,
    iterations,
    elapsedMs: Date.now() - startTime,
  };
}
