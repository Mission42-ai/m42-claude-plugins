"use strict";
/**
 * TypeScript types for agent monitoring and workflow visualization
 * Used by AgentWatcher to track Claude agent activity during sprint execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_EVENTS_FILE = exports.AGENT_EMOTIONS = exports.AGENT_NAMES = void 0;
exports.getAgentName = getAgentName;
exports.getAgentEmoji = getAgentEmoji;
exports.isAgentEvent = isAgentEvent;
exports.createAgentState = createAgentState;
exports.getEmotionFromTool = getEmotionFromTool;
// ============================================================================
// Agent Identity
// ============================================================================
/**
 * Playful agent names derived deterministically from session_id
 */
exports.AGENT_NAMES = [
    'Klaus', 'Luna', 'Max', 'Mia', 'Felix',
    'Emma', 'Leo', 'Sophie', 'Finn', 'Lara',
];
/**
 * Emoji mapping for agent emotions
 */
exports.AGENT_EMOTIONS = {
    working: '😉',
    thinking: '🤔',
    reading: '🧐',
    success: '😊',
    failed: '😵',
};
/**
 * Get deterministic agent name from session_id
 */
function getAgentName(sessionId) {
    // Simple hash: sum of char codes mod length
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
        hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % exports.AGENT_NAMES.length;
    return exports.AGENT_NAMES[index];
}
/**
 * Get emoji avatar based on current activity
 */
function getAgentEmoji(emotion) {
    return exports.AGENT_EMOTIONS[emotion];
}
/**
 * Type guard to check if an object is a valid AgentEvent
 */
function isAgentEvent(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const event = obj;
    // Required base fields
    if (typeof event.ts !== 'string')
        return false;
    if (typeof event.sessionId !== 'string')
        return false;
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
/**
 * Create an initial agent state from a spawn event
 */
function createAgentState(event) {
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
function getEmotionFromTool(tool) {
    if (!tool)
        return 'thinking';
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
exports.AGENT_EVENTS_FILE = '.agent-events.jsonl';
//# sourceMappingURL=agent-types.js.map