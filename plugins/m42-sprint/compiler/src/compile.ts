/**
 * Main Compiler Module
 *
 * Orchestrates the compilation of SPRINT.yaml into PROGRESS.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { YAMLException } from 'js-yaml';
import type {
  SprintDefinition,
  WorkflowDefinition,
  CompiledProgress,
  CompiledTopPhase,
  CurrentPointer,
  SprintStats,
  CompilerConfig,
  CompilerResult,
  CompilerError,
  TemplateContext,
  LoadedWorkflow,
  PerIterationHook,
  RalphConfig
} from './types.js';
import { loadWorkflow, resolveWorkflowRefs } from './resolve-workflows.js';
import { expandForEach, compileSimplePhase } from './expand-foreach.js';
import {
  validateSprintDefinition,
  validateWorkflowDefinition,
  validateCompiledProgress,
  checkUnresolvedVariables,
  validateRalphModeSprint
} from './validate.js';

/**
 * Format a YAML parsing error with line numbers and context
 *
 * @param err - The error from yaml.load()
 * @param filePath - Path to the file that failed to parse
 * @returns Formatted error message with context
 */
export function formatYamlError(err: unknown, filePath: string): string {
  if (err instanceof YAMLException) {
    const parts: string[] = [];

    // Add the reason
    parts.push(err.reason || 'YAML parsing error');

    // Add location if available
    if (err.mark) {
      // js-yaml uses 0-indexed line/column, display as 1-indexed
      const line = err.mark.line + 1;
      const column = err.mark.column + 1;
      parts.push(`at line ${line}, column ${column}`);

      // Add snippet if available (js-yaml provides context around the error)
      if (err.mark.snippet) {
        parts.push('\n' + err.mark.snippet);
      }
    }

    return parts.join(' ');
  }

  // For non-YAML errors, return the message as-is
  return err instanceof Error ? err.message : String(err);
}

/**
 * Main compilation function
 *
 * @param config - Compiler configuration
 * @returns Compilation result with progress or errors
 */
