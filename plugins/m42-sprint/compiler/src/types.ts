/**
 * TypeScript interfaces for the Sprint Workflow System
 */

// ============================================================================
// Schema Version Constants
// ============================================================================

/** Current workflow schema version */
export const CURRENT_SCHEMA_VERSION = '2.0';

/** Minimum supported schema version */
export const MIN_SCHEMA_VERSION = '1.0';

// ============================================================================
// Status Types (defined early for use in other interfaces)
// ============================================================================

export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';

/** Valid Claude model identifiers */
export type ClaudeModel = 'sonnet' | 'opus' | 'haiku';

/**
 * @deprecated Use SprintState discriminated union instead for type-safe state handling.
 * This type is kept for backwards compatibility with existing code.
 */
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'paused-at-breakpoint' | 'needs-human' | 'interrupted';
export type ParallelTaskStatus = 'spawned' | 'running' | 'completed' | 'failed';

/** Log severity levels for LOG actions */
export type LogLevel = 'info' | 'warn' | 'error';

/** Step insertion position strategies */
export type InsertPosition = 'after-current' | 'end-of-phase';

// ============================================================================
// XState-Inspired Discriminated Unions (Type-Safe State Machine)
// ============================================================================

/**
 * Discriminated union for sprint state - provides type-safe state access.
 * Each state variant has its own specific required fields.
 */
export type SprintState =
  | { status: 'not-started' }
  | {
      status: 'in-progress';
      current: CurrentPointer;
      iteration: number;
      startedAt: string;
    }
  | {
      status: 'paused';
      pausedAt: CurrentPointer;
      pauseReason: string;
    }
  | {
      status: 'paused-at-breakpoint';
      pausedAt: CurrentPointer;
      breakpointPhaseId: string;
    }
  | {
      status: 'blocked';
      error: string;
      failedPhase: string;
      blockedAt: string;
    }
  | {
      status: 'needs-human';
      reason: string;
      details?: string;
    }
  | {
      status: 'completed';
      summary?: string;
      completedAt: string;
      elapsed: string;
    };

/**
 * Discriminated union for sprint events - enables exhaustive switch handling.
 * Each event type has its specific required payload fields.
 */
export type SprintEvent =
  | { type: 'START' }
  | { type: 'TICK' }
  | { type: 'MAX_ITERATIONS_REACHED' }
  | { type: 'PHASE_COMPLETE'; summary: string; phaseId: string }
  | { type: 'PHASE_FAILED'; error: string; category: ErrorCategory; phaseId: string }
  | { type: 'STEP_COMPLETE'; summary: string; stepId: string }
  | { type: 'STEP_FAILED'; error: string; category: ErrorCategory; stepId: string }
  | { type: 'PROPOSE_STEPS'; steps: ProposedStep[]; proposedBy: string }
  | { type: 'PAUSE'; reason: string }
  | { type: 'BREAKPOINT_REACHED'; phaseId: string }
  | { type: 'RESUME' }
  | { type: 'HUMAN_NEEDED'; reason: string; details?: string }
  | { type: 'GOAL_COMPLETE'; summary: string };

/**
 * Discriminated union for sprint actions - describes side effects without executing them.
 * Actions are data that represent what should happen, not the execution itself.
 */
export type SprintAction =
  | { type: 'LOG'; level: LogLevel; message: string }
  | { type: 'SPAWN_CLAUDE'; prompt: string; phaseId: string; onComplete: SprintEvent['type'] }
  | { type: 'WRITE_PROGRESS' }
  | { type: 'UPDATE_STATS'; updates: Partial<SprintStats> }
  | { type: 'EMIT_ACTIVITY'; activity: string; data: unknown }
  | { type: 'SCHEDULE_RETRY'; phaseId: string; delayMs: number }
  | { type: 'INSERT_STEP'; step: StepQueueItem; position: InsertPosition };

/**
 * Result of a state transition - combines next state, actions to execute, and context updates.
 */
