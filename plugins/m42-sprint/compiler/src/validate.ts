/**
 * Validation Module
 *
 * Schema validation for SPRINT.yaml and workflow definitions
 */

import type {
  SprintDefinition,
  WorkflowDefinition,
  WorkflowPhase,
  SprintStep,
  CompiledProgress,
  CompilerError
} from './types.js';
import { findUnresolvedVars } from './expand-foreach.js';

/**
 * Validate a sprint definition (SPRINT.yaml)
 *
 * @param sprint - The sprint definition to validate
 * @returns Array of validation errors
 */
export function validateSprintDefinition(sprint: unknown): CompilerError[] {
  const errors: CompilerError[] = [];

  if (!sprint || typeof sprint !== 'object') {
    errors.push({
      code: 'INVALID_SPRINT',
      message: 'SPRINT.yaml must be a valid YAML object'
    });
    return errors;
  }

  const s = sprint as Record<string, unknown>;

  // Check required fields
  if (!s.workflow || typeof s.workflow !== 'string') {
    errors.push({
      code: 'MISSING_WORKFLOW',
      message: 'SPRINT.yaml must specify a workflow reference',
      path: 'workflow'
    });
  }

  if (!s.steps || !Array.isArray(s.steps)) {
    errors.push({
      code: 'MISSING_STEPS',
      message: 'SPRINT.yaml must have a steps array',
      path: 'steps'
    });
  } else {
    // Validate each step
    (s.steps as unknown[]).forEach((step, index) => {
      const stepErrors = validateSprintStep(step, index);
      errors.push(...stepErrors);
    });
  }

  return errors;
}

/**
 * Validate a single sprint step
 *
 * @param step - The step to validate
 * @param index - Index of the step in the array
 * @returns Array of validation errors
 */
export function validateSprintStep(step: unknown, index: number): CompilerError[] {
  const errors: CompilerError[] = [];

  if (!step || typeof step !== 'object') {
    errors.push({
      code: 'INVALID_STEP',
      message: `Step ${index} must be an object`,
      path: `steps[${index}]`
    });
    return errors;
  }

  const s = step as Record<string, unknown>;

  if (!s.prompt || typeof s.prompt !== 'string') {
    errors.push({
      code: 'MISSING_STEP_PROMPT',
      message: `Step ${index} must have a prompt`,
      path: `steps[${index}].prompt`
    });
  } else if (s.prompt.trim().length === 0) {
    errors.push({
      code: 'EMPTY_STEP_PROMPT',
      message: `Step ${index} has an empty prompt`,
      path: `steps[${index}].prompt`
    });
  }

  // Validate optional workflow override
  if (s.workflow !== undefined && typeof s.workflow !== 'string') {
    errors.push({
      code: 'INVALID_STEP_WORKFLOW',
      message: `Step ${index} workflow must be a string`,
      path: `steps[${index}].workflow`
    });
  }

  return errors;
}

/**
 * Validate a workflow definition
 *
 * @param workflow - The workflow to validate
 * @param name - Name of the workflow (for error messages)
 * @returns Array of validation errors
 */
export function validateWorkflowDefinition(
  workflow: unknown,
  name: string
): CompilerError[] {
  const errors: CompilerError[] = [];

  if (!workflow || typeof workflow !== 'object') {
    errors.push({
      code: 'INVALID_WORKFLOW',
      message: `Workflow ${name} must be a valid YAML object`
    });
    return errors;
  }

  const w = workflow as Record<string, unknown>;

  // Check required fields
  if (!w.name || typeof w.name !== 'string') {
    errors.push({
      code: 'MISSING_WORKFLOW_NAME',
      message: `Workflow ${name} must have a name`,
      path: `${name}.name`
    });
  }

  if (!w.phases || !Array.isArray(w.phases)) {
    errors.push({
      code: 'MISSING_PHASES',
      message: `Workflow ${name} must have a phases array`,
      path: `${name}.phases`
    });
  } else {
    // Validate each phase
    const phaseIds = new Set<string>();
    (w.phases as unknown[]).forEach((phase, index) => {
      const phaseErrors = validateWorkflowPhase(phase, index, name, phaseIds);
      errors.push(...phaseErrors);
    });
  }

  return errors;
}

