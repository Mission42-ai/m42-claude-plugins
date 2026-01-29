/**
 * Cross-Worktree Sprint Status Module
 *
 * Provides functionality to discover and display sprint status across all worktrees
 * in a git repository. Used by /sprint-status command with --all-worktrees flag.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import * as yaml from 'js-yaml';
import { getWorktreeInfo, WorktreeInfo } from './worktree.js';

// ============================================================================
// Types
// ============================================================================

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
  worktreeErrors: Array<{ path: string; error: string }>;
}

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Execute a git command and return output
 */
function execGit(
  command: string,
  cwd: string
): { success: boolean; output: string; error?: string } {
  const execOptions: ExecSyncOptionsWithStringEncoding = {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  };

  try {
    const output = execSync(command, execOptions).trim();
    return { success: true, output };
  } catch (err) {
    const error = err as { stderr?: string; message?: string };
    const errorMsg = error.stderr?.trim() || error.message || 'Unknown git error';
    return { success: false, output: '', error: errorMsg };
  }
}

/**
 * List all git worktrees in the repository
 *
 * Uses `git worktree list --porcelain` to get structured output.
 *
 * @param cwd - Any directory within the repository
 * @returns Array of worktree information
 */
export function listAllWorktrees(cwd: string): GitWorktree[] {
  const result = execGit('git worktree list --porcelain', cwd);
  if (!result.success) {
    return [];
  }

  const worktrees: GitWorktree[] = [];
  const lines = result.output.split('\n');

  let current: Partial<GitWorktree> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      // Save previous worktree if we have one
      if (current.path) {
        worktrees.push(current as GitWorktree);
      }
      current = {
        path: line.slice(9),
        isMain: false,
      };
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice(5);
    } else if (line.startsWith('branch refs/heads/')) {
      current.branch = line.slice(18);
    } else if (line === 'bare') {
      // Skip bare repositories
      current = {};
    } else if (line === 'detached') {
      current.branch = '(detached HEAD)';
    } else if (line === '') {
      // Empty line separates worktree entries
      // The main worktree is listed first
      if (current.path && worktrees.length === 0) {
        current.isMain = true;
      }
    }
  }

  // Don't forget the last worktree
  if (current.path) {
    if (worktrees.length === 0) {
      current.isMain = true;
    }
    worktrees.push(current as GitWorktree);
  }

  return worktrees;
}

// ============================================================================
// Sprint Discovery
// ============================================================================

/**
 * Find all sprint directories in a worktree
 *
 * Looks for directories under .claude/sprints/ that contain a PROGRESS.yaml
 *
 * @param worktreePath - Root path of the worktree
 * @returns Array of absolute paths to sprint directories
 */
export function findSprintsInWorktree(worktreePath: string): string[] {
  const sprintsDir = path.join(worktreePath, '.claude', 'sprints');

  if (!fs.existsSync(sprintsDir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(sprintsDir, { withFileTypes: true });
    const sprintDirs: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sprintDir = path.join(sprintsDir, entry.name);
        const progressFile = path.join(sprintDir, 'PROGRESS.yaml');

        // Only include directories that have a PROGRESS.yaml
        if (fs.existsSync(progressFile)) {
          sprintDirs.push(sprintDir);
        }
      }
    }

    // Sort by modification time (most recent first)
    return sprintDirs.sort((a, b) => {
      try {
        const statA = fs.statSync(path.join(a, 'PROGRESS.yaml'));
        const statB = fs.statSync(path.join(b, 'PROGRESS.yaml'));
        return statB.mtime.getTime() - statA.mtime.getTime();
      } catch {
        return 0;
      }
    });
  } catch {
    return [];
  }
}

/**
 * Read and parse PROGRESS.yaml from a sprint directory
 *
 * @param sprintDir - Path to the sprint directory
 * @returns Parsed progress or null with error message
 */
