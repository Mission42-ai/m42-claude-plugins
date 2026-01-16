/**
 * Workflow Resolution Module
 *
 * Handles loading and resolving workflow definitions from .claude/workflows/
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type {
  WorkflowDefinition,
  LoadedWorkflow,
  CompilerError
} from './types.js';
import { formatYamlError } from './compile.js';

/**
 * Cache for loaded workflows to avoid re-reading files
 */
const workflowCache = new Map<string, LoadedWorkflow>();

/**
 * Load a workflow definition by name
 *
 * @param name - Workflow name (without .yaml extension)
 * @param workflowsDir - Directory containing workflow files
 * @param errors - Optional array to collect errors (for YAML parsing errors)
 * @returns Loaded workflow or null if not found or failed to parse
 */
export function loadWorkflow(
  name: string,
  workflowsDir: string,
  errors?: CompilerError[]
): LoadedWorkflow | null {
  // Check cache first
  const cacheKey = `${workflowsDir}:${name}`;
  if (workflowCache.has(cacheKey)) {
    return workflowCache.get(cacheKey)!;
  }

  // Try to find the workflow file
  const possiblePaths = [
    path.join(workflowsDir, `${name}.yaml`),
    path.join(workflowsDir, `${name}.yml`),
    path.join(workflowsDir, name) // In case full filename is provided
  ];

  let workflowPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      workflowPath = p;
      break;
    }
  }

  if (!workflowPath) {
    return null;
  }

  // Load and parse the workflow
  try {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const definition = yaml.load(content) as WorkflowDefinition;

    const loaded: LoadedWorkflow = {
      definition,
      path: workflowPath
    };

    // Cache the result
    workflowCache.set(cacheKey, loaded);

    return loaded;
  } catch (err) {
    if (errors) {
      errors.push({
        code: 'WORKFLOW_PARSE_ERROR',
        message: `Failed to parse workflow '${name}': ${formatYamlError(err, workflowPath)}`,
        path: workflowPath
      });
    }
    return null;
  }
}

/**
 * Resolve all workflow references recursively
 *
 * @param workflow - The workflow to resolve
 * @param workflowsDir - Directory containing workflow files
 * @param visited - Set of already visited workflow names (for cycle detection)
 * @param errors - Array to collect errors
 * @returns Map of workflow name to loaded workflow
 */
export function resolveWorkflowRefs(
  workflow: WorkflowDefinition,
  workflowsDir: string,
  visited: Set<string> = new Set(),
  errors: CompilerError[] = []
): Map<string, LoadedWorkflow> {
  const resolved = new Map<string, LoadedWorkflow>();

  for (const phase of workflow.phases) {
    if (phase.workflow) {
      // Check for cycles
      if (visited.has(phase.workflow)) {
        errors.push({
          code: 'CYCLE_DETECTED',
          message: `Circular workflow reference detected: ${phase.workflow}`,
          path: `phases[${phase.id}].workflow`,
          details: { cycle: Array.from(visited).concat(phase.workflow) }
        });
        continue;
      }

      // Load the referenced workflow
      const loaded = loadWorkflow(phase.workflow, workflowsDir, errors);
      if (!loaded) {
        // Only add "not found" error if no parse error was added
        const hasParseError = errors.some(e => e.code === 'WORKFLOW_PARSE_ERROR' && e.path?.includes(phase.workflow!));
        if (!hasParseError) {
          errors.push({
            code: 'WORKFLOW_NOT_FOUND',
            message: `Referenced workflow not found: ${phase.workflow}`,
            path: `phases[${phase.id}].workflow`
          });
        }
        continue;
      }

      resolved.set(phase.workflow, loaded);

      // Recursively resolve nested references
      const newVisited = new Set(visited);
      newVisited.add(phase.workflow);

      const nested = resolveWorkflowRefs(
        loaded.definition,
        workflowsDir,
        newVisited,
        errors
      );

      for (const [name, wf] of nested) {
        resolved.set(name, wf);
      }
    }
  }

  return resolved;
}

/**
 * Get all workflow files in a directory
 *
 * @param workflowsDir - Directory to scan
 * @returns Array of workflow names (without extension)
 */
export function listWorkflows(workflowsDir: string): string[] {
  if (!fs.existsSync(workflowsDir)) {
    return [];
  }

  return fs.readdirSync(workflowsDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => f.replace(/\.ya?ml$/, ''));
}

/**
 * Clear the workflow cache (useful for testing)
 */
export function clearWorkflowCache(): void {
  workflowCache.clear();
}
