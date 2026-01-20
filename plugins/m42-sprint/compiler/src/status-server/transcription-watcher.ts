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
const TEXT_DEBOUNCE_DELAY = 500; // 500ms debounce for text accumulation

/**
 * Determine verbosity level for a tool
 * NOTE: Similar logic exists in sprint-activity-hook.sh - keep in sync
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
 * NOTE: Similar logic exists in sprint-activity-hook.sh - keep in sync
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
 * NOTE: Similar logic exists in sprint-activity-hook.sh - keep in sync
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
/**
 * State for tracking text block accumulation
 */
interface TextBlockState {
  index: number;
  text: string;
  startTime: number;
  stopped: boolean;
}

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

  // Text block accumulation state
  private textBlocks: Map<number, TextBlockState> = new Map();
  private textDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
      // Use file modification time as base timestamp for events
      const fileTimestamp = stats.mtime.toISOString();

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
            this.parseLine(line, fileTimestamp);
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
   * Parse a single NDJSON line and emit activity if it's a tool use or text content
   */
  private parseLine(line: string, timestamp: string): void {
    try {
      const event = JSON.parse(line);

      // Handle two formats:
      // 1. Non-streaming: assistant message with content array containing tool_use
      // 2. Streaming: stream_event with content_block_start

      let toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

      // Format 1: Assistant message with tool_use in content array
      if (event.type === 'assistant' && event.message?.content) {
        const content = event.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use' && block.id && block.name) {
              toolUses.push({
                id: block.id,
                name: block.name,
                input: block.input || {},
              });
            }
          }
        }
      }

      // Format 2: Stream event with content_block_start (for streaming mode)
      if (event.type === 'stream_event' && event.event?.type === 'content_block_start') {
        const contentBlock = event.event.content_block;
        const blockIndex = event.event.index ?? 0;

        if (contentBlock?.type === 'tool_use') {
          // Tool use block
          toolUses.push({
            id: contentBlock.id,
            name: contentBlock.name,
            input: contentBlock.input || {},
          });
        } else if (contentBlock?.type === 'text') {
          // Text content block start
          this.textBlocks.set(blockIndex, {
            index: blockIndex,
            text: '',
            startTime: Date.now(),
            stopped: false,
          });
        }
      }

      // Handle text_delta events
      if (event.type === 'stream_event' &&
          event.event?.type === 'content_block_delta' &&
          event.event?.delta?.type === 'text_delta') {
        const blockIndex = event.event.index ?? 0;
        const deltaText = event.event.delta.text || '';

        let block = this.textBlocks.get(blockIndex);
        if (!block) {
          // Create block if not exists (handle out-of-order events)
          block = {
            index: blockIndex,
            text: '',
            startTime: Date.now(),
            stopped: false,
          };
          this.textBlocks.set(blockIndex, block);
        }

        block.text += deltaText;
        this.scheduleTextEmission(timestamp);
      }

      // Handle content_block_stop events
      if (event.type === 'stream_event' && event.event?.type === 'content_block_stop') {
        const blockIndex = event.event.index ?? 0;
        const block = this.textBlocks.get(blockIndex);
        if (block) {
          block.stopped = true;
          this.scheduleTextEmission(timestamp);
        }
      }

      // Process each tool use found
      for (const toolUse of toolUses) {
        // Skip if we've already seen this tool use
        if (this.seenToolUseIds.has(toolUse.id)) {
          continue;
        }
        this.seenToolUseIds.add(toolUse.id);

        // Limit memory usage
        if (this.seenToolUseIds.size > this.maxEvents * 2) {
          const idsArray = Array.from(this.seenToolUseIds);
          this.seenToolUseIds = new Set(idsArray.slice(-this.maxEvents));
        }

        const activityEvent: ActivityEvent = {
          ts: timestamp,
          type: 'tool',
          tool: toolUse.name,
          level: getToolVerbosityLevel(toolUse.name),
          file: extractFilePath(toolUse.name, toolUse.input),
          params: extractParams(toolUse.name, toolUse.input),
        };

        // Store in recent activity (for historical queries)
        this.recentActivity.push(activityEvent);
        if (this.recentActivity.length > this.maxEvents) {
          this.recentActivity = this.recentActivity.slice(-this.maxEvents);
        }

        this.emit('activity', activityEvent);
      }

    } catch {
      // Invalid JSON, skip silently
    }
  }

  /**
   * Schedule text emission with debouncing
   */
  private scheduleTextEmission(timestamp: string): void {
    if (this.textDebounceTimer) {
      clearTimeout(this.textDebounceTimer);
    }

    this.textDebounceTimer = setTimeout(() => {
      this.textDebounceTimer = null;
      this.emitAccumulatedText(timestamp);
    }, TEXT_DEBOUNCE_DELAY);
  }

  /**
   * Emit accumulated text as assistant activity events
   */
  private emitAccumulatedText(timestamp: string): void {
    for (const [blockIndex, block] of this.textBlocks) {
      if (block.text.length > 0) {
        const activityEvent: ActivityEvent = {
          ts: timestamp,
          type: 'assistant',
          tool: '', // Required for compatibility
          level: 'minimal',
          text: block.text,
          isThinking: !block.stopped,
        };

        // Store in recent activity
        this.recentActivity.push(activityEvent);
        if (this.recentActivity.length > this.maxEvents) {
          this.recentActivity = this.recentActivity.slice(-this.maxEvents);
        }

        this.emit('activity', activityEvent);
      }

      // Remove completed blocks
      if (block.stopped) {
        this.textBlocks.delete(blockIndex);
      }
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

    if (this.textDebounceTimer) {
      clearTimeout(this.textDebounceTimer);
      this.textDebounceTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.textBlocks.clear();
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