export interface TransitionResult {
  /** The next state after the transition */
  nextState: SprintState;
  /** Actions to execute as side effects */
  actions: SprintAction[];
  /** Partial updates to apply to CompiledProgress context */
  context: Partial<CompiledProgress>;
}

/**
 * Type alias for guard functions used in conditional transitions.
 */
export type GuardFn = (
  state: SprintState,
  context: CompiledProgress,
  event: SprintEvent
) => boolean;

/**
 * Guard functions object - provides reusable condition checks for transitions.
 */
export const guards: Record<string, GuardFn> = {
  /** Check if there are more phases to process */
  hasMorePhases: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    return ctx.current.phase < (ctx.phases?.length ?? 0) - 1;
  },

  /** Check if there are more steps within the current phase */
  hasMoreSteps: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    if (ctx.current.step === null) return false;
    const phase = ctx.phases?.[ctx.current.phase];
    if (!phase?.steps) return false;
    return ctx.current.step < phase.steps.length - 1;
  },

  /** Check if there are more sub-phases within the current step */
  hasMoreSubPhases: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    if (ctx.current.step === null || ctx.current['sub-phase'] === null) return false;
    const phase = ctx.phases?.[ctx.current.phase];
    const step = phase?.steps?.[ctx.current.step];
    if (!step?.phases) return false;
    return ctx.current['sub-phase'] < step.phases.length - 1;
  },

  /** Check if the error is retryable based on retry configuration */
  isRetryable: (_state: SprintState, ctx: CompiledProgress, event: SprintEvent): boolean => {
    if (event.type !== 'PHASE_FAILED' && event.type !== 'STEP_FAILED') return false;
    if (!ctx.retry?.retryOn) return false;
    return ctx.retry.retryOn.includes(event.category);
  },

  /** Check if there are steps in the step queue */
  hasStepQueue: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    return (ctx['step-queue']?.length ?? 0) > 0;
  },

  /** Check if orchestration is enabled */
  orchestrationEnabled: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    return ctx.orchestration?.enabled === true;
  },

  /** Check if auto-approve is enabled for orchestration */
  autoApproveEnabled: (_state: SprintState, ctx: CompiledProgress, _event: SprintEvent): boolean => {
    return ctx.orchestration?.autoApprove === true;
  },
};

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
// Worktree Configuration
// ============================================================================

/** Cleanup mode for worktrees */
export type WorktreeCleanup = 'never' | 'on-complete' | 'on-merge';

/**
 * Worktree configuration for sprint or workflow level
 *
 * Supports variable substitution in branch and path:
 * - {sprint-id} → e.g., "2026-01-20_feature-auth"
 * - {sprint-name} → e.g., "feature-auth"
 * - {date} → e.g., "2026-01-20"
 * - {workflow} → e.g., "feature-development"
 */
export interface WorktreeConfig {
  /** Enable dedicated worktree for this sprint */
  enabled: boolean;
  /** Branch name for the worktree (default: sprint/{sprint-id}) */
  branch?: string;
  /** Path for the worktree relative to repo root (default: ../{sprint-id}-worktree) */
  path?: string;
  /** When to clean up the worktree (default: on-complete) */
  cleanup?: WorktreeCleanup;
}

/**
 * Workflow-level worktree defaults
 * Uses prefix patterns instead of full templates
 */
export interface WorkflowWorktreeDefaults {
  /** Enable worktree for all sprints using this workflow */
  enabled: boolean;
  /** Branch prefix (e.g., "sprint/" → "sprint/{sprint-id}") */
  'branch-prefix'?: string;
  /** Path prefix for worktrees (e.g., "../worktrees/" → "../worktrees/{sprint-id}") */
  'path-prefix'?: string;
  /** Default cleanup mode */
  cleanup?: WorktreeCleanup;
}

/**
 * Compiled worktree configuration in PROGRESS.yaml
 * Contains resolved paths and runtime state
 */
