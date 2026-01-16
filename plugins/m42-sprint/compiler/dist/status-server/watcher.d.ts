/**
 * File watcher for PROGRESS.yaml with debounce
 * Emits events when the file changes, handling rapid updates gracefully
 */
import { EventEmitter } from 'events';
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
/**
 * Watches a PROGRESS.yaml file for changes with debouncing
 *
 * Uses fs.watch() for efficient file system monitoring and implements
 * debouncing to prevent excessive updates when the file is modified
 * rapidly (e.g., during sprint-loop.sh execution).
 */
export declare class ProgressWatcher extends EventEmitter {
    private readonly filePath;
    private readonly debounceDelay;
    private watcher;
    private debounceTimer;
    private isClosing;
    constructor(filePath: string, options?: ProgressWatcherOptions);
    /**
     * Start watching the file
     * @throws Error if file does not exist or cannot be watched
     */
    start(): void;
    /**
     * Handle file system events with debouncing
     */
    private handleFileEvent;
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
/**
 * Create and start a watcher for a PROGRESS.yaml file
 * Convenience function that handles common setup
 */
export declare function watchProgressFile(filePath: string, onUpdate: (filePath: string) => void, options?: ProgressWatcherOptions): ProgressWatcher;
//# sourceMappingURL=watcher.d.ts.map