/**
 * Workflow Resolution Module
 *
 * Handles loading and resolving workflow definitions from .claude/workflows/
 */
import type { WorkflowDefinition, LoadedWorkflow, CompilerError } from './types.js';
/**
 * Load a workflow definition by name
 *
 * @param name - Workflow name (without .yaml extension)
 * @param workflowsDir - Directory containing workflow files
 * @returns Loaded workflow or null if not found
 */
export declare function loadWorkflow(name: string, workflowsDir: string): LoadedWorkflow | null;
/**
 * Resolve all workflow references recursively
 *
 * @param workflow - The workflow to resolve
 * @param workflowsDir - Directory containing workflow files
 * @param visited - Set of already visited workflow names (for cycle detection)
 * @param errors - Array to collect errors
 * @returns Map of workflow name to loaded workflow
 */
export declare function resolveWorkflowRefs(workflow: WorkflowDefinition, workflowsDir: string, visited?: Set<string>, errors?: CompilerError[]): Map<string, LoadedWorkflow>;
/**
 * Get all workflow files in a directory
 *
 * @param workflowsDir - Directory to scan
 * @returns Array of workflow names (without extension)
 */
export declare function listWorkflows(workflowsDir: string): string[];
/**
 * Clear the workflow cache (useful for testing)
 */
export declare function clearWorkflowCache(): void;
//# sourceMappingURL=resolve-workflows.d.ts.map