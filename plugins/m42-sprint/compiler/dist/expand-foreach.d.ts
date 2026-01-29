/**
 * For-Each Expansion Module
 *
 * Handles expansion of for-each: step phases into concrete steps
 */
import type { WorkflowPhase, WorkflowDefinition, CollectionItem, CompiledTopPhase, CompiledStep, CompiledGate, LoadedWorkflow, TemplateContext, CompilerError, ClaudeModel, GateCheck } from './types.js';
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
export declare function resolveModelFromContext(ctx: ModelContext): ClaudeModel | undefined;
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
export declare function substituteTemplateVars(template: string, context: TemplateContext): string;
/**
 * Compile gate configuration from workflow phase
 *
 * @param gate - The gate configuration from the workflow phase
 * @returns Compiled gate configuration with defaults applied
 */
export declare function compileGate(gate: GateCheck): CompiledGate;
/**
 * Find unresolved template variables in a string
 *
 * @param text - String to check
 * @returns Array of unresolved variable names
 */
export declare function findUnresolvedVars(text: string): string[];
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
export declare function expandItem(item: CollectionItem, itemIndex: number, itemType: string, workflow: WorkflowDefinition, context: TemplateContext, modelContext?: ModelContext): CompiledStep;
/**
 * @deprecated Use expandItem instead. Kept for backwards compatibility.
 */
export declare const expandStep: typeof expandItem;
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
export declare function expandForEach(phase: WorkflowPhase, items: CollectionItem[], itemType: string, workflowsDir: string, defaultWorkflow: LoadedWorkflow | null, context: TemplateContext, errors: CompilerError[], modelContext?: ModelContext): CompiledTopPhase;
/**
 * Compile a simple phase (no for-each)
 *
 * @param phase - The phase to compile
 * @param context - Template context
 * @param modelContext - Model context for resolution
 * @returns Compiled top phase
 */
export declare function compileSimplePhase(phase: WorkflowPhase, context: TemplateContext, modelContext?: ModelContext): CompiledTopPhase;
//# sourceMappingURL=expand-foreach.d.ts.map