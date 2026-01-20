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
  CompilerError,
  PerIterationHook,
  ClaudeModel
} from './types.js';
import { findUnresolvedVars } from './expand-foreach.js';

/** Valid model values */
const VALID_MODELS: ClaudeModel[] = ['sonnet', 'opus', 'haiku'];

/**
 * Validate that a model value is valid
 *
 * @param model - The model value to validate
 * @param path - Path for error messages
 * @returns Array of validation errors (empty if valid)
 */
export function validateModel(model: unknown, path: string): CompilerError[] {
  const errors: CompilerError[] = [];

  if (model !== undefined && model !== null) {
    if (typeof model !== 'string' || !VALID_MODELS.includes(model as ClaudeModel)) {
      errors.push({
        code: 'INVALID_MODEL',
        message: `Invalid model value '${model}': must be one of ${VALID_MODELS.join(', ')}`,
        path
      });
    }
  }

  return errors;
}

/**
 * Validate a sprint definition (SPRINT.yaml) - basic validation
 *
 * This performs minimal validation before workflow is loaded.
 * The `steps` array requirement is deferred to validateStandardModeSprint()
 * because Ralph mode sprints don't use steps.
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

  // Check required fields (workflow is always required)
  if (!s.workflow || typeof s.workflow !== 'string') {
    errors.push({
      code: 'MISSING_WORKFLOW',
      message: 'SPRINT.yaml must specify a workflow reference',
      path: 'workflow'
    });
  }

  // Note: steps validation is deferred to validateStandardModeSprint()
  // because Ralph mode sprints don't require steps

  // Validate model field if present
  if (s.model !== undefined) {
    errors.push(...validateModel(s.model, 'model'));
  }

  // Validate steps if present (even for Ralph mode, steps would be invalid)
  if (s.steps !== undefined && Array.isArray(s.steps)) {
    (s.steps as unknown[]).forEach((step, index) => {
      const stepErrors = validateSprintStep(step, index);
      errors.push(...stepErrors);
    });
  }

  return errors;
}

/**
 * Validate standard mode sprint requirements
 *
 * Called after workflow is loaded to validate sprint-specific standard mode requirements.
 *
 * @param sprint - The sprint definition
 * @returns Array of validation errors
 */
