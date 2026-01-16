/**
 * File watcher for PROGRESS.yaml with debounce
 * Emits events when the file changes, handling rapid updates gracefully
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Events emitted by ProgressWatcher
 */
export interface ProgressWatcherEvents {
  change: [filePath: string];
  error: [error: Error];
  ready: [];
  close: [];
}

/**
 * Options for the ProgressWatcher
 */
export interface ProgressWatcherOptions {
  /** Debounce delay in milliseconds (default: 100) */
  debounceDelay?: number;
}

const DEFAULT_DEBOUNCE_DELAY = 100;

/**
 * Watches a PROGRESS.yaml file for changes with debouncing
 *
 * Uses fs.watch() for efficient file system monitoring and implements
 * debouncing to prevent excessive updates when the file is modified
 * rapidly (e.g., during sprint-loop.sh execution).
 */
export class ProgressWatcher extends EventEmitter {
  private readonly filePath: string;
  private readonly debounceDelay: number;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosing = false;

  constructor(filePath: string, options: ProgressWatcherOptions = {}) {
    super();
    this.filePath = path.resolve(filePath);
    this.debounceDelay = options.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
  }

  /**
   * Start watching the file
   * @throws Error if file does not exist or cannot be watched
   */
  start(): void {
    if (this.watcher) {
      return; // Already watching
    }

    // Verify file exists before watching
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`File does not exist: ${this.filePath}`);
    }

    const dir = path.dirname(this.filePath);
    const filename = path.basename(this.filePath);

    try {
      // Watch the directory to handle file deletion/recreation
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
      throw new Error(`Failed to watch file: ${error instanceof Error ? error.message : String(error)}`);
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

      // Check if file exists (handles deletion case)
      if (!fs.existsSync(this.filePath)) {
        // File was deleted, don't emit change
        // We'll pick it up when it's recreated
        return;
      }

      // Emit change event
      this.emit('change', this.filePath);
    }, this.debounceDelay);
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

/**
 * Create and start a watcher for a PROGRESS.yaml file
 * Convenience function that handles common setup
 */
export function watchProgressFile(
  filePath: string,
  onUpdate: (filePath: string) => void,
  options: ProgressWatcherOptions = {}
): ProgressWatcher {
  const watcher = new ProgressWatcher(filePath, options);

  watcher.on('change', onUpdate);
  watcher.start();

  return watcher;
}
