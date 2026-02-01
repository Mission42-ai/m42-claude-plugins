/**
 * Cross-Worktree Sprint Status Module
 *
 * Provides functionality to discover and display sprint status across all worktrees
 * in a git repository. Used by /sprint-status command with --all-worktrees flag.
 */
import { WorktreeInfo } from './worktree.js';
/**
 * Information about a single git worktree
 */
export interface GitWorktree {
    /** Absolute path to the worktree root */
    path: string;
    /** Branch name checked out in this worktree */
    branch: string;
    /** Whether this is the main worktree (not a linked worktree) */
    isMain: boolean;
    /** Commit hash HEAD points to */
    head: string;
}
/**
 * Minimal PROGRESS.yaml fields needed for status display
 */
export interface SprintProgress {
    'sprint-id': string;
    status: 'pending' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'paused-at-breakpoint';
    'worktree-id'?: string;
    'worktree-path'?: string;
    'working-dir'?: string;
    current?: {
        phase: number;
        step: number;
        'sub-phase'?: number;
    };
    stats?: {
        'total-phases': number;
        'completed-phases': number;
        'total-steps': number;
        'completed-steps': number;
        'started-at'?: string;
    };
    phases?: Array<{
        id: string;
        status: string;
    }>;
}
/**
 * Sprint information discovered in a worktree
 */
export interface WorktreeSprint {
    /** Absolute path to the sprint directory (.claude/sprints/xxx/) */
    sprintDir: string;
    /** The worktree containing this sprint */
    worktree: GitWorktree;
    /** Parsed PROGRESS.yaml data (if available) */
    progress: SprintProgress | null;
    /** Error message if PROGRESS.yaml couldn't be read */
    error?: string;
    /** Whether this sprint is in the current worktree */
    isCurrent: boolean;
}
/**
 * Options for discovering sprints across worktrees
 */
export interface DiscoverSprintsOptions {
    /** Only discover sprints in the current worktree (default: false) */
    currentOnly?: boolean;
    /** Filter by status (default: all statuses) */
    statusFilter?: SprintProgress['status'][];
}
/**
 * Result of sprint discovery
 */
export interface DiscoverSprintsResult {
    /** All discovered sprints */
    sprints: WorktreeSprint[];
    /** Current worktree info */
    currentWorktree: WorktreeInfo;
    /** Total count of worktrees checked */
    worktreesChecked: number;
    /** Worktrees that had errors (permission, not found, etc.) */
    worktreeErrors: Array<{
        path: string;
        error: string;
    }>;
}
/**
 * List all git worktrees in the repository
 *
 * Uses `git worktree list --porcelain` to get structured output.
 *
 * @param cwd - Any directory within the repository
 * @returns Array of worktree information
 */
export declare function listAllWorktrees(cwd: string): GitWorktree[];
/**
 * Find all sprint directories in a worktree
 *
 * Looks for directories under .claude/sprints/ that contain a PROGRESS.yaml
 *
 * @param worktreePath - Root path of the worktree
 * @returns Array of absolute paths to sprint directories
 */
export declare function findSprintsInWorktree(worktreePath: string): string[];
/**
 * Read and parse PROGRESS.yaml from a sprint directory
 *
 * @param sprintDir - Path to the sprint directory
 * @returns Parsed progress or null with error message
 */
export declare function readSprintProgress(sprintDir: string): {
    progress: SprintProgress | null;
    error?: string;
};
/**
 * Discover all sprints across worktrees
 *
 * @param cwd - Current working directory
 * @param options - Discovery options
 * @returns Discovery result with all found sprints
 */
export declare function discoverSprints(cwd: string, options?: DiscoverSprintsOptions): DiscoverSprintsResult;
/**
 * Get status color code (for terminal output)
 */
export declare function getStatusColor(status: SprintProgress['status']): string;
/**
 * Reset terminal color
 */
export declare const RESET_COLOR = "\u001B[0m";
/**
 * Format a single sprint's status for display
 */
export declare function formatSprintStatus(sprint: WorktreeSprint, useColor?: boolean): string;
/**
 * Format the full cross-worktree status display
 */
export declare function formatCrossWorktreeStatus(result: DiscoverSprintsResult, useColor?: boolean): string;
/**
 * Format status for current worktree only (default behavior)
 */
export declare function formatCurrentWorktreeStatus(result: DiscoverSprintsResult, useColor?: boolean): string;
//# sourceMappingURL=status.d.ts.map