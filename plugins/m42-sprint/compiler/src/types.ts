/**
 * TypeScript interfaces for the Sprint Workflow System
 */

// ============================================================================
// Status Types (defined early for use in other interfaces)
// ============================================================================

export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
export type ParallelTaskStatus = 'spawned' | 'running' | 'completed' | 'failed';

// ============================================================================
// Ralph Mode Types
// ============================================================================

/**
 * Per-iteration hook configuration for Ralph mode
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
 * Dynamic step created by Claude during Ralph mode execution
 */
export interface DynamicStep {
  /** Unique identifier */
  id: string;
  /** The task prompt */
  prompt: string;
  /** Current status */
  status: PhaseStatus;
  /** When added (ISO timestamp) */
  'added-at': string;
  /** Which iteration added this step */
  'added-in-iteration': number;
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
  status: ParallelTaskStatus;
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
 * Ralph mode configuration
 */
export interface RalphConfig {
  /** Iterations without progress before reflection */
  'idle-threshold'?: number;
}

/**
 * Ralph mode exit information
 */
export interface RalphExitInfo {
  /** When RALPH_COMPLETE was detected */
  'detected-at'?: string;
  /** Which iteration completed */
  iteration?: number;
  /** Final summary from Claude */
  'final-summary'?: string;
}

// ============================================================================
// SPRINT.yaml - Input Format
// ============================================================================

/**
 * A step in the sprint (formerly called "feature")
 */
export interface SprintStep {
  /** The prompt/description for this step */
  prompt: string;
  /** Optional: Override the default workflow for this step */
  workflow?: string;
  /** Optional: Custom ID for this step */
  id?: string;
}

/**
 * Error category types for classification and retry configuration
 */
export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';

/**
 * Retry configuration for automatic error recovery
 */
export interface RetryConfig {
  /** Maximum number of retry attempts per phase */
  maxAttempts: number;
  /** Exponential backoff delays in milliseconds */
  backoffMs: number[];
  /** Error categories that should trigger automatic retry */
  retryOn: ErrorCategory[];
}

/**
 * Sprint Definition - the input format (SPRINT.yaml)
 */
export interface SprintDefinition {
  /** Reference to the workflow in .claude/workflows/ */
  workflow: string;
  /** The steps to process in this sprint (optional for Ralph mode) */
  steps?: SprintStep[];
  /** Optional sprint metadata */
  'sprint-id'?: string;
  name?: string;
  created?: string;
  owner?: string;
  /** Optional configuration */
  config?: {
    'max-tasks'?: number;
    'time-box'?: string;
    'auto-commit'?: boolean;
  };
  /** Optional retry configuration for error recovery */
  retry?: RetryConfig;
  /** Goal for Ralph mode (required when using Ralph workflow) */
  goal?: string;
  /** Override per-iteration hook settings from workflow */
  'per-iteration-hooks'?: Record<string, { enabled: boolean }>;
}

// ============================================================================
// Workflow Definition (.claude/workflows/*.yaml)
// ============================================================================

/**
 * A phase within a workflow
 */
export interface WorkflowPhase {
  /** Unique identifier for this phase */
  id: string;
  /** The prompt to execute for this phase */
  prompt?: string;
  /** If set to 'step', iterates over all steps from SPRINT.yaml */
  'for-each'?: 'step';
  /** Reference to another workflow to use for each iteration */
  workflow?: string;
  /** If true, this phase runs as a background parallel task */
  parallel?: boolean;
  /** If true, wait for all parallel tasks to complete before continuing */
  'wait-for-parallel'?: boolean;
}

/**
 * Workflow Definition - the reusable workflow template
 */
export interface WorkflowDefinition {
  /** Human-readable name */
  name: string;
  /** Description of what this workflow does */
  description?: string;
  /** The phases in this workflow (optional for Ralph mode) */
  phases?: WorkflowPhase[];
  /** Workflow mode: standard (phase-based) or ralph (goal-driven) */
  mode?: 'standard' | 'ralph';
  /** Prompt template for goal analysis (Ralph mode) */
  'goal-prompt'?: string;
  /** Prompt template for reflection (Ralph mode) */
  'reflection-prompt'?: string;
  /** Per-iteration hooks for Ralph mode */
  'per-iteration-hooks'?: PerIterationHook[];
}

// ============================================================================
// PROGRESS.yaml - Runtime/Compiled Format
// ============================================================================

/**
 * A parallel task running in the background
 */
export interface ParallelTask {
  /** Unique identifier for this parallel task */
  id: string;
  /** Reference to the step this task belongs to */
  'step-id': string;
  /** Reference to the phase within the step */
  'phase-id': string;
  /** Current status of the parallel task */
  status: ParallelTaskStatus;
  /** Process ID of the spawned task */
  pid?: number;
  /** Path to the log file for this task */
  'log-file'?: string;
  /** ISO timestamp when task was spawned */
  'spawned-at'?: string;
  /** ISO timestamp when task completed */
  'completed-at'?: string;
  /** Exit code from the process */
  'exit-code'?: number;
  /** Error message if task failed */
  error?: string;
}

/**
 * A compiled phase (leaf node - has prompt but no sub-phases)
 */
export interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  /** Timing information */
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  /** Any notes or summary from execution */
  summary?: string;
  /** Error message if phase failed */
  error?: string;
  /** Number of retry attempts made */
  'retry-count'?: number;
  /** ISO timestamp for next scheduled retry */
  'next-retry-at'?: string;
  /** Classified error category */
  'error-category'?: ErrorCategory;
  /** If true, this phase runs as a background parallel task */
  parallel?: boolean;
  /** ID of the parallel task if this phase was spawned */
  'parallel-task-id'?: string;
}

