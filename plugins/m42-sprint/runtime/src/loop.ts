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
  CompiledGate,
  GateTracking,
  GateStatus,
  transition,
} from './transition.js';

import { spawn } from 'child_process';

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

// Import from worktree module
import { getProjectRoot, getWorktreeInfo } from './worktree.js';

// Import from operator module
import {
  processOperatorRequests,
  executeOperatorDecision,
  type OperatorRequest,
  type QueuedRequest,
  type OperatorConfig,
} from './operator.js';

// Import from scheduler module for parallel execution
import {
  StepScheduler,
  type ReadyStep,
  type ParallelExecutionConfig,
} from './scheduler.js';

// ============================================================================
// Per-Iteration Hook Types (defined locally to avoid cross-project imports)
// ============================================================================

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

const TERMINAL_STATES = ['completed', 'blocked', 'paused', 'paused-at-breakpoint', 'needs-human', 'interrupted'] as const;
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

    case 'paused-at-breakpoint':
      return {
        status: 'paused-at-breakpoint',
        pausedAt: progress.current,
        breakpointPhaseId: (progress as unknown as { 'breakpoint-phase-id'?: string })['breakpoint-phase-id'] ?? '',
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

    case 'paused-at-breakpoint':
      progress.current = state.pausedAt;
      (progress as unknown as { 'breakpoint-phase-id': string })['breakpoint-phase-id'] = state.breakpointPhaseId;
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

// ============================================================================
// Parallel Execution Helper Functions
// ============================================================================

/**
 * Check if parallel execution is enabled and applicable for the current phase.
 *
 * Parallel execution is used when:
 * 1. parallel-execution.enabled is true in PROGRESS.yaml
 * 2. The current phase has a dependency-graph
 * 3. The current phase has steps (for-each phase)
 *
 * @param progress - The compiled progress
 * @returns True if parallel execution should be used
 */
function shouldUseParallelExecution(progress: CompiledProgress): boolean {
  const parallelConfig = (progress as unknown as { 'parallel-execution'?: ParallelExecutionConfig })['parallel-execution'];

  // Check if parallel execution is enabled
  if (!parallelConfig?.enabled) {
    return false;
  }

  // Check if there's a dependency graph
  const dependencyGraph = (progress as unknown as { 'dependency-graph'?: unknown[] })['dependency-graph'];
  if (!dependencyGraph || dependencyGraph.length === 0) {
    return false;
  }

  // Check if the current phase has steps (for-each phase)
  const currentPhase = progress.phases?.[progress.current.phase];
  if (!currentPhase?.steps || currentPhase.steps.length === 0) {
    return false;
  }

  return true;
}

/**
 * Get the parallel execution configuration from progress.
 *
 * @param progress - The compiled progress
 * @returns Parallel execution config or default values
 */
function getParallelConfig(progress: CompiledProgress): ParallelExecutionConfig {
  const config = (progress as unknown as { 'parallel-execution'?: ParallelExecutionConfig })['parallel-execution'];

  return {
    enabled: config?.enabled ?? false,
    maxConcurrency: config?.maxConcurrency ?? 0, // 0 = unlimited
    onDependencyFailure: config?.onDependencyFailure ?? 'skip-dependents',
  };
}

/**
 * Result of executing a single step in parallel mode
 */
interface ParallelStepResult {
  /** The step ID */
  stepId: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Summary if successful */
  summary?: string;
  /** Error message if failed */
  error?: string;
  /** Whether human intervention is needed */
  needsHuman?: {
    reason: string;
    details?: string;
  };
  /** Operator requests from the step */
  operatorRequests?: OperatorRequest[];
}

// ============================================================================
// Quality Gate Check Functions
// ============================================================================

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
export async function runGateScript(
  gate: CompiledGate,
  sprintDir: string,
  phaseId: string,
  attemptNumber: number
): Promise<GateResult> {
  return new Promise((resolve) => {
    const timeoutMs = gate.timeout * 1000;
    let output = '';
    let timedOut = false;

    // Get sprint-id from directory name
    const sprintId = path.basename(sprintDir);

    // Spawn shell to run the script
    const child = spawn('sh', ['-c', gate.script], {
      cwd: sprintDir,
      env: {
        ...process.env,
        SPRINT_ID: sprintId,
        PHASE_ID: phaseId,
        ATTEMPT_NUMBER: String(attemptNumber),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Capture stdout
    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    // Capture stderr
    child.stderr.on('data', (data: Buffer) => {
      output += data.toString();
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        resolve({
          passed: false,
          exitCode: -1,
          output,
          error: `Gate script timed out after ${gate.timeout} seconds`,
        });
        return;
      }

      const exitCode = code ?? 1;
      resolve({
        passed: exitCode === 0,
        exitCode,
        output,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        passed: false,
        exitCode: -1,
        output,
        error: `Failed to execute gate script: ${err.message}`,
      });
    });
  });
}

/**
 * Initialize or update gate tracking state
 *
 * @param tracking - Existing tracking state (or undefined)
 * @param status - New status to set
 * @param result - Gate result to store (optional)
 * @returns Updated gate tracking state
 */
function updateGateTracking(
  tracking: GateTracking | undefined,
  status: GateStatus,
  result?: GateResult
): GateTracking {
  const current = tracking ?? { attempts: 0, status: 'pending' as GateStatus };

  return {
    ...current,
    status,
    ...(result && {
      'last-output': result.output.slice(0, 10000), // Cap output at 10KB
      'last-exit-code': result.exitCode,
      ...(result.error && { error: result.error }),
    }),
  };
}

/**
 * Build the fix prompt for a failed gate check
 *
 * @param gate - Gate configuration
 * @param tracking - Current gate tracking state
 * @returns Prompt string with context for fixing the failure
 */
function buildGateFixPrompt(gate: CompiledGate, tracking: GateTracking): string {
  let prompt = gate['on-fail-prompt'];

  // Append the script output as context
  if (tracking['last-output']) {
    prompt += `\n\n## Gate Check Output (Exit Code: ${tracking['last-exit-code']})\n\`\`\`\n${tracking['last-output']}\n\`\`\``;
  }

  return prompt;
}

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
export async function executeGateCheck(
  gate: CompiledGate,
  tracking: GateTracking | undefined,
  sprintDir: string,
  phaseId: string,
  workingDir: string,
  deps: LoopDependencies,
  verbose: boolean,
  progressPath: string,
  progress: CompiledProgress,
  outputDir: string,
  model?: string
): Promise<GateTracking> {
  let currentTracking = tracking ?? { attempts: 0, status: 'pending' as GateStatus };

  while (true) {
    currentTracking.attempts++;
    currentTracking.status = 'running';

    if (verbose) {
      console.log(`[loop] Running gate check for phase '${phaseId}', attempt ${currentTracking.attempts}/${gate['max-retries']}`);
    }

    // Run the gate script
    const result = await runGateScript(gate, workingDir, phaseId, currentTracking.attempts);

    if (result.passed) {
      if (verbose) {
        console.log(`[loop] Gate check passed for phase '${phaseId}'`);
      }
      return updateGateTracking(currentTracking, 'passed', result);
    }

    // Gate failed
    currentTracking = updateGateTracking(currentTracking, 'retrying', result);

    if (verbose) {
      console.log(`[loop] Gate check failed for phase '${phaseId}' (exit code ${result.exitCode})`);
    }

    // Check if we've exceeded max retries
    if (currentTracking.attempts >= gate['max-retries']) {
      if (verbose) {
        console.log(`[loop] Gate check blocked for phase '${phaseId}' after ${currentTracking.attempts} attempts`);
      }
      return updateGateTracking(currentTracking, 'blocked', result);
    }

    // Run fix iteration with Claude
    const fixPrompt = buildGateFixPrompt(gate, currentTracking);
    const logFileName = `gate-fix_${phaseId}_attempt-${currentTracking.attempts}.log`;
    const outputFile = path.join(outputDir, logFileName);

    if (verbose) {
      console.log(`[loop] Running fix iteration for phase '${phaseId}'`);
    }

    const fixResult = await deps.runClaude({
      prompt: fixPrompt,
      cwd: workingDir,
      outputFile,
      jsonSchema: SPRINT_RESULT_SCHEMA,
      model,
    });

    if (!fixResult?.success) {
      // Fix iteration failed, continue to next retry
      if (verbose) {
        console.log(`[loop] Fix iteration failed for phase '${phaseId}': ${fixResult?.error}`);
      }
    }

    // Save progress after each fix iteration
    await writeProgressAtomic(progressPath, progress);
  }
}

// ============================================================================
// Operator Request Handling
// ============================================================================

/**
 * Progress with operator queue extension
 */
type ProgressWithOperatorQueue = CompiledProgress & {
  'operator-queue'?: QueuedRequest[];
};

/**
 * Queue operator requests from Claude result into PROGRESS.yaml
 *
 * @param progress - Progress object to update
 * @param requests - Operator requests from Claude
 * @param phaseId - Current phase ID where requests were discovered
 */
function queueOperatorRequests(
  progress: ProgressWithOperatorQueue,
  requests: OperatorRequest[],
  phaseId: string
): void {
  if (!requests || requests.length === 0) {
    return;
  }

  // Initialize operator-queue if not exists
  if (!progress['operator-queue']) {
    progress['operator-queue'] = [];
  }

  const createdAt = new Date().toISOString();

  for (const request of requests) {
    const queuedRequest: QueuedRequest = {
      ...request,
      status: 'pending',
      'created-at': createdAt,
      'discovered-in': phaseId,
    };
    progress['operator-queue'].push(queuedRequest);
  }
}

/**
 * Check if there are critical priority requests that need immediate processing
 *
 * @param requests - Operator requests to check
 * @returns True if any request has critical priority
 */
function hasCriticalRequests(requests: OperatorRequest[]): boolean {
  return requests.some((r) => r.priority === 'critical');
}

/**
 * Trigger operator processing for pending requests
 *
 * @param progress - Progress object with operator queue
 * @param sprintDir - Sprint directory path
 * @param verbose - Enable verbose logging
 */
async function triggerOperator(
  progress: ProgressWithOperatorQueue,
  sprintDir: string,
  verbose: boolean
): Promise<void> {
  const queue = progress['operator-queue'];
  if (!queue || queue.length === 0) {
    return;
  }

  // Get pending requests
  const pendingRequests = queue.filter((r) => r.status === 'pending');
  if (pendingRequests.length === 0) {
    return;
  }

  if (verbose) {
    console.log(`[loop] Triggering operator for ${pendingRequests.length} pending requests`);
  }

  // Default operator config
  const operatorConfig: OperatorConfig = {
    enabled: true,
  };

  // Process requests
  const response = await processOperatorRequests(pendingRequests, operatorConfig, sprintDir);

  // Execute each decision
  for (const decision of response.decisions) {
    const request = queue.find((r) => r.id === decision.requestId);
    if (request) {
      await executeOperatorDecision(decision, request, sprintDir);
    }
  }

  if (verbose) {
    console.log(`[loop] Operator processed ${response.decisions.length} requests: ${response.operatorLog}`);
  }
}

// ============================================================================
// Per-Iteration Hook Execution
// ============================================================================

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
export function replaceHookTemplateVars(prompt: string, vars: HookTemplateVars): string {
  return prompt
    .replace(/\$ITERATION_TRANSCRIPT/g, vars.ITERATION_TRANSCRIPT)
    .replace(/\$SPRINT_ID/g, vars.SPRINT_ID)
    .replace(/\$ITERATION/g, String(vars.ITERATION))
    .replace(/\$PHASE_ID/g, vars.PHASE_ID);
}

/**
 * Create a HookTask entry for tracking hook execution
 *
 * @param hookId - The hook identifier
 * @param iteration - Current iteration number
 * @returns Initial HookTask entry
 */
function createHookTask(hookId: string, iteration: number): HookTask {
  return {
    iteration,
    'hook-id': hookId,
    status: 'running',
    'spawned-at': new Date().toISOString(),
  };
}

/**
 * Execute a single per-iteration hook.
 *
 * @param hook - Hook configuration
 * @param vars - Template variables for prompt substitution
 * @param workingDir - Working directory for Claude execution
 * @param outputDir - Directory for transcript output
 * @param deps - Loop dependencies (runClaude function)
 * @param verbose - Enable verbose logging
 * @returns Promise resolving to partial HookTask with completion info
 */
async function executeHook(
  hook: PerIterationHook,
  vars: HookTemplateVars,
  workingDir: string,
  outputDir: string,
  deps: LoopDependencies,
  verbose: boolean
): Promise<Partial<HookTask>> {
  const prompt = hook.prompt ?? '';
  const resolvedPrompt = replaceHookTemplateVars(prompt, vars);

  const logFileName = `hook_${hook.id}_iteration-${vars.ITERATION}.log`;
  const outputFile = path.join(outputDir, logFileName);

  if (verbose) {
    console.log(`[loop] Executing hook '${hook.id}' for iteration ${vars.ITERATION}`);
  }

  try {
    const result = await deps.runClaude({
      prompt: resolvedPrompt,
      cwd: workingDir,
      outputFile,
    });

    return {
      status: result.success ? 'completed' : 'failed',
      'completed-at': new Date().toISOString(),
      'exit-code': result.exitCode,
      transcript: outputFile,
    };
  } catch (err) {
    return {
      status: 'failed',
      'completed-at': new Date().toISOString(),
      'exit-code': 1,
    };
  }
}

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
export async function executePerIterationHooks(
  progress: ProgressWithHooks,
  iteration: number,
  transcriptPath: string,
  phaseId: string,
  sprintDir: string,
  workingDir: string,
  deps: LoopDependencies,
  verbose: boolean
): Promise<void> {
  const hooks = progress['per-iteration-hooks'];
  if (!hooks || hooks.length === 0) {
    return;
  }

  // Filter to enabled hooks only
  const enabledHooks = hooks.filter((h) => h.enabled);
  if (enabledHooks.length === 0) {
    return;
  }

  if (verbose) {
    console.log(`[loop] Executing ${enabledHooks.length} per-iteration hooks for iteration ${iteration}`);
  }

  // Initialize hook-tasks array if not present
  if (!progress['hook-tasks']) {
    progress['hook-tasks'] = [];
  }

  // Create transcriptions directory for hook transcripts
  const transcriptionsDir = path.join(sprintDir, 'transcriptions');
  if (!fs.existsSync(transcriptionsDir)) {
    fs.mkdirSync(transcriptionsDir, { recursive: true });
  }

  // Template variables for all hooks
  const vars: HookTemplateVars = {
    ITERATION_TRANSCRIPT: transcriptPath,
    SPRINT_ID: progress['sprint-id'],
    ITERATION: iteration,
    PHASE_ID: phaseId,
  };

  // Separate parallel and sequential hooks
  const parallelHooks = enabledHooks.filter((h) => h.parallel);
  const sequentialHooks = enabledHooks.filter((h) => !h.parallel);

  // Execute sequential hooks first (blocking)
  for (const hook of sequentialHooks) {
    if (!hook.prompt && !hook.workflow) {
      if (verbose) {
        console.log(`[loop] Skipping hook '${hook.id}' - no prompt or workflow defined`);
      }
      continue;
    }

    // Create task entry
    const task = createHookTask(hook.id, iteration);
    progress['hook-tasks'].push(task);

    // Execute and update task
    const result = await executeHook(hook, vars, workingDir, transcriptionsDir, deps, verbose);
    Object.assign(task, result);

    if (verbose) {
      console.log(`[loop] Hook '${hook.id}' completed with status: ${task.status}`);
    }
  }

  // Execute parallel hooks (non-blocking)
  // Note: In the TypeScript implementation, we spawn them but don't await completion
  // This allows the main loop to continue to the next iteration
  const parallelPromises: Promise<void>[] = [];

  for (const hook of parallelHooks) {
    if (!hook.prompt && !hook.workflow) {
      if (verbose) {
        console.log(`[loop] Skipping hook '${hook.id}' - no prompt or workflow defined`);
      }
      continue;
    }

    // Create task entry
    const task = createHookTask(hook.id, iteration);
    progress['hook-tasks'].push(task);

    // Execute in background (don't await)
    const hookPromise = executeHook(hook, vars, workingDir, transcriptionsDir, deps, verbose)
      .then((result) => {
        Object.assign(task, result);
        if (verbose) {
          console.log(`[loop] Parallel hook '${hook.id}' completed with status: ${task.status}`);
        }
      })
      .catch((err) => {
        task.status = 'failed';
        task['completed-at'] = new Date().toISOString();
        if (verbose) {
          console.log(`[loop] Parallel hook '${hook.id}' failed: ${err}`);
        }
      });

    parallelPromises.push(hookPromise);
  }

  // For parallel hooks, we don't wait - they run in background
  // The tasks are already tracked in hook-tasks with 'running' status
  // They'll be updated when they complete

  if (verbose && parallelPromises.length > 0) {
    console.log(`[loop] Spawned ${parallelPromises.length} parallel hooks in background`);
  }
}

// ============================================================================
// Parallel Execution Loop
// ============================================================================

/**
 * Execute a single step and return the result.
 *
 * This is a standalone function that handles executing one step with all
 * the necessary Claude invocation, result processing, and status updates.
 *
 * @param step - The ready step to execute
 * @param progress - Progress state
 * @param sprintDir - Sprint directory path
 * @param workingDir - Working directory for Claude
 * @param deps - Dependencies (runClaude)
 * @param verbose - Enable verbose logging
 * @returns Promise resolving to the step result
 */
async function executeParallelStep(
  step: ReadyStep,
  progress: CompiledProgress,
  sprintDir: string,
  workingDir: string,
  deps: LoopDependencies,
  verbose: boolean
): Promise<ParallelStepResult> {
  const phase = progress.phases?.[step.stepIndex === -1 ? progress.current.phase : progress.current.phase];
  const currentStep = phase?.steps?.[step.stepIndex];

  if (!currentStep) {
    return {
      stepId: step.id,
      success: false,
      error: `Step not found: ${step.id}`,
    };
  }

  // Get the first sub-phase prompt, or step prompt if no sub-phases
  const subPhase = currentStep.phases?.[0];
  const prompt = subPhase?.prompt ?? currentStep.prompt;
  const phaseId = subPhase?.id ?? currentStep.id;

  // Get model from current execution context
  const currentModel = (subPhase as { model?: string } | undefined)?.model
    ?? (currentStep as { model?: string } | undefined)?.model
    ?? (phase as { model?: string } | undefined)?.model;

  // Create transcriptions directory
  const transcriptionsDir = path.join(sprintDir, 'transcriptions');
  if (!fs.existsSync(transcriptionsDir)) {
    fs.mkdirSync(transcriptionsDir, { recursive: true });
  }

  // Generate log file path
  const phaseIdx = progress.current.phase;
  const sanitizedId = step.id.replace(/[^a-zA-Z0-9-_]/g, '_');
  const logFileName = `phase-${phaseIdx}_step-${step.stepIndex}_${sanitizedId}.log`;
  const outputFile = path.join(transcriptionsDir, logFileName);

  // Mark step as in-progress
  currentStep.status = 'in-progress';
  if (!currentStep['started-at']) {
    currentStep['started-at'] = new Date().toISOString();
  }

  if (verbose) {
    console.log(`[parallel] Starting step '${step.id}'`);
  }

  // Execute Claude
  const spawnResult = await deps.runClaude({
    prompt,
    cwd: workingDir,
    outputFile,
    jsonSchema: SPRINT_RESULT_SCHEMA,
    model: currentModel,
  });

  // Process result
  if (spawnResult?.success) {
    const jsonResult = spawnResult.jsonResult as {
      status?: string;
      summary?: string;
      humanNeeded?: { reason?: string; details?: string };
      operatorRequests?: OperatorRequest[];
    } | undefined;

    if (jsonResult?.status === 'needs-human') {
      return {
        stepId: step.id,
        success: false,
        needsHuman: {
          reason: jsonResult.humanNeeded?.reason ?? 'Human intervention required',
          details: jsonResult.humanNeeded?.details,
        },
      };
    }

    // Mark step as completed
    const completedAt = new Date().toISOString();
    currentStep.status = 'completed';
    currentStep['completed-at'] = completedAt;

    // Mark sub-phases as completed too
    if (currentStep.phases) {
      for (const sp of currentStep.phases) {
        sp.status = 'completed';
        (sp as { 'completed-at'?: string })['completed-at'] = completedAt;
      }
    }

    if (verbose) {
      console.log(`[parallel] Step '${step.id}' completed successfully`);
    }

    return {
      stepId: step.id,
      success: true,
      summary: jsonResult?.summary ?? 'Step completed',
      operatorRequests: jsonResult?.operatorRequests,
    };
  } else {
    // Mark step as failed
    currentStep.status = 'failed';
    currentStep.error = spawnResult?.error ?? 'Unknown error';

    if (verbose) {
      console.log(`[parallel] Step '${step.id}' failed: ${currentStep.error}`);
    }

    return {
      stepId: step.id,
      success: false,
      error: spawnResult?.error ?? 'Unknown error',
    };
  }
}

/**
 * Run the parallel execution loop for a for-each phase.
 *
 * This function handles parallel step execution using the StepScheduler:
 * 1. Creates a scheduler from the dependency graph
 * 2. Gets ready steps (all dependencies satisfied)
 * 3. Executes ready steps concurrently (up to max-concurrent)
 * 4. Handles completion/failure and updates scheduler
 * 5. Continues until all steps are done or blocked
 *
 * @param progress - The compiled progress
 * @param sprintDir - Sprint directory path
 * @param progressPath - Path to PROGRESS.yaml
 * @param deps - Dependencies (runClaude)
 * @param verbose - Enable verbose logging
 * @returns Promise resolving when phase is complete or blocked
 */
async function runParallelPhaseLoop(
  progress: CompiledProgress,
  sprintDir: string,
  progressPath: string,
  deps: LoopDependencies,
  verbose: boolean
): Promise<{
  completed: boolean;
  error?: string;
  needsHuman?: { reason: string; details?: string };
}> {
  const parallelConfig = getParallelConfig(progress);

  // Create scheduler from dependency graph
  // The scheduler has its own CompiledProgress type that's structurally compatible
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheduler = new StepScheduler(progress as any, parallelConfig);

  // Determine working directory
  let workingDir: string;
  if (progress.worktree?.enabled && progress.worktree?.path) {
    const worktreeInfo = getWorktreeInfo(sprintDir);
    workingDir = path.resolve(worktreeInfo.mainWorktreePath, progress.worktree.path);
  } else {
    workingDir = getProjectRoot(sprintDir);
  }

  if (verbose) {
    const summary = scheduler.getStatusSummary();
    console.log(`[parallel] Starting parallel execution: ${summary.pending + summary.ready} steps to process`);
  }

  // Main parallel execution loop
  while (!scheduler.isComplete()) {
    // Check for pause signal
    if (checkPauseSignal(sprintDir)) {
      if (verbose) {
        console.log('[parallel] PAUSE signal detected');
      }
      return { completed: false, error: 'Paused by user request' };
    }

    // Get ready steps
    const readySteps = scheduler.getReadySteps();

    if (readySteps.length === 0) {
      // No steps ready and not complete - we're blocked
      if (!scheduler.isComplete()) {
        const summary = scheduler.getStatusSummary();
        if (summary.running === 0 && summary.pending > 0) {
          // Deadlock - pending steps but none ready and none running
          return {
            completed: false,
            error: 'Deadlock detected: pending steps but none ready to execute',
          };
        }
        // Steps are still running, wait a bit
        await sleep(100);
        continue;
      }
      break;
    }

    if (verbose) {
      console.log(`[parallel] ${readySteps.length} steps ready to execute`);
    }

    // Check for pending step injections from the step-queue
    // and inject them into the scheduler
    const stepQueue = (progress as unknown as { 'step-queue'?: Array<{
      id: string;
      prompt: string;
      dependsOn?: string[];
      status?: string;
    }> })['step-queue'];

    if (stepQueue && stepQueue.length > 0) {
      const pendingInjections = stepQueue.filter(s => s.status !== 'injected');
      for (const queuedStep of pendingInjections) {
        const phaseId = progress.phases?.[progress.current.phase]?.id ?? '';
        const result = scheduler.injectStep(
          { id: queuedStep.id, prompt: queuedStep.prompt },
          phaseId,
          queuedStep.dependsOn
        );

        if (result.success) {
          queuedStep.status = 'injected';
          if (verbose) {
            console.log(`[parallel] Injected step '${queuedStep.id}' with dependencies: ${queuedStep.dependsOn?.join(', ') ?? 'none'}`);
          }
        } else if (verbose) {
          console.log(`[parallel] Failed to inject step '${queuedStep.id}': ${result.error}`);
        }
      }
    }

    // Mark all ready steps as started in the scheduler
    for (const step of readySteps) {
      scheduler.startStep(step.id);
    }

    // Write progress before execution (backup)
    backupProgress(progressPath);
    await writeProgressAtomic(progressPath, progress);

    // Execute ready steps in parallel
    const stepPromises = readySteps.map((step) =>
      executeParallelStep(step, progress, sprintDir, workingDir, deps, verbose)
    );

    // Wait for all to complete using Promise.allSettled
    const results = await Promise.allSettled(stepPromises);

    // Process results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const step = readySteps[i];

      if (result.status === 'fulfilled') {
        const stepResult = result.value;

        if (stepResult.needsHuman) {
          // Human intervention needed - stop execution
          return {
            completed: false,
            needsHuman: stepResult.needsHuman,
          };
        }

        if (stepResult.success) {
          scheduler.completeStep(step.id);

          // Queue operator requests if any
          if (stepResult.operatorRequests && stepResult.operatorRequests.length > 0) {
            queueOperatorRequests(
              progress as ProgressWithOperatorQueue,
              stepResult.operatorRequests,
              step.id
            );
          }
        } else {
          scheduler.failStep(step.id, stepResult.error);

          // Handle failure based on policy
          if (parallelConfig.onDependencyFailure === 'fail-phase') {
            // Update dependency graph in progress before returning
            (progress as unknown as { 'dependency-graph'?: unknown })['dependency-graph'] =
              scheduler.exportDependencyGraphs();
            await writeProgressAtomic(progressPath, progress);

            return {
              completed: false,
              error: `Step '${step.id}' failed: ${stepResult.error}`,
            };
          }
          // 'skip-dependents' and 'continue' are handled by the scheduler
        }
      } else {
        // Promise rejected (unexpected error)
        scheduler.failStep(step.id, result.reason?.message ?? 'Unknown error');

        if (parallelConfig.onDependencyFailure === 'fail-phase') {
          (progress as unknown as { 'dependency-graph'?: unknown })['dependency-graph'] =
            scheduler.exportDependencyGraphs();
          await writeProgressAtomic(progressPath, progress);

          return {
            completed: false,
            error: `Step '${step.id}' failed unexpectedly: ${result.reason?.message ?? 'Unknown error'}`,
          };
        }
      }
    }

    // Update dependency graph in progress
    (progress as unknown as { 'dependency-graph'?: unknown })['dependency-graph'] =
      scheduler.exportDependencyGraphs();

    // Commit transaction
    await writeProgressAtomic(progressPath, progress);
    cleanupBackup(progressPath);

    if (verbose) {
      const summary = scheduler.getStatusSummary();
      console.log(
        `[parallel] Progress: ${summary.completed} completed, ${summary.failed} failed, ` +
        `${summary.skipped} skipped, ${summary.pending + summary.ready} remaining`
      );
    }
  }

  // Check final status
  const finalSummary = scheduler.getStatusSummary();
  const hasFailures = scheduler.hasFailed();

  if (verbose) {
    console.log(
      `[parallel] Phase complete: ${finalSummary.completed} completed, ` +
      `${finalSummary.failed} failed, ${finalSummary.skipped} skipped`
    );
  }

  return {
    completed: true,
    error: hasFailures ? `${finalSummary.failed} steps failed` : undefined,
  };
}

// ============================================================================
// Recovery Functions
// ============================================================================

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

    // Check if we should use parallel execution for the current phase
    if (shouldUseParallelExecution(progress)) {
      if (verbose) {
        console.log(`[loop] Iteration ${iterations}: using parallel execution for phase`);
      }

      // Run parallel execution loop for this phase
      const parallelResult = await runParallelPhaseLoop(
        progress,
        sprintDir,
        progressPath,
        deps,
        verbose
      );

      // Handle parallel execution result
      if (parallelResult.needsHuman) {
        state = {
          status: 'needs-human',
          reason: parallelResult.needsHuman.reason,
          details: parallelResult.needsHuman.details,
        };
        updateProgressFromState(progress, state);
        await writeProgressAtomic(progressPath, progress);
        break;
      }

      if (!parallelResult.completed && parallelResult.error) {
        // Check if it was a pause
        if (parallelResult.error.includes('Paused')) {
          const result = transition(state, { type: 'PAUSE', reason: 'PAUSE file detected' }, progress);
          state = result.nextState;
          updateProgressFromState(progress, state);
          await writeProgressAtomic(progressPath, progress);
          break;
        }

        // Phase failed - transition to blocked
        const currentPhase = progress.phases?.[progress.current.phase];
        state = {
          status: 'blocked',
          error: parallelResult.error,
          failedPhase: currentPhase?.id ?? '',
          blockedAt: new Date().toISOString(),
        };
        updateProgressFromState(progress, state);
        await writeProgressAtomic(progressPath, progress);
        break;
      }

      // Phase completed - mark it and advance
      const currentPhase = progress.phases?.[progress.current.phase];
      if (currentPhase) {
        currentPhase.status = 'completed';
        currentPhase['completed-at'] = new Date().toISOString();
      }

      // Check if there are more phases
      if (progress.current.phase < (progress.phases?.length ?? 0) - 1) {
        // Advance to next phase
        progress.current.phase++;
        progress.current.step = null;
        progress.current['sub-phase'] = null;

        // Reset to first step if next phase has steps
        const nextPhase = progress.phases?.[progress.current.phase];
        if (nextPhase?.steps && nextPhase.steps.length > 0) {
          progress.current.step = 0;
          const firstStep = nextPhase.steps[0];
          if (firstStep.phases && firstStep.phases.length > 0) {
            progress.current['sub-phase'] = 0;
          }
        }

        await writeProgressAtomic(progressPath, progress);
        continue; // Continue with next phase
      } else {
        // All phases complete
        const completedAt = new Date().toISOString();
        const elapsedMs = Date.now() - startTime;
        const elapsed = `${Math.floor(elapsedMs / 1000)}s`;

        state = {
          status: 'completed',
          completedAt,
          elapsed,
        };
        updateProgressFromState(progress, state);
        await writeProgressAtomic(progressPath, progress);
        break;
      }
    }

    // Sequential execution (original logic)
    if (verbose) {
      console.log(`[loop] Iteration ${iterations}: executing phase (sequential)`);
    }

    // Transaction: backup before Claude execution
    backupProgress(progressPath);

    // Get the current phase/step/sub-phase
    const currentPhase = progress.phases?.[progress.current.phase];
    const currentStep = currentPhase?.steps?.[progress.current.step ?? -1];
    const currentSubPhase = currentStep?.phases?.[progress.current['sub-phase'] ?? -1];

    const prompt = currentSubPhase?.prompt ?? currentStep?.prompt ?? currentPhase?.prompt ?? '';
    const phaseId = currentSubPhase?.id ?? currentStep?.id ?? currentPhase?.id ?? '';

    // Get model from current execution context (sub-phase > phase)
    const currentModel = (currentSubPhase as { model?: string } | undefined)?.model
      ?? (currentPhase as { model?: string } | undefined)?.model;

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

    // Determine the correct working directory for Claude execution
    // For worktree sprints: resolve the worktree path relative to main repo root
    // For non-worktree sprints: use the project root (git root or folder containing .claude/)
    let workingDir: string;
    if (progress.worktree?.enabled && progress.worktree?.path) {
      // Worktree path is relative to main repo root - resolve it
      const worktreeInfo = getWorktreeInfo(sprintDir);
      workingDir = path.resolve(worktreeInfo.mainWorktreePath, progress.worktree.path);
    } else {
      workingDir = getProjectRoot(sprintDir);
    }

    // Execute SPAWN_CLAUDE action directly
    // Use --json-schema to enforce validated structured output
    const spawnResult = await deps.runClaude({
      prompt,
      cwd: workingDir,
      outputFile,
      jsonSchema: SPRINT_RESULT_SCHEMA,
      model: currentModel,
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
        operatorRequests?: OperatorRequest[];
      } | undefined;

      // STEP-5: Queue operator requests if present in result
      if (jsonResult?.operatorRequests && jsonResult.operatorRequests.length > 0) {
        queueOperatorRequests(
          progress as ProgressWithOperatorQueue,
          jsonResult.operatorRequests,
          phaseId
        );

        if (verbose) {
          console.log(`[loop] Queued ${jsonResult.operatorRequests.length} operator requests from phase ${phaseId}`);
        }

        // Trigger operator immediately for critical priority requests
        if (hasCriticalRequests(jsonResult.operatorRequests)) {
          if (verbose) {
            console.log('[loop] Critical priority request detected, triggering operator immediately');
          }
          await triggerOperator(progress as ProgressWithOperatorQueue, sprintDir, verbose);
        }
      }

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

    // Execute gate check if phase completed successfully and has a gate defined
    // Gate checks run after the phase prompt completes but before advancing
    if (event.type === 'PHASE_COMPLETE') {
      // Determine which level has a gate: sub-phase, phase, or top-level phase
      // Priority: sub-phase gate > phase gate (for for-each phases, gate runs after ALL items complete)
      const gateItem = currentSubPhase ?? currentPhase;
      const gateConfig = (gateItem as { gate?: CompiledGate } | undefined)?.gate;

      // Only run gate for the current item (sub-phase or simple phase without steps)
      // For for-each phases, the gate runs after all steps complete (phaseIsFullyComplete check below)
      const shouldRunGate = gateConfig && (
        currentSubPhase ||
        (!currentPhase?.steps || currentPhase.steps.length === 0)
      );

      if (shouldRunGate && gateConfig) {
        if (verbose) {
          console.log(`[loop] Running gate check for phase '${phaseId}'`);
        }

        // Get existing tracking state
        const gateableItem = gateItem as { 'gate-tracking'?: GateTracking };
        const existingTracking = gateableItem['gate-tracking'];

        // Execute the gate check with retry loop
        const gateTracking = await executeGateCheck(
          gateConfig,
          existingTracking,
          sprintDir,
          phaseId,
          workingDir,
          deps,
          verbose,
          progressPath,
          progress,
          transcriptionsDir,
          currentModel
        );

        // Update tracking on the item
        gateableItem['gate-tracking'] = gateTracking;

        // If gate is blocked, transition to blocked state
        if (gateTracking.status === 'blocked') {
          event = {
            type: 'PHASE_FAILED',
            error: `Gate check failed after ${gateTracking.attempts} attempts: ${gateTracking.error ?? 'Max retries exceeded'}`,
            category: 'validation',
            phaseId,
          };

          // Mark the item as failed
          if (currentSubPhase) {
            currentSubPhase.status = 'failed';
            currentSubPhase.error = `Gate check blocked: ${gateTracking.error ?? 'Max retries exceeded'}`;
          } else if (currentPhase) {
            currentPhase.status = 'failed';
            currentPhase.error = `Gate check blocked: ${gateTracking.error ?? 'Max retries exceeded'}`;
          }

          if (verbose) {
            console.log(`[loop] Gate check blocked for phase '${phaseId}', transitioning to blocked state`);
          }
        }
      }

      // For for-each phases, check if there's a phase-level gate after all steps complete
      if (currentPhase?.steps && currentPhase.steps.length > 0) {
        const allStepsComplete = currentPhase.steps.every(
          (s) => s.status === 'completed' || s.status === 'skipped'
        );
        const phaseGate = (currentPhase as { gate?: CompiledGate }).gate;

        if (allStepsComplete && phaseGate && event.type === 'PHASE_COMPLETE') {
          if (verbose) {
            console.log(`[loop] Running phase-level gate check for '${currentPhase.id}' after all steps completed`);
          }

          const phaseTracking = (currentPhase as { 'gate-tracking'?: GateTracking })['gate-tracking'];

          const gateTracking = await executeGateCheck(
            phaseGate,
            phaseTracking,
            sprintDir,
            currentPhase.id,
            workingDir,
            deps,
            verbose,
            progressPath,
            progress,
            transcriptionsDir,
            currentModel
          );

          (currentPhase as { 'gate-tracking'?: GateTracking })['gate-tracking'] = gateTracking;

          if (gateTracking.status === 'blocked') {
            event = {
              type: 'PHASE_FAILED',
              error: `Phase gate check failed after ${gateTracking.attempts} attempts: ${gateTracking.error ?? 'Max retries exceeded'}`,
              category: 'validation',
              phaseId: currentPhase.id,
            };

            currentPhase.status = 'failed';
            currentPhase.error = `Gate check blocked: ${gateTracking.error ?? 'Max retries exceeded'}`;

            if (verbose) {
              console.log(`[loop] Phase gate check blocked for '${currentPhase.id}', transitioning to blocked state`);
            }
          }
        }
      }
    }

    // Process event through transition
    let result = transition(state, event, progress);
    state = result.nextState;
    updateProgressFromState(progress, state);

    // Execute any resulting actions (excluding SPAWN_CLAUDE since we already did it)
    const nonSpawnActions = result.actions.filter(a => a.type !== 'SPAWN_CLAUDE');
    await executeActions(nonSpawnActions, context, deps);

    // Check for breakpoint after phase completion
    // Breakpoint triggers AFTER the phase with break: true completes (all iterations for for-each)
    if (state.status === 'in-progress' && event.type === 'PHASE_COMPLETE' && currentPhase) {
      // Check if the completed phase has break: true
      const phaseHasBreak = (currentPhase as { break?: boolean }).break === true;

      // For for-each phases, only trigger breakpoint when ALL iterations are complete
      // (i.e., the phase status is 'completed')
      const phaseIsFullyComplete = currentPhase.status === 'completed';

      // For simple phases without steps, check if this is the last iteration of the phase
      const isSimplePhaseComplete = !currentPhase.steps && !currentStep && !currentSubPhase;

      if (phaseHasBreak && (phaseIsFullyComplete || isSimplePhaseComplete)) {
        if (verbose) {
          console.log(`[loop] Breakpoint reached after phase '${currentPhase.id}'`);
        }

        // Trigger BREAKPOINT_REACHED event
        const breakpointResult = transition(state, { type: 'BREAKPOINT_REACHED', phaseId: currentPhase.id }, progress);
        state = breakpointResult.nextState;
        updateProgressFromState(progress, state);

        // Execute breakpoint actions
        const breakpointActions = breakpointResult.actions.filter(a => a.type !== 'SPAWN_CLAUDE');
        await executeActions(breakpointActions, context, deps);
      }
    }

    // Execute per-iteration hooks after successful iteration
    // Hooks run AFTER phase completion but BEFORE advancing to next phase
    if (event.type === 'PHASE_COMPLETE') {
      await executePerIterationHooks(
        progress as ProgressWithHooks,
        iterations,
        outputFile,  // The transcript path for this iteration
        phaseId,
        sprintDir,
        workingDir,
        deps,
        verbose
      );
    }

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
