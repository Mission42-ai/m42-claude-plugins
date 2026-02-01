/**
 * Public API exports for @m42/sprint-runtime
 *
 * This module exports the main loop functionality for programmatic usage.
 */
// Re-export main loop functionality
export { runLoop, isTerminalState, recoverFromInterrupt, } from './loop.js';
// Re-export worktree functionality
export { createWorktree, buildWorktreeProgressSection, formatWorktreeSuccessMessage, formatWorktreeErrorMessage, substituteWorktreeVars, extractSprintName, extractDate, checkBranchExists, getRepoRoot, getCurrentBranch, getProjectRoot, getWorktreeInfo, validateWorktreeIsolation, buildWorktreeMetadata, } from './worktree.js';
// Re-export cross-worktree status functionality
export { listAllWorktrees, findSprintsInWorktree, readSprintProgress, discoverSprints, formatSprintStatus, formatCrossWorktreeStatus, formatCurrentWorktreeStatus, getStatusColor, RESET_COLOR, } from './status.js';
// Re-export lock functionality for conflict detection
export { LOCK_DIR_NAME, DEFAULT_STALE_LOCK_AGE_MS, getLockDir, ensureLockDir, generateLockFileName, parseLockFile, createLockFile, releaseLock, acquireLock, isProcessAlive, isLockStale, cleanupStaleLocks, listActiveLocks, checkBranchConflict, checkSprintConflicts, suggestAlternativeBranch, formatConflictWarning, formatConflictSuggestions, formatFullConflictMessage, } from './locks.js';
// Re-export cleanup functionality for worktree lifecycle management
export { TERMINAL_STATES, isTerminalState as isTerminalCleanupState, hasUncommittedChanges, hasUnpushedCommits, isBranchMerged, removeWorktree, deleteBranch, pruneWorktrees, gatherCleanupContext, performSafetyChecks, shouldAutoCleanup, archiveSprint, executeCleanup, formatCleanupResult, formatCleanupPrompt, findCleanableWorktrees, } from './cleanup.js';
//# sourceMappingURL=index.js.map