/**
 * Transcription Watcher for sprint activity
 * Watches transcription directory for .log files and extracts tool use activity
 * from the NDJSON stream format produced by Claude CLI
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import type { ActivityEvent, VerbosityLevel } from './activity-types.js';

/**
 * Events emitted by TranscriptionWatcher
 */
export interface TranscriptionWatcherEvents {
  activity: [event: ActivityEvent];
  error: [error: Error];
  ready: [];
  close: [];
}

/**
 * Options for TranscriptionWatcher
 */
export interface TranscriptionWatcherOptions {
  /** Debounce delay in milliseconds (default: 100) */
  debounceDelay?: number;
  /** Maximum events to keep in memory (default: 200) */
  maxEvents?: number;
}

const DEFAULT_DEBOUNCE_DELAY = 100;
const DEFAULT_MAX_EVENTS = 200;

/**
 * Determine verbosity level for a tool
 */
function getToolVerbosityLevel(toolName: string): VerbosityLevel {
  // Minimal: major milestones only
  const minimalTools = ['TodoWrite', 'AskUserQuestion'];
  if (minimalTools.includes(toolName)) {
    return 'minimal';
  }

  // Basic: file operations
  const basicTools = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];
  if (basicTools.includes(toolName)) {
    return 'basic';
  }

  // Detailed: everything else
  return 'detailed';
}

/**
 * Extract file path from tool input
 */
function extractFilePath(toolName: string, input: Record<string, unknown>): string | undefined {
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return input.file_path as string | undefined;
    case 'Glob':
      return input.pattern as string | undefined;
    case 'Grep':
      return input.path as string | undefined;
    default:
      return undefined;
  }
}

/**
 * Extract params summary from tool input
 */
function extractParams(toolName: string, input: Record<string, unknown>): string | undefined {
  switch (toolName) {
    case 'Bash':
      return input.command as string | undefined;
    case 'Grep':
      return input.pattern as string | undefined;
    case 'Task':
      return input.description as string | undefined;
    default:
      return undefined;
  }
}

/**
 * Watches transcription files for tool use activity
 *
 * Parses NDJSON stream format from Claude CLI:
 * - Looks for content_block_start events with tool_use
 * - Extracts tool name and parameters
 * - Emits ActivityEvent for each tool use
 */
export class TranscriptionWatcher extends EventEmitter {
  private readonly transcriptionsDir: string;
  private readonly debounceDelay: number;
  private readonly maxEvents: number;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosing = false;
  private filePositions: Map<string, number> = new Map();
  private seenToolUseIds: Set<string> = new Set();
  private recentActivity: ActivityEvent[] = [];

  constructor(transcriptionsDir: string, options: TranscriptionWatcherOptions = {}) {
    super();
    this.transcriptionsDir = path.resolve(transcriptionsDir);
    this.debounceDelay = options.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
    this.maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
  }

