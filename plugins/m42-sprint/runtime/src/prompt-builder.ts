/**
 * Prompt Builder Module - Generates execution prompts for sprint tasks
 *
 * Replaces: build-sprint-prompt.sh (354 lines) and build-parallel-prompt.sh (82 lines)
 *
 * Generates hierarchical prompts for:
 * - Simple phases (no steps)
 * - For-each phases with steps and sub-phases
 * - Parallel background tasks
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed' | 'spawned';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

export interface CurrentPointer {
  phase: number;
  step: number | null;
  'sub-phase': number | null;
}

export interface SprintStats {
  'started-at': string | null;
  'completed-at'?: string | null;
  'total-phases': number;
  'completed-phases': number;
  elapsed?: string;
  'current-iteration'?: number;
  'max-iterations'?: number;
  'total-steps'?: number;
  'completed-steps'?: number;
}

export interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
  error?: string;
  'retry-count'?: number;
  'next-retry-at'?: string;
  parallel?: boolean;
  'parallel-task-id'?: string;
}

export interface CompiledStep {
  id: string;
  prompt: string;
  status: PhaseStatus;
  phases: CompiledPhase[];
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  error?: string;
  'retry-count'?: number;
}

export interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;
  steps?: CompiledStep[];
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
  error?: string;
  'retry-count'?: number;
  'wait-for-parallel'?: boolean;
  'parallel-task-id'?: string;
}

export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  current: CurrentPointer;
  stats: SprintStats;
  phases?: CompiledTopPhase[];
  [key: string]: unknown;
}

/**
 * Context for template variable substitution
 */
export interface PromptContext {
  sprintId: string;
  iteration: number;
  phase: {
    id: string;
    index: number;  // 0-based
    total: number;
  };
  step: {
    id: string;
    prompt: string;
    index: number;  // 0-based
    total: number;
  } | null;
  subPhase: {
    id: string;
    index: number;  // 0-based
    total: number;
  } | null;
  retryCount: number;
  error: string | null;
}

/**
 * Custom prompt templates from SPRINT.yaml
 */
export interface CustomPrompts {
  header?: string;
  position?: string;
  'retry-warning'?: string;
  instructions?: string;
  'result-reporting'?: string;
}

/**
 * Worktree context for prompt injection
 */
export interface WorktreeContext {
  enabled: boolean;
  path?: string;
  branch?: string;
}

// ============================================================================
// Default Prompt Templates
// ============================================================================

export const DEFAULT_PROMPTS: Required<CustomPrompts> = {
  header: `# Sprint Workflow Execution
Sprint: {{sprint-id}} | Iteration: {{iteration}}`,

  position: `## Current Position
- Phase: **{{phase.id}}** ({{phase.index}}/{{phase.total}})
- Step: **{{step.id}}** ({{step.index}}/{{step.total}})
- Sub-Phase: **{{sub-phase.id}}** ({{sub-phase.index}}/{{sub-phase.total}})`,

  'retry-warning': `## Warning: RETRY ATTEMPT {{retry-count}}
This task previously failed. Please review the error and try a different approach.

Previous error: {{error}}`,

  instructions: `## Instructions

1. Execute this sub-phase task
2. Commit your changes when the task is done
3. **EXIT immediately** - do NOT continue to next task`,

  'result-reporting': `## Result Reporting (IMPORTANT)

Do NOT modify PROGRESS.yaml directly. The sprint loop handles all state updates.
Report your result as JSON in your final output:

**On Success:**
\`\`\`json
{"status": "completed", "summary": "Brief description of what was accomplished"}
\`\`\`

**On Failure:**
\`\`\`json
{"status": "failed", "summary": "What was attempted", "error": "What went wrong"}
\`\`\`

**If Human Needed:**
\`\`\`json
{"status": "needs-human", "summary": "What was done so far", "humanNeeded": {"reason": "Why human is needed", "details": "Additional context"}}
\`\`\``,
};

// Simple position template (no step/sub-phase)
const DEFAULT_POSITION_SIMPLE = `## Current Position
- Phase: **{{phase.id}}** ({{phase.index}}/{{phase.total}})`;

