/**
 * Executor Module - Action Execution for Sprint State Machine
 *
 * Maps SprintAction discriminated union to side effect implementations.
 * Actions describe effects; this module executes them.
 */

import * as fs from 'fs';
import * as path from 'path';
import { writeProgressAtomic, CompiledProgress as YamlOpsProgress } from './yaml-ops.js';
import { runClaude, categorizeError, ClaudeResult, ClaudeRunOptions } from './claude-runner.js';

// Re-export types from transition module for consumers
export type {
  LogLevel,
  InsertPosition,
  ErrorCategory,
  PhaseStatus,
  SprintStatus,
  StepQueueItem,
  SprintStats,
  CurrentPointer,
  CompiledPhase,
  CompiledStep,
  CompiledTopPhase,
  CompiledProgress,
  SprintAction,
  SprintEvent,
} from './transition.js';

// Import types for local use
import type {
  CompiledProgress,
  SprintAction,
  SprintEvent,
} from './transition.js';

// ============================================================================
// ExecutorContext Interface
// ============================================================================

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

// ============================================================================
// Dependency Injection
// ============================================================================

/**
 * Dependencies that can be injected for testing
 */
export interface ExecutorDependencies {
  runClaude: (options: ClaudeRunOptions) => Promise<ClaudeResult>;
}

/** Default dependencies using real implementations */
const defaultDeps: ExecutorDependencies = {
  runClaude,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Execute a single action and return any resulting event.
 *
 * @param action - The action to execute
 * @param context - Executor context with sprint state
 * @param deps - Optional dependencies for testing
 * @returns Promise resolving to SprintEvent or null
 */
export async function executeAction(
  action: SprintAction,
  context: ExecutorContext,
  deps: ExecutorDependencies = defaultDeps
): Promise<SprintEvent | null> {
  switch (action.type) {
    case 'LOG': {
      const logFn =
        action.level === 'warn' ? console.warn :
        action.level === 'error' ? console.error :
        console.log;
      logFn(action.message);
      return null;
    }

    case 'SPAWN_CLAUDE': {
      const result = await deps.runClaude({
        prompt: action.prompt,
        cwd: context.sprintDir,
      });

      if (result.success) {
        // Extract summary from jsonResult if available
        const summary =
          (result.jsonResult as { summary?: string } | undefined)?.summary ||
          'Phase completed';
        return { type: 'PHASE_COMPLETE', summary, phaseId: action.phaseId };
      } else {
        const category = categorizeError(result.error || 'Unknown error');
        return {
          type: 'PHASE_FAILED',
          error: result.error || 'Unknown error',
          category,
          phaseId: action.phaseId,
        };
      }
    }

    case 'WRITE_PROGRESS': {
      const progressPath = path.join(context.sprintDir, 'PROGRESS.yaml');
      // Cast to yaml-ops compatible type (index signature allows all fields)
      await writeProgressAtomic(progressPath, context.progress as unknown as YamlOpsProgress);
      return null;
    }

    case 'UPDATE_STATS': {
      // Merge updates into existing stats
      context.progress.stats = {
        ...context.progress.stats,
        ...action.updates,
      };
      return null;
    }

    case 'EMIT_ACTIVITY': {
      const activityPath = path.join(context.sprintDir, '.sprint-activity.jsonl');

      const entry = {
        timestamp: new Date().toISOString(),
        activity: action.activity,
        data: action.data,
      };

      // Ensure directory exists
      const dir = path.dirname(activityPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Append JSONL line
      fs.appendFileSync(activityPath, JSON.stringify(entry) + '\n');
      return null;
    }

    case 'SCHEDULE_RETRY': {
      await sleep(action.delayMs);
      // Return TICK event to signal retry iteration
      return { type: 'TICK' };
    }

    case 'INSERT_STEP': {
      const { step, position } = action;
      const currentPhaseIdx = context.progress.current.phase;
      const currentPhase = context.progress.phases?.[currentPhaseIdx];

      if (!currentPhase?.steps) {
        // Handle simple phase (no steps) - cannot insert
        return null;
      }

      // Create CompiledStep from StepQueueItem
      const newStep = {
        id: step.id,
        prompt: step.prompt,
        status: 'pending' as const,
        phases: [],
      };

      if (position === 'after-current') {
        const insertIdx = (context.progress.current.step ?? 0) + 1;
        currentPhase.steps.splice(insertIdx, 0, newStep);
      } else {
        // 'end-of-phase'
        currentPhase.steps.push(newStep);
      }

      return null;
    }

    default: {
      // Exhaustive switch - TypeScript will error if any action type is not handled
      const _exhaustive: never = action;
      throw new Error(`Unhandled action type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Execute multiple actions in sequence and collect resulting events.
 *
 * @param actions - Array of actions to execute
 * @param context - Executor context with sprint state
 * @param deps - Optional dependencies for testing
 * @returns Promise resolving to array of non-null events
 */
export async function executeActions(
  actions: SprintAction[],
  context: ExecutorContext,
  deps: ExecutorDependencies = defaultDeps
): Promise<SprintEvent[]> {
  const events: SprintEvent[] = [];

  for (const action of actions) {
    const event = await executeAction(action, context, deps);
    if (event !== null) {
      events.push(event);
    }
  }

  return events;
}
