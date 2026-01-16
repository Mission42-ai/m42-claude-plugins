/**
 * Activity Watcher for sprint activity log
 * Watches .sprint-activity.jsonl file and emits events for new activity entries
 */
import { EventEmitter } from 'events';
import type { ActivityEvent, ActivityWatcherOptions } from './activity-types.js';
/**
 * Events emitted by ActivityWatcher
 */
export interface ActivityWatcherEvents {
    activity: [event: ActivityEvent];
    error: [error: Error];
    ready: [];
    close: [];
}
/**
 * Watches a .sprint-activity.jsonl file for new activity events
 *
 * Implements tail-like behavior:
 * - On start, reads last N lines of existing file
 * - On file change, reads only new lines since last position
 * - Handles file rotation (truncation/deletion)
 * - Recovers from corrupted JSON lines by skipping them
 */
export declare class ActivityWatcher extends EventEmitter {
    private readonly filePath;
    private readonly debounceDelay;
    private readonly tailLines;
    private watcher;
    private debounceTimer;
    private isClosing;
    private lastPosition;
    private lastSize;
    constructor(filePath: string, options?: ActivityWatcherOptions);
    /**
     * Start watching the activity file
     * Does not throw if file doesn't exist - waits for creation
     */
    start(): void;
    /**
     * Read initial content from file (tail behavior)
     */
    private readInitialContent;
    /**
     * Handle file system events with debouncing
     */
    private handleFileEvent;
    /**
     * Process file change - read new content since last position
     */
    private processFileChange;
    /**
     * Parse a single JSONL line and emit event if valid
     */
    private parseLine;
    /**
     * Stop watching the file and clean up resources
     */
    close(): void;
    /**
     * Get the path being watched
     */
    getFilePath(): string;
    /**
     * Check if the watcher is active
     */
    isWatching(): boolean;
}
//# sourceMappingURL=activity-watcher.d.ts.map