  /**
   * Start watching the transcriptions directory
   */
  start(): void {
    if (this.watcher) {
      return; // Already watching
    }

    console.log(`[TranscriptionWatcher] Starting to watch: ${this.transcriptionsDir}`);

    // Ensure directory exists
    if (!fs.existsSync(this.transcriptionsDir)) {
      try {
        fs.mkdirSync(this.transcriptionsDir, { recursive: true });
      } catch (error) {
        this.emit('error', new Error(`Failed to create transcriptions directory: ${error instanceof Error ? error.message : String(error)}`));
        return;
      }
    }

    try {
      // Read existing transcription files
      this.readExistingFiles();
      console.log(`[TranscriptionWatcher] Found ${this.recentActivity.length} activity events from transcriptions`);

      // Watch the directory for changes
      this.watcher = fs.watch(this.transcriptionsDir, { persistent: true }, (eventType, filename) => {
        if (this.isClosing) return;

        // Only process .log files
        if (filename && filename.endsWith('.log')) {
          this.handleFileEvent(filename);
        }
      });

      this.watcher.on('error', (error) => {
        if (!this.isClosing) {
          this.emit('error', error);
        }
      });

      // Emit ready after watcher is set up
      process.nextTick(() => {
        if (!this.isClosing) {
          this.emit('ready');
        }
      });
    } catch (error) {
      this.emit('error', new Error(`Failed to watch transcriptions: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Read existing transcription files and extract activity
   */
  private readExistingFiles(): void {
    try {
      const files = fs.readdirSync(this.transcriptionsDir)
        .filter(f => f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.transcriptionsDir, f),
          mtime: fs.statSync(path.join(this.transcriptionsDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => a.mtime - b.mtime); // Oldest first

      for (const file of files) {
        this.processFile(file.path, false);
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to read existing files: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Handle file system events with debouncing
   */
  private handleFileEvent(filename: string): void {
    // Clear any pending debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Set up new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      const filePath = path.join(this.transcriptionsDir, filename);
      this.processFile(filePath, true);
    }, this.debounceDelay);
  }

  /**
   * Process a transcription file and extract tool use activity
   */
  private processFile(filePath: string, incrementalOnly: boolean): void {
    if (!fs.existsSync(filePath)) {
      return;
    }

    try {
      const stats = fs.statSync(filePath);
      const lastPosition = this.filePositions.get(filePath) ?? 0;

      // Check for truncation
      if (stats.size < lastPosition) {
        this.filePositions.set(filePath, 0);
        return this.processFile(filePath, false);
      }

      // Skip if no new content
      if (incrementalOnly && stats.size <= lastPosition) {
        return;
      }

      // Read new content
      const startPos = incrementalOnly ? lastPosition : 0;
      const fd = fs.openSync(filePath, 'r');
      try {
        const bufferSize = stats.size - startPos;
        if (bufferSize <= 0) return;

        const buffer = Buffer.alloc(bufferSize);
        fs.readSync(fd, buffer, 0, bufferSize, startPos);

        const content = buffer.toString('utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            this.parseLine(line);
          }
        }

        this.filePositions.set(filePath, stats.size);
      } finally {
        fs.closeSync(fd);
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to process file ${filePath}: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Parse a single NDJSON line and emit activity if it's a tool use
   */
  private parseLine(line: string): void {
    try {
      const event = JSON.parse(line);

      // Look for tool_use content blocks in stream events
      const isToolUse = event.type === 'stream_event' &&
          event.event?.type === 'content_block_start' &&
          event.event?.content_block?.type === 'tool_use';

      if (isToolUse) {

        const toolUse = event.event.content_block;
        const toolUseId = toolUse.id;

        // Skip if we've already seen this tool use
        if (this.seenToolUseIds.has(toolUseId)) {
          return;
        }
        this.seenToolUseIds.add(toolUseId);

        // Limit memory usage
        if (this.seenToolUseIds.size > this.maxEvents * 2) {
          const idsArray = Array.from(this.seenToolUseIds);
          this.seenToolUseIds = new Set(idsArray.slice(-this.maxEvents));
        }

        const toolName = toolUse.name;
        const input = toolUse.input || {};

        const activityEvent: ActivityEvent = {
          ts: new Date().toISOString(),
          type: 'tool',
          tool: toolName,
          level: getToolVerbosityLevel(toolName),
          file: extractFilePath(toolName, input),
          params: extractParams(toolName, input),
        };

        // Store in recent activity (for historical queries)
        this.recentActivity.push(activityEvent);
        if (this.recentActivity.length > this.maxEvents) {
          this.recentActivity = this.recentActivity.slice(-this.maxEvents);
        }

        this.emit('activity', activityEvent);
      }

      // Also look for tool_result to get timing info
      if (event.type === 'tool_result') {
        // Could emit completion events here if needed
      }

    } catch {
      // Invalid JSON, skip silently
    }
  }

  /**
   * Stop watching and clean up resources
   */
  close(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.emit('close');
  }

  /**
   * Get the directory being watched
   */
  getDirectory(): string {
    return this.transcriptionsDir;
  }

  /**
   * Check if the watcher is active
   */
  isWatching(): boolean {
    return this.watcher !== null && !this.isClosing;
  }

  /**
   * Get recent activity events (for historical queries by new SSE clients)
   * Returns most recent events up to the specified limit
   */
  getRecentActivity(limit: number = 50): ActivityEvent[] {
    return this.recentActivity.slice(-limit);
  }
}
