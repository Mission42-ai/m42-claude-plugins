/**
 * For-Each Expansion Module
 *
 * Handles expansion of for-each: step phases into concrete steps
 */

import type {
  WorkflowPhase,
  WorkflowDefinition,
  CollectionItem,
  CompiledTopPhase,
  CompiledStep,
  CompiledPhase,
  CompiledGate,
  LoadedWorkflow,
  TemplateContext,
  ItemContext,
  CompilerError,
  ClaudeModel,
  GateCheck
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
export function resolveModelFromContext(ctx: ModelContext): ClaudeModel | undefined {
  return ctx.stepModel ?? ctx.phaseModel ?? ctx.sprintModel ?? ctx.workflowModel;
}

/**
 * Substitute template variables in a string
 *
 * Supports:
 * - {{item.prompt}} - The item's prompt text (generic)
 * - {{item.id}} - The item's ID
 * - {{item.index}} - The item's index (0-based)
 * - {{item.<prop>}} - Any custom property from the item
 * - {{<type>.prompt}} - Type-specific variant (e.g., {{feature.prompt}})
 * - {{<type>.<prop>}} - Type-specific custom property
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

  // Replace item variables (generic accessor)
  if (context.item) {
    // Replace all {{item.<property>}} patterns
    result = result.replace(/\{\{item\.(\w+)\}\}/g, (_, prop) => {
      const value = context.item?.[prop];
      return value !== undefined ? String(value) : '';
    });

    // Replace type-specific patterns: {{<type>.<property>}}
    const itemType = context.item.type;
    if (itemType) {
      const typePattern = new RegExp(`\\{\\{${escapeRegExp(itemType)}\\.(\\w+)\\}\\}`, 'g');
      result = result.replace(typePattern, (_, prop) => {
        const value = context.item?.[prop];
        return value !== undefined ? String(value) : '';
      });
    }
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
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile gate configuration from workflow phase
 *
 * @param gate - The gate configuration from the workflow phase
 * @returns Compiled gate configuration with defaults applied
 */
export function compileGate(gate: GateCheck): CompiledGate {
  return {
    script: gate.script,
    'on-fail-prompt': gate['on-fail'].prompt,
    'max-retries': gate['on-fail']['max-retries'] ?? 3,
    timeout: gate.timeout ?? 60
  };
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
 * Expand a single item using its workflow
 *
 * @param item - The collection item to expand
 * @param itemIndex - Index of this item
 * @param itemType - Type of the item (collection name, e.g., 'step', 'feature')
 * @param workflow - The workflow to use for expansion
 * @param context - Template context
 * @param modelContext - Model context for resolution
 * @returns Compiled step with expanded sub-phases
 */
export function expandItem(
  item: CollectionItem,
  itemIndex: number,
  itemType: string,
  workflow: WorkflowDefinition,
  context: TemplateContext,
  modelContext: ModelContext = {}
): CompiledStep {
  const itemId = item.id || `${itemType}-${itemIndex}`;

  // Build item context with all properties from the item
  // Spread custom properties first, then override with computed values
  const itemContext: ItemContext = {
    ...item,           // Custom properties from the item
    prompt: item.prompt,  // Ensure prompt is the string value
    id: itemId,           // Computed ID (may override item.id)
    index: itemIndex,     // Computed index
    type: itemType        // Collection type
  };

  // Update context with item info
  const stepContext: TemplateContext = {
    ...context,
    item: itemContext
  };

  // Create item-level model context (item model has highest priority)
  const itemModelContext: ModelContext = {
    ...modelContext,
    stepModel: item.model
  };

  // Expand each phase in the item's workflow
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
    // Priority: item.model > phase.model > sprint.model > workflow.model
    const subPhaseModelContext: ModelContext = {
      ...itemModelContext,
      phaseModel: phase.model
    };
    const resolvedModel = resolveModelFromContext(subPhaseModelContext);

    // Compile gate configuration if present
    const compiledGate = phase.gate ? compileGate(phase.gate) : undefined;

    return {
      id: phase.id,
      status: 'pending' as const,
      prompt,
      parallel: phase.parallel,
      model: resolvedModel,
      ...(compiledGate && { gate: compiledGate })
    };
  });

  return {
    id: itemId,
    prompt: item.prompt,
    status: 'pending' as const,
    phases: compiledPhases,
    model: item.model,
    ...(item['depends-on'] && item['depends-on'].length > 0 && { 'depends-on': item['depends-on'] })
  };
}

