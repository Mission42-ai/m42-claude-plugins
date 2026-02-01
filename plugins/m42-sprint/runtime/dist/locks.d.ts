/**
 * Lock File Management for Parallel Sprint Conflict Detection
 *
 * Provides locking mechanisms to detect and prevent conflicts when multiple
 * sprints run in parallel across different worktrees. Locks are stored in
 * a shared .sprint-locks/ directory at the repository root.
 *
 * Key features:
 * - Shared lock directory accessible from all worktrees
 * - Lock files with worktree ID and operation type
 * - Automatic stale lock cleanup (older than 1 hour by default)
 * - Branch conflict detection across worktrees
 */
/** Default lock directory name (at repo root) */
export declare const LOCK_DIR_NAME = ".sprint-locks";
/** Default stale lock age in milliseconds (1 hour) */
export declare const DEFAULT_STALE_LOCK_AGE_MS: number;
/** Lock operation types */
export type LockOperation = 'branch-create' | 'branch-checkout' | 'worktree-create' | 'sprint-run' | 'git-commit' | 'git-push';
/**
 * Information stored in a lock file
 */
export interface LockInfo {
    /** Type of operation being locked */
    operation: LockOperation;
    /** Unique ID of the worktree holding the lock */
    worktreeId: string;
    /** Path to the worktree holding the lock */
    worktreePath: string;
    /** Branch being operated on (if applicable) */
    branch?: string;
    /** Sprint ID (if applicable) */
    sprintId?: string;
    /** Process ID that created the lock */
    pid: number;
    /** ISO timestamp when lock was created */
    createdAt: string;
    /** Optional human-readable description */
    description?: string;
}
/**
 * Result of attempting to acquire a lock
 */
export interface LockAcquisitionResult {
    success: boolean;
    /** Path to the lock file (if successful) */
    lockPath?: string;
    /** Existing lock info (if acquisition failed due to conflict) */
    existingLock?: LockInfo;
    /** Error message if failed */
    error?: string;
}
/**
 * Result of checking for conflicts
 */
export interface ConflictCheckResult {
    /** Whether there's a conflict */
    hasConflict: boolean;
    /** Type of conflict detected */
    conflictType?: 'branch-in-use' | 'sprint-running' | 'operation-locked';
    /** Detailed conflict information */
    details?: {
        /** The worktree that has the conflict */
        worktreePath: string;
        /** Branch involved in conflict */
        branch?: string;
        /** Sprint ID involved in conflict */
        sprintId?: string;
        /** Status of the conflicting sprint */
        sprintStatus?: string;
    };
    /** User-facing warning message */
    message?: string;
    /** Suggestions for resolving the conflict */
    suggestions?: string[];
}
/**
 * Options for branch conflict checking
 */
export interface BranchConflictOptions {
    /** Branch name to check */
    branchName: string;
    /** Repository root directory */
    repoRoot: string;
    /** Optional sprint ID being created */
    sprintId?: string;
}
/**
 * Get the path to the shared lock directory.
 *
 * The lock directory is at the repository root, accessible from all worktrees.
 * This ensures locks are visible across parallel sprint executions.
 *
 * @param cwd - Current working directory (any location in the repo)
 * @returns Absolute path to lock directory, or null if not in a git repo
 */
export declare function getLockDir(cwd: string): string | null;
/**
 * Ensure the lock directory exists.
 *
 * Creates the .sprint-locks/ directory if it doesn't exist.
 * Also creates a .gitignore file to exclude locks from version control.
 *
 * @param cwd - Current working directory
 * @returns Path to lock directory, or null if creation failed
 */
export declare function ensureLockDir(cwd: string): string | null;
/**
 * Generate a lock file name.
 *
 * Format: {operation}-{worktreeId}.lock
 *
 * @param operation - Type of operation being locked
 * @param worktreeId - ID of the worktree
 * @param suffix - Optional suffix for uniqueness (e.g., branch name hash)
 * @returns Lock file name
 */
export declare function generateLockFileName(operation: LockOperation, worktreeId: string, suffix?: string): string;
/**
 * Parse a lock file to extract lock information.
 *
 * @param lockPath - Path to the lock file
 * @returns Parsed lock info, or null if invalid
 */
