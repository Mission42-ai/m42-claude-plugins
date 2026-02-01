/**
 * Public API exports for @m42/sprint-runtime
 *
 * This module exports the main loop functionality for programmatic usage.
 */
export { runLoop, LoopOptions, LoopResult, LoopDependencies, isTerminalState, recoverFromInterrupt, } from './loop.js';
export { createWorktree, buildWorktreeProgressSection, formatWorktreeSuccessMessage, formatWorktreeErrorMessage, substituteWorktreeVars, extractSprintName, extractDate, checkBranchExists, getRepoRoot, getCurrentBranch, getProjectRoot, getWorktreeInfo, validateWorktreeIsolation, buildWorktreeMetadata, } from './worktree.js';
export type { WorktreeVariables, WorktreeConfig, CreateWorktreeResult, BranchCheckResult, WorktreeInfo, } from './worktree.js';
export type { SprintState, SprintEvent, CompiledProgress, } from './transition.js';
export { listAllWorktrees, findSprintsInWorktree, readSprintProgress, discoverSprints, formatSprintStatus, formatCrossWorktreeStatus, formatCurrentWorktreeStatus, getStatusColor, RESET_COLOR, } from './status.js';
export type { GitWorktree, SprintProgress, WorktreeSprint, DiscoverSprintsOptions, DiscoverSprintsResult, } from './status.js';
export { LOCK_DIR_NAME, DEFAULT_STALE_LOCK_AGE_MS, getLockDir, ensureLockDir, generateLockFileName, parseLockFile, createLockFile, releaseLock, acquireLock, isProcessAlive, isLockStale, cleanupStaleLocks, listActiveLocks, checkBranchConflict, checkSprintConflicts, suggestAlternativeBranch, formatConflictWarning, formatConflictSuggestions, formatFullConflictMessage, } from './locks.js';
export type { LockOperation, LockInfo, LockAcquisitionResult, ConflictCheckResult, BranchConflictOptions, ConflictWarningParams, } from './locks.js';
export { TERMINAL_STATES, isTerminalState as isTerminalCleanupState, hasUncommittedChanges, hasUnpushedCommits, isBranchMerged, removeWorktree, deleteBranch, pruneWorktrees, gatherCleanupContext, performSafetyChecks, shouldAutoCleanup, archiveSprint, executeCleanup, formatCleanupResult, formatCleanupPrompt, findCleanableWorktrees, } from './cleanup.js';
export type { CleanupSafetyCheck, CleanupOptions, CleanupAction, CleanupResult, CleanupContext, } from './cleanup.js';
//# sourceMappingURL=index.d.ts.map