/**
 * @deprecated Use expandItem instead. Kept for backwards compatibility.
 */
export const expandStep = expandItem;

/**
 * Expand a for-each phase into concrete steps
 *
 * @param phase - The phase with for-each directive
 * @param items - The items from the collection
 * @param itemType - The type of items (collection name, e.g., 'step', 'feature')
 * @param workflowsDir - Directory containing workflow definitions
 * @param defaultWorkflow - Default workflow to use if item doesn't specify one
 * @param context - Template context
 * @param errors - Array to collect errors
 * @param modelContext - Model context for resolution
 * @returns Compiled top phase with expanded steps
 */
export function expandForEach(
  phase: WorkflowPhase,
  items: CollectionItem[],
  itemType: string,
  workflowsDir: string,
  defaultWorkflow: LoadedWorkflow | null,
  context: TemplateContext,
  errors: CompilerError[],
  modelContext: ModelContext = {}
): CompiledTopPhase {
  const compiledSteps: CompiledStep[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Determine which workflow to use for this item
    let itemWorkflow: WorkflowDefinition;

    if (item.workflow) {
      // Item has its own workflow override
      const loaded = loadWorkflow(item.workflow as string, workflowsDir, errors);
      if (!loaded) {
        // Only add "not found" error if no parse error was added
        const hasParseError = errors.some(e => e.code === 'WORKFLOW_PARSE_ERROR' && e.path?.includes(item.workflow as string));
        if (!hasParseError) {
          errors.push({
            code: 'ITEM_WORKFLOW_NOT_FOUND',
            message: `Workflow not found for ${itemType}[${i}]: ${item.workflow}`,
            path: `collections.${itemType}[${i}].workflow`
          });
        }
        // Use a minimal fallback workflow
        itemWorkflow = {
          name: 'Fallback',
          phases: [{ id: 'execute', prompt: '{{item.prompt}}' }]
        };
      } else {
        itemWorkflow = loaded.definition;
      }
    } else if (phase.workflow && phase.workflow !== defaultWorkflow?.definition.name) {
      // Phase specifies a default workflow for its items
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
        itemWorkflow = {
          name: 'Fallback',
          phases: [{ id: 'execute', prompt: '{{item.prompt}}' }]
        };
      } else {
        itemWorkflow = loaded.definition;
      }
    } else if (defaultWorkflow) {
      // Use the collection's default workflow
      itemWorkflow = defaultWorkflow.definition;
    } else {
      // No workflow available, create a minimal one
      itemWorkflow = {
        name: 'Minimal',
        phases: [{ id: 'execute', prompt: '{{item.prompt}}' }]
      };
    }

    // Expand this item with model context
    const compiledStep = expandItem(item, i, itemType, itemWorkflow, context, modelContext);
    compiledSteps.push(compiledStep);
  }

  // Compile gate configuration if present on the for-each phase
  const compiledGate = phase.gate ? compileGate(phase.gate) : undefined;

  return {
    id: phase.id,
    status: 'pending' as const,
    steps: compiledSteps,
    'wait-for-parallel': phase['wait-for-parallel'],
    break: phase.break,
    ...(compiledGate && { gate: compiledGate })
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

  // Compile gate configuration if present
  const compiledGate = phase.gate ? compileGate(phase.gate) : undefined;

  return {
    id: phase.id,
    status: 'pending' as const,
    prompt,
    'wait-for-parallel': phase['wait-for-parallel'],
    model: resolvedModel,
    break: phase.break,
    ...(compiledGate && { gate: compiledGate })
  };
}
