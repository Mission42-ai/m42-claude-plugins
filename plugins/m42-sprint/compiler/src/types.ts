/**
 * TypeScript interfaces for the Sprint Workflow System
 */

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
  /** The steps to process in this sprint */
  steps: SprintStep[];
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
}

/**
 * Workflow Definition - the reusable workflow template
 */
export interface WorkflowDefinition {
  /** Human-readable name */
  name: string;
  /** Description of what this workflow does */
  description?: string;
  /** The phases in this workflow */
  phases: WorkflowPhase[];
}

// ============================================================================
// PROGRESS.yaml - Runtime/Compiled Format
// ============================================================================

export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

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
  /** The compiled phase hierarchy */
  phases: CompiledTopPhase[];
  /** Current execution position */
  current: CurrentPointer;
  /** Execution statistics */
  stats: SprintStats;
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
