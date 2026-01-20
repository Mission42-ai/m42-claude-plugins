/**
 * Transcription Watcher for sprint activity
 * Watches transcription directory for .log files and extracts tool use activity
 * from the NDJSON stream format produced by Claude CLI
 */
import { EventEmitter } from 'events';
import type { ActivityEvent } from './activity-types.js';
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
export declare class TranscriptionWatcher extends EventEmitter {
    private readonly transcriptionsDir;
    private readonly debounceDelay;
    private readonly maxEvents;
    private watcher;
    private debounceTimer;
    private isClosing;
    private filePositions;
    private seenToolUseIds;
    private recentActivity;
    private textBlocks;
    private textDebounceTimer;
    constructor(transcriptionsDir: string, options?: TranscriptionWatcherOptions);
    /**
     * Start watching the transcriptions directory
     */
    start(): void;
    /**
     * Read existing transcription files and extract activity
     */
    private readExistingFiles;
    /**
     * Handle file system events with debouncing
     */
    private handleFileEvent;
    /**
     * Process a transcription file and extract tool use activity
     */
    private processFile;
    /**
     * Parse a single NDJSON line and emit activity if it's a tool use or text content
     */
    private parseLine;
    /**
     * Add an event to recent activity, maintaining max size limit
     */
    private addToRecentActivity;
    /**
     * Schedule text emission with debouncing
     */
    private scheduleTextEmission;
    /**
     * Emit accumulated text as assistant activity events
     */
    private emitAccumulatedText;
    /**
     * Stop watching and clean up resources
     */
    close(): void;
    /**
     * Get the directory being watched
     */
    getDirectory(): string;
    /**
     * Check if the watcher is active
     */
    isWatching(): boolean;
    /**
     * Get recent activity events (for historical queries by new SSE clients)
     * Returns most recent events up to the specified limit
     */
    getRecentActivity(limit?: number): ActivityEvent[];
}
//# sourceMappingURL=transcription-watcher.d.ts.map