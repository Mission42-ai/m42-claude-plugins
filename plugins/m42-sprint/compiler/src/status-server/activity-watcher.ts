/**
 * Activity Watcher for sprint activity log
 * Watches .sprint-activity.jsonl file and emits events for new activity entries
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import type { ActivityEvent, ActivityWatcherOptions } from './activity-types.js';
import { isActivityEvent } from './activity-types.js';

/**
 * Events emitted by ActivityWatcher
 */
export interface ActivityWatcherEvents {
  activity: [event: ActivityEvent];
  error: [error: Error];
  ready: [];
  close: [];
}

const DEFAULT_DEBOUNCE_DELAY = 100;
const DEFAULT_TAIL_LINES = 50;

/**
 * Watches a .sprint-activity.jsonl file for new activity events
 *
 * Implements tail-like behavior:
 * - On start, reads last N lines of existing file
 * - On file change, reads only new lines since last position
 * - Handles file rotation (truncation/deletion)
 * - Recovers from corrupted JSON lines by skipping them
 */
export class ActivityWatcher extends EventEmitter {
  private readonly filePath: string;
  private readonly debounceDelay: number;
  private readonly tailLines: number;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosing = false;
  private lastPosition = 0;
  private lastSize = 0;

  constructor(filePath: string, options: ActivityWatcherOptions = {}) {
    super();
    this.filePath = path.resolve(filePath);
    this.debounceDelay = options.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
    this.tailLines = options.tailLines ?? DEFAULT_TAIL_LINES;
  }

  /**
   * Start watching the activity file
   * Does not throw if file doesn't exist - waits for creation
   */
  start(): void {
    if (this.watcher) {
      return; // Already watching
    }

    const dir = path.dirname(this.filePath);
    const filename = path.basename(this.filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      this.emit('error', new Error(`Directory does not exist: ${dir}`));
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
          this.handleFileEvent(eventType);
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
      this.emit('error', new Error(`Failed to watch file: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Read initial content from file (tail behavior)
   */
  private readInitialContent(): void {
    try {
      const stats = fs.statSync(this.filePath);
      this.lastSize = stats.size;

      if (stats.size === 0) {
        this.lastPosition = 0;
        return;
      }

      // Read entire file and take last N lines
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim() !== '');

      // Take last N lines
      const startIndex = Math.max(0, lines.length - this.tailLines);
      const recentLines = lines.slice(startIndex);

      // Parse and emit each line
      for (const line of recentLines) {
        this.parseLine(line);
      }

      // Set position to end of file for incremental reads
      this.lastPosition = stats.size;
    } catch (error) {
      this.emit('error', new Error(`Failed to read initial content: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Handle file system events with debouncing
   */
  private handleFileEvent(eventType: string): void {
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
      // File was deleted, reset position for when it's recreated
      this.lastPosition = 0;
      this.lastSize = 0;
      return;
    }

    try {
      const stats = fs.statSync(this.filePath);

      // Detect file rotation (truncation)
      if (stats.size < this.lastSize) {
        // File was truncated or rotated, read from beginning
        this.lastPosition = 0;
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
            this.parseLine(line);
          }
        }

        this.lastPosition = stats.size;
      } finally {
        fs.closeSync(fd);
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Parse a single JSONL line and emit event if valid
   */
  private parseLine(line: string): void {
    try {
      const parsed = JSON.parse(line);

      if (isActivityEvent(parsed)) {
        this.emit('activity', parsed);
      } else {
        // Invalid event structure, skip silently (could be future format)
        console.warn('[ActivityWatcher] Skipping invalid event structure');
      }
    } catch (error) {
      // Invalid JSON, skip this line
      console.warn(`[ActivityWatcher] Skipping corrupted line: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop watching the file and clean up resources
   */
  close(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
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
