/**
 * Sprint Scanner - Enumerate and parse sprints in .claude/sprints/
 * Provides sprint history for the dashboard view
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
}
/**
 * SprintScanner enumerates and parses all sprints in a sprints directory
 */
export declare class SprintScanner {
    private readonly sprintsDir;
    /**
     * Create a new SprintScanner
     * @param sprintsDir Path to the .claude/sprints/ directory
     */
    constructor(sprintsDir: string);
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
 * @returns Array of SprintSummary sorted by date (newest first)
 */
export declare function scanSprints(sprintsDir: string): SprintSummary[];
//# sourceMappingURL=sprint-scanner.d.ts.map