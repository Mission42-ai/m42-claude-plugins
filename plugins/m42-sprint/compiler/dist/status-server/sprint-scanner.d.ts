/**
 * Sprint Scanner - Enumerate and parse sprints in .claude/sprints/
 * Provides sprint history for the dashboard view
 *
 * Supports worktree awareness for parallel sprint execution:
 * - Each sprint knows which worktree it belongs to
 * - Can scan across all worktrees in a repository
 */
import type { SprintStatus } from './status-types.js';
/**
 * Summary information for a single sprint
 */
export interface SprintSummary {
    /** Sprint identifier from PROGRESS.yaml */
    sprintId: string;
    /** Overall sprint status */
    status: SprintStatus;
    /** ISO timestamp when sprint started (null if not started) */
    startedAt: string | null;
    /** ISO timestamp when sprint completed (if applicable) */
    completedAt?: string | null;
    /** Human-readable elapsed time */
    elapsed?: string;
    /** Total number of steps across all phases */
    totalSteps: number;
    /** Number of completed steps */
    completedSteps: number;
    /** Total number of top-level phases */
    totalPhases: number;
    /** Number of completed top-level phases */
    completedPhases: number;
    /** Workflow used (if available from SPRINT.yaml) */
    workflow?: string;
    /** Full path to the sprint directory */
    path: string;
    /** Worktree information (for parallel execution context) */
    worktree?: {
        /** Worktree name (basename of root, or "main" for main worktree) */
        name: string;
        /** Git branch in this worktree */
        branch: string;
        /** Whether this is the main worktree */
        isMain: boolean;
    };
}
/**
 * Options for SprintScanner
 */
export interface SprintScannerOptions {
    /** Include worktree information in summaries (default: false for performance) */
    includeWorktreeInfo?: boolean;
}
/**
 * SprintScanner enumerates and parses all sprints in a sprints directory
 */
export declare class SprintScanner {
    private readonly sprintsDir;
    private readonly options;
    private worktreeCache;
    /**
     * Create a new SprintScanner
     * @param sprintsDir Path to the .claude/sprints/ directory
     * @param options Scanner options
     */
    constructor(sprintsDir: string, options?: SprintScannerOptions);
    /**
     * Get worktree info for this sprints directory (cached)
     */
    private getWorktreeInfo;
    /**
     * Scan the sprints directory and return summaries of all sprints
     * @returns Array of SprintSummary objects sorted by date (newest first)
     */
    scan(): SprintSummary[];
    /**
     * Get a single sprint summary by ID
     * @param sprintId The sprint ID to find
     * @returns SprintSummary or null if not found
     */
    getById(sprintId: string): SprintSummary | null;
    /**
     * Get list of sprint directories
     */
    private getSprintDirectories;
    /**
     * Parse a single sprint directory into a SprintSummary
     */
    private parseSprint;
    /**
     * Validate that an object is a valid CompiledProgress
     */
    private isValidProgress;
    /**
     * Count total and completed steps across all phases
     */
    private countSteps;
    /**
     * Try to get workflow name from SPRINT.yaml
     */
    private getWorkflow;
}
/**
 * Convenience function to scan sprints directory
 * @param sprintsDir Path to .claude/sprints/ directory
 * @param options Scanner options
 * @returns Array of SprintSummary sorted by date (newest first)
 */
export declare function scanSprints(sprintsDir: string, options?: SprintScannerOptions): SprintSummary[];
/**
 * Scan sprints across all worktrees in a repository
 *
 * @param targetPath Any path within a git repository
 * @param sprintsRelativePath Relative path to sprints directory (default: .claude/sprints)
 * @returns Array of SprintSummary from all worktrees, sorted by date (newest first)
 */
export declare function scanSprintsAcrossWorktrees(targetPath: string, sprintsRelativePath?: string): SprintSummary[];
//# sourceMappingURL=sprint-scanner.d.ts.map