export function validateStandardModeSprint(sprint: SprintDefinition): CompilerError[] {
  const errors: CompilerError[] = [];

  // Standard mode requires steps array
  if (!sprint.steps || !Array.isArray(sprint.steps)) {
    errors.push({
      code: 'MISSING_STEPS',
      message: 'SPRINT.yaml must have a steps array',
      path: 'steps'
    });
  } else if (sprint.steps.length === 0) {
    errors.push({
      code: 'EMPTY_STEPS',
      message: 'SPRINT.yaml steps array cannot be empty',
      path: 'steps'
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

  // Validate optional model override
  if (s.model !== undefined) {
    errors.push(...validateModel(s.model, `steps[${index}].model`));
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

  // Check for mode field
  const isRalphMode = w.mode === 'ralph';

  // Validate mode field if present
  if (w.mode !== undefined && w.mode !== 'standard' && w.mode !== 'ralph') {
    errors.push({
      code: 'INVALID_WORKFLOW_MODE',
      message: `Workflow ${name} has invalid mode: must be 'standard' or 'ralph'`,
      path: `${name}.mode`
    });
  }

  // Validate model field if present
  if (w.model !== undefined) {
    errors.push(...validateModel(w.model, `${name}.model`));
  }

  // Ralph mode workflows don't require phases
  if (isRalphMode) {
    // Validate per-iteration hooks if present
    if (w['per-iteration-hooks'] !== undefined) {
      if (!Array.isArray(w['per-iteration-hooks'])) {
        errors.push({
          code: 'INVALID_HOOKS',
          message: `Workflow ${name} per-iteration-hooks must be an array`,
          path: `${name}.per-iteration-hooks`
        });
      } else {
        (w['per-iteration-hooks'] as unknown[]).forEach((hook, index) => {
          const hookErrors = validatePerIterationHook(hook, index, name);
          errors.push(...hookErrors);
        });
      }
    }
  } else {
    // Standard mode: phases are required
    if (!w.phases || !Array.isArray(w.phases)) {
      errors.push({
        code: 'MISSING_PHASES',
        message: `Workflow ${name} must have a phases array`,
        path: `${name}.phases`
      });
    } else if (w.phases.length === 0) {
      errors.push({
        code: 'EMPTY_WORKFLOW',
        message: `Workflow ${name} has zero phases`,
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
  }

  return errors;
}

/**
 * Validate a per-iteration hook
 *
 * @param hook - The hook to validate
 * @param index - Index of the hook
 * @param workflowName - Name of the containing workflow
 * @returns Array of validation errors
 */
export function validatePerIterationHook(
  hook: unknown,
  index: number,
  workflowName: string
): CompilerError[] {
  const errors: CompilerError[] = [];

  if (!hook || typeof hook !== 'object') {
    errors.push({
      code: 'INVALID_HOOK',
      message: `Per-iteration hook ${index} in ${workflowName} must be an object`,
      path: `${workflowName}.per-iteration-hooks[${index}]`
    });
    return errors;
  }

  const h = hook as Record<string, unknown>;

  // Check required id field
  if (!h.id || typeof h.id !== 'string') {
    errors.push({
      code: 'MISSING_HOOK_ID',
      message: `Per-iteration hook ${index} in ${workflowName} must have an id`,
      path: `${workflowName}.per-iteration-hooks[${index}].id`
    });
  }

  // Must have either workflow OR prompt (but not both, not neither)
  const hasWorkflow = h.workflow && typeof h.workflow === 'string';
  const hasPrompt = h.prompt && typeof h.prompt === 'string';

  if (!hasWorkflow && !hasPrompt) {
    errors.push({
      code: 'RALPH_INVALID_HOOK',
      message: `Per-iteration hook '${h.id || index}' must have either workflow or prompt`,
      path: `${workflowName}.per-iteration-hooks[${index}]`
    });
  }

  if (hasWorkflow && hasPrompt) {
    errors.push({
      code: 'HOOK_AMBIGUOUS_ACTION',
      message: `Per-iteration hook '${h.id || index}' cannot have both workflow and prompt`,
      path: `${workflowName}.per-iteration-hooks[${index}]`
    });
  }

  // Validate parallel field
  if (h.parallel !== undefined && typeof h.parallel !== 'boolean') {
    errors.push({
      code: 'INVALID_HOOK_PARALLEL',
      message: `Per-iteration hook '${h.id || index}' parallel must be a boolean`,
      path: `${workflowName}.per-iteration-hooks[${index}].parallel`
    });
  }

  // Validate enabled field
  if (h.enabled !== undefined && typeof h.enabled !== 'boolean') {
    errors.push({
      code: 'INVALID_HOOK_ENABLED',
      message: `Per-iteration hook '${h.id || index}' enabled must be a boolean`,
      path: `${workflowName}.per-iteration-hooks[${index}].enabled`
    });
  }

  return errors;
}

/**
 * Validate Ralph mode sprint requirements
 *
 * Called after workflow is loaded to validate sprint-specific Ralph mode requirements.
 *
 * @param sprint - The sprint definition
 * @param workflow - The workflow definition (known to be Ralph mode)
 * @returns Array of validation errors
 */
export function validateRalphModeSprint(
  sprint: SprintDefinition,
  workflow: WorkflowDefinition
): CompilerError[] {
  const errors: CompilerError[] = [];

  // Ralph mode requires goal field in SPRINT.yaml
  if (!sprint.goal || typeof sprint.goal !== 'string' || sprint.goal.trim().length === 0) {
    errors.push({
      code: 'RALPH_MISSING_GOAL',
      message: 'Ralph mode requires goal field in SPRINT.yaml',
      path: 'goal'
    });
  }

  // Validate per-iteration hook overrides reference valid hook IDs
  if (sprint['per-iteration-hooks'] && workflow['per-iteration-hooks']) {
    const workflowHookIds = new Set(workflow['per-iteration-hooks'].map(h => h.id));

    for (const hookId of Object.keys(sprint['per-iteration-hooks'])) {
      if (!workflowHookIds.has(hookId)) {
        errors.push({
          code: 'RALPH_INVALID_HOOK_OVERRIDE',
          message: `Per-iteration hook override '${hookId}' does not match any hook in workflow`,
          path: `per-iteration-hooks.${hookId}`
        });
      }
    }
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

  // A phase must have either prompt, for-each, or workflow (but prompt and workflow are mutually exclusive)
  const hasPrompt = p.prompt && typeof p.prompt === 'string';
  const hasForEach = p['for-each'] === 'step';
  const hasWorkflow = p.workflow && typeof p.workflow === 'string';

  // Check mutual exclusivity: prompt and workflow cannot both be specified
  if (hasPrompt && hasWorkflow) {
    errors.push({
      code: 'PROMPT_WORKFLOW_MUTUAL_EXCLUSIVE',
      message: `Phase '${p.id || index}' in ${workflowName} cannot have both 'prompt' and 'workflow'`,
      path: `${workflowName}.phases[${index}]`
    });
  }

  // A phase must have prompt, for-each, or workflow (workflow without for-each is allowed)
  if (!hasPrompt && !hasForEach && !hasWorkflow) {
    errors.push({
      code: 'PHASE_MISSING_ACTION',
      message: `Phase '${p.id || index}' in ${workflowName} must have 'prompt', 'for-each: step', or 'workflow'`,
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

  // Validate parallel property (must be boolean if present)
  if (p.parallel !== undefined && typeof p.parallel !== 'boolean') {
    errors.push({
      code: 'INVALID_PARALLEL',
      message: `parallel must be a boolean (got ${typeof p.parallel})`,
      path: `${workflowName}.phases[${index}].parallel`
    });
  }

  // Validate wait-for-parallel property (must be boolean if present)
  if (p['wait-for-parallel'] !== undefined && typeof p['wait-for-parallel'] !== 'boolean') {
    errors.push({
      code: 'INVALID_WAIT_FOR_PARALLEL',
      message: `wait-for-parallel must be a boolean (got ${typeof p['wait-for-parallel']})`,
      path: `${workflowName}.phases[${index}].wait-for-parallel`
    });
  }

  // Warn if parallel: true is used on for-each phase (not supported)
  if (p.parallel === true && p['for-each'] === 'step') {
    errors.push({
      code: 'PARALLEL_FOREACH_WARNING',
      message: `parallel: true on for-each phase is not supported; use parallel in step workflow phases instead`,
      path: `${workflowName}.phases[${index}]`
    });
  }

  // Validate model field if present
  if (p.model !== undefined) {
    errors.push(...validateModel(p.model, `${workflowName}.phases[${index}].model`));
  }

  return errors;
}

/**
 * Check for unresolved template variables in compiled progress
 *
 * @param progress - The compiled progress to check
 * @param asErrors - If true, return as CompilerError[] for strict mode; otherwise return as string[]
 * @returns Array of issues about unresolved variables (errors or warnings based on asErrors)
 */
export function checkUnresolvedVariables(progress: CompiledProgress): CompilerError[] {
  const issues: CompilerError[] = [];

  function checkPhasePrompt(prompt: string | undefined, path: string): void {
    if (!prompt) return;
    const unresolved = findUnresolvedVars(prompt);
    if (unresolved.length > 0) {
      issues.push({
        code: 'UNRESOLVED_VARIABLES',
        message: `Unresolved variables: ${unresolved.join(', ')}`,
        path
      });
    }
  }

  // Ralph mode doesn't have phases, skip this check
  if (!progress.phases) {
    return issues;
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

  return issues;
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

  // Ralph mode doesn't require phases
  const isRalphMode = progress.mode === 'ralph';

  if (!isRalphMode) {
    if (!progress.phases || !Array.isArray(progress.phases) || progress.phases.length === 0) {
      errors.push({
        code: 'NO_PHASES',
        message: 'Compiled progress must have at least one phase'
      });
    }
  } else {
    // Ralph mode validation
    if (!progress.goal || typeof progress.goal !== 'string') {
      errors.push({
        code: 'RALPH_MISSING_GOAL',
        message: 'Ralph mode progress must have a goal'
      });
    }
  }

  if (!progress.current) {
    errors.push({
      code: 'MISSING_CURRENT',
      message: 'Compiled progress must have a current pointer'
    });
  }

  return errors;
}