export interface CompiledWorktreeConfig {
  /** Whether worktree is enabled */
  enabled: boolean;
  /** Resolved branch name (variables substituted) */
  branch: string;
  /** Resolved worktree path (variables substituted) */
  path: string;
  /** Cleanup mode */
  cleanup: WorktreeCleanup;
  /** When the worktree was created (ISO timestamp) */
  'created-at'?: string;
  /** Whether worktree has been cleaned up */
  'cleaned-up'?: boolean;
  /** Working directory for Claude execution (worktree root or sprint dir) */
  'working-dir'?: string;
}

/**
 * Runtime worktree isolation metadata
 * Added to PROGRESS.yaml to track which worktree a sprint is running in
 */
export interface WorktreeIsolationMeta {
  /** Unique identifier for this worktree (12-char hash of worktree path) */
  'worktree-id': string;
  /** Absolute path to the worktree root (for debugging) */
  'worktree-path': string;
  /** Whether this is a linked worktree (true) or main repo (false) */
  'is-worktree': boolean;
}

// ============================================================================
// Dependency Graph Types (Parallel Execution)
// ============================================================================

/**
 * Node in a dependency graph for tracking execution order
 * Used for topological sorting and cycle detection
 */
export interface DependencyNode {
  /** Unique identifier for this node (matches item ID) */
  id: string;
  /** IDs of nodes this node depends on (must complete before this can start) */
  dependencies: string[];
  /** Current processing state for graph algorithms */
  state: 'unvisited' | 'visiting' | 'visited';
}

/**
 * Compiled dependency graph node for PROGRESS.yaml
 * Tracks execution readiness based on dependency completion
 */
export interface CompiledDependencyNode {
  /** Unique identifier for this node (matches step ID) */
  id: string;
  /** IDs of nodes this node depends on (from depends-on in SPRINT.yaml) */
  'depends-on': string[];
  /** IDs of nodes that are blocking this node (initially same as depends-on, cleared as they complete) */
  'blocked-by': string[];
}

/**
 * Dependency graph for a for-each phase
 * Tracks dependencies between steps for parallel execution
 */
export interface CompiledDependencyGraph {
  /** The phase ID this graph belongs to */
  'phase-id': string;
  /** Nodes in the dependency graph (one per step) */
  nodes: CompiledDependencyNode[];
}

/**
 * Configuration for parallel execution within a phase
 * Controls how items with dependencies are executed concurrently
 */
export interface ParallelExecutionConfig {
  /** Enable parallel execution of items within for-each phases */
  enabled: boolean;
  /** Maximum number of concurrent executions (default: unlimited) */
  maxConcurrency?: number;
  /** Strategy for handling failed dependencies */
  onDependencyFailure: 'skip-dependents' | 'fail-phase' | 'continue';
}

// ============================================================================
// Orchestration Types (Unified Loop)
// ============================================================================

/**
 * Orchestration configuration for dynamic step injection
 * Enables Claude to propose new steps during execution
 */
export interface OrchestrationConfig {
  /** Enable dynamic step injection */
  enabled: boolean;
  /** Custom orchestration prompt (optional) */
  prompt?: string;
  /** Where to insert proposed steps */
  insertStrategy: 'after-current' | 'end-of-phase' | 'custom';
  /** If true, steps are inserted without orchestration iteration */
  autoApprove: boolean;
}

/**
 * A step proposed by Claude via JSON result
 * Part of the proposedSteps array in agent output
 */
export interface ProposedStep {
  /** The task prompt for the proposed step */
  prompt: string;
  /** Why this step is needed */
  reasoning?: string;
  /** Urgency/importance of this step */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Suggested insertion point */
  insertAfter?: string;
}

/**
 * A queued step waiting for orchestration in PROGRESS.yaml
 * Created when agent proposes steps via proposedSteps JSON
 */
export interface StepQueueItem {
  /** Unique identifier for this queue item */
  id: string;
  /** The task prompt */
  prompt: string;
  /** Which step proposed this (step ID) */
  proposedBy: string;
  /** When proposed (ISO timestamp) */
  proposedAt: string;
  /** Why this step was proposed */
  reasoning?: string;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Optional: Dependencies on other items (by ID) for parallel execution */
  'depends-on'?: string[];
}

