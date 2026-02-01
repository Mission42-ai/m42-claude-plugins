/**
 * Worktree Cleanup Module for Sprint Lifecycle Management
 *
 * Handles cleanup of git worktrees when sprints complete or are explicitly cleaned up.
 * Supports multiple cleanup modes: never, on-complete, on-merge.
 */
import { SprintProgress } from './status.js';
/** Cleanup mode for worktrees */
export type WorktreeCleanup = 'never' | 'on-complete' | 'on-merge';
/**
 * Compiled worktree configuration in PROGRESS.yaml
 * Contains resolved paths and runtime state
 */
export interface CompiledWorktreeConfig {
    /** Whether worktree is enabled */
    enabled: boolean;
    /** Resolved branch name (variables substituted) */
    branch: string;
    /** Resolved worktree path (variables substituted) */
    path: string;
    /** Cleanup mode */
    cleanup: WorktreeCleanup;
    /** When the worktree was created (ISO timestamp) */
    'created-at'?: string;
    /** Whether worktree has been cleaned up */
    'cleaned-up'?: boolean;
    /** Working directory for Claude execution (worktree root or sprint dir) */
    'working-dir'?: string;
}
/**
 * Result of checking if cleanup is safe to proceed
 */
export interface CleanupSafetyCheck {
    /** Whether cleanup can proceed */
    safe: boolean;
    /** Reason if not safe */
    reason?: string;
    /** Details about the issue */
    details?: string;
    /** Whether --force can override this check */
    forceOverridable: boolean;
}
/**
 * Options for cleanup operation
 */
export interface CleanupOptions {
    /** Skip confirmation prompts and safety checks (use with caution) */
    force?: boolean;
    /** Keep the git branch after removing worktree */
    keepBranch?: boolean;
    /** Archive sprint directory before removal */
    archive?: boolean;
    /** Dry run - show what would be done without doing it */
    dryRun?: boolean;
}
/**
 * Cleanup action that was or will be performed
 */
export interface CleanupAction {
    /** Type of action */
    type: 'worktree-remove' | 'branch-delete' | 'archive' | 'skip';
    /** Human-readable description */
    description: string;
    /** Whether action was successful */
    success?: boolean;
    /** Error message if failed */
    error?: string;
}
/**
 * Result of cleanup operation
 */
export interface CleanupResult {
    /** Whether cleanup succeeded overall */
    success: boolean;
    /** Sprint ID that was cleaned up */
    sprintId: string;
    /** Actions that were performed */
    actions: CleanupAction[];
    /** Summary message */
    summary: string;
    /** Warning messages */
    warnings: string[];
    /** Error message if failed */
    error?: string;
}
/**
 * Information gathered for cleanup decision
 */
export interface CleanupContext {
    /** Sprint ID */
    sprintId: string;
    /** Sprint directory path */
    sprintDir: string;
    /** Sprint status from PROGRESS.yaml */
    status: SprintProgress['status'];
    /** Worktree configuration from PROGRESS.yaml */
    worktreeConfig: CompiledWorktreeConfig | null;
    /** Worktree path (if applicable) */
    worktreePath: string | null;
    /** Branch name (if applicable) */
    branch: string | null;
    /** Whether worktree has uncommitted changes */
    hasUncommittedChanges: boolean;
    /** Whether branch has unpushed commits */
    hasUnpushedCommits: boolean;
    /** Whether branch is merged to main */
    isMergedToMain: boolean;
    /** Repository root path */
    repoRoot: string;
}
/**
 * Sprint states that are considered terminal (sprint is done)
 */
export declare const TERMINAL_STATES: SprintProgress['status'][];
/**
 * Check if a sprint status is a terminal state
 */
export declare function isTerminalState(status: SprintProgress['status']): boolean;
/**
 * Check if worktree has uncommitted changes
 */
export declare function hasUncommittedChanges(worktreePath: string): boolean;
/**
 * Check if branch has commits not pushed to remote
 */
export declare function hasUnpushedCommits(branch: string, cwd: string): boolean;
/**
 * Check if branch is merged into main/master
 */
export declare function isBranchMerged(branch: string, cwd: string): boolean;
/**
 * Remove a git worktree
 */
export declare function removeWorktree(worktreePath: string, cwd: string, force?: boolean): {
    success: boolean;
    error?: string;
};
/**
 * Delete a git branch
 */
export declare function deleteBranch(branch: string, cwd: string, force?: boolean): {
    success: boolean;
    error?: string;
};
/**
 * Prune worktrees that have been removed from disk
 */
export declare function pruneWorktrees(cwd: string): {
    success: boolean;
    error?: string;
};
/**
 * Gather all information needed for cleanup decision
 */
export declare function gatherCleanupContext(sprintDir: string): CleanupContext | null;
/**
 * Perform safety checks before cleanup
 */
export declare function performSafetyChecks(context: CleanupContext, options?: CleanupOptions): CleanupSafetyCheck;
/**
 * Determine if automatic cleanup should run based on config and state
 */
export declare function shouldAutoCleanup(context: CleanupContext): {
    shouldCleanup: boolean;
    reason: string;
};
/**
 * Archive sprint directory to .claude/sprints/archive/
 */
export declare function archiveSprint(sprintDir: string, repoRoot: string): {
    success: boolean;
    archivePath?: string;
    error?: string;
};
/**
 * Execute cleanup for a sprint
 */
export declare function executeCleanup(context: CleanupContext, options?: CleanupOptions): CleanupResult;
/**
 * Format cleanup result for user display
 */
export declare function formatCleanupResult(result: CleanupResult, context: CleanupContext): string;
/**
 * Format cleanup prompt for user confirmation
 */
export declare function formatCleanupPrompt(context: CleanupContext): string;
/**
 * Find sprints that are eligible for cleanup
 */
export declare function findCleanableWorktrees(repoRoot: string): CleanupContext[];
//# sourceMappingURL=cleanup.d.ts.map