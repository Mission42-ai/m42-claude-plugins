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
  calculateChecksum,
  CompiledProgress as YamlOpsProgress,
} from './yaml-ops.js';

import * as yaml from 'js-yaml';

// Import from executor module
import {
  ExecutorContext,
  executeActions,
} from './executor.js';

// Import from claude-runner module
import { runClaude as defaultRunClaude, SPRINT_RESULT_SCHEMA } from './claude-runner.js';
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

const TERMINAL_STATES = ['completed', 'blocked', 'paused', 'needs-human', 'interrupted'] as const;
const PAUSE_FILENAME = 'PAUSE';
const PROGRESS_FILENAME = 'PROGRESS.yaml';

/** Flag to track if signal handlers have been set up */
let signalHandlersSetup = false;

/** Reference to current progress for signal handlers */
let currentProgressRef: { progress: CompiledProgress; progressPath: string } | null = null;

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
 * Write last-activity heartbeat timestamp to progress
 */
function writeHeartbeat(progress: CompiledProgress): void {
  (progress as unknown as { 'last-activity': string })['last-activity'] = new Date().toISOString();
}

/**
 * Mark sprint as interrupted and write to disk
 */
async function markAsInterrupted(signal: string): Promise<void> {
  if (!currentProgressRef) return;

  const { progress, progressPath } = currentProgressRef;
  progress.status = 'interrupted' as CompiledProgress['status'];
  (progress as unknown as { 'interrupted-at': string })['interrupted-at'] = new Date().toISOString();
  (progress as unknown as { 'interrupted-signal': string })['interrupted-signal'] = signal;

  // Write synchronously since we're exiting
  const content = yaml.dump(progress, { lineWidth: -1, noRefs: true, quotingType: '"' });
  fs.writeFileSync(progressPath, content, 'utf-8');
}

/**
 * Set up signal handlers for graceful shutdown
 */
function setupSignalHandlers(): void {
  if (signalHandlersSetup) return;
  signalHandlersSetup = true;

  const handler = async (signal: string): Promise<void> => {
    console.log(`\n[loop] Received ${signal}, marking sprint as interrupted...`);
    await markAsInterrupted(signal);
    process.exit(0);
  };

  process.on('SIGTERM', () => handler('SIGTERM'));
  process.on('SIGINT', () => handler('SIGINT'));
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
      // Mark non-skipped phases as completed (BUG-002 FIX: preserve skipped status)
      if (progress.phases) {
        for (const phase of progress.phases) {
          if (phase.status !== 'skipped') {
            phase.status = 'completed';
          }
        }
      }
      break;
  }
}

/**
 * Merge external status changes into a single item (phase, step, or sub-phase).
 * Preserves 'skipped' status and retry-count from external writes.
 */
function mergeItemChanges(
  localItem: { id?: string; status?: string; 'retry-count'?: number },
  diskItem: { id?: string; status?: string; 'retry-count'?: number }
): void {
  // Preserve 'skipped' status from external writes (e.g., /api/skip)
  if (diskItem?.status === 'skipped' && localItem?.status !== 'completed') {
    localItem.status = 'skipped';
  }

  // Preserve retry-count from external writes (e.g., /api/retry)
  if (diskItem?.['retry-count'] !== undefined) {
    localItem['retry-count'] = diskItem['retry-count'];
    // If retry was requested and phase was failed/blocked, reset to pending
    if (diskItem.status === 'pending' && (localItem.status === 'failed' || localItem.status === 'blocked')) {
      localItem.status = 'pending';
    }
  }
}

/**
 * Merge external changes into the in-memory progress.
 * Called when file has been modified by an external process during Claude execution.
 *
 * This preserves phase-level status changes (like 'skipped' from /api/skip)
 * that may have been made by the status server. Handles the full hierarchy:
 * phases → steps → sub-phases.
 */