// Worktree context warning - CRITICAL for path resolution
const WORKTREE_CONTEXT_WARNING = `## ⚠️ WORKTREE EXECUTION CONTEXT

**CRITICAL: You are executing in a git worktree, NOT the main repository.**

Worktree path: {{worktree-path}}
Branch: {{worktree-branch}}

**PATH RULES - MUST FOLLOW:**
1. **ALWAYS use RELATIVE paths** for all file operations (Read, Write, Edit, Bash mkdir/touch)
2. **NEVER use absolute paths** like \`/home/.../projects/repo-name/...\`
3. **NEVER derive paths from Read results** - when you read a reference file, do NOT copy its absolute path
4. When creating files similar to existing ones, use the RELATIVE path pattern, not the absolute path you saw

**Examples:**
- ✅ CORRECT: \`plugins/my-plugin/README.md\`
- ❌ WRONG: \`/home/user/projects/repo/plugins/my-plugin/README.md\`
- ✅ CORRECT: \`mkdir -p plugins/my-plugin/skills\`
- ❌ WRONG: \`mkdir -p /home/user/projects/repo/plugins/my-plugin/skills\`

This ensures your changes land in the worktree, not the main repository.`;

// Simple instructions (for simple phases)
const DEFAULT_INSTRUCTIONS_SIMPLE = `## Instructions

1. Execute this phase
2. Commit your changes when the task is done
3. **EXIT immediately** - do NOT continue to next task`;

// ============================================================================
// Template Variable Substitution
// ============================================================================

/**
 * Substitute template variables in a string
 * Variables use {{variable.name}} syntax
 * Index values are converted from 0-based to 1-based for display
 */
export function substituteVariables(template: string, context: PromptContext): string {
  let result = template;

  // Sprint-level variables
  result = result.replace(/\{\{sprint-id\}\}/g, context.sprintId);
  result = result.replace(/\{\{iteration\}\}/g, String(context.iteration));

  // Phase variables
  result = result.replace(/\{\{phase\.id\}\}/g, context.phase.id);
  result = result.replace(/\{\{phase\.index\}\}/g, String(context.phase.index + 1));
  result = result.replace(/\{\{phase\.total\}\}/g, String(context.phase.total));

  // Step variables (if step exists)
  if (context.step) {
    result = result.replace(/\{\{step\.id\}\}/g, context.step.id);
    result = result.replace(/\{\{step\.prompt\}\}/g, context.step.prompt);
    result = result.replace(/\{\{step\.index\}\}/g, String(context.step.index + 1));
    result = result.replace(/\{\{step\.total\}\}/g, String(context.step.total));
  } else {
    // Clear step variables if no step
    result = result.replace(/\{\{step\.id\}\}/g, '');
    result = result.replace(/\{\{step\.prompt\}\}/g, '');
    result = result.replace(/\{\{step\.index\}\}/g, '0');
    result = result.replace(/\{\{step\.total\}\}/g, '0');
  }

  // Sub-phase variables (if sub-phase exists)
  if (context.subPhase) {
    result = result.replace(/\{\{sub-phase\.id\}\}/g, context.subPhase.id);
    result = result.replace(/\{\{sub-phase\.index\}\}/g, String(context.subPhase.index + 1));
    result = result.replace(/\{\{sub-phase\.total\}\}/g, String(context.subPhase.total));
  } else {
    // Clear sub-phase variables if no sub-phase
    result = result.replace(/\{\{sub-phase\.id\}\}/g, '');
    result = result.replace(/\{\{sub-phase\.index\}\}/g, '0');
    result = result.replace(/\{\{sub-phase\.total\}\}/g, '0');
  }

  // Retry variables
  result = result.replace(/\{\{retry-count\}\}/g, String(context.retryCount));
  result = result.replace(/\{\{error\}\}/g, context.error ?? '');

  return result;
}

// ============================================================================
// Context File Loading
// ============================================================================

/**
 * Load context files from the sprint's context directory
 * Returns concatenated content of all context files (primarily _shared.md)
 */