/**
 * A compiled step (contains sub-phases from the step's workflow)
 */
export interface CompiledStep {
  id: string;
  /** The original prompt from SPRINT.yaml */
  prompt: string;
  status: PhaseStatus;
  /** The expanded phases from the step's workflow */
  phases: CompiledPhase[];
  /** Timing information */
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  /** Error message if step failed */
  error?: string;
  /** Number of retry attempts made */
  'retry-count'?: number;
  /** ISO timestamp for next scheduled retry */
  'next-retry-at'?: string;
  /** Classified error category */
  'error-category'?: ErrorCategory;
}

/**
 * A top-level phase that may contain steps (for for-each phases)
 */
export interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  /** Present for simple phases (no for-each) */
  prompt?: string;
  /** Present for for-each phases - contains the expanded steps */
  steps?: CompiledStep[];
  /** Timing information */
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
  /** Error message if phase failed */
  error?: string;
  /** Number of retry attempts made */
  'retry-count'?: number;
  /** ISO timestamp for next scheduled retry */
  'next-retry-at'?: string;
  /** Classified error category */
  'error-category'?: ErrorCategory;
  /** If true, wait for all parallel tasks to complete before continuing */
  'wait-for-parallel'?: boolean;
}

/**
 * Current position pointer in the workflow
 */
export interface CurrentPointer {
  /** Index into phases array (0-based) */
  phase: number;
  /** Index into steps array within current phase (0-based, null if no steps) */
  step: number | null;
  /** Index into sub-phases array within current step (0-based, null if no sub-phases) */
  'sub-phase': number | null;
}

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
  /** Current iteration number (1-based) */
  'current-iteration'?: number;
  /** Maximum number of iterations configured */
  'max-iterations'?: number;
}

/**
 * Compiled Progress - the runtime format (PROGRESS.yaml)
 */
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  /** The compiled phase hierarchy (optional for Ralph mode) */
  phases?: CompiledTopPhase[];
  /** Current execution position */
  current: CurrentPointer;
  /** Execution statistics */
  stats: SprintStats;
  /** Active parallel tasks running in background */
  'parallel-tasks'?: ParallelTask[];

  // Ralph mode fields
  /** Workflow mode: standard (default) or ralph */
  mode?: 'standard' | 'ralph';
  /** Goal for Ralph mode */
  goal?: string;
  /** Dynamically created steps during Ralph execution */
  'dynamic-steps'?: DynamicStep[];
  /** Per-iteration hook task tracking */
  'hook-tasks'?: HookTask[];
  /** Merged per-iteration hooks */
  'per-iteration-hooks'?: PerIterationHook[];
  /** Ralph mode configuration */
  ralph?: RalphConfig;
  /** Ralph mode exit information */
  'ralph-exit'?: RalphExitInfo;
}

// ============================================================================
// Compiler Internal Types
// ============================================================================

/**
 * Context for template variable substitution
 */
export interface TemplateContext {
  step?: {
    prompt: string;
    id: string;
    index: number;
  };
  phase?: {
    id: string;
    index: number;
  };
  sprint?: {
    id: string;
    name?: string;
  };
}

/**
 * Result of loading a workflow
 */
export interface LoadedWorkflow {
  definition: WorkflowDefinition;
  path: string;
}

/**
 * Compiler configuration
 */
export interface CompilerConfig {
  /** Base directory for workflow definitions */
  workflowsDir: string;
  /** Sprint directory containing SPRINT.yaml */
  sprintDir: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Treat unresolved template variables as errors (fail compilation) */
  strict?: boolean;
}

/**
 * Compiler error with context
 */
export interface CompilerError {
  code: string;
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

/**
 * Compiler result
 */
export interface CompilerResult {
  success: boolean;
  progress?: CompiledProgress;
  errors: CompilerError[];
  warnings: string[];
}