/**
 * Validate a single workflow phase
 *
 * @param phase - The phase to validate
 * @param index - Index of the phase
 * @param workflowName - Name of the containing workflow
 * @param existingIds - Set of already seen phase IDs (for duplicate detection)
 * @returns Array of validation errors
 */
export function validateWorkflowPhase(
  phase: unknown,
  index: number,
  workflowName: string,
  existingIds: Set<string>
): CompilerError[] {
  const errors: CompilerError[] = [];

  if (!phase || typeof phase !== 'object') {
    errors.push({
      code: 'INVALID_PHASE',
      message: `Phase ${index} in ${workflowName} must be an object`,
      path: `${workflowName}.phases[${index}]`
    });
    return errors;
  }

  const p = phase as Record<string, unknown>;

  // Check required ID
  if (!p.id || typeof p.id !== 'string') {
    errors.push({
      code: 'MISSING_PHASE_ID',
      message: `Phase ${index} in ${workflowName} must have an id`,
      path: `${workflowName}.phases[${index}].id`
    });
  } else {
    // Check for duplicate IDs
    if (existingIds.has(p.id)) {
      errors.push({
        code: 'DUPLICATE_PHASE_ID',
        message: `Duplicate phase ID '${p.id}' in ${workflowName}`,
        path: `${workflowName}.phases[${index}].id`
      });
    }
    existingIds.add(p.id);
  }

  // A phase must have either prompt, for-each, or workflow
  const hasPrompt = p.prompt && typeof p.prompt === 'string';
  const hasForEach = p['for-each'] === 'step';
  const hasWorkflow = p.workflow && typeof p.workflow === 'string';

  if (!hasPrompt && !hasForEach) {
    errors.push({
      code: 'PHASE_MISSING_ACTION',
      message: `Phase '${p.id || index}' in ${workflowName} must have either 'prompt' or 'for-each: step'`,
      path: `${workflowName}.phases[${index}]`
    });
  }

  // Validate for-each value
  if (p['for-each'] !== undefined && p['for-each'] !== 'step') {
    errors.push({
      code: 'INVALID_FOREACH',
      message: `for-each must be 'step' (got '${p['for-each']}')`,
      path: `${workflowName}.phases[${index}].for-each`
    });
  }

  return errors;
}

/**
 * Check for unresolved template variables in compiled progress
 *
 * @param progress - The compiled progress to check
 * @returns Array of warnings about unresolved variables
 */
export function checkUnresolvedVariables(progress: CompiledProgress): string[] {
  const warnings: string[] = [];

  function checkPhasePrompt(prompt: string | undefined, path: string): void {
    if (!prompt) return;
    const unresolved = findUnresolvedVars(prompt);
    if (unresolved.length > 0) {
      warnings.push(`Unresolved variables in ${path}: ${unresolved.join(', ')}`);
    }
  }

  for (const phase of progress.phases) {
    checkPhasePrompt(phase.prompt, `phases[${phase.id}].prompt`);

    if (phase.steps) {
      for (const step of phase.steps) {
        for (const subPhase of step.phases) {
          checkPhasePrompt(
            subPhase.prompt,
            `phases[${phase.id}].steps[${step.id}].phases[${subPhase.id}].prompt`
          );
        }
      }
    }
  }

  return warnings;
}

/**
 * Validate the entire compiled progress structure
 *
 * @param progress - The compiled progress to validate
 * @returns Array of validation errors
 */
export function validateCompiledProgress(progress: CompiledProgress): CompilerError[] {
  const errors: CompilerError[] = [];

  if (!progress['sprint-id']) {
    errors.push({
      code: 'MISSING_SPRINT_ID',
      message: 'Compiled progress must have a sprint-id'
    });
  }

  if (!progress.phases || !Array.isArray(progress.phases) || progress.phases.length === 0) {
    errors.push({
      code: 'NO_PHASES',
      message: 'Compiled progress must have at least one phase'
    });
  }

  if (!progress.current) {
    errors.push({
      code: 'MISSING_CURRENT',
      message: 'Compiled progress must have a current pointer'
    });
  }

  return errors;
}
