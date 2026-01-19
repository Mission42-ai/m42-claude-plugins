/**
 * Sprint Scanner - Enumerate and parse sprints in .claude/sprints/
 * Provides sprint history for the dashboard view
 *
 * Supports worktree awareness for parallel sprint execution:
 * - Each sprint knows which worktree it belongs to
 * - Can scan across all worktrees in a repository
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import type { CompiledProgress, SprintStatus, CompiledTopPhase } from './status-types.js';
import { detectWorktree, listWorktrees, type WorktreeInfo } from './worktree.js';

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
 * Maximum number of sprints to return for performance
 */
const MAX_SPRINTS = 50;

// ============================================================================
// Sprint Scanner Class
// ============================================================================

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
export class SprintScanner {
  private readonly sprintsDir: string;
  private readonly options: SprintScannerOptions;
  private worktreeCache: WorktreeInfo | null | undefined = undefined;

  /**
   * Create a new SprintScanner
   * @param sprintsDir Path to the .claude/sprints/ directory
   * @param options Scanner options
   */
  constructor(sprintsDir: string, options: SprintScannerOptions = {}) {
    this.sprintsDir = sprintsDir;
    this.options = options;
  }

  /**
   * Get worktree info for this sprints directory (cached)
   */
  private getWorktreeInfo(): WorktreeInfo | null {
    if (this.worktreeCache === undefined) {
      this.worktreeCache = detectWorktree(this.sprintsDir);
    }
    return this.worktreeCache;
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

      // Build summary
      const summary: SprintSummary = {
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

      // Add worktree info if requested
      if (this.options.includeWorktreeInfo) {
        const worktreeInfo = this.getWorktreeInfo();
        if (worktreeInfo) {
          summary.worktree = {
            name: worktreeInfo.isMain ? 'main' : worktreeInfo.name,
            branch: worktreeInfo.branch,
            isMain: worktreeInfo.isMain,
          };
        }
      }

      return summary;
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
 * @param options Scanner options
 * @returns Array of SprintSummary sorted by date (newest first)
 */
export function scanSprints(sprintsDir: string, options?: SprintScannerOptions): SprintSummary[] {
  const scanner = new SprintScanner(sprintsDir, options);
  return scanner.scan();
}

/**
 * Scan sprints across all worktrees in a repository
 *
 * @param targetPath Any path within a git repository
 * @param sprintsRelativePath Relative path to sprints directory (default: .claude/sprints)
 * @returns Array of SprintSummary from all worktrees, sorted by date (newest first)
 */
export function scanSprintsAcrossWorktrees(
  targetPath: string,
  sprintsRelativePath = '.claude/sprints'
): SprintSummary[] {
  const worktreeList = listWorktrees(targetPath);
  if (!worktreeList) {
    // Fallback to single directory scan
    const sprintsDir = path.join(path.dirname(targetPath), sprintsRelativePath);
    return scanSprints(sprintsDir, { includeWorktreeInfo: true });
  }

  const allSprints: SprintSummary[] = [];

  for (const worktree of worktreeList.worktrees) {
    const sprintsDir = path.join(worktree.root, sprintsRelativePath);

    try {
      if (fs.existsSync(sprintsDir) && fs.statSync(sprintsDir).isDirectory()) {
        const scanner = new SprintScanner(sprintsDir, { includeWorktreeInfo: true });
        const sprints = scanner.scan();
        allSprints.push(...sprints);
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  // Sort all sprints by date (newest first)
  allSprints.sort((a, b) => b.sprintId.localeCompare(a.sprintId));

  // Limit to MAX_SPRINTS
  return allSprints.slice(0, MAX_SPRINTS);
}
