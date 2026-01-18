"use strict";
/**
 * For-Each Expansion Module
 *
 * Handles expansion of for-each: step phases into concrete steps
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.substituteTemplateVars = substituteTemplateVars;
exports.findUnresolvedVars = findUnresolvedVars;
exports.expandStep = expandStep;
exports.expandForEach = expandForEach;
exports.compileSimplePhase = compileSimplePhase;
const resolve_workflows_js_1 = require("./resolve-workflows.js");
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
function substituteTemplateVars(template, context) {
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
function findUnresolvedVars(text) {
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
 * @returns Compiled step with expanded sub-phases
 */
function expandStep(step, stepIndex, workflow, context) {
    const stepId = step.id || `step-${stepIndex}`;
    // Update context with step info
    const stepContext = {
        ...context,
        step: {
            prompt: step.prompt,
            id: stepId,
            index: stepIndex
        }
    };
    // Expand each phase in the step's workflow
    const compiledPhases = (workflow.phases ?? []).map((phase, phaseIndex) => {
        const phaseContext = {
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
        return {
            id: phase.id,
            status: 'pending',
            prompt,
            parallel: phase.parallel
        };
    });
    return {
        id: stepId,
        prompt: step.prompt,
        status: 'pending',
        phases: compiledPhases
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
 * @returns Compiled top phase with expanded steps
 */
function expandForEach(phase, steps, workflowsDir, defaultWorkflow, context, errors) {
    const compiledSteps = [];
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        // Determine which workflow to use for this step
        let stepWorkflow;
        if (step.workflow) {
            // Step has its own workflow override
            const loaded = (0, resolve_workflows_js_1.loadWorkflow)(step.workflow, workflowsDir, errors);
            if (!loaded) {
                // Only add "not found" error if no parse error was added
                const hasParseError = errors.some(e => e.code === 'WORKFLOW_PARSE_ERROR' && e.path?.includes(step.workflow));
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
            }
            else {
                stepWorkflow = loaded.definition;
            }
        }
        else if (phase.workflow && phase.workflow !== defaultWorkflow?.definition.name) {
            // Phase specifies a default workflow for its steps
            const loaded = (0, resolve_workflows_js_1.loadWorkflow)(phase.workflow, workflowsDir, errors);
            if (!loaded) {
                // Only add "not found" error if no parse error was added
                const hasParseError = errors.some(e => e.code === 'WORKFLOW_PARSE_ERROR' && e.path?.includes(phase.workflow));
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
            }
            else {
                stepWorkflow = loaded.definition;
            }
        }
        else if (defaultWorkflow) {
            // Use the sprint's default workflow
            stepWorkflow = defaultWorkflow.definition;
        }
        else {
            // No workflow available, create a minimal one
            stepWorkflow = {
                name: 'Minimal',
                phases: [{ id: 'execute', prompt: '{{step.prompt}}' }]
            };
        }
        // Expand this step
        const compiledStep = expandStep(step, i, stepWorkflow, context);
        compiledSteps.push(compiledStep);
    }
    return {
        id: phase.id,
        status: 'pending',
        steps: compiledSteps,
        'wait-for-parallel': phase['wait-for-parallel']
    };
}
/**
 * Compile a simple phase (no for-each)
 *
 * @param phase - The phase to compile
 * @param context - Template context
 * @returns Compiled top phase
 */
function compileSimplePhase(phase, context) {
    const phaseContext = {
        ...context,
        phase: {
            id: phase.id,
            index: 0
        }
    };
    const prompt = phase.prompt
        ? substituteTemplateVars(phase.prompt, phaseContext)
        : `Execute phase: ${phase.id}`;
    return {
        id: phase.id,
        status: 'pending',
        prompt,
        'wait-for-parallel': phase['wait-for-parallel']
    };
}
//# sourceMappingURL=expand-foreach.js.map