export function loadContextFiles(contextDir: string): string {
  if (!fs.existsSync(contextDir)) {
    return '';
  }

  const sharedFile = path.join(contextDir, '_shared.md');
  if (fs.existsSync(sharedFile)) {
    return fs.readFileSync(sharedFile, 'utf8');
  }

  return '';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Append the standard Files section to prompt parts
 */
function appendFilesSection(parts: string[], sprintDir: string): void {
  parts.push('');
  parts.push('## Files');
  parts.push(`- Progress: ${path.join(sprintDir, 'PROGRESS.yaml')}`);
  parts.push(`- Sprint: ${path.join(sprintDir, 'SPRINT.yaml')}`);
}

/**
 * Append context files content if available
 */
function appendContextContent(parts: string[], sprintDir: string): void {
  const contextDir = path.join(sprintDir, 'context');
  const contextContent = loadContextFiles(contextDir);
  if (contextContent) {
    parts.push('');
    parts.push(contextContent);
  }
}

/**
 * Append worktree context warning if executing in a worktree
 */
function appendWorktreeContext(parts: string[], worktree?: WorktreeContext): void {
  if (!worktree?.enabled) {
    return;
  }

  let warning = WORKTREE_CONTEXT_WARNING;
  warning = warning.replace(/\{\{worktree-path\}\}/g, worktree.path ?? 'unknown');
  warning = warning.replace(/\{\{worktree-branch\}\}/g, worktree.branch ?? 'unknown');

  parts.push('');
  parts.push(warning);
}

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build prompt for the current sprint position
 * Handles both simple phases and for-each phases with steps/sub-phases
 */
export function buildPrompt(
  progress: CompiledProgress,
  sprintDir: string,
  customPrompts?: CustomPrompts,
  worktree?: WorktreeContext
): string {
  const phases = progress.phases ?? [];
  const current = progress.current;
  const phaseIdx = current.phase;

  // No phases or out of bounds
  if (phases.length === 0 || phaseIdx >= phases.length) {
    return '';
  }

  const phase = phases[phaseIdx];
  const iteration = progress.stats['current-iteration'] ?? 1;

  // Determine if this is a for-each phase (has steps) or simple phase
  const isForEachPhase = phase.steps && phase.steps.length > 0;

  if (isForEachPhase) {
    return buildForEachPrompt(progress, sprintDir, customPrompts, phase, phaseIdx, iteration, worktree);
  } else {
    return buildSimplePrompt(progress, sprintDir, customPrompts, phase, phaseIdx, iteration, worktree);
  }
}

/**
 * Build prompt for a simple phase (no steps)
 */
function buildSimplePrompt(
  progress: CompiledProgress,
  sprintDir: string,
  customPrompts: CustomPrompts | undefined,
  phase: CompiledTopPhase,
  phaseIdx: number,
  iteration: number,
  worktree?: WorktreeContext
): string {
  const phases = progress.phases ?? [];
  const context: PromptContext = {
    sprintId: progress['sprint-id'],
    iteration,
    phase: {
      id: phase.id,
      index: phaseIdx,
      total: phases.length,
    },
    step: null,
    subPhase: null,
    retryCount: phase['retry-count'] ?? 0,
    error: phase.error ?? null,
  };

  const parts: string[] = [];

  // Header
  const headerTemplate = customPrompts?.header ?? DEFAULT_PROMPTS.header;
  parts.push(substituteVariables(headerTemplate, context));

  // Worktree context warning (CRITICAL - must come early in prompt)
  appendWorktreeContext(parts, worktree);

  // Position (simple - no step/sub-phase)
  parts.push('');
  const positionTemplate = customPrompts?.position ?? DEFAULT_POSITION_SIMPLE;
  parts.push(substituteVariables(positionTemplate, context));

  // Retry warning (if applicable)
  if (context.retryCount > 0) {
    parts.push('');
    const retryTemplate = customPrompts?.['retry-warning'] ?? DEFAULT_PROMPTS['retry-warning'];
    parts.push(substituteVariables(retryTemplate, context));
  }

  // Task section
  parts.push('');
  parts.push('## Your Task');
  parts.push('');
  parts.push(phase.prompt ?? '');

  // Instructions
  parts.push('');
  const instructionsTemplate = customPrompts?.instructions ?? DEFAULT_INSTRUCTIONS_SIMPLE;
  parts.push(substituteVariables(instructionsTemplate, context));

  // Files section
  appendFilesSection(parts, sprintDir);

  // Result reporting
  parts.push('');
  const resultTemplate = customPrompts?.['result-reporting'] ?? DEFAULT_PROMPTS['result-reporting'];
  parts.push(substituteVariables(resultTemplate, context));

  // Context files
  appendContextContent(parts, sprintDir);

  return parts.join('\n');
}

/**
 * Build prompt for a for-each phase with steps and sub-phases
 */
function buildForEachPrompt(
  progress: CompiledProgress,
  sprintDir: string,
  customPrompts: CustomPrompts | undefined,
  phase: CompiledTopPhase,
  phaseIdx: number,
  iteration: number,
  worktree?: WorktreeContext
): string {
  const phases = progress.phases ?? [];
  const current = progress.current;
  const stepIdx = current.step ?? 0;
  const subPhaseIdx = current['sub-phase'] ?? 0;

  const steps = phase.steps ?? [];
  if (steps.length === 0 || stepIdx >= steps.length) {
    return '';
  }

  const step = steps[stepIdx];
  const subPhases = step.phases ?? [];
  if (subPhases.length === 0 || subPhaseIdx >= subPhases.length) {
    return '';
  }

  const subPhase = subPhases[subPhaseIdx];

  const context: PromptContext = {
    sprintId: progress['sprint-id'],
    iteration,
    phase: {
      id: phase.id,
      index: phaseIdx,
      total: phases.length,
    },
    step: {
      id: step.id,
      prompt: step.prompt,
      index: stepIdx,
      total: steps.length,
    },
    subPhase: {
      id: subPhase.id,
      index: subPhaseIdx,
      total: subPhases.length,
    },
    retryCount: subPhase['retry-count'] ?? 0,
    error: subPhase.error ?? null,
  };

  const parts: string[] = [];

  // Header
  const headerTemplate = customPrompts?.header ?? DEFAULT_PROMPTS.header;
  parts.push(substituteVariables(headerTemplate, context));

  // Worktree context warning (CRITICAL - must come early in prompt)
  appendWorktreeContext(parts, worktree);

  // Position (full - with step and sub-phase)
  parts.push('');
  const positionTemplate = customPrompts?.position ?? DEFAULT_PROMPTS.position;
  parts.push(substituteVariables(positionTemplate, context));

  // Retry warning (if applicable)
  if (context.retryCount > 0) {
    parts.push('');
    const retryTemplate = customPrompts?.['retry-warning'] ?? DEFAULT_PROMPTS['retry-warning'];
    parts.push(substituteVariables(retryTemplate, context));
  }

  // Step context
  parts.push('');
  parts.push('## Step Context');
  parts.push(step.prompt);

  // Task section with sub-phase ID
  parts.push('');
  parts.push(`## Your Task: ${subPhase.id}`);
  parts.push('');
  parts.push(subPhase.prompt);

  // Instructions
  parts.push('');
  const instructionsTemplate = customPrompts?.instructions ?? DEFAULT_PROMPTS.instructions;
  parts.push(substituteVariables(instructionsTemplate, context));

  // Files section
  appendFilesSection(parts, sprintDir);

  // Result reporting
  parts.push('');
  const resultTemplate = customPrompts?.['result-reporting'] ?? DEFAULT_PROMPTS['result-reporting'];
  parts.push(substituteVariables(resultTemplate, context));

  // Context files
  appendContextContent(parts, sprintDir);

  return parts.join('\n');
}

// ============================================================================
// Parallel Prompt Building
// ============================================================================

/**
 * Build simplified prompt for parallel background tasks
 * Does NOT include progress modification instructions
 */
export function buildParallelPrompt(
  progress: CompiledProgress,
  sprintDir: string,
  phaseIdx: number,
  stepIdx: number,
  subPhaseIdx: number,
  taskId: string,
  worktree?: WorktreeContext
): string {
  const phases = progress.phases ?? [];
  if (phaseIdx >= phases.length) {
    return '';
  }

  const phase = phases[phaseIdx];
  const steps = phase.steps ?? [];
  if (stepIdx >= steps.length) {
    return '';
  }

  const step = steps[stepIdx];
  const subPhases = step.phases ?? [];
  if (subPhaseIdx >= subPhases.length) {
    return '';
  }

  const subPhase = subPhases[subPhaseIdx];

  const parts: string[] = [];

  // Parallel task header
  parts.push('# Parallel Task Execution');
  parts.push(`Task ID: ${taskId}`);

  // Worktree context warning (CRITICAL - must come early in prompt)
  appendWorktreeContext(parts, worktree);

  // Context
  parts.push('');
  parts.push('## Context');
  parts.push(`Step: ${step.prompt}`);

  // Task
  parts.push('');
  parts.push(`## Your Task: ${subPhase.id}`);
  parts.push(subPhase.prompt);

  // Instructions (simplified for parallel)
  parts.push('');
  parts.push('## Instructions');
  parts.push('1. Execute this task independently');
  parts.push('2. This runs in background - focus on completing this specific task');
  parts.push('3. Commit changes when done');

  // Result reporting (reuse default template)
  parts.push('');
  parts.push(DEFAULT_PROMPTS['result-reporting']);

  return parts.join('\n');
}
