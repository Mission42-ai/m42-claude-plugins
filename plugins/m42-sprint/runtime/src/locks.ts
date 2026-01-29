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

import * as fs from 'fs';
import * as path from 'path';
import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import {
  getWorktreeInfo,
  getRepoRoot,
  checkBranchExists,
  WorktreeInfo,
  BranchCheckResult,
} from './worktree.js';
import { discoverSprints } from './status.js';

// ============================================================================
// Constants
// ============================================================================

/** Default lock directory name (at repo root) */
export const LOCK_DIR_NAME = '.sprint-locks';

/** Default stale lock age in milliseconds (1 hour) */
export const DEFAULT_STALE_LOCK_AGE_MS = 60 * 60 * 1000;

/** Lock operation types */
export type LockOperation =
  | 'branch-create'
  | 'branch-checkout'
  | 'worktree-create'
  | 'sprint-run'
  | 'git-commit'
  | 'git-push';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Lock Directory Management
// ============================================================================

/**
 * Get the path to the shared lock directory.
 *
 * The lock directory is at the repository root, accessible from all worktrees.
 * This ensures locks are visible across parallel sprint executions.
 *
 * @param cwd - Current working directory (any location in the repo)
 * @returns Absolute path to lock directory, or null if not in a git repo
 */
export function getLockDir(cwd: string): string | null {
  const info = getWorktreeInfo(cwd);

  // Use the main worktree path for lock directory
  // This ensures all worktrees share the same lock directory
  const lockDir = path.join(info.mainWorktreePath, LOCK_DIR_NAME);

  return lockDir;
}

/**
 * Ensure the lock directory exists.
 *
 * Creates the .sprint-locks/ directory if it doesn't exist.
 * Also creates a .gitignore file to exclude locks from version control.
 *
 * @param cwd - Current working directory
 * @returns Path to lock directory, or null if creation failed
 */
export function ensureLockDir(cwd: string): string | null {
  const lockDir = getLockDir(cwd);
  if (!lockDir) {
    return null;
  }

  try {
    if (!fs.existsSync(lockDir)) {
      fs.mkdirSync(lockDir, { recursive: true });

      // Create .gitignore to exclude lock files
      const gitignorePath = path.join(lockDir, '.gitignore');
      fs.writeFileSync(gitignorePath, '*\n!.gitignore\n');
    }
    return lockDir;
  } catch {
    return null;
  }
}

// ============================================================================
// Lock File Operations
// ============================================================================

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
export function generateLockFileName(
  operation: LockOperation,
  worktreeId: string,
  suffix?: string
): string {
  const base = `${operation}-${worktreeId}`;
  return suffix ? `${base}-${suffix}.lock` : `${base}.lock`;
}

/**
 * Parse a lock file to extract lock information.
 *
 * @param lockPath - Path to the lock file
 * @returns Parsed lock info, or null if invalid
 */
export function parseLockFile(lockPath: string): LockInfo | null {
  try {
    if (!fs.existsSync(lockPath)) {
      return null;
    }
    const content = fs.readFileSync(lockPath, 'utf-8');
    const info = JSON.parse(content) as LockInfo;

    // Validate required fields
    if (!info.operation || !info.worktreeId || !info.pid || !info.createdAt) {
      return null;
    }

    return info;
  } catch {
    return null;
  }
}

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
export function createLockFile(
  lockDir: string,
  lockInfo: LockInfo
): LockAcquisitionResult {
  // Generate lock file name based on operation and branch (not worktree ID)
  // This allows conflict detection across different worktrees
  const suffix = lockInfo.branch
    ? hashString(lockInfo.branch).slice(0, 8)
    : undefined;

  // Use operation + suffix for the file name (no worktree ID)
  // This way multiple worktrees trying to lock the same operation+branch will conflict
  const lockFileName = suffix
    ? `${lockInfo.operation}-${suffix}.lock`
    : `${lockInfo.operation}.lock`;
  const lockPath = path.join(lockDir, lockFileName);

  // Check if lock already exists
  const existing = parseLockFile(lockPath);
  if (existing) {
    // Check if the existing lock is from a dead process
    if (!isProcessAlive(existing.pid)) {
      // Stale lock from dead process - safe to remove
      try {
        fs.unlinkSync(lockPath);
      } catch {
        return {
          success: false,
          error: `Failed to remove stale lock: ${lockPath}`,
          existingLock: existing,
        };
      }
    } else if (existing.worktreeId !== lockInfo.worktreeId) {
      // Lock held by another worktree's live process
      return {
        success: false,
        existingLock: existing,
        error: `Lock held by another worktree: ${existing.worktreePath}`,
      };
    }
    // Same worktree, same or dead process - proceed to overwrite
  }

  // Write lock file atomically
  const tempPath = `${lockPath}.tmp.${process.pid}`;
  try {
    const content = JSON.stringify(lockInfo, null, 2);
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, lockPath);

    return { success: true, lockPath };
  } catch (err) {
    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    const error = err as { message?: string };
    return {
      success: false,
      error: error.message || 'Failed to create lock file',
    };
  }
}