export function readSprintProgress(
  sprintDir: string
): { progress: SprintProgress | null; error?: string } {
  const progressFile = path.join(sprintDir, 'PROGRESS.yaml');

  try {
    if (!fs.existsSync(progressFile)) {
      return { progress: null, error: 'PROGRESS.yaml not found' };
    }

    const content = fs.readFileSync(progressFile, 'utf-8');
    const progress = yaml.load(content) as SprintProgress;

    if (!progress || typeof progress !== 'object') {
      return { progress: null, error: 'Invalid PROGRESS.yaml format' };
    }

    // Validate required fields
    if (!progress['sprint-id']) {
      return { progress: null, error: 'Missing sprint-id in PROGRESS.yaml' };
    }

    return { progress };
  } catch (err) {
    const error = err as { message?: string };
    return { progress: null, error: error.message || 'Failed to read PROGRESS.yaml' };
  }
}

/**
 * Discover all sprints across worktrees
 *
 * @param cwd - Current working directory
 * @param options - Discovery options
 * @returns Discovery result with all found sprints
 */
export function discoverSprints(
  cwd: string,
  options: DiscoverSprintsOptions = {}
): DiscoverSprintsResult {
  const { currentOnly = false, statusFilter } = options;

  const currentWorktree = getWorktreeInfo(cwd);
  const worktreeErrors: Array<{ path: string; error: string }> = [];
  const sprints: WorktreeSprint[] = [];

  // Get list of worktrees to check
  let worktreesToCheck: GitWorktree[];

  if (currentOnly) {
    // Only check current worktree
    worktreesToCheck = [{
      path: currentWorktree.path,
      branch: '(current)',
      isMain: !currentWorktree.isWorktree,
      head: '',
    }];
  } else {
    // Get all worktrees
    worktreesToCheck = listAllWorktrees(cwd);

    if (worktreesToCheck.length === 0) {
      // Fallback: just use current directory
      worktreesToCheck = [{
        path: currentWorktree.path,
        branch: '(unknown)',
        isMain: true,
        head: '',
      }];
    }
  }

  // Check each worktree for sprints
  for (const worktree of worktreesToCheck) {
    try {
      // Check if worktree path is accessible
      if (!fs.existsSync(worktree.path)) {
        worktreeErrors.push({
          path: worktree.path,
          error: 'Worktree path does not exist',
        });
        continue;
      }

      const sprintDirs = findSprintsInWorktree(worktree.path);

      for (const sprintDir of sprintDirs) {
        const { progress, error } = readSprintProgress(sprintDir);

        // Apply status filter if specified
        if (statusFilter && progress) {
          if (!statusFilter.includes(progress.status)) {
            continue;
          }
        }

        const isCurrent = worktree.path === currentWorktree.path;

        sprints.push({
          sprintDir,
          worktree,
          progress,
          error,
          isCurrent,
        });
      }
    } catch (err) {
      const error = err as { message?: string };
      worktreeErrors.push({
        path: worktree.path,
        error: error.message || 'Unknown error accessing worktree',
      });
    }
  }

  return {
    sprints,
    currentWorktree,
    worktreesChecked: worktreesToCheck.length,
    worktreeErrors,
  };
}

// ============================================================================
// Status Formatting
// ============================================================================

/**
 * Get status color code (for terminal output)
 */
export function getStatusColor(status: SprintProgress['status']): string {
  switch (status) {
    case 'in-progress':
      return '\x1b[33m'; // Yellow
    case 'completed':
      return '\x1b[32m'; // Green
    case 'blocked':
      return '\x1b[31m'; // Red
    case 'paused':
      return '\x1b[36m'; // Cyan
    case 'paused-at-breakpoint':
      return '\x1b[35m'; // Magenta (distinct from regular pause)
    case 'pending':
    default:
      return '\x1b[37m'; // White
  }
}

/**
 * Reset terminal color
 */
export const RESET_COLOR = '\x1b[0m';

/**
 * Format a single sprint's status for display
 */
