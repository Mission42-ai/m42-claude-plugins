/**
 * Agent Watcher for agent monitor events
 * Watches .agent-events.jsonl file and tracks agent state for workflow visualization
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import type {
  AgentEvent,
  AgentState,
  AgentMonitorState,
  AgentWatcherOptions,
  AgentSpawnEvent,
  AgentToolStartEvent,
  AgentToolEndEvent,
  AgentCompleteEvent,
  SubagentSpawnEvent,
  SubagentCompleteEvent,
} from './agent-types.js';
import {
  isAgentEvent,
  createAgentState,
  getEmotionFromTool,
  AGENT_EVENTS_FILE,
} from './agent-types.js';

/**
 * Events emitted by AgentWatcher
 */
export interface AgentWatcherEvents {
  /** Emitted when an agent event is received */
  'agent-event': [event: AgentEvent, state: AgentState | null];
  /** Emitted when error occurs */
  error: [error: Error];
  /** Emitted when watcher is ready */
  ready: [];
  /** Emitted when watcher is closed */
  close: [];
}

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
export class AgentWatcher extends EventEmitter {
  private readonly filePath: string;
  private readonly debounceDelay: number;
  private readonly staleTimeout: number;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private staleCleanupTimer: ReturnType<typeof setInterval> | null = null;
  private isClosing = false;
  private lastPosition = 0;
  private lastSize = 0;

  /** Live agent state */
  private state: AgentMonitorState = {
    agents: new Map(),
    stepToAgent: new Map(),
    lastUpdate: new Date().toISOString(),
  };

  constructor(sprintDir: string, options: AgentWatcherOptions = {}) {
    super();
    this.filePath = path.join(sprintDir, AGENT_EVENTS_FILE);
    this.debounceDelay = options.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
    this.staleTimeout = options.staleTimeout ?? DEFAULT_STALE_TIMEOUT;
  }

  /**
   * Start watching the agent events file
   */
  start(): void {
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
        if (this.isClosing) return;

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
    } catch (error) {
      this.emit('error', new Error(`Failed to watch agent events: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Read initial content from file
   */
  private readInitialContent(): void {
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
    } catch (error) {
      this.emit('error', new Error(`Failed to read initial agent events: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Handle file system events with debouncing
   */
  private handleFileEvent(): void {
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
  private processFileChange(): void {
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
      } finally {
        fs.closeSync(fd);
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to read agent events: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Parse a single JSONL line and update state
   */
  private parseLine(line: string, shouldEmit: boolean): void {
    try {
      const parsed = JSON.parse(line);

      if (!isAgentEvent(parsed)) {
        return; // Skip invalid events
      }

      // Update state based on event type
      const agentState = this.processEvent(parsed);

      // Emit event with current state
      if (shouldEmit) {
        this.emit('agent-event', parsed, agentState);
      }
    } catch (error) {
      // Invalid JSON, skip this line
      console.warn(`[AgentWatcher] Skipping corrupted line: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process an event and update agent state
   */
  private processEvent(event: AgentEvent): AgentState | null {
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
  private handleSpawn(event: AgentSpawnEvent): AgentState {
    const agentState = createAgentState(event);

    this.state.agents.set(event.sessionId, agentState);
    this.state.stepToAgent.set(event.stepId, event.sessionId);

    return agentState;
  }

  /**
   * Handle tool start event
   */
  private handleToolStart(event: AgentToolStartEvent): AgentState | null {
    const agent = this.state.agents.get(event.sessionId);
    if (!agent) return null;

    agent.currentTool = event.tool;
    agent.currentFile = event.file;
    agent.emotion = getEmotionFromTool(event.tool);
    agent.lastActivityAt = event.ts;

    return agent;
  }

  /**
   * Handle tool end event
   */
  private handleToolEnd(event: AgentToolEndEvent): AgentState | null {
    const agent = this.state.agents.get(event.sessionId);
    if (!agent) return null;

    agent.currentTool = undefined;
    agent.currentFile = undefined;
    agent.emotion = 'thinking';
    agent.lastActivityAt = event.ts;

    return agent;
  }

  /**
   * Handle agent complete event
   */
  private handleComplete(event: AgentCompleteEvent): AgentState | null {
    const agent = this.state.agents.get(event.sessionId);
    if (!agent) return null;

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
  private handleSubagentSpawn(event: SubagentSpawnEvent): AgentState | null {
    const agent = this.state.agents.get(event.sessionId);
    if (!agent) return null;

    agent.subagentCount++;
    agent.lastActivityAt = event.ts;

    return agent;
  }

  /**
   * Handle subagent complete event
   */
  private handleSubagentComplete(event: SubagentCompleteEvent): AgentState | null {
    const agent = this.state.agents.get(event.sessionId);
    if (!agent) return null;

    agent.subagentCount = Math.max(0, agent.subagentCount - 1);
    agent.lastActivityAt = event.ts;

    return agent;
  }

  /**
   * Clean up stale agents (no activity for staleTimeout)
   */
  private cleanupStaleAgents(): void {
    const now = Date.now();
    const staleIds: string[] = [];

    for (const [sessionId, agent] of this.state.agents) {
      if (!agent.isActive) continue;

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
  getState(): AgentMonitorState {
    return this.state;
  }

  /**
   * Get all active agents as array
   */
  getActiveAgents(): AgentState[] {
    return Array.from(this.state.agents.values()).filter(a => a.isActive);
  }

  /**
   * Get agent by step ID
   */
  getAgentForStep(stepId: string): AgentState | null {
    const sessionId = this.state.stepToAgent.get(stepId);
    if (!sessionId) return null;
    return this.state.agents.get(sessionId) ?? null;
  }

  /**
   * Stop watching and clean up resources
   */
  close(): void {
    if (this.isClosing) return;
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
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Check if the watcher is active
   */
  isWatching(): boolean {
    return this.watcher !== null && !this.isClosing;
  }
}
