/**
 * Atomic YAML Operations with Checksum Validation
 *
 * Provides atomic read/write operations for PROGRESS.yaml files
 * with checksum validation for corruption detection.
 */
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
export interface CurrentPointer {
    phase: number;
    step: number | null;
    'sub-phase': number | null;
}
export interface SprintStats {
    'started-at': string | null;
    'completed-at'?: string | null;
    'total-phases': number;
    'completed-phases': number;
    elapsed?: string;
}
/**
 * Minimal CompiledProgress interface for yaml-ops.
 * Uses index signature to allow all fields from full interface.
 */
export interface CompiledProgress {
    'sprint-id': string;
    status: SprintStatus;
    current: CurrentPointer;
    stats: SprintStats;
    phases?: unknown[];
    [key: string]: unknown;
}
/**
 * Calculate SHA256 checksum of content string.
 *
 * @param content - String content to hash
 * @returns SHA256 hex string (64 characters)
 */
export declare function calculateChecksum(content: string): string;
/**
 * Write progress to file atomically with checksum.
 * Uses temp file + rename pattern for atomicity on POSIX systems.
 *
 * @param filePath - Path to the progress file
 * @param progress - Progress object to write
 */
export declare function writeProgressAtomic(filePath: string, progress: CompiledProgress): Promise<void>;
/**
 * Read progress from file with optional checksum validation.
 * Throws on checksum mismatch if checksum file exists.
 *
 * @param filePath - Path to the progress file
 * @returns Parsed CompiledProgress object
 * @throws Error if file not found, invalid YAML, or checksum mismatch
 */
export declare function readProgress(filePath: string): CompiledProgress;
/**
 * Create backup of progress file before critical operations.
 * Also backs up checksum file if it exists.
 *
 * @param filePath - Path to the progress file to backup
 */
export declare function backupProgress(filePath: string): void;
/**
 * Restore progress from backup file.
 * Uses rename for atomic restore. Also restores checksum backup if present.
 *
 * @param filePath - Path to the progress file to restore
 * @returns true if backup existed and was restored, false otherwise
 */
export declare function restoreProgress(filePath: string): boolean;
/**
 * Remove backup files. Idempotent - no error if backups don't exist.
 *
 * @param filePath - Path to the progress file whose backups should be removed
 */
export declare function cleanupBackup(filePath: string): void;
//# sourceMappingURL=yaml-ops.d.ts.map