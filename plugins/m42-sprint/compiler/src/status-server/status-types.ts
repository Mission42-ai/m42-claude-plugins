/**
 * TypeScript interfaces for the Sprint Status Server
 * These types are used for real-time status updates via SSE
 */

import type {
  CompiledProgress,
  CompiledTopPhase,
  CompiledStep,
  CompiledPhase,
  PhaseStatus,
  SprintStatus,
} from '../types.js';

import type { ActivityEvent } from './activity-types.js';

// ============================================================================
// SSE Event Types
// ============================================================================

/**
 * Types of events sent over the SSE connection
 */
export type SSEEventType = 'status-update' | 'log-entry' | 'keep-alive' | 'activity-event';

/**
 * Generic SSE event wrapper
 */
export interface SSEEvent<T extends SSEEventType, D> {
  type: T;
  data: D;
  timestamp: string;
}

// ============================================================================
// Phase Tree Types (for UI display)
// ============================================================================

/**
 * A phase node in the UI tree representation
 * For standard mode: phase > step > sub-phase hierarchy
 * For Ralph mode: flat list of 'task' nodes
 */
export interface PhaseTreeNode {
  id: string;
  label: string;
  status: PhaseStatus;
  type: 'phase' | 'step' | 'sub-phase' | 'task';
  depth: number;
  children?: PhaseTreeNode[];
  startedAt?: string;
  completedAt?: string;
  elapsed?: string;
  error?: string;
  /** Number of retry attempts made */
  'retry-count'?: number;
  /** ISO timestamp for next scheduled retry */
  'next-retry-at'?: string;
  /** Classified error category */
  'error-category'?: string;
}

// ============================================================================
// Status Update Types
// ============================================================================

/**
 * Current task information displayed prominently in the UI
 */
export interface CurrentTask {
  /** Full path to current position (e.g., "phase-1 > step-0 > implement") */
  path: string;
  /** The prompt being executed */
  prompt: string;
  /** ISO timestamp when task started */
  startedAt?: string;
  /** Elapsed time since start (human readable) */
  elapsed?: string;
}

/**
 * Sprint header information
 */
export interface SprintHeader {
  /** Sprint identifier */
  sprintId: string;
  /** Overall sprint status */
  status: SprintStatus;
  /** Execution mode: 'standard' (phase-based) or 'ralph' (goal-driven) */
  mode?: 'standard' | 'ralph';
  /** Goal description (Ralph mode only) */
  goal?: string;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Completed phases/tasks count */
  completedPhases: number;
  /** Total phases/tasks count */
  totalPhases: number;
  /** Current iteration number (for retry loops) */
  currentIteration?: number;
  /** Maximum iterations allowed */
  maxIterations?: number;
  /** ISO timestamp when sprint started */
  startedAt?: string;
  /** Total elapsed time */
  elapsed?: string;
  /** Estimated milliseconds remaining */
  estimatedRemainingMs?: number;
  /** Formatted estimated time remaining */
  estimatedRemaining?: string;
  /** Confidence level of the estimate */
  estimateConfidence?: 'low' | 'medium' | 'high' | 'no-data';
  /** Estimated completion time (ISO) */
  estimatedCompletionTime?: string;
  /** Total leaf-level phases for "Step X of Y" display */
  totalSteps?: number;
  /** Current step number (1-indexed for display) */
  currentStep?: number;
  /** Whether the sprint is stale (in-progress but inactive > 15 min) */
  isStale?: boolean;
}

/**
 * Hook task status for display in Ralph mode
 */
export interface HookTaskStatus {
  /** Hook identifier */
  hookId: string;
  /** Iteration number */
  iteration: number;
  /** Current status */
  status: 'spawned' | 'running' | 'completed' | 'failed' | 'in-progress';
  /** When spawned (ISO timestamp) */
  spawnedAt?: string;
  /** When completed (ISO timestamp) */
  completedAt?: string;
  /** Exit code if completed */
  exitCode?: number;
}

/**
 * Complete status update sent to clients
 */
export interface StatusUpdate {
  /** Sprint header with overall status */
  header: SprintHeader;
  /** Hierarchical phase tree for sidebar */
  phaseTree: PhaseTreeNode[];
  /** Current task being executed (if any) */
  currentTask: CurrentTask | null;
  /** Hook task statuses (Ralph mode) */
  hookTasks?: HookTaskStatus[];
  /** Raw progress data for debugging */
  raw?: CompiledProgress;
}

// ============================================================================
// Log Entry Types
// ============================================================================

/**
 * Type of log entry for styling
 */
export type LogEntryType = 'info' | 'start' | 'complete' | 'error' | 'warning' | 'skip';

/**
 * A log entry for the activity feed
 */
export interface LogEntry {
  /** Unique ID for this log entry */
  id: string;
  /** Type of log entry (for styling) */
  type: LogEntryType;
  /** Human-readable message */
  message: string;
  /** ISO timestamp */
  timestamp: string;
  /** Optional phase/step path context */
  context?: string;
}

// ============================================================================
// Server Configuration
// ============================================================================

/**
 * Configuration for the status server
 */
export interface ServerConfig {
  /** Port to listen on (default: 3100) */
  port: number;
  /** Host to bind to (default: localhost) */
  host: string;
  /** Path to sprint directory containing PROGRESS.yaml */
  sprintDir: string;
  /** Keep-alive interval in milliseconds (default: 15000) */
  keepAliveInterval?: number;
  /** File watcher debounce delay in milliseconds (default: 100) */
  debounceDelay?: number;
}

// ============================================================================
// SSE Event Payloads
// ============================================================================

/**
 * Status update event
 */
export type StatusUpdateEvent = SSEEvent<'status-update', StatusUpdate>;

/**
 * Log entry event
 */
export type LogEntryEvent = SSEEvent<'log-entry', LogEntry>;

/**
 * Keep-alive event (empty payload)
 */
export type KeepAliveEvent = SSEEvent<'keep-alive', null>;

/**
 * Activity event (tool usage from .sprint-activity.jsonl)
 */
export type ActivityEventSSE = SSEEvent<'activity-event', ActivityEvent>;

/**
 * Union of all SSE event types
 */
export type AnySSEEvent = StatusUpdateEvent | LogEntryEvent | KeepAliveEvent | ActivityEventSSE;

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  CompiledProgress,
  CompiledTopPhase,
  CompiledStep,
  CompiledPhase,
  PhaseStatus,
  SprintStatus,
};
