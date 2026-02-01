"use strict";
/**
 * Agent Watcher for agent monitor events
 * Watches .agent-events.jsonl file and tracks agent state for workflow visualization
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentWatcher = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const agent_types_js_1 = require("./agent-types.js");
const DEFAULT_DEBOUNCE_DELAY = 100;
const DEFAULT_STALE_TIMEOUT = 60_000; // 1 minute
/**
 * Watches .agent-events.jsonl and maintains live agent state
 *
 * Provides:
 * - Real-time agent event streaming
 * - Computed agent state (emotion, current tool, etc.)
 * - Step-to-agent mapping for workflow visualization
 * - Stale agent cleanup
 */
class AgentWatcher extends events_1.EventEmitter {
    filePath;
    debounceDelay;
    staleTimeout;
    watcher = null;
    debounceTimer = null;
    staleCleanupTimer = null;
    isClosing = false;
    lastPosition = 0;
    lastSize = 0;
    /** Live agent state */
    state = {
        agents: new Map(),
        stepToAgent: new Map(),
        lastUpdate: new Date().toISOString(),
    };
    constructor(sprintDir, options = {}) {
        super();
        this.filePath = path.join(sprintDir, agent_types_js_1.AGENT_EVENTS_FILE);
        this.debounceDelay = options.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
        this.staleTimeout = options.staleTimeout ?? DEFAULT_STALE_TIMEOUT;
    }
    /**
     * Start watching the agent events file
     */
    start() {
        if (this.watcher) {
            return; // Already watching
        }
        const dir = path.dirname(this.filePath);
        const filename = path.basename(this.filePath);
        // Ensure directory exists
        if (!fs.existsSync(dir)) {
            // Don't error - sprint directory may not have agent events yet
            this.emit('ready');
            return;
        }
        try {
            // Read initial content if file exists
            if (fs.existsSync(this.filePath)) {
                this.readInitialContent();
            }
            // Watch the directory to handle file creation/deletion
            this.watcher = fs.watch(dir, { persistent: true }, (eventType, changedFile) => {
                if (this.isClosing)
                    return;
                // Only process events for our target file
                if (changedFile === filename) {
                    this.handleFileEvent();
                }
            });
            this.watcher.on('error', (error) => {
                if (!this.isClosing) {
                    this.emit('error', error);
                }
            });
            // Start stale agent cleanup timer
            this.staleCleanupTimer = setInterval(() => {
                this.cleanupStaleAgents();
            }, Math.max(this.staleTimeout / 2, 5000));
            // Emit ready after watcher is set up
            process.nextTick(() => {
                if (!this.isClosing) {
                    this.emit('ready');
                }
            });
        }
        catch (error) {
            this.emit('error', new Error(`Failed to watch agent events: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    /**
     * Read initial content from file
     */
    readInitialContent() {
        try {
            const stats = fs.statSync(this.filePath);
            this.lastSize = stats.size;
            if (stats.size === 0) {
                this.lastPosition = 0;
                return;
            }
            // Read entire file and process all events to build state
            const content = fs.readFileSync(this.filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim() !== '');
            // Process all lines to build complete state
            for (const line of lines) {
                this.parseLine(line, false); // Don't emit during initial load
            }
            // Set position to end of file for incremental reads
            this.lastPosition = stats.size;
        }
        catch (error) {
            this.emit('error', new Error(`Failed to read initial agent events: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    /**
     * Handle file system events with debouncing
     */
    handleFileEvent() {
        // Clear any pending debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        // Set up new debounce timer
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.processFileChange();
        }, this.debounceDelay);
    }
    /**
     * Process file change - read new content since last position
     */
    processFileChange() {
        // Check if file exists
        if (!fs.existsSync(this.filePath)) {
            // File was deleted, reset state
            this.lastPosition = 0;
            this.lastSize = 0;
            this.state.agents.clear();
            this.state.stepToAgent.clear();
            return;
        }
        try {
            const stats = fs.statSync(this.filePath);
            // Detect file rotation (truncation)
            if (stats.size < this.lastSize) {
                // File was truncated, reset and rebuild state
                this.lastPosition = 0;
                this.state.agents.clear();
                this.state.stepToAgent.clear();
            }
            this.lastSize = stats.size;
            // No new content
            if (stats.size <= this.lastPosition) {
                return;
            }
            // Read new content from last position
            const fd = fs.openSync(this.filePath, 'r');
            try {
                const bufferSize = stats.size - this.lastPosition;
                const buffer = Buffer.alloc(bufferSize);
                fs.readSync(fd, buffer, 0, bufferSize, this.lastPosition);
                const content = buffer.toString('utf-8');
                const lines = content.split('\n');
                // Parse each complete line
                for (const line of lines) {
                    if (line.trim() !== '') {
                        this.parseLine(line, true); // Emit events for new lines
                    }
                }
                this.lastPosition = stats.size;
            }
            finally {
                fs.closeSync(fd);
            }
        }
        catch (error) {
            this.emit('error', new Error(`Failed to read agent events: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    /**
     * Parse a single JSONL line and update state
     */
    parseLine(line, shouldEmit) {
        try {
            const parsed = JSON.parse(line);
            if (!(0, agent_types_js_1.isAgentEvent)(parsed)) {
                return; // Skip invalid events
            }
            // Update state based on event type
            const agentState = this.processEvent(parsed);
            // Emit event with current state
            if (shouldEmit) {
                this.emit('agent-event', parsed, agentState);
            }
        }
        catch (error) {
            // Invalid JSON, skip this line
            console.warn(`[AgentWatcher] Skipping corrupted line: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Process an event and update agent state
     */
    processEvent(event) {
        this.state.lastUpdate = event.ts;
        switch (event.type) {
            case 'spawn':
                return this.handleSpawn(event);
            case 'tool_start':
                return this.handleToolStart(event);
            case 'tool_end':
                return this.handleToolEnd(event);
            case 'complete':
                return this.handleComplete(event);
            case 'subagent_spawn':
                return this.handleSubagentSpawn(event);
            case 'subagent_complete':
                return this.handleSubagentComplete(event);
            default:
                return null;
        }
    }
    /**
     * Handle agent spawn event
     */
    handleSpawn(event) {
        const agentState = (0, agent_types_js_1.createAgentState)(event);
        this.state.agents.set(event.sessionId, agentState);
        this.state.stepToAgent.set(event.stepId, event.sessionId);
        return agentState;
    }
    /**
     * Handle tool start event
     */
    handleToolStart(event) {
        const agent = this.state.agents.get(event.sessionId);
        if (!agent)
            return null;
        agent.currentTool = event.tool;
        agent.currentFile = event.file;
        agent.emotion = (0, agent_types_js_1.getEmotionFromTool)(event.tool);
        agent.lastActivityAt = event.ts;
        return agent;
    }
    /**
     * Handle tool end event
     */
    handleToolEnd(event) {
        const agent = this.state.agents.get(event.sessionId);
        if (!agent)
            return null;
        agent.currentTool = undefined;
        agent.currentFile = undefined;
        agent.emotion = 'thinking';
        agent.lastActivityAt = event.ts;
        return agent;
    }
    /**
     * Handle agent complete event
     */
    handleComplete(event) {
        const agent = this.state.agents.get(event.sessionId);
        if (!agent)
            return null;
        agent.isActive = false;
        agent.emotion = event.status === 'success' ? 'success' : 'failed';
        agent.lastActivityAt = event.ts;
        // Remove step mapping but keep agent state briefly for UI transition
        this.state.stepToAgent.delete(agent.stepId);
        // Schedule removal after brief delay for UI animation
        setTimeout(() => {
            this.state.agents.delete(event.sessionId);
        }, 3000);
        return agent;
    }
    /**
     * Handle subagent spawn event
     */
    handleSubagentSpawn(event) {
        const agent = this.state.agents.get(event.sessionId);
        if (!agent)
            return null;
        agent.subagentCount++;
        agent.lastActivityAt = event.ts;
        return agent;
    }
    /**
     * Handle subagent complete event
     */
    handleSubagentComplete(event) {
        const agent = this.state.agents.get(event.sessionId);
        if (!agent)
            return null;
        agent.subagentCount = Math.max(0, agent.subagentCount - 1);
        agent.lastActivityAt = event.ts;
        return agent;
    }
    /**
     * Clean up stale agents (no activity for staleTimeout)
     */
    cleanupStaleAgents() {
        const now = Date.now();
        const staleIds = [];
        for (const [sessionId, agent] of this.state.agents) {
            if (!agent.isActive)
                continue;
            const lastActivity = new Date(agent.lastActivityAt).getTime();
            if (now - lastActivity > this.staleTimeout) {
                staleIds.push(sessionId);
            }
        }
        for (const sessionId of staleIds) {
            const agent = this.state.agents.get(sessionId);
            if (agent) {
                this.state.stepToAgent.delete(agent.stepId);
                this.state.agents.delete(sessionId);
                console.log(`[AgentWatcher] Cleaned up stale agent: ${agent.name} (${sessionId})`);
            }
        }
    }
    /**
     * Get current agent state
     */
    getState() {
        return this.state;
    }
    /**
     * Get all active agents as array
     */
    getActiveAgents() {
        return Array.from(this.state.agents.values()).filter(a => a.isActive);
    }
    /**
     * Get agent by step ID
     */
    getAgentForStep(stepId) {
        const sessionId = this.state.stepToAgent.get(stepId);
        if (!sessionId)
            return null;
        return this.state.agents.get(sessionId) ?? null;
    }
    /**
     * Stop watching and clean up resources
     */
    close() {
        if (this.isClosing)
            return;
        this.isClosing = true;
        // Clear timers
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.staleCleanupTimer) {
            clearInterval(this.staleCleanupTimer);
            this.staleCleanupTimer = null;
        }
        // Close watcher
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        this.emit('close');
    }
    /**
     * Get the path being watched
     */
    getFilePath() {
        return this.filePath;
    }
    /**
     * Check if the watcher is active
     */
    isWatching() {
        return this.watcher !== null && !this.isClosing;
    }
}
exports.AgentWatcher = AgentWatcher;
//# sourceMappingURL=agent-watcher.js.map