// ============================================================================
// SPRINT.yaml - Input Format
// ============================================================================

/**
 * A generic item in a collection (feature, bug, step, etc.)
 * Supports arbitrary custom properties via index signature.
 */
export interface CollectionItem {
  /** The prompt/description for this item */
  prompt: string;
  /** Optional: Override the default workflow for this item */
  workflow?: string;
  /** Optional: Custom ID for this item */
  id?: string;
  /** Optional: Model override for this item (highest priority) */
  model?: ClaudeModel;
  /** Optional: Dependencies on other items (by ID) for parallel execution */
  'depends-on'?: string[];
  /** Allow custom properties (priority, severity, etc.) */
  [key: string]: unknown;
}

/**
 * @deprecated Use CollectionItem instead. Kept for backwards compatibility.
 */
export type SprintStep = CollectionItem;

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
 * Collections map - named arrays of collection items
 * Each collection name maps to an array of items (feature, bug, step, etc.)
 */
export interface CollectionsMap {
  [name: string]: CollectionItem[];
}

/**
 * Sprint Definition - the input format (SPRINT.yaml)
 */
export interface SprintDefinition {
  /** Reference to the workflow in .claude/workflows/ */
  workflow: string;
  /** Collections of items to process (required for standard mode, keyed by type) */
  collections?: CollectionsMap;
  /** Optional sprint metadata */
  'sprint-id'?: string;
  name?: string;
  created?: string;
  owner?: string;
  /** Optional model to use for all phases (overrides workflow model) */
  model?: ClaudeModel;
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
  /** Custom prompt templates for runtime */
  prompts?: SprintPrompts;
  /** Optional worktree configuration for isolated execution */
  worktree?: WorktreeConfig;
}

/**
 * Customizable runtime prompt templates for sprint execution
 * Allows SPRINT.yaml to override default prompts from build-sprint-prompt.sh
 */
export interface SprintPrompts {
  /** Header shown at top of each prompt */
  header?: string;
  /** Position indicator (phase/step/sub-phase) */
  position?: string;
  /** Warning shown on retry attempts */
  'retry-warning'?: string;
  /** Instructions section */
  instructions?: string;
  /** Result reporting format instructions */
  'result-reporting'?: string;
}

// ============================================================================
// Workflow Definition (.claude/workflows/*.yaml)
// ============================================================================

/**
 * Gate check failure handler configuration
 */
export interface GateOnFail {
  /** Instructions prompt for fixing the failure */
  prompt: string;
  /** Maximum retry attempts before escalating (default: 3) */
  'max-retries'?: number;
}

/**
 * Quality gate check configuration
 * Runs a validation script after phase completion, with retry-on-fail capability
 */
export interface GateCheck {
  /** Shell script/command returning 0 (pass) or non-0 (fail) */
  script: string;
  /** What to do when the gate check fails */
  'on-fail': GateOnFail;
  /** Timeout in seconds for the script (default: 60) */
  timeout?: number;
}

/**
 * A phase within a workflow
 */
export interface WorkflowPhase {
  /** Unique identifier for this phase */
  id: string;
  /** The prompt to execute for this phase */
  prompt?: string;
  /** Iterate over items in the named collection (e.g., 'step', 'feature', 'bug') */
  'for-each'?: string;
  /** Explicit collection reference (overrides for-each for collection lookup) */
  collection?: string;
  /** Reference to another workflow to use for each iteration */
  workflow?: string;
  /** If true, this phase runs as a background parallel task */
  parallel?: boolean;
  /** If true, wait for all parallel tasks to complete before continuing */
  'wait-for-parallel'?: boolean;
  /** Optional model override for this phase */
  model?: ClaudeModel;
  /** If true, pause execution after this phase completes for human review */
  break?: boolean;
  /** Quality gate check to run after phase completion */
  gate?: GateCheck;
}

