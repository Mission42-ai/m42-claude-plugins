/**
 * Worktree Detection - Identify git worktrees for parallel sprint execution
 *
 * When running multiple sprints in parallel (each in their own worktree),
 * we need to track which worktree each sprint belongs to.
 */
/**
 * Information about a git worktree
 */
export interface WorktreeInfo {
    /** Absolute path to the worktree root */
    root: string;
    /** Short name for the worktree (basename of root path) */
    name: string;
    /** Current git branch in this worktree */
    branch: string;
    /** Current commit SHA (abbreviated) */
    commit: string;
    /** Whether this is the main worktree (has .git directory, not .git file) */
    isMain: boolean;
}
/**
 * Information about all worktrees in a repository
 */
export interface WorktreeList {
    /** All worktrees in the repository */
    worktrees: WorktreeInfo[];
    /** The main worktree (containing actual .git directory) */
    main: WorktreeInfo | null;
}
/**
 * Detect the worktree containing a given path
 *
 * @param targetPath Any path within a git repository (file or directory)
 * @returns WorktreeInfo for the containing worktree, or null if not in a git repo
 */
export declare function detectWorktree(targetPath: string): WorktreeInfo | null;
/**
 * List all worktrees in the repository containing the given path
 *
 * @param targetPath Any path within a git repository
 * @returns WorktreeList with all worktrees, or null if not in a git repo
 */
export declare function listWorktrees(targetPath: string): WorktreeList | null;
/**
 * Find all sprint directories across all worktrees
 *
 * @param targetPath Any path within a git repository
 * @param sprintsRelativePath Relative path to sprints directory (default: .claude/sprints)
 * @returns Map of worktree name to list of sprint directory paths
 */
export declare function findSprintsAcrossWorktrees(targetPath: string, sprintsRelativePath?: string): Map<string, string[]> | null;
/**
 * Get a display label for a worktree (combines name and branch)
 *
 * @param worktree The worktree info
 * @returns Human-readable label like "main (feature-branch)" or "parallel-1 (feature-x)"
 */
export declare function getWorktreeLabel(worktree: WorktreeInfo): string;
/**
 * Check if a path is in a git worktree (vs main repo)
 *
 * @param targetPath Any path within a git repository
 * @returns true if in a linked worktree, false if in main repo or not in git
 */
export declare function isInWorktree(targetPath: string): boolean;
/**
 * Get the worktree name for a sprint directory
 * Returns "main" for the main worktree, or the worktree directory name otherwise
 *
 * @param sprintDir Path to the sprint directory
 * @returns Worktree name or null if not in a git repo
 */
export declare function getWorktreeName(sprintDir: string): string | null;
//# sourceMappingURL=worktree.d.ts.map