function mergeExternalChanges(
  localProgress: CompiledProgress,
  diskProgress: CompiledProgress
): void {
  if (!localProgress.phases || !diskProgress.phases) return;

  // Iterate through top-level phases
  for (let i = 0; i < localProgress.phases.length && i < diskProgress.phases.length; i++) {
    const localPhase = localProgress.phases[i] as {
      id?: string;
      status?: string;
      'retry-count'?: number;
      steps?: Array<{ id?: string; status?: string; 'retry-count'?: number; phases?: Array<{ id?: string; status?: string; 'retry-count'?: number }> }>;
    };
    const diskPhase = diskProgress.phases[i] as typeof localPhase;

    // Only merge if IDs match (sanity check)
    if (localPhase?.id !== diskPhase?.id) continue;

    // Merge phase-level changes
    mergeItemChanges(localPhase, diskPhase);

    // Merge step-level changes
    if (localPhase.steps && diskPhase.steps) {
      for (let j = 0; j < localPhase.steps.length && j < diskPhase.steps.length; j++) {
        const localStep = localPhase.steps[j];
        const diskStep = diskPhase.steps[j];

        if (localStep?.id !== diskStep?.id) continue;

        mergeItemChanges(localStep, diskStep);

        // Merge sub-phase-level changes
        if (localStep.phases && diskStep.phases) {
          for (let k = 0; k < localStep.phases.length && k < diskStep.phases.length; k++) {
            const localSubPhase = localStep.phases[k];
            const diskSubPhase = diskStep.phases[k];

            if (localSubPhase?.id !== diskSubPhase?.id) continue;

            mergeItemChanges(localSubPhase, diskSubPhase);
          }
        }
      }
    }
  }
}

/**
 * Get the checksum of a file's current content.
 */
function getFileChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf8');
  return calculateChecksum(content);
}

/**
 * Read progress from file without checksum validation.
 * Used for merging external changes where checksum may be out of sync.
 * BUG-002 FIX: External processes may write without updating checksum.
 */
