/**
 * For-Each Expansion Module
 *
 * Handles expansion of for-each: step phases into concrete steps
 */

import type {
  WorkflowPhase,
  WorkflowDefinition,
  SprintStep,
  CompiledTopPhase,
  CompiledStep,
  CompiledPhase,
  LoadedWorkflow,
  TemplateContext,
  CompilerError,
  ClaudeModel
} from './types.js';
import { loadWorkflow } from './resolve-workflows.js';

/**
 * Model context for resolving models during compilation
 */
export interface ModelContext {
  /** Workflow-level model (lowest priority) */
  workflowModel?: ClaudeModel;
  /** Sprint-level model (overrides workflow) */
  sprintModel?: ClaudeModel;
  /** Phase-level model (overrides sprint) */
  phaseModel?: ClaudeModel;
  /** Step-level model (highest priority) */
  stepModel?: ClaudeModel;
}

/**
 * Resolve model using priority: step > phase > sprint > workflow
 */
function resolveModelFromContext(ctx: ModelContext): ClaudeModel | undefined {
  return ctx.stepModel ?? ctx.phaseModel ?? ctx.sprintModel ?? ctx.workflowModel;
}

/**
 * Substitute template variables in a string
 *
 * Supports:
 * - {{step.prompt}} - The step's prompt text
 * - {{step.id}} - The step's ID
 * - {{step.index}} - The step's index (0-based)
 * - {{phase.id}} - Current phase ID
 * - {{sprint.id}} - Sprint ID
 *
 * @param template - String containing template variables
 * @param context - Context for variable substitution
 * @returns String with variables replaced
 */
export function substituteTemplateVars(
  template: string,
  context: TemplateContext
): string {
  let result = template;

  // Replace step variables
  if (context.step) {
    result = result.replace(/\{\{step\.prompt\}\}/g, context.step.prompt);
    result = result.replace(/\{\{step\.id\}\}/g, context.step.id);
    result = result.replace(/\{\{step\.index\}\}/g, String(context.step.index));
  }

  // Replace phase variables
  if (context.phase) {
    result = result.replace(/\{\{phase\.id\}\}/g, context.phase.id);
    result = result.replace(/\{\{phase\.index\}\}/g, String(context.phase.index));
  }

  // Replace sprint variables
  if (context.sprint) {
    result = result.replace(/\{\{sprint\.id\}\}/g, context.sprint.id);
    if (context.sprint.name) {
      result = result.replace(/\{\{sprint\.name\}\}/g, context.sprint.name);
    }
  }

  return result;
}

/**
 * Find unresolved template variables in a string
 *
 * @param text - String to check
 * @returns Array of unresolved variable names
 */
export function findUnresolvedVars(text: string): string[] {
  const matches = text.match(/\{\{[^}]+\}\}/g);
  return matches || [];
}

/**
 * Expand a single step using its workflow
 *
 * @param step - The step to expand
 * @param stepIndex - Index of this step
 * @param workflow - The workflow to use for expansion
 * @param context - Template context
 * @param modelContext - Model context for resolution
 * @returns Compiled step with expanded sub-phases
 */
export function expandStep(
  step: SprintStep,
  stepIndex: number,
  workflow: WorkflowDefinition,
  context: TemplateContext,
  modelContext: ModelContext = {}
): CompiledStep {
  const stepId = step.id || `step-${stepIndex}`;

  // Update context with step info
  const stepContext: TemplateContext = {
    ...context,
    step: {
      prompt: step.prompt,
      id: stepId,
      index: stepIndex
    }
  };

  // Create step-level model context (step model has highest priority)
  const stepModelContext: ModelContext = {
    ...modelContext,
    stepModel: step.model
  };

  // Expand each phase in the step's workflow
  const compiledPhases: CompiledPhase[] = (workflow.phases ?? []).map((phase, phaseIndex) => {
    const phaseContext: TemplateContext = {
      ...stepContext,
      phase: {
        id: phase.id,
        index: phaseIndex
      }
    };

    // Substitute variables in the prompt
    const prompt = phase.prompt
      ? substituteTemplateVars(phase.prompt, phaseContext)
      : `Execute phase: ${phase.id}`;

    // Resolve model for this sub-phase
    // Priority: step.model > phase.model > sprint.model > workflow.model
    const subPhaseModelContext: ModelContext = {
      ...stepModelContext,
      phaseModel: phase.model
    };
    const resolvedModel = resolveModelFromContext(subPhaseModelContext);

    return {
      id: phase.id,
      status: 'pending' as const,
      prompt,
      parallel: phase.parallel,
      model: resolvedModel
    };
  });

  return {
    id: stepId,
    prompt: step.prompt,
    status: 'pending' as const,
    phases: compiledPhases,
    model: step.model
  };
}