export async function compile(config: CompilerConfig): Promise<CompilerResult> {
  const errors: CompilerError[] = [];
  const warnings: string[] = [];

  // Load SPRINT.yaml
  const sprintYamlPath = path.join(config.sprintDir, 'SPRINT.yaml');
  let sprintDef: SprintDefinition;

  try {
    const content = fs.readFileSync(sprintYamlPath, 'utf8');
    sprintDef = yaml.load(content) as SprintDefinition;
  } catch (err) {
    errors.push({
      code: 'SPRINT_LOAD_ERROR',
      message: `Failed to load SPRINT.yaml: ${formatYamlError(err, sprintYamlPath)}`,
      path: sprintYamlPath
    });
    return { success: false, errors, warnings };
  }

  // Validate SPRINT.yaml
  const sprintErrors = validateSprintDefinition(sprintDef);
  if (sprintErrors.length > 0) {
    errors.push(...sprintErrors);
    return { success: false, errors, warnings };
  }

  if (config.verbose) {
    console.log(`Loaded SPRINT.yaml: ${sprintDef.steps?.length ?? 0} steps`); // intentional
  }

  // Load the main workflow
  const mainWorkflow = loadWorkflow(sprintDef.workflow, config.workflowsDir, errors);
  if (!mainWorkflow) {
    // Only add "not found" error if no parse error was added
    const hasParseError = errors.some(e => e.code === 'WORKFLOW_PARSE_ERROR');
    if (!hasParseError) {
      errors.push({
        code: 'MAIN_WORKFLOW_NOT_FOUND',
        message: `Main workflow not found: ${sprintDef.workflow}`,
        path: 'workflow',
        details: {
          searchPath: config.workflowsDir,
          workflowName: sprintDef.workflow
        }
      });
    }
    return { success: false, errors, warnings };
  }

  // Validate main workflow
  const workflowErrors = validateWorkflowDefinition(mainWorkflow.definition, sprintDef.workflow);
  if (workflowErrors.length > 0) {
    errors.push(...workflowErrors);
    return { success: false, errors, warnings };
  }

  // Check for Ralph mode and use separate compilation path
  const isRalphMode = mainWorkflow.definition.mode === 'ralph';

  if (isRalphMode) {
    // Validate Ralph mode specific requirements
    const ralphErrors = validateRalphModeSprint(sprintDef, mainWorkflow.definition);
    if (ralphErrors.length > 0) {
      errors.push(...ralphErrors);
      return { success: false, errors, warnings };
    }

    if (config.verbose) {
      console.log(`Loaded Ralph mode workflow: ${mainWorkflow.definition.name}`); // intentional
    }

    // Compile Ralph mode PROGRESS.yaml
    return compileRalphMode(sprintDef, mainWorkflow.definition, config, errors, warnings);
  }

  if (config.verbose) {
    console.log(`Loaded workflow: ${mainWorkflow.definition.name} (${mainWorkflow.definition.phases?.length ?? 0} phases)`); // intentional
  }

  // Resolve all workflow references (for cycle detection and validation)
  const referencedWorkflows = resolveWorkflowRefs(
    mainWorkflow.definition,
    config.workflowsDir,
    new Set([sprintDef.workflow]),
    errors
  );

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  // Validate all referenced workflows
  for (const [name, loaded] of referencedWorkflows) {
    const refErrors = validateWorkflowDefinition(loaded.definition, name);
    errors.push(...refErrors);
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  // Generate sprint ID
  const sprintId = sprintDef['sprint-id'] || generateSprintId(config.sprintDir);

  // Create template context
  const context: TemplateContext = {
    sprint: {
      id: sprintId,
      name: sprintDef.name
    }
  };

  // Compile phases (standard mode - phases are required and validated by this point)
  const compiledPhases: CompiledTopPhase[] = [];
  const workflowPhases = mainWorkflow.definition.phases ?? [];

  // Find the default step workflow (first for-each phase's workflow, or feature-standard)
  let defaultStepWorkflow: LoadedWorkflow | null = null;
  for (const phase of workflowPhases) {
    if (phase['for-each'] === 'step' && phase.workflow) {
      defaultStepWorkflow = loadWorkflow(phase.workflow, config.workflowsDir, errors);
      break;
    }
  }

  for (const phase of workflowPhases) {
    if (phase['for-each'] === 'step') {
      // Expand for-each phase into steps
      const expandedPhase = expandForEach(
        phase,
        sprintDef.steps ?? [],
        config.workflowsDir,
        defaultStepWorkflow,
        context,
        errors
      );
      compiledPhases.push(expandedPhase);
    } else {
      // Simple phase with prompt
      const simplePhase = compileSimplePhase(phase, context);
      compiledPhases.push(simplePhase);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  // Calculate statistics
  const stats = calculateStats(compiledPhases);

  // Create current pointer (start at first phase)
  const current = initializeCurrentPointer(compiledPhases);

  // Build compiled progress
  const progress: CompiledProgress = {
    'sprint-id': sprintId,
    status: 'not-started',
    phases: compiledPhases,
    current,
    stats,
    'parallel-tasks': []
  };

  // Validate compiled progress
  const progressErrors = validateCompiledProgress(progress);
  if (progressErrors.length > 0) {
    errors.push(...progressErrors);
    return { success: false, errors, warnings };
  }

  // Check for unresolved variables
  const unresolvedIssues = checkUnresolvedVariables(progress);

  if (config.strict && unresolvedIssues.length > 0) {
    // In strict mode, unresolved variables are errors
    errors.push(...unresolvedIssues);
    return { success: false, errors, warnings };
  } else {
    // In non-strict mode, unresolved variables are warnings
    warnings.push(...unresolvedIssues.map(e =>
      `${e.message}${e.path ? ` at ${e.path}` : ''}`
    ));
  }

  return {
    success: true,
    progress,
    errors,
    warnings
  };
}

/**
 * Generate a sprint ID from the directory name
 */
function generateSprintId(sprintDir: string): string {
  const dirName = path.basename(sprintDir);

  // If directory already has date prefix, use as-is
  if (/^\d{4}-\d{2}-\d{2}_/.test(dirName)) {
    return dirName;
  }

  // Add date prefix
  const today = new Date().toISOString().split('T')[0];
  return `${today}_${dirName}`;
}

/**
 * Calculate statistics for compiled phases
 */
function calculateStats(phases: CompiledTopPhase[]): SprintStats {
  let totalPhases = 0;
  let totalSteps = 0;

  for (const phase of phases) {
    totalPhases++;
    if (phase.steps) {
      totalSteps += phase.steps.length;
      // Count sub-phases within steps
      for (const step of phase.steps) {
        totalPhases += step.phases.length;
      }
    }
  }

  return {
    'started-at': null,
    'total-phases': totalPhases,
    'completed-phases': 0,
    'total-steps': totalSteps > 0 ? totalSteps : undefined,
    'completed-steps': totalSteps > 0 ? 0 : undefined
  };
}

/**
 * Initialize the current pointer to the first executable item
 */
function initializeCurrentPointer(phases: CompiledTopPhase[]): CurrentPointer {
  if (phases.length === 0) {
    return { phase: 0, step: null, 'sub-phase': null };
  }

  const firstPhase = phases[0];

  if (firstPhase.steps && firstPhase.steps.length > 0) {
    // First phase has steps, point to first step's first sub-phase
    return {
      phase: 0,
      step: 0,
      'sub-phase': 0
    };
  } else {
    // Simple phase
    return {
      phase: 0,
      step: null,
      'sub-phase': null
    };
  }
}

/**
 * Merge per-iteration hooks from workflow definition with sprint overrides
 *
 * @param workflowHooks - Hooks defined in the workflow
 * @param sprintOverrides - Override settings from SPRINT.yaml
 * @returns Merged hooks with overrides applied
 */
function mergePerIterationHooks(
  workflowHooks: PerIterationHook[] | undefined,
  sprintOverrides: Record<string, { enabled: boolean }> | undefined
): PerIterationHook[] {
  if (!workflowHooks || workflowHooks.length === 0) {
    return [];
  }

  return workflowHooks.map(hook => {
    const override = sprintOverrides?.[hook.id];
    if (override) {
      return { ...hook, enabled: override.enabled };
    }
    return hook;
  });
}

/**
 * Compile Ralph mode PROGRESS.yaml
 *
 * Ralph mode uses goal-driven execution rather than predefined phases.
 * Claude analyzes the goal, creates dynamic steps, and decides when complete.
 *
 * @param sprintDef - The sprint definition
 * @param workflow - The Ralph mode workflow definition
 * @param config - Compiler configuration
 * @param errors - Error accumulator
 * @param warnings - Warning accumulator
 * @returns Compilation result with Ralph mode progress structure
 */
function compileRalphMode(
  sprintDef: SprintDefinition,
  workflow: WorkflowDefinition,
  config: CompilerConfig,
  errors: CompilerError[],
  warnings: string[]
): CompilerResult {
  // Generate sprint ID
  const sprintId = sprintDef['sprint-id'] || generateSprintId(config.sprintDir);

  // Merge per-iteration hooks (workflow defaults + sprint overrides)
  const mergedHooks = mergePerIterationHooks(
    workflow['per-iteration-hooks'],
    sprintDef['per-iteration-hooks']
  );

  // Build Ralph mode configuration
  const ralphConfig: RalphConfig = {
    'idle-threshold': 3  // Default: reflect after 3 iterations without progress
  };

  // Build Ralph mode PROGRESS.yaml structure
  const progress: CompiledProgress = {
    'sprint-id': sprintId,
    status: 'not-started',
    mode: 'ralph',
    goal: sprintDef.goal,
    'dynamic-steps': [],
    'hook-tasks': [],
    'per-iteration-hooks': mergedHooks,
    ralph: ralphConfig,
    'ralph-exit': {
      'detected-at': undefined,
      iteration: undefined,
      'final-summary': undefined
    },
    current: {
      phase: 0,
      step: null,
      'sub-phase': null
    },
    stats: {
      'started-at': null,
      'total-phases': 0,
      'completed-phases': 0,
      'current-iteration': 0
    }
  };

  return {
    success: true,
    progress,
    errors,
    warnings
  };
}

/**
 * Convenience function to compile from file paths
 */
export async function compileFromPaths(
  sprintDir: string,
  workflowsDir: string,
  verbose: boolean = false
): Promise<CompilerResult> {
  return compile({
    sprintDir: path.resolve(sprintDir),
    workflowsDir: path.resolve(workflowsDir),
    verbose
  });
}
