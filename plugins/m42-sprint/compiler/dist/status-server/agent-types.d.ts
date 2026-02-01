/**
 * TypeScript types for agent monitoring and workflow visualization
 * Used by AgentWatcher to track Claude agent activity during sprint execution
 */
/**
 * Playful agent names derived deterministically from session_id
 */
export declare const AGENT_NAMES: readonly ["Klaus", "Luna", "Max", "Mia", "Felix", "Emma", "Leo", "Sophie", "Finn", "Lara"];
/**
 * Agent emotion states for avatar display
 */
export type AgentEmotion = 'working' | 'thinking' | 'reading' | 'success' | 'failed';
/**
 * Emoji mapping for agent emotions
 */
export declare const AGENT_EMOTIONS: Record<AgentEmotion, string>;
/**
 * Get deterministic agent name from session_id
 */
export declare function getAgentName(sessionId: string): string;
/**
 * Get emoji avatar based on current activity
 */
export declare function getAgentEmoji(emotion: AgentEmotion): string;
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
export type AgentEvent = AgentSpawnEvent | AgentToolStartEvent | AgentToolEndEvent | AgentCompleteEvent | SubagentSpawnEvent | SubagentCompleteEvent;
/**
 * Type guard to check if an object is a valid AgentEvent
 */
export declare function isAgentEvent(obj: unknown): obj is AgentEvent;
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
export declare function createAgentState(event: AgentSpawnEvent): AgentState;
/**
 * Derive emotion from current tool usage
 */
export declare function getEmotionFromTool(tool: string | undefined): AgentEmotion;
/**
 * Default agent events file name
 */
export declare const AGENT_EVENTS_FILE = ".agent-events.jsonl";
/**
 * Options for AgentWatcher
 */
export interface AgentWatcherOptions {
    /** Debounce delay in milliseconds (default: 100) */
    debounceDelay?: number;
    /** Stale agent timeout in milliseconds (default: 60000 = 1 minute) */
    staleTimeout?: number;
}
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
export {};
//# sourceMappingURL=agent-types.d.ts.map