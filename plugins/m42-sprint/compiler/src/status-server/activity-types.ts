/**
 * TypeScript types for activity event streaming
 * Used by ActivityWatcher to parse and validate events from .sprint-activity.jsonl
 */

// ============================================================================
// Verbosity Levels
// ============================================================================

/**
 * Verbosity levels for filtering activity events
 * Each level includes events of lower levels:
 * - minimal: Only major milestones
 * - basic: File operations (Read, Write, Edit)
 * - detailed: All tool calls with parameters
 * - verbose: Full input/output data
 */
export type VerbosityLevel = 'minimal' | 'basic' | 'detailed' | 'verbose';

/**
 * Numeric ordering of verbosity levels for comparison
 */
export const VERBOSITY_ORDER: Record<VerbosityLevel, number> = {
  minimal: 0,
  basic: 1,
  detailed: 2,
  verbose: 3,
};

/**
 * Check if an event level should be shown at a given display level
 */
export function shouldShowAtLevel(eventLevel: VerbosityLevel, displayLevel: VerbosityLevel): boolean {
  return VERBOSITY_ORDER[eventLevel] <= VERBOSITY_ORDER[displayLevel];
}

// ============================================================================
// Activity Event Types
// ============================================================================

/**
 * Activity event from .sprint-activity.jsonl file
 * Written by sprint-activity-hook.sh
 */
export interface ActivityEvent {
  /** ISO-8601 timestamp */
  ts: string;
  /** Event type (currently only 'tool') */
  type: 'tool';
  /** Tool name (Read, Write, Bash, Edit, Grep, Glob, etc.) */
  tool: string;
  /** Verbosity level this event belongs to */
  level: VerbosityLevel;
  /** File path (for Read, Write, Edit operations) */
  file?: string;
  /** Additional parameters (for Bash commands, Grep patterns, etc.) */
  params?: string;
  /** Full tool input (verbose level only) */
  input?: unknown;
  /** Full tool response (verbose level only) */
  response?: unknown;
}

/**
 * Type guard to check if an object is a valid ActivityEvent
 */
export function isActivityEvent(obj: unknown): obj is ActivityEvent {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const event = obj as Record<string, unknown>;

  // Required fields
  if (typeof event.ts !== 'string') return false;
  if (event.type !== 'tool') return false;
  if (typeof event.tool !== 'string') return false;
  if (!isVerbosityLevel(event.level)) return false;

  // Optional fields must be correct type if present
  if (event.file !== undefined && typeof event.file !== 'string') return false;
  if (event.params !== undefined && typeof event.params !== 'string') return false;

  return true;
}

/**
 * Type guard for VerbosityLevel
 */
export function isVerbosityLevel(value: unknown): value is VerbosityLevel {
  return value === 'minimal' || value === 'basic' || value === 'detailed' || value === 'verbose';
}

// ============================================================================
// Activity Watcher Configuration
// ============================================================================

/**
 * Options for ActivityWatcher
 */
export interface ActivityWatcherOptions {
  /** Debounce delay in milliseconds (default: 100) */
  debounceDelay?: number;
  /** Initial lines to read from end of file (default: 50) */
  tailLines?: number;
}

// ============================================================================
// SSE Event Types for Activity
// ============================================================================

/**
 * SSE event for activity updates
 */
export interface ActivityEventSSE {
  type: 'activity-event';
  data: ActivityEvent;
  timestamp: string;
}
