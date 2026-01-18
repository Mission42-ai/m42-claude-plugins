/**
 * Sprint Scanner - Enumerate and parse sprints in .claude/sprints/
 * Provides sprint history for the dashboard view
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import type { CompiledProgress, SprintStatus, CompiledTopPhase } from './status-types.js';

// ============================================================================
// Types
// ============================================================================

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
 * Maximum number of sprints to return for performance
 */
const MAX_SPRINTS = 50;

// ============================================================================
// Sprint Scanner Class
// ============================================================================

/**
 * SprintScanner enumerates and parses all sprints in a sprints directory
 */
export class SprintScanner {
  private readonly sprintsDir: string;

  /**
   * Create a new SprintScanner
   * @param sprintsDir Path to the .claude/sprints/ directory
   */
  constructor(sprintsDir: string) {
    this.sprintsDir = sprintsDir;
  }

  /**
   * Scan the sprints directory and return summaries of all sprints
   * @returns Array of SprintSummary objects sorted by date (newest first)
   */
  scan(): SprintSummary[] {
    const summaries: SprintSummary[] = [];
    const sprintDirs = this.getSprintDirectories();

    for (const sprintDir of sprintDirs) {
      try {
        const summary = this.parseSprint(sprintDir);
        if (summary) {
          summaries.push(summary);
        }
      } catch {
        // Skip corrupted sprint directories
        console.warn(`[SprintScanner] Skipping corrupted sprint: ${sprintDir}`);
      }
    }

    // Sort by sprint ID (date-based IDs sort correctly lexicographically)
    // Newest first (descending order)
    summaries.sort((a, b) => b.sprintId.localeCompare(a.sprintId));

    // Limit to MAX_SPRINTS for performance
    return summaries.slice(0, MAX_SPRINTS);
  }

  /**
   * Get a single sprint summary by ID
   * @param sprintId The sprint ID to find
   * @returns SprintSummary or null if not found
   */
  getById(sprintId: string): SprintSummary | null {
    const sprintDir = path.join(this.sprintsDir, sprintId);
    if (!fs.existsSync(sprintDir)) {
      return null;
    }

    try {
      return this.parseSprint(sprintDir);
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Get list of sprint directories
   */
  private getSprintDirectories(): string[] {
    try {
      const entries = fs.readdirSync(this.sprintsDir, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => path.join(this.sprintsDir, e.name));
    } catch {
      return [];
    }
  }

  /**
   * Parse a single sprint directory into a SprintSummary
   */
  private parseSprint(sprintDir: string): SprintSummary | null {
    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');

    if (!fs.existsSync(progressPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(progressPath, 'utf-8');
      const progress = yaml.load(content) as CompiledProgress;

      if (!this.isValidProgress(progress)) {
        return null;
      }

      // Calculate step counts (Ralph mode has no phases)
      const phases = progress.phases ?? [];
      const { totalSteps, completedSteps } = this.countSteps(phases);

      // Try to get workflow from SPRINT.yaml
      const workflow = this.getWorkflow(sprintDir);

      return {
        sprintId: progress['sprint-id'],
        status: progress.status,
        startedAt: progress.stats?.['started-at'] ?? null,
        completedAt: progress.stats?.['completed-at'],
        elapsed: progress.stats?.elapsed,
        totalSteps,
        completedSteps,
        totalPhases: progress.stats?.['total-phases'] ?? phases.length,
        completedPhases: progress.stats?.['completed-phases'] ?? 0,
        workflow,
        path: sprintDir,
      };
    } catch {
      return null;
    }
  }

  /**
   * Validate that an object is a valid CompiledProgress
   */
  private isValidProgress(obj: unknown): obj is CompiledProgress {
    if (typeof obj !== 'object' || obj === null) return false;
    const progress = obj as Record<string, unknown>;
    return (
      typeof progress['sprint-id'] === 'string' &&
      typeof progress.status === 'string' &&
      Array.isArray(progress.phases)
    );
  }

  /**
   * Count total and completed steps across all phases
   */
  private countSteps(phases: CompiledTopPhase[]): { totalSteps: number; completedSteps: number } {
    let totalSteps = 0;
    let completedSteps = 0;

    for (const phase of phases) {
      if (phase.steps) {
        // For-each phase with steps
        for (const step of phase.steps) {
          totalSteps++;
          if (step.status === 'completed') {
            completedSteps++;
          }
        }
      }
    }

    return { totalSteps, completedSteps };
  }

  /**
   * Try to get workflow name from SPRINT.yaml
   */
  private getWorkflow(sprintDir: string): string | undefined {
    const sprintYamlPath = path.join(sprintDir, 'SPRINT.yaml');

    try {
      if (!fs.existsSync(sprintYamlPath)) {
        return undefined;
      }

      const content = fs.readFileSync(sprintYamlPath, 'utf-8');
      const sprint = yaml.load(content) as Record<string, unknown>;

      if (typeof sprint?.workflow === 'string') {
        return sprint.workflow;
      }
    } catch {
      // Ignore errors reading SPRINT.yaml
    }

    return undefined;
  }
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Convenience function to scan sprints directory
 * @param sprintsDir Path to .claude/sprints/ directory
 * @returns Array of SprintSummary sorted by date (newest first)
 */
export function scanSprints(sprintsDir: string): SprintSummary[] {
  const scanner = new SprintScanner(sprintsDir);
  return scanner.scan();
}
