/**
 * Main Compiler Module
 *
 * Orchestrates the compilation of SPRINT.yaml into PROGRESS.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
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
  LoadedWorkflow
} from './types.js';
import { loadWorkflow, resolveWorkflowRefs } from './resolve-workflows.js';
import { expandForEach, compileSimplePhase } from './expand-foreach.js';
import {
  validateSprintDefinition,
  validateWorkflowDefinition,
  validateCompiledProgress,
  checkUnresolvedVariables
} from './validate.js';

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
      message: `Failed to load SPRINT.yaml: ${err instanceof Error ? err.message : err}`,
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
    console.log(`Loaded SPRINT.yaml: ${sprintDef.steps.length} steps`);
  }

  // Load the main workflow
  const mainWorkflow = loadWorkflow(sprintDef.workflow, config.workflowsDir);
  if (!mainWorkflow) {
    errors.push({
      code: 'MAIN_WORKFLOW_NOT_FOUND',
      message: `Main workflow not found: ${sprintDef.workflow}`,
      path: 'workflow',
      details: {
        searchPath: config.workflowsDir,
        workflowName: sprintDef.workflow
      }
    });
    return { success: false, errors, warnings };
  }

  // Validate main workflow
  const workflowErrors = validateWorkflowDefinition(mainWorkflow.definition, sprintDef.workflow);
  if (workflowErrors.length > 0) {
    errors.push(...workflowErrors);
    return { success: false, errors, warnings };
  }

  if (config.verbose) {
    console.log(`Loaded workflow: ${mainWorkflow.definition.name} (${mainWorkflow.definition.phases.length} phases)`);
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

  // Compile phases
  const compiledPhases: CompiledTopPhase[] = [];

  // Find the default step workflow (first for-each phase's workflow, or feature-standard)
  let defaultStepWorkflow: LoadedWorkflow | null = null;
  for (const phase of mainWorkflow.definition.phases) {
    if (phase['for-each'] === 'step' && phase.workflow) {
      defaultStepWorkflow = loadWorkflow(phase.workflow, config.workflowsDir);
      break;
    }
  }

  for (const phase of mainWorkflow.definition.phases) {
    if (phase['for-each'] === 'step') {
      // Expand for-each phase into steps
      const expandedPhase = expandForEach(
        phase,
        sprintDef.steps,
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
    stats
  };

  // Validate compiled progress
  const progressErrors = validateCompiledProgress(progress);
  if (progressErrors.length > 0) {
    errors.push(...progressErrors);
    return { success: false, errors, warnings };
  }

  // Check for unresolved variables
  const unresolvedWarnings = checkUnresolvedVariables(progress);
  warnings.push(...unresolvedWarnings);

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