/**
 * Release a lock file.
 *
 * @param lockPath - Path to the lock file
 * @param worktreeId - ID of the worktree releasing the lock (for verification)
 * @returns true if released successfully, false otherwise
 */
export function releaseLock(lockPath: string, worktreeId: string): boolean {
  const existing = parseLockFile(lockPath);
  if (!existing) {
    // Lock doesn't exist - nothing to release
    return true;
  }

  // Only allow release if we own the lock
  if (existing.worktreeId !== worktreeId) {
    return false;
  }

  try {
    fs.unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Acquire a lock for a specific operation.
 *
 * @param cwd - Current working directory
 * @param operation - Type of operation to lock
 * @param options - Additional lock options
 * @returns Lock acquisition result
 */
export function acquireLock(
  cwd: string,
  operation: LockOperation,
  options: {
    branch?: string;
    sprintId?: string;
    description?: string;
  } = {}
): LockAcquisitionResult {
  const lockDir = ensureLockDir(cwd);
  if (!lockDir) {
    return {
      success: false,
      error: 'Could not create lock directory',
    };
  }

  const info = getWorktreeInfo(cwd);

  const lockInfo: LockInfo = {
    operation,
    worktreeId: info.id,
    worktreePath: info.path,
    branch: options.branch,
    sprintId: options.sprintId,
    pid: process.pid,
    createdAt: new Date().toISOString(),
    description: options.description,
  };

  return createLockFile(lockDir, lockInfo);
}

// ============================================================================
// Stale Lock Cleanup
// ============================================================================

/**
 * Check if a process is still alive.
 *
 * @param pid - Process ID to check
 * @returns true if process is alive, false otherwise
 */
export function isProcessAlive(pid: number): boolean {
  try {
    // Sending signal 0 doesn't actually send a signal, but checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a lock is stale (too old or from dead process).
 *
 * @param lockInfo - Lock information
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 * @returns true if lock is stale
 */
export function isLockStale(
  lockInfo: LockInfo,
  maxAgeMs: number = DEFAULT_STALE_LOCK_AGE_MS
): boolean {
  // Check if process is dead
  if (!isProcessAlive(lockInfo.pid)) {
    return true;
  }

  // Check age
  const createdAt = new Date(lockInfo.createdAt).getTime();
  const age = Date.now() - createdAt;
  return age > maxAgeMs;
}

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
export function cleanupStaleLocks(
  cwd: string,
  maxAgeMs: number = DEFAULT_STALE_LOCK_AGE_MS
): number {
  const lockDir = getLockDir(cwd);
  if (!lockDir || !fs.existsSync(lockDir)) {
    return 0;
  }

  let removed = 0;

  try {
    const files = fs.readdirSync(lockDir);

    for (const file of files) {
      if (!file.endsWith('.lock')) {
        continue;
      }

      const lockPath = path.join(lockDir, file);
      const lockInfo = parseLockFile(lockPath);

      if (lockInfo && isLockStale(lockInfo, maxAgeMs)) {
        try {
          fs.unlinkSync(lockPath);
          removed++;
        } catch {
          // Ignore removal errors (might be removed by another process)
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  return removed;
}

/**
 * List all active locks.
 *
 * @param cwd - Current working directory
 * @returns Array of active lock information
 */
export function listActiveLocks(cwd: string): LockInfo[] {
  const lockDir = getLockDir(cwd);
  if (!lockDir || !fs.existsSync(lockDir)) {
    return [];
  }

  const locks: LockInfo[] = [];

  try {
    const files = fs.readdirSync(lockDir);

    for (const file of files) {
      if (!file.endsWith('.lock')) {
        continue;
      }

      const lockPath = path.join(lockDir, file);
      const lockInfo = parseLockFile(lockPath);

      if (lockInfo && !isLockStale(lockInfo)) {
        locks.push(lockInfo);
      }
    }
  } catch {
    // Ignore read errors
  }

  return locks;
}

// ============================================================================
// Branch Conflict Detection
// ============================================================================

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
export function checkBranchConflict(
  options: BranchConflictOptions
): ConflictCheckResult {
  const { branchName, repoRoot, sprintId } = options;

  // First check if branch exists and has a worktree via git
  const branchCheck = checkBranchExists(branchName, repoRoot);

  if (branchCheck.exists && branchCheck.hasWorktree) {
    return {
      hasConflict: true,
      conflictType: 'branch-in-use',
      details: {
        worktreePath: branchCheck.worktreePath!,
        branch: branchName,
      },
      message: `Branch '${branchName}' is already checked out in another worktree`,
      suggestions: [
        `Use a different branch name, e.g., sprint/${sprintId || 'new-sprint'}-v2`,
        `Remove the existing worktree: git worktree remove ${branchCheck.worktreePath}`,
        'Use --force to proceed anyway (not recommended)',
      ],
    };
  }

  // Check for running sprints using the same branch
  try {
    const sprintsResult = discoverSprints(repoRoot, { currentOnly: false });
    const currentWorktreeInfo = getWorktreeInfo(repoRoot);

    for (const sprint of sprintsResult.sprints) {
      // Skip sprints in the current worktree
      if (sprint.worktree.path === currentWorktreeInfo.path) {
        continue;
      }

      // Check if sprint is using the same branch
      if (sprint.worktree.branch === branchName) {
        const isActive =
          sprint.progress?.status === 'in-progress' ||
          sprint.progress?.status === 'pending';

        if (isActive) {
          return {
            hasConflict: true,
            conflictType: 'sprint-running',
            details: {
              worktreePath: sprint.worktree.path,
              branch: branchName,
              sprintId: sprint.progress?.['sprint-id'],
              sprintStatus: sprint.progress?.status,
            },
            message: formatConflictWarning({
              sprintId: sprint.progress?.['sprint-id'] || 'unknown',
              worktreePath: sprint.worktree.path,
              branch: branchName,
              status: sprint.progress?.status || 'unknown',
            }),
            suggestions: [
              `Use a different sprint name: /start-sprint ${sprintId || 'new-sprint'}-v2`,
              `Stop the other sprint first: cd ${sprint.worktree.path} && /stop-sprint`,
              'Continue anyway (not recommended): --force',
            ],
          };
        }
      }
    }
  } catch {
    // If discovery fails, don't block - just warn
  }

  return { hasConflict: false };
}

/**
 * Check for any operation conflicts before starting a sprint.
 *
 * @param cwd - Current working directory
 * @param branchName - Branch name for the new sprint
 * @param sprintId - ID of the sprint being started
 * @returns Conflict check result
 */
export function checkSprintConflicts(
  cwd: string,
  branchName: string,
  sprintId: string
): ConflictCheckResult {
  const repoRoot = getRepoRoot(cwd);
  if (!repoRoot) {
    return { hasConflict: false };
  }

  // Clean up stale locks first
  cleanupStaleLocks(cwd);

  // Check for branch conflicts
  const branchConflict = checkBranchConflict({
    branchName,
    repoRoot,
    sprintId,
  });

  if (branchConflict.hasConflict) {
    return branchConflict;
  }

  // Check for active locks on the same branch
  const activeLocks = listActiveLocks(cwd);
  const conflictingLock = activeLocks.find(
    (lock) =>
      lock.branch === branchName &&
      lock.worktreeId !== getWorktreeInfo(cwd).id &&
      (lock.operation === 'branch-create' || lock.operation === 'sprint-run')
  );

  if (conflictingLock) {
    return {
      hasConflict: true,
      conflictType: 'operation-locked',
      details: {
        worktreePath: conflictingLock.worktreePath,
        branch: branchName,
        sprintId: conflictingLock.sprintId,
      },
      message: `Another sprint is performing '${conflictingLock.operation}' on branch '${branchName}'`,
      suggestions: [
        'Wait for the other operation to complete',
        `Use a different branch name: sprint/${sprintId}-v2`,
        'Use --force to proceed anyway (not recommended)',
      ],
    };
  }

  return { hasConflict: false };
}

/**
 * Suggest an alternative branch name to avoid conflicts.
 *
 * Appends worktree ID suffix to make branch unique.
 *
 * @param baseBranch - Original branch name
 * @param cwd - Current working directory
 * @returns Suggested alternative branch name
 */
export function suggestAlternativeBranch(
  baseBranch: string,
  cwd: string
): string {
  const info = getWorktreeInfo(cwd);
  // Use first 6 chars of worktree ID as suffix
  const suffix = info.id.slice(0, 6);
  return `${baseBranch}-${suffix}`;
}

// ============================================================================
// Conflict Warning Messages
// ============================================================================

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
export function formatConflictWarning(params: ConflictWarningParams): string {
  const { sprintId, worktreePath, branch, status } = params;

  return `Warning: Sprint "${sprintId}" is already running in another worktree:
  Worktree: ${worktreePath}
  Branch: ${branch}
  Status: ${status}`;
}

/**
 * Format suggestions for resolving a conflict.
 *
 * @param sprintId - Current sprint ID
 * @param worktreePath - Path to conflicting worktree
 * @returns Formatted suggestions string
 */
export function formatConflictSuggestions(
  sprintId: string,
  worktreePath: string
): string {
  return `Suggestions:
  1. Use a different sprint name: /start-sprint ${sprintId}-v2
  2. Stop the other sprint first: cd ${worktreePath} && /stop-sprint
  3. Continue anyway (not recommended): --force`;
}

/**
 * Format a complete conflict message with warning and suggestions.
 *
 * @param params - Conflict parameters
 * @returns Complete formatted conflict message
 */
export function formatFullConflictMessage(
  params: ConflictWarningParams
): string {
  const warning = formatConflictWarning(params);
  const suggestions = formatConflictSuggestions(params.sprintId, params.worktreePath);
  return `${warning}\n\n${suggestions}`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simple string hash function (djb2).
 * Used for generating unique lock file suffixes.
 *
 * @param str - String to hash
 * @returns 8-character hex hash
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