export declare function parseLockFile(lockPath: string): LockInfo | null;
/**
 * Create a lock file atomically.
 *
 * Uses write-to-temp-then-rename pattern to ensure atomicity.
 * Lock files are keyed by operation+branch (not worktree ID) to detect
 * conflicts across different worktrees.
 *
 * @param lockDir - Lock directory path
 * @param lockInfo - Information to store in the lock
 * @returns Result of lock acquisition attempt
 */
export declare function createLockFile(lockDir: string, lockInfo: LockInfo): LockAcquisitionResult;
/**
 * Release a lock file.
 *
 * @param lockPath - Path to the lock file
 * @param worktreeId - ID of the worktree releasing the lock (for verification)
 * @returns true if released successfully, false otherwise
 */
export declare function releaseLock(lockPath: string, worktreeId: string): boolean;
/**
 * Acquire a lock for a specific operation.
 *
 * @param cwd - Current working directory
 * @param operation - Type of operation to lock
 * @param options - Additional lock options
 * @returns Lock acquisition result
 */
export declare function acquireLock(cwd: string, operation: LockOperation, options?: {
    branch?: string;
    sprintId?: string;
    description?: string;
}): LockAcquisitionResult;
/**
 * Check if a process is still alive.
 *
 * @param pid - Process ID to check
 * @returns true if process is alive, false otherwise
 */
export declare function isProcessAlive(pid: number): boolean;
/**
 * Check if a lock is stale (too old or from dead process).
 *
 * @param lockInfo - Lock information
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 * @returns true if lock is stale
 */
export declare function isLockStale(lockInfo: LockInfo, maxAgeMs?: number): boolean;
/**
 * Clean up stale locks in the lock directory.
 *
 * Removes locks that are:
 * - Older than maxAgeMs (default: 1 hour)
 * - From processes that are no longer running
 *
 * @param cwd - Current working directory
 * @param maxAgeMs - Maximum lock age in milliseconds
 * @returns Number of stale locks removed
 */
export declare function cleanupStaleLocks(cwd: string, maxAgeMs?: number): number;
/**
 * List all active locks.
 *
 * @param cwd - Current working directory
 * @returns Array of active lock information
 */
export declare function listActiveLocks(cwd: string): LockInfo[];
/**
 * Check if a branch is in use by another worktree or sprint.
 *
 * This detects conflicts when:
 * 1. Branch already has a git worktree
 * 2. A sprint is running with the same branch in another worktree
 *
 * @param options - Branch conflict check options
 * @returns Conflict check result with details if conflict found
 */
export declare function checkBranchConflict(options: BranchConflictOptions): ConflictCheckResult;
/**
 * Check for any operation conflicts before starting a sprint.
 *
 * @param cwd - Current working directory
 * @param branchName - Branch name for the new sprint
 * @param sprintId - ID of the sprint being started
 * @returns Conflict check result
 */
export declare function checkSprintConflicts(cwd: string, branchName: string, sprintId: string): ConflictCheckResult;
/**
 * Suggest an alternative branch name to avoid conflicts.
 *
 * Appends worktree ID suffix to make branch unique.
 *
 * @param baseBranch - Original branch name
 * @param cwd - Current working directory
 * @returns Suggested alternative branch name
 */
export declare function suggestAlternativeBranch(baseBranch: string, cwd: string): string;
/**
 * Parameters for formatting a conflict warning
 */
export interface ConflictWarningParams {
    sprintId: string;
    worktreePath: string;
    branch: string;
    status: string;
}
/**
 * Format a detailed conflict warning message.
 *
 * Creates a user-friendly message when a sprint conflict is detected.
 *
 * @param params - Conflict parameters
 * @returns Formatted warning message
 */
export declare function formatConflictWarning(params: ConflictWarningParams): string;
/**
 * Format suggestions for resolving a conflict.
 *
 * @param sprintId - Current sprint ID
 * @param worktreePath - Path to conflicting worktree
 * @returns Formatted suggestions string
 */
export declare function formatConflictSuggestions(sprintId: string, worktreePath: string): string;
/**
 * Format a complete conflict message with warning and suggestions.
 *
 * @param params - Conflict parameters
 * @returns Complete formatted conflict message
 */
export declare function formatFullConflictMessage(params: ConflictWarningParams): string;
//# sourceMappingURL=locks.d.ts.map