function readProgressWithoutChecksumValidation(filePath: string): CompiledProgress {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content) as unknown as CompiledProgress;
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

  // Set up signal handlers for graceful shutdown
  setupSignalHandlers();
  currentProgressRef = { progress, progressPath };

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

    // Write last-activity heartbeat timestamp
    writeHeartbeat(progress);
    await writeProgressAtomic(progressPath, progress);

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

    // Create transcriptions directory for full NDJSON transcripts
    const transcriptionsDir = path.join(sprintDir, 'transcriptions');
    if (!fs.existsSync(transcriptionsDir)) {
      fs.mkdirSync(transcriptionsDir, { recursive: true });
    }

    // Generate unique log file path including phase/step/sub-phase indices
    // Format: phase-{N}_step-{M}_subphase-{K}_{id}.log or phase-{N}_{id}.log
    const phaseIdx = progress.current.phase;
    const stepIdx = progress.current.step;
    const subPhaseIdx = progress.current['sub-phase'];

    let logBaseName: string;
    if (stepIdx != null && stepIdx >= 0 && subPhaseIdx != null && subPhaseIdx >= 0) {
      // Full hierarchy: phase + step + sub-phase
      const sanitizedId = phaseId.replace(/[^a-zA-Z0-9-_]/g, '_') || 'subphase';
      logBaseName = `phase-${phaseIdx}_step-${stepIdx}_${sanitizedId}`;
    } else if (stepIdx != null && stepIdx >= 0) {
      // Phase + step (no sub-phase)
      const sanitizedId = (currentStep?.id || phaseId).replace(/[^a-zA-Z0-9-_]/g, '_') || 'step';
      logBaseName = `phase-${phaseIdx}_step-${stepIdx}_${sanitizedId}`;
    } else {
      // Just phase (no steps)
      const sanitizedId = phaseId.replace(/[^a-zA-Z0-9-_]/g, '_') || 'phase';
      logBaseName = `phase-${phaseIdx}_${sanitizedId}`;
    }
    const logFileName = `${logBaseName}.log`;
    const outputFile = path.join(transcriptionsDir, logFileName);

    // BUG-001 FIX: Mark current step/sub-phase as in-progress before execution
    if (currentPhase) {
      currentPhase.status = 'in-progress';
      if (!currentPhase['started-at']) {
        currentPhase['started-at'] = new Date().toISOString();
      }
    }
    if (currentStep) {
      currentStep.status = 'in-progress';
      if (!currentStep['started-at']) {
        currentStep['started-at'] = new Date().toISOString();
      }
    }
    if (currentSubPhase) {
      currentSubPhase.status = 'in-progress';
      if (!currentSubPhase['started-at']) {
        currentSubPhase['started-at'] = new Date().toISOString();
      }
    }

    // BUG-001 FIX: Write progress to disk so status server can see in-progress status
    await writeProgressAtomic(progressPath, progress);

    // BUG-002 FIX: Update checksum after our write, so compare-and-swap only detects external changes
    const preClaudeChecksum = getFileChecksum(progressPath);

    // Execute SPAWN_CLAUDE action directly
    // Use --json-schema to enforce validated structured output
    const spawnResult = await deps.runClaude({
      prompt,
      cwd: sprintDir,
      outputFile,
      jsonSchema: SPRINT_RESULT_SCHEMA,
    });

    // BUG-002 FIX: Compare-and-swap - check if file was modified during execution
    const postExecChecksum = getFileChecksum(progressPath);
    if (postExecChecksum !== preClaudeChecksum) {
      // File was modified externally (e.g., by status server /api/skip or /api/retry)
      // Read the current disk state and merge external changes into our progress
      // Use readProgressWithoutChecksumValidation because external writers may not update checksum
      const diskProgress = readProgressWithoutChecksumValidation(progressPath);
      mergeExternalChanges(progress, diskProgress);

      if (verbose) {
        console.log('[loop] Detected external modification to PROGRESS.yaml, merged changes');
      }
    }

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

        // BUG-001 FIX: Mark current step/sub-phase as completed
        const completedAt = new Date().toISOString();
        if (currentSubPhase) {
          currentSubPhase.status = 'completed';
          currentSubPhase['completed-at'] = completedAt;
        }
        // Mark step completed only if all its sub-phases are completed
        if (currentStep) {
          const allSubPhasesComplete = currentStep.phases.every(
            (p) => p.status === 'completed' || p.status === 'skipped'
          );
          if (allSubPhasesComplete || currentStep.phases.length === 0) {
            currentStep.status = 'completed';
            currentStep['completed-at'] = completedAt;
          }
        }
        // Mark phase completed only if all its steps (or direct execution) are completed
        if (currentPhase) {
          // For phases with steps, check if all steps are completed
          if (currentPhase.steps && currentPhase.steps.length > 0) {
            const allStepsComplete = currentPhase.steps.every(
              (s) => s.status === 'completed' || s.status === 'skipped'
            );
            if (allStepsComplete) {
              currentPhase.status = 'completed';
              currentPhase['completed-at'] = completedAt;
            }
          } else if (!currentStep && !currentSubPhase) {
            // Phase has no steps (direct execution) - mark completed
            currentPhase.status = 'completed';
            currentPhase['completed-at'] = completedAt;
          }
        }
      }
    } else {
      event = {
        type: 'PHASE_FAILED',
        error: spawnResult?.error ?? 'Unknown error',
        category: 'logic',
        phaseId,
      };

      // BUG-001 FIX: Mark current step/sub-phase as failed
      if (currentSubPhase) {
        currentSubPhase.status = 'failed';
        currentSubPhase.error = spawnResult?.error ?? 'Unknown error';
      }
      if (currentStep) {
        currentStep.status = 'failed';
        currentStep.error = spawnResult?.error ?? 'Unknown error';
      }
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