/**
 * Expand a for-each phase into concrete steps
 *
 * @param phase - The phase with for-each directive
 * @param steps - The steps from SPRINT.yaml
 * @param workflowsDir - Directory containing workflow definitions
 * @param defaultWorkflow - Default workflow to use if step doesn't specify one
 * @param context - Template context
 * @param errors - Array to collect errors
 * @param modelContext - Model context for resolution
 * @returns Compiled top phase with expanded steps
 */
export function expandForEach(
  phase: WorkflowPhase,
  steps: SprintStep[],
  workflowsDir: string,
  defaultWorkflow: LoadedWorkflow | null,
  context: TemplateContext,
  errors: CompilerError[],
  modelContext: ModelContext = {}
): CompiledTopPhase {
  const compiledSteps: CompiledStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Determine which workflow to use for this step
    let stepWorkflow: WorkflowDefinition;

    if (step.workflow) {
      // Step has its own workflow override
      const loaded = loadWorkflow(step.workflow, workflowsDir, errors);
      if (!loaded) {
        // Only add "not found" error if no parse error was added
        const hasParseError = errors.some(e => e.code === 'WORKFLOW_PARSE_ERROR' && e.path?.includes(step.workflow!));
        if (!hasParseError) {
          errors.push({
            code: 'STEP_WORKFLOW_NOT_FOUND',
            message: `Workflow not found for step ${i}: ${step.workflow}`,
            path: `steps[${i}].workflow`
          });
        }
        // Use a minimal fallback workflow
        stepWorkflow = {
          name: 'Fallback',
          phases: [{ id: 'execute', prompt: '{{step.prompt}}' }]
        };
      } else {
        stepWorkflow = loaded.definition;
      }
    } else if (phase.workflow && phase.workflow !== defaultWorkflow?.definition.name) {
      // Phase specifies a default workflow for its steps
      const loaded = loadWorkflow(phase.workflow, workflowsDir, errors);
      if (!loaded) {
        // Only add "not found" error if no parse error was added
        const hasParseError = errors.some(e => e.code === 'WORKFLOW_PARSE_ERROR' && e.path?.includes(phase.workflow!));
        if (!hasParseError) {
          errors.push({
            code: 'PHASE_WORKFLOW_NOT_FOUND',
            message: `Default workflow for phase '${phase.id}' not found: ${phase.workflow}`,
            path: `phases[${phase.id}].workflow`
          });
        }
        stepWorkflow = {
          name: 'Fallback',
          phases: [{ id: 'execute', prompt: '{{step.prompt}}' }]
        };
      } else {
        stepWorkflow = loaded.definition;
      }
    } else if (defaultWorkflow) {
      // Use the sprint's default workflow
      stepWorkflow = defaultWorkflow.definition;
    } else {
      // No workflow available, create a minimal one
      stepWorkflow = {
        name: 'Minimal',
        phases: [{ id: 'execute', prompt: '{{step.prompt}}' }]
      };
    }

    // Expand this step with model context
    const compiledStep = expandStep(step, i, stepWorkflow, context, modelContext);
    compiledSteps.push(compiledStep);
  }

  return {
    id: phase.id,
    status: 'pending' as const,
    steps: compiledSteps,
    'wait-for-parallel': phase['wait-for-parallel']
  };
}

/**
 * Compile a simple phase (no for-each)
 *
 * @param phase - The phase to compile
 * @param context - Template context
 * @param modelContext - Model context for resolution
 * @returns Compiled top phase
 */
export function compileSimplePhase(
  phase: WorkflowPhase,
  context: TemplateContext,
  modelContext: ModelContext = {}
): CompiledTopPhase {
  const phaseContext: TemplateContext = {
    ...context,
    phase: {
      id: phase.id,
      index: 0
    }
  };

  const prompt = phase.prompt
    ? substituteTemplateVars(phase.prompt, phaseContext)
    : `Execute phase: ${phase.id}`;

  // Resolve model for this phase
  // Priority: phase.model > sprint.model > workflow.model
  const phaseModelContext: ModelContext = {
    ...modelContext,
    phaseModel: phase.model
  };
  const resolvedModel = resolveModelFromContext(phaseModelContext);

  return {
    id: phase.id,
    status: 'pending' as const,
    prompt,
    'wait-for-parallel': phase['wait-for-parallel'],
    model: resolvedModel
  };
}