/**
 * Workflow Definition - the reusable workflow template
 */
export interface WorkflowDefinition {
  /** Human-readable name */
  name: string;
  /** Description of what this workflow does */
  description?: string;
  /** Schema version for tracking workflow format compatibility */
  'schema-version'?: string;
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
  /** Orchestration configuration for dynamic step injection */
  orchestration?: OrchestrationConfig;
  /** Default worktree configuration for sprints using this workflow */
  worktree?: WorkflowWorktreeDefaults;
  /** Optional model to use for all phases (lowest priority default) */
  model?: ClaudeModel;
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
 * Gate check status for tracking in PROGRESS.yaml
 */
export type GateStatus = 'pending' | 'running' | 'passed' | 'retrying' | 'failed' | 'blocked';

/**
 * Gate tracking state for PROGRESS.yaml
 */
export interface GateTracking {
  /** Number of gate check attempts made */
  attempts: number;
  /** Current status of the gate check */
  status: GateStatus;
  /** Last script output (stdout + stderr) for fix prompt context */
  'last-output'?: string;
  /** Exit code from the last gate script run */
  'last-exit-code'?: number;
  /** Error message if gate is blocked */
  error?: string;
}

/**
 * Compiled gate configuration (resolved from workflow)
 */
export interface CompiledGate {
  /** Shell script/command to execute */
  script: string;
  /** Fix prompt for failures */
  'on-fail-prompt': string;
  /** Maximum retries (default: 3) */
  'max-retries': number;
  /** Timeout in seconds (default: 60) */
  timeout: number;
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
  /** Resolved model to use for execution */
  model?: ClaudeModel;
  /** Quality gate configuration (compiled from workflow) */
  gate?: CompiledGate;
  /** Gate check tracking state */
  'gate-tracking'?: GateTracking;
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
  /** Step-level model override (for sub-phase resolution) */
  model?: ClaudeModel;
  /** Dependencies on other steps (by ID) for parallel execution */
  'depends-on'?: string[];
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
  /** Resolved model to use for execution */
  model?: ClaudeModel;
  /** If true, pause execution after this phase completes for human review */
  break?: boolean;
  /** Quality gate configuration (compiled from workflow) */
  gate?: CompiledGate;
  /** Gate check tracking state */
  'gate-tracking'?: GateTracking;
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

  // Orchestration fields (Unified Loop)
  /** Orchestration configuration for dynamic step injection */
  orchestration?: OrchestrationConfig;
  /** Queue of proposed steps awaiting orchestration */
  'step-queue'?: StepQueueItem[];
  /** Custom prompt templates for runtime */
  prompts?: SprintPrompts;
  /** Retry configuration for error recovery */
  retry?: RetryConfig;

  // Worktree configuration
  /** Compiled worktree configuration (resolved from sprint + workflow defaults) */
  worktree?: CompiledWorktreeConfig;

  // Worktree isolation metadata
  /** Runtime worktree isolation tracking (auto-populated on sprint start) */
  'worktree-isolation'?: WorktreeIsolationMeta;

  // Dependency tracking for parallel execution
  /** Dependency graphs for for-each phases (one per phase with dependencies) */
  'dependency-graph'?: CompiledDependencyGraph[];

  // Parallel execution configuration
  /** Configuration for parallel execution within for-each phases */
  'parallel-execution'?: ParallelExecutionConfig;
}

// ============================================================================
// Compiler Internal Types
// ============================================================================

/**
 * Item context for template variable substitution
 * Used for {{item.*}} and {{<type>.*}} template variables
 */
export interface ItemContext {
  /** The item's prompt text */
  prompt: string;
  /** The item's ID */
  id: string;
  /** The item's index within the collection */
  index: number;
  /** The collection type (e.g., 'step', 'feature', 'bug') */
  type: string;
  /** Allow custom properties from the collection item */
  [key: string]: unknown;
}

/**
 * Context for template variable substitution
 */
export interface TemplateContext {
  /** Generic item context (replaces step context) */
  item?: ItemContext;
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