export function formatSprintStatus(sprint: WorktreeSprint, useColor: boolean = true): string {
  const lines: string[] = [];
  const indent = '  ';

  // Sprint directory with current marker
  const marker = sprint.isCurrent ? '* ' : '  ';
  lines.push(`${marker}${sprint.sprintDir}`);

  if (sprint.error) {
    lines.push(`${indent}Error: ${sprint.error}`);
    return lines.join('\n');
  }

  if (!sprint.progress) {
    lines.push(`${indent}Status: unknown (no progress data)`);
    return lines.join('\n');
  }

  const p = sprint.progress;

  // Worktree info
  const worktreeLabel = sprint.worktree.isMain ? 'main' : sprint.worktree.branch;
  const currentSuffix = sprint.isCurrent ? ' (current)' : '';
  lines.push(`${indent}Worktree: ${worktreeLabel}${currentSuffix}`);

  // Working directory
  const workingDir = p['working-dir'] || p['worktree-path'] || sprint.worktree.path;
  lines.push(`${indent}Working Dir: ${workingDir}`);

  // Status with color
  const statusColor = useColor ? getStatusColor(p.status) : '';
  const resetColor = useColor ? RESET_COLOR : '';
  lines.push(`${indent}Status: ${statusColor}${p.status}${resetColor}`);

  // Phase progress
  if (p.stats) {
    const totalPhases = p.stats['total-phases'] || 0;
    const completedPhases = p.stats['completed-phases'] || 0;

    // Find current phase name
    let currentPhaseName = '';
    if (p.current && p.phases && p.phases[p.current.phase]) {
      currentPhaseName = ` (${p.phases[p.current.phase].id})`;
    }

    lines.push(`${indent}Phase: ${completedPhases}/${totalPhases}${currentPhaseName}`);
  } else if (p.current) {
    lines.push(`${indent}Phase: ${p.current.phase}`);
  }

  // Worktree ID for verification
  if (p['worktree-id']) {
    lines.push(`${indent}Worktree ID: ${p['worktree-id']}`);
  }

  return lines.join('\n');
}

/**
 * Format the full cross-worktree status display
 */
export function formatCrossWorktreeStatus(
  result: DiscoverSprintsResult,
  useColor: boolean = true
): string {
  const lines: string[] = [];

  // Header
  lines.push('Active Sprints Across Worktrees');
  lines.push('================================');
  lines.push('');

  if (result.sprints.length === 0) {
    lines.push('No sprints found across worktrees.');
    if (result.worktreeErrors.length > 0) {
      lines.push('');
      lines.push('Note: Some worktrees had errors:');
      for (const err of result.worktreeErrors) {
        lines.push(`  - ${err.path}: ${err.error}`);
      }
    }
    return lines.join('\n');
  }

  // Group sprints by worktree
  const sprintsByWorktree = new Map<string, WorktreeSprint[]>();
  for (const sprint of result.sprints) {
    const key = sprint.worktree.path;
    if (!sprintsByWorktree.has(key)) {
      sprintsByWorktree.set(key, []);
    }
    sprintsByWorktree.get(key)!.push(sprint);
  }

  // Display sprints grouped by worktree
  for (const [_worktreePath, sprints] of sprintsByWorktree) {
    for (const sprint of sprints) {
      lines.push(formatSprintStatus(sprint, useColor));
      lines.push('');
    }
  }

  // Summary
  const activeCount = result.sprints.filter(
    s => s.progress?.status === 'in-progress'
  ).length;
  const totalCount = result.sprints.length;

  lines.push(`Total: ${totalCount} sprint(s), ${activeCount} active`);

  // Error summary if any
  if (result.worktreeErrors.length > 0) {
    lines.push('');
    lines.push(`Warnings: ${result.worktreeErrors.length} worktree(s) had errors`);
  }

  return lines.join('\n');
}

/**
 * Format status for current worktree only (default behavior)
 */
export function formatCurrentWorktreeStatus(
  result: DiscoverSprintsResult,
  useColor: boolean = true
): string {
  const lines: string[] = [];

  const currentSprints = result.sprints.filter(s => s.isCurrent);

  if (currentSprints.length === 0) {
    lines.push('No active sprint in current worktree.');
    lines.push('Use /init-sprint to create one.');
    return lines.join('\n');
  }

  // Show most recent sprint in current worktree
  const sprint = currentSprints[0];
  lines.push(formatSprintStatus(sprint, useColor));

  // Hint about other worktrees if there are more sprints
  const otherSprints = result.sprints.filter(s => !s.isCurrent);
  if (otherSprints.length > 0) {
    lines.push('');
    lines.push(`Note: ${otherSprints.length} sprint(s) in other worktrees. Use --all-worktrees to see all.`);
  }

  return lines.join('\n');
}
