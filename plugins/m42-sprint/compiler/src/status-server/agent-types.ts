/**
 * TypeScript types for agent monitoring and workflow visualization
 * Used by AgentWatcher to track Claude agent activity during sprint execution
 */

// ============================================================================
// Agent Identity
// ============================================================================

/**
 * Playful agent names derived deterministically from session_id
 */
export const AGENT_NAMES = [
  'Klaus', 'Luna', 'Max', 'Mia', 'Felix',
  'Emma', 'Leo', 'Sophie', 'Finn', 'Lara',
] as const;

/**
 * Agent emotion states for avatar display
 */
export type AgentEmotion = 'working' | 'thinking' | 'reading' | 'success' | 'failed';

/**
 * Emoji mapping for agent emotions
 */
export const AGENT_EMOTIONS: Record<AgentEmotion, string> = {
  working: '😉',
  thinking: '🤔',
  reading: '🧐',
  success: '😊',
  failed: '😵',
};

/**
 * Get deterministic agent name from session_id
 */
export function getAgentName(sessionId: string): string {
  // Simple hash: sum of char codes mod length
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % AGENT_NAMES.length;
  return AGENT_NAMES[index];
}

/**
 * Get emoji avatar based on current activity
 */
export function getAgentEmoji(emotion: AgentEmotion): string {
  return AGENT_EMOTIONS[emotion];
}

// ============================================================================
// Agent Event Types (written to .agent-events.jsonl)
// ============================================================================

/**
 * Base fields shared by all agent events
 */
interface BaseAgentEvent {
  /** ISO-8601 timestamp */
  ts: string;
  /** Claude session ID */
  sessionId: string;
}

/**
 * Agent spawn event - when a Claude process starts for a step
 */
export interface AgentSpawnEvent extends BaseAgentEvent {
  type: 'spawn';
  /** Step ID this agent is working on */
  stepId: string;
}

/**
 * Tool start event - when an agent begins using a tool
 */
export interface AgentToolStartEvent extends BaseAgentEvent {
  type: 'tool_start';
  /** Tool name (Read, Edit, Bash, etc.) */
  tool: string;
  /** File path (for file operations) */
  file?: string;
  /** Command (for Bash) */
  command?: string;
  /** Tool use ID for correlation */
  toolUseId?: string;
}

/**
 * Tool end event - when an agent finishes using a tool
 */
export interface AgentToolEndEvent extends BaseAgentEvent {
  type: 'tool_end';
  /** Tool name */
  tool: string;
  /** Tool use ID for correlation */
  toolUseId?: string;
  /** Success indicator */
  success?: boolean;
}

/**
 * Agent complete event - when a Claude process finishes
 */
export interface AgentCompleteEvent extends BaseAgentEvent {
  type: 'complete';
  /** Exit status */
  status: 'success' | 'failed' | 'cancelled';
  /** Error message if failed */
  error?: string;
}

/**
 * Subagent spawn event - when Task tool spawns a subagent
 */
export interface SubagentSpawnEvent extends BaseAgentEvent {
  type: 'subagent_spawn';
  /** Subagent ID */
  agentId: string;
  /** Subagent type */
  agentType?: string;
}

/**
 * Subagent complete event - when a subagent finishes
 */
export interface SubagentCompleteEvent extends BaseAgentEvent {
  type: 'subagent_complete';
  /** Subagent ID */
  agentId: string;
}

/**
 * Union of all agent event types
 */
export type AgentEvent =
  | AgentSpawnEvent
  | AgentToolStartEvent
  | AgentToolEndEvent
  | AgentCompleteEvent
  | SubagentSpawnEvent
  | SubagentCompleteEvent;

/**
 * Type guard to check if an object is a valid AgentEvent
 */
export function isAgentEvent(obj: unknown): obj is AgentEvent {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const event = obj as Record<string, unknown>;

  // Required base fields
  if (typeof event.ts !== 'string') return false;
  if (typeof event.sessionId !== 'string') return false;

  // Validate by type
  switch (event.type) {
    case 'spawn':
      return typeof event.stepId === 'string';

    case 'tool_start':
      return typeof event.tool === 'string';

    case 'tool_end':
      return typeof event.tool === 'string';

    case 'complete':
      return event.status === 'success' || event.status === 'failed' || event.status === 'cancelled';

    case 'subagent_spawn':
      return typeof event.agentId === 'string';

    case 'subagent_complete':
      return typeof event.agentId === 'string';

    default:
      return false;
  }
}

// ============================================================================
// Agent State (derived from events)
// ============================================================================

/**
 * Live state of an agent (computed from events)
 */
export interface AgentState {
  /** Claude session ID */
  sessionId: string;
  /** Derived agent name (Klaus, Luna, etc.) */
  name: string;
  /** Step ID this agent is working on */
  stepId: string;
  /** Current emotion/status */
  emotion: AgentEmotion;
  /** Current tool being used (if any) */
  currentTool?: string;
  /** Current file being worked on (if any) */
  currentFile?: string;
  /** When the agent spawned */
  spawnedAt: string;
  /** When the last activity occurred */
  lastActivityAt: string;
  /** Active subagent count */
  subagentCount: number;
  /** Whether the agent is still active */
  isActive: boolean;
}

/**
 * Aggregate agent state for UI display
 */
export interface AgentMonitorState {
  /** Map of sessionId -> AgentState for active agents */
  agents: Map<string, AgentState>;
  /** Map of stepId -> sessionId for quick lookup */
  stepToAgent: Map<string, string>;
  /** Last update timestamp */
  lastUpdate: string;
}

/**
 * Create an initial agent state from a spawn event
 */
export function createAgentState(event: AgentSpawnEvent): AgentState {
  return {
    sessionId: event.sessionId,
    name: getAgentName(event.sessionId),
    stepId: event.stepId,
    emotion: 'thinking',
    spawnedAt: event.ts,
    lastActivityAt: event.ts,
    subagentCount: 0,
    isActive: true,
  };
}

/**
 * Derive emotion from current tool usage
 */
export function getEmotionFromTool(tool: string | undefined): AgentEmotion {
  if (!tool) return 'thinking';

  const readTools = ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];
  if (readTools.includes(tool)) {
    return 'reading';
  }

  return 'working';
}

// ============================================================================
// Agent Watcher Configuration
// ============================================================================

/**
 * Default agent events file name
 */
export const AGENT_EVENTS_FILE = '.agent-events.jsonl';

/**
 * Options for AgentWatcher
 */
export interface AgentWatcherOptions {
  /** Debounce delay in milliseconds (default: 100) */
  debounceDelay?: number;
  /** Stale agent timeout in milliseconds (default: 60000 = 1 minute) */
  staleTimeout?: number;
}

// ============================================================================
// SSE Event Types for Agent Updates
// ============================================================================

/**
 * Agent update event for SSE broadcast
 */
export interface AgentUpdatePayload {
  /** The event that triggered this update */
  event: AgentEvent;
  /** Current state of the affected agent */
  agentState?: AgentState;
  /** All active agents (for full refresh) */
  allAgents?: AgentState[];
}
