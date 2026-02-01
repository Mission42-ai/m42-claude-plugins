/**
 * Validation Module
 *
 * Schema validation for SPRINT.yaml and workflow definitions
 */

import type {
  SprintDefinition,
  WorkflowDefinition,
  CollectionItem,
  CompiledProgress,
  CompilerError,
  WorktreeCleanup,
  ClaudeModel,
  DependencyNode
} from './types.js';
import { CURRENT_SCHEMA_VERSION } from './types.js';
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
 * Validate schema version of a workflow and produce warnings if missing or outdated
 *
 * @param workflow - The workflow definition to validate
 * @param workflowName - Name of the workflow (for warning messages)
 * @param warnings - Array to push warning messages to
 */
export function validateSchemaVersion(
  workflow: WorkflowDefinition,
  workflowName: string,
  warnings: string[]
): void {
  const version = workflow['schema-version'];

  if (!version) {
    warnings.push(
      `Workflow '${workflowName}' has no schema-version field. ` +
      `Consider adding: schema-version: "${CURRENT_SCHEMA_VERSION}"`
    );
    return;
  }

  if (version !== CURRENT_SCHEMA_VERSION) {
    warnings.push(
      `Workflow '${workflowName}' uses schema-version ${version}. ` +
      `Current version is ${CURRENT_SCHEMA_VERSION}. Consider updating.`
    );
  }
}

/**
 * Validate a sprint definition (SPRINT.yaml) - basic validation
 *
 * This performs minimal validation before workflow is loaded.
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

  // Validate model field if present
  if (s.model !== undefined) {
    errors.push(...validateModel(s.model, 'model'));
  }

  // Validate collections if present
  if (s.collections !== undefined) {
    const collectionsErrors = validateCollections(s.collections);
    errors.push(...collectionsErrors);
  }

  // Validate worktree configuration if present
  if (s.worktree !== undefined) {
    const worktreeErrors = validateWorktreeConfig(s.worktree, 'worktree');
    errors.push(...worktreeErrors);
  }

  return errors;
}

/**
 * Validate standard mode sprint requirements
 *
 * Called after workflow is loaded to validate sprint-specific standard mode requirements.
 *
 * @param sprint - The sprint definition
 * @param workflow - The workflow definition (to check collection references)
 * @returns Array of validation errors
 */
export function validateStandardModeSprint(
  sprint: SprintDefinition,
  workflow: WorkflowDefinition
): CompilerError[] {
  const errors: CompilerError[] = [];

  // Standard mode requires collections
  if (!sprint.collections || typeof sprint.collections !== 'object') {
    errors.push({
      code: 'MISSING_COLLECTIONS',
      message: 'SPRINT.yaml must have a collections object',
      path: 'collections'
    });
    return errors;
  }

  // Check that at least one collection has items
  const collectionNames = Object.keys(sprint.collections);
  if (collectionNames.length === 0) {
    errors.push({
      code: 'EMPTY_COLLECTIONS',
      message: 'SPRINT.yaml collections must have at least one collection',
      path: 'collections'
    });
    return errors;
  }

  // Check that referenced collections exist
  const collectionRefErrors = validateCollectionReferences(workflow, sprint);
  errors.push(...collectionRefErrors);

  return errors;
}

/**
 * Validate the collections object
 *
 * @param collections - The collections object to validate
 * @returns Array of validation errors
 */
export function validateCollections(collections: unknown): CompilerError[] {
  const errors: CompilerError[] = [];

  if (!collections || typeof collections !== 'object') {
    errors.push({
      code: 'INVALID_COLLECTIONS',
      message: 'collections must be an object',
      path: 'collections'
    });
    return errors;
  }

  const collectionsMap = collections as Record<string, unknown>;

  for (const [collectionName, items] of Object.entries(collectionsMap)) {
    if (!Array.isArray(items)) {
      errors.push({
        code: 'INVALID_COLLECTION',
        message: `Collection '${collectionName}' must be an array`,
        path: `collections.${collectionName}`
      });
      continue;
    }

    // Validate each item in the collection
    items.forEach((item, index) => {
      const itemErrors = validateCollectionItem(item, index, collectionName);
      errors.push(...itemErrors);
    });

    // Validate dependencies within the collection (references, cycles, self-refs)
    // Only run if items passed basic validation
    const hasBasicErrors = errors.some(e =>
      e.path?.startsWith(`collections.${collectionName}`) &&
      (e.code === 'INVALID_COLLECTION_ITEM' || e.code === 'INVALID_DEPENDS_ON')
    );

    if (!hasBasicErrors && items.length > 0) {
      const depErrors = validateDependencies(items as CollectionItem[], collectionName);
      errors.push(...depErrors);
    }
  }

  return errors;
}

/**
 * Validate a single collection item
 *
 * @param item - The item to validate
 * @param index - Index of the item in the collection
 * @param collectionName - Name of the containing collection
 * @returns Array of validation errors
 */
export function validateCollectionItem(
  item: unknown,
  index: number,
  collectionName: string
): CompilerError[] {
  const errors: CompilerError[] = [];
  const path = `collections.${collectionName}[${index}]`;

  if (!item || typeof item !== 'object') {
    errors.push({
      code: 'INVALID_COLLECTION_ITEM',
      message: `Item ${index} in collection '${collectionName}' must be an object`,
      path
    });
    return errors;
  }

  const i = item as Record<string, unknown>;

  if (!i.prompt || typeof i.prompt !== 'string') {
    errors.push({
      code: 'MISSING_ITEM_PROMPT',
      message: `Item ${index} in collection '${collectionName}' must have a prompt`,
      path: `${path}.prompt`
    });
  } else if (i.prompt.trim().length === 0) {
    errors.push({
      code: 'EMPTY_ITEM_PROMPT',
      message: `Item ${index} in collection '${collectionName}' has an empty prompt`,
      path: `${path}.prompt`
    });
  }

  // Validate optional workflow override
  if (i.workflow !== undefined && typeof i.workflow !== 'string') {
    errors.push({
      code: 'INVALID_ITEM_WORKFLOW',
      message: `Item ${index} in collection '${collectionName}' workflow must be a string`,
      path: `${path}.workflow`
    });
  }

  // Validate optional model override
  if (i.model !== undefined) {
    errors.push(...validateModel(i.model, `${path}.model`));
  }

  // Validate optional depends-on field
  const depsErrors = validateDependsOnField(item, index, collectionName);
  errors.push(...depsErrors);

  return errors;
}

/**
 * Validate that workflow for-each references exist in sprint collections
 *
 * @param workflow - The workflow definition
 * @param sprint - The sprint definition
 * @returns Array of validation errors
 */
export function validateCollectionReferences(
  workflow: WorkflowDefinition,
  sprint: SprintDefinition
): CompilerError[] {
  const errors: CompilerError[] = [];

  if (!workflow.phases || !sprint.collections) {
    return errors;
  }

  const availableCollections = new Set(Object.keys(sprint.collections));

  for (const phase of workflow.phases) {
    if (phase['for-each']) {
      const collectionName = resolveCollectionName(phase['for-each'], phase.collection);

      if (!availableCollections.has(collectionName)) {
        errors.push({
          code: 'COLLECTION_NOT_FOUND',
          message: `Phase '${phase.id}' references collection '${collectionName}' which does not exist in sprint collections`,
          path: `collections.${collectionName}`,
          details: {
            phaseId: phase.id,
            forEachType: phase['for-each'],
            explicitCollection: phase.collection,
            resolvedCollection: collectionName,
            availableCollections: Array.from(availableCollections)
          }
        });
      }
    }
  }

  return errors;
}

/**
 * Resolve the collection name from for-each type and optional explicit collection
 *
 * @param forEachType - The for-each type (e.g., 'step', 'feature')
 * @param explicitCollection - Optional explicit collection reference
 * @returns The resolved collection name
 */
export function resolveCollectionName(
  forEachType: string,
  explicitCollection?: string
): string {
  // Explicit collection overrides for-each type
  return explicitCollection ?? forEachType;
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

  // Validate worktree defaults if present
  if (w.worktree !== undefined) {
    const worktreeErrors = validateWorkflowWorktreeDefaults(w.worktree, name);
    errors.push(...worktreeErrors);
  }

  // Validate model field if present
  if (w.model !== undefined) {
    errors.push(...validateModel(w.model, `${name}.model`));
  }

  // Phases are required
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
  const hasForEach = p['for-each'] && typeof p['for-each'] === 'string';
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
      message: `Phase '${p.id || index}' in ${workflowName} must have 'prompt', 'for-each', or 'workflow'`,
      path: `${workflowName}.phases[${index}]`
    });
  }

  // Validate for-each value (must be a non-empty string)
  if (p['for-each'] !== undefined) {
    if (typeof p['for-each'] !== 'string') {
      errors.push({
        code: 'INVALID_FOREACH',
        message: `for-each must be a string (got '${typeof p['for-each']}')`,
        path: `${workflowName}.phases[${index}].for-each`
      });
    } else if (p['for-each'].trim().length === 0) {
      errors.push({
        code: 'EMPTY_FOREACH',
        message: `for-each cannot be empty`,
        path: `${workflowName}.phases[${index}].for-each`
      });
    }
  }

  // Validate optional collection reference
  if (p.collection !== undefined) {
    if (typeof p.collection !== 'string') {
      errors.push({
        code: 'INVALID_COLLECTION_REF',
        message: `collection must be a string (got '${typeof p.collection}')`,
        path: `${workflowName}.phases[${index}].collection`
      });
    } else if (p.collection.trim().length === 0) {
      errors.push({
        code: 'EMPTY_COLLECTION_REF',
        message: `collection cannot be empty`,
        path: `${workflowName}.phases[${index}].collection`
      });
    }
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
  if (p.parallel === true && p['for-each']) {
    errors.push({
      code: 'PARALLEL_FOREACH_WARNING',
      message: `parallel: true on for-each phase is not supported; use parallel in item workflow phases instead`,
      path: `${workflowName}.phases[${index}]`
    });
  }

  // Validate model field if present
  if (p.model !== undefined) {
    errors.push(...validateModel(p.model, `${workflowName}.phases[${index}].model`));
  }

  // Validate break property (must be boolean if present)
  if (p.break !== undefined && typeof p.break !== 'boolean') {
    errors.push({
      code: 'INVALID_BREAK',
      message: `break must be a boolean (got ${typeof p.break})`,
      path: `${workflowName}.phases[${index}].break`
    });
  }

  // Validate gate property if present
  if (p.gate !== undefined) {
    const gateErrors = validateGateCheck(p.gate, `${workflowName}.phases[${index}].gate`);
    errors.push(...gateErrors);
  }

  return errors;
}

/**
 * Validate a quality gate check configuration
 *
 * @param gate - The gate configuration to validate
 * @param path - Path for error messages
 * @returns Array of validation errors
 */
export function validateGateCheck(gate: unknown, path: string): CompilerError[] {
  const errors: CompilerError[] = [];

  if (!gate || typeof gate !== 'object') {
    errors.push({
      code: 'INVALID_GATE',
      message: 'Gate must be an object',
      path
    });
    return errors;
  }

  const g = gate as Record<string, unknown>;

  // Validate script (required, non-empty string)
  if (g.script === undefined || g.script === null || typeof g.script !== 'string') {
    errors.push({
      code: 'GATE_MISSING_SCRIPT',
      message: 'Gate must have a script property',
      path: `${path}.script`
    });
  } else if (g.script.trim().length === 0) {
    errors.push({
      code: 'GATE_EMPTY_SCRIPT',
      message: 'Gate script cannot be empty',
      path: `${path}.script`
    });
  }

  // Validate on-fail (required object)
  if (!g['on-fail'] || typeof g['on-fail'] !== 'object') {
    errors.push({
      code: 'GATE_MISSING_ON_FAIL',
      message: 'Gate must have an on-fail configuration',
      path: `${path}.on-fail`
    });
  } else {
    const onFail = g['on-fail'] as Record<string, unknown>;

    // Validate on-fail.prompt (required, non-empty string)
    if (onFail.prompt === undefined || onFail.prompt === null || typeof onFail.prompt !== 'string') {
      errors.push({
        code: 'GATE_MISSING_ON_FAIL_PROMPT',
        message: 'Gate on-fail must have a prompt property',
        path: `${path}.on-fail.prompt`
      });
    } else if (onFail.prompt.trim().length === 0) {
      errors.push({
        code: 'GATE_EMPTY_ON_FAIL_PROMPT',
        message: 'Gate on-fail prompt cannot be empty',
        path: `${path}.on-fail.prompt`
      });
    }

    // Validate on-fail.max-retries (optional, positive integer)
    if (onFail['max-retries'] !== undefined) {
      const maxRetries = onFail['max-retries'];
      if (typeof maxRetries !== 'number' || !Number.isInteger(maxRetries) || maxRetries < 1) {
        errors.push({
          code: 'GATE_INVALID_MAX_RETRIES',
          message: 'Gate on-fail max-retries must be a positive integer',
          path: `${path}.on-fail.max-retries`
        });
      }
    }
  }

  // Validate timeout (optional, positive number)
  if (g.timeout !== undefined) {
    if (typeof g.timeout !== 'number' || g.timeout <= 0) {
      errors.push({
        code: 'GATE_INVALID_TIMEOUT',
        message: 'Gate timeout must be a positive number (seconds)',
        path: `${path}.timeout`
      });
    }
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

// ============================================================================
// Dependency Validation
// ============================================================================

/**
 * Validate dependencies in a collection of items
 *
 * Performs three types of validation:
 * 1. Reference validation - all dependency IDs must exist in the collection
 * 2. Self-reference detection - items cannot depend on themselves
 * 3. Circular dependency detection - no cycles in the dependency graph
 *
 * @param items - The collection items to validate
 * @param collectionName - Name of the collection (for error messages)
 * @returns Array of validation errors
 */
export function validateDependencies(
  items: CollectionItem[],
  collectionName: string
): CompilerError[] {
  const errors: CompilerError[] = [];

  // Build a map of item IDs for quick lookup
  // Items without explicit IDs get auto-generated IDs (e.g., "item-0", "item-1")
  const itemIds = new Map<string, number>();
  items.forEach((item, index) => {
    const id = item.id ?? `${collectionName}-${index}`;
    itemIds.set(id, index);
  });

  // First pass: validate references and detect self-references
  items.forEach((item, index) => {
    const itemId = item.id ?? `${collectionName}-${index}`;
    const deps = item['depends-on'];

    if (!deps || !Array.isArray(deps)) {
      return; // No dependencies to validate
    }

    // Validate each dependency reference
    for (const depId of deps) {
      // Check for self-reference
      if (depId === itemId) {
        errors.push({
          code: 'DEPENDENCY_SELF_REFERENCE',
          message: `Item '${itemId}' in collection '${collectionName}' cannot depend on itself`,
          path: `collections.${collectionName}[${index}].depends-on`,
          details: { itemId, dependencyId: depId }
        });
        continue;
      }

      // Check if the dependency exists
      if (!itemIds.has(depId)) {
        errors.push({
          code: 'DEPENDENCY_NOT_FOUND',
          message: `Item '${itemId}' in collection '${collectionName}' depends on '${depId}' which does not exist`,
          path: `collections.${collectionName}[${index}].depends-on`,
          details: {
            itemId,
            missingDependency: depId,
            availableIds: Array.from(itemIds.keys())
          }
        });
      }
    }
  });

  // Second pass: detect circular dependencies using DFS
  const circularErrors = detectCircularDependencies(items, collectionName);
  errors.push(...circularErrors);

  return errors;
}

/**
 * Detect circular dependencies in a collection using depth-first search
 *
 * Uses a three-color marking scheme:
 * - unvisited: node not yet processed
 * - visiting: node currently being processed (in recursion stack)
 * - visited: node fully processed
 *
 * A cycle is detected when we encounter a 'visiting' node during DFS.
 *
 * @param items - The collection items to check
 * @param collectionName - Name of the collection (for error messages)
 * @returns Array of circular dependency errors
 */
export function detectCircularDependencies(
  items: CollectionItem[],
  collectionName: string
): CompilerError[] {
  const errors: CompilerError[] = [];

  // Build dependency graph as DependencyNode array
  const nodes: Map<string, DependencyNode> = new Map();
  const indexById: Map<string, number> = new Map();

  items.forEach((item, index) => {
    const id = item.id ?? `${collectionName}-${index}`;
    indexById.set(id, index);
    nodes.set(id, {
      id,
      dependencies: (item['depends-on'] ?? []).filter(dep => dep !== id), // Exclude self-refs (handled separately)
      state: 'unvisited'
    });
  });

  // Track the current path for cycle reporting
  const path: string[] = [];

  /**
   * DFS visit function
   * @returns true if a cycle was detected
   */
  function visit(nodeId: string): boolean {
    const node = nodes.get(nodeId);
    if (!node) {
      return false; // Node doesn't exist (already reported as missing reference)
    }

    if (node.state === 'visited') {
      return false; // Already fully processed
    }

    if (node.state === 'visiting') {
      // Found a cycle! Build the cycle path
      const cycleStartIndex = path.indexOf(nodeId);
      const cyclePath = [...path.slice(cycleStartIndex), nodeId];

      errors.push({
        code: 'DEPENDENCY_CIRCULAR',
        message: `Circular dependency detected in collection '${collectionName}': ${cyclePath.join(' -> ')}`,
        path: `collections.${collectionName}`,
        details: {
          cycle: cyclePath,
          startNode: nodeId
        }
      });
      return true;
    }

    // Mark as visiting and add to path
    node.state = 'visiting';
    path.push(nodeId);

    // Visit all dependencies
    for (const depId of node.dependencies) {
      if (visit(depId)) {
        // Cycle detected - don't continue checking this branch
        // but don't return immediately to find all cycles
      }
    }

    // Mark as visited and remove from path
    node.state = 'visited';
    path.pop();

    return false;
  }

  // Run DFS from each unvisited node
  for (const [nodeId] of nodes) {
    const node = nodes.get(nodeId)!;
    if (node.state === 'unvisited') {
      visit(nodeId);
    }
  }

  return errors;
}

/**
 * Validate depends-on field format in a collection item
 *
 * @param item - The item to validate
 * @param index - Index of the item in the collection
 * @param collectionName - Name of the containing collection
 * @returns Array of validation errors
 */
export function validateDependsOnField(
  item: unknown,
  index: number,
  collectionName: string
): CompilerError[] {
  const errors: CompilerError[] = [];
  const path = `collections.${collectionName}[${index}].depends-on`;

  if (!item || typeof item !== 'object') {
    return errors;
  }

  const i = item as Record<string, unknown>;
  const deps = i['depends-on'];

  if (deps === undefined || deps === null) {
    return errors; // Field is optional
  }

  if (!Array.isArray(deps)) {
    errors.push({
      code: 'INVALID_DEPENDS_ON',
      message: `depends-on must be an array of strings`,
      path
    });
    return errors;
  }

  // Validate each element is a non-empty string
  deps.forEach((dep, depIndex) => {
    if (typeof dep !== 'string') {
      errors.push({
        code: 'INVALID_DEPENDS_ON_ELEMENT',
        message: `depends-on[${depIndex}] must be a string, got ${typeof dep}`,
        path: `${path}[${depIndex}]`
      });
    } else if (dep.trim().length === 0) {
      errors.push({
        code: 'EMPTY_DEPENDS_ON_ELEMENT',
        message: `depends-on[${depIndex}] cannot be empty`,
        path: `${path}[${depIndex}]`
      });
    }
  });

  return errors;
}

// ============================================================================
// Worktree Configuration Validation
// ============================================================================

/** Valid cleanup modes for worktrees */
const VALID_CLEANUP_MODES: WorktreeCleanup[] = ['never', 'on-complete', 'on-merge'];

/**
 * Validate a git branch name according to git ref rules
 * @see https://git-scm.com/docs/git-check-ref-format
 *
 * @param branch - The branch name to validate (may contain variables like {sprint-id})
 * @returns true if the branch name is valid
 */
export function isValidGitBranchName(branch: string): boolean {
  // Allow variable placeholders - they'll be substituted at runtime
  // Remove placeholders for validation
  const withoutVars = branch.replace(/\{[^}]+\}/g, 'placeholder');

  // Empty after removing vars is invalid
  if (withoutVars.length === 0) {
    return false;
  }

  // Cannot start or end with /
  if (withoutVars.startsWith('/') || withoutVars.endsWith('/')) {
    return false;
  }

  // Cannot have consecutive slashes
  if (withoutVars.includes('//')) {
    return false;
  }

  // Cannot start with -
  if (withoutVars.startsWith('-')) {
    return false;
  }

  // Cannot end with .lock
  if (withoutVars.endsWith('.lock')) {
    return false;
  }

  // Cannot contain certain characters
  const invalidChars = /[~^:?*\[\]\\@{}\s]/;
  if (invalidChars.test(withoutVars)) {
    return false;
  }

  // Cannot have consecutive dots
  if (withoutVars.includes('..')) {
    return false;
  }

  return true;
}

/**
 * Validate worktree configuration from SPRINT.yaml
 *
 * @param worktree - The worktree configuration to validate
 * @param configPath - Path prefix for error messages (e.g., 'worktree' or 'workflow.worktree')
 * @returns Array of validation errors
 */
export function validateWorktreeConfig(
  worktree: unknown,
  configPath: string
): CompilerError[] {
  const errors: CompilerError[] = [];

  // Worktree config is optional - undefined/null is valid
  if (worktree === undefined || worktree === null) {
    return errors;
  }

  if (typeof worktree !== 'object') {
    errors.push({
      code: 'INVALID_WORKTREE_CONFIG',
      message: 'Worktree configuration must be an object',
      path: configPath
    });
    return errors;
  }

  const w = worktree as Record<string, unknown>;

  // Validate 'enabled' field (required)
  if (w.enabled === undefined) {
    errors.push({
      code: 'WORKTREE_MISSING_ENABLED',
      message: 'Worktree configuration must specify enabled: true or false',
      path: `${configPath}.enabled`
    });
  } else if (typeof w.enabled !== 'boolean') {
    errors.push({
      code: 'WORKTREE_INVALID_ENABLED',
      message: 'Worktree enabled must be a boolean',
      path: `${configPath}.enabled`
    });
  }

  // Validate 'branch' field (optional string)
  if (w.branch !== undefined) {
    if (typeof w.branch !== 'string') {
      errors.push({
        code: 'WORKTREE_INVALID_BRANCH',
        message: 'Worktree branch must be a string',
        path: `${configPath}.branch`
      });
    } else if (w.branch.trim().length === 0) {
      errors.push({
        code: 'WORKTREE_EMPTY_BRANCH',
        message: 'Worktree branch cannot be empty',
        path: `${configPath}.branch`
      });
    } else if (!isValidGitBranchName(w.branch)) {
      errors.push({
        code: 'WORKTREE_INVALID_BRANCH_NAME',
        message: `Worktree branch '${w.branch}' is not a valid git branch name`,
        path: `${configPath}.branch`
      });
    }
  }

  // Validate 'path' field (optional string)
  if (w.path !== undefined) {
    if (typeof w.path !== 'string') {
      errors.push({
        code: 'WORKTREE_INVALID_PATH',
        message: 'Worktree path must be a string',
        path: `${configPath}.path`
      });
    } else if (w.path.trim().length === 0) {
      errors.push({
        code: 'WORKTREE_EMPTY_PATH',
        message: 'Worktree path cannot be empty',
        path: `${configPath}.path`
      });
    }
  }

  // Validate 'cleanup' field (optional enum)
  if (w.cleanup !== undefined) {
    if (typeof w.cleanup !== 'string') {
      errors.push({
        code: 'WORKTREE_INVALID_CLEANUP',
        message: 'Worktree cleanup must be a string',
        path: `${configPath}.cleanup`
      });
    } else if (!VALID_CLEANUP_MODES.includes(w.cleanup as WorktreeCleanup)) {
      errors.push({
        code: 'WORKTREE_INVALID_CLEANUP_MODE',
        message: `Worktree cleanup must be one of: ${VALID_CLEANUP_MODES.join(', ')}`,
        path: `${configPath}.cleanup`
      });
    }
  }

  return errors;
}

/**
 * Validate workflow-level worktree defaults
 *
 * @param worktree - The workflow worktree defaults to validate
 * @param workflowName - Name of the workflow (for error messages)
 * @returns Array of validation errors
 */
export function validateWorkflowWorktreeDefaults(
  worktree: unknown,
  workflowName: string
): CompilerError[] {
  const errors: CompilerError[] = [];
  const configPath = `${workflowName}.worktree`;

  // Worktree defaults are optional
  if (worktree === undefined || worktree === null) {
    return errors;
  }

  if (typeof worktree !== 'object') {
    errors.push({
      code: 'INVALID_WORKFLOW_WORKTREE',
      message: 'Workflow worktree configuration must be an object',
      path: configPath
    });
    return errors;
  }

  const w = worktree as Record<string, unknown>;

  // Validate 'enabled' field (required)
  if (w.enabled === undefined) {
    errors.push({
      code: 'WORKFLOW_WORKTREE_MISSING_ENABLED',
      message: 'Workflow worktree configuration must specify enabled: true or false',
      path: `${configPath}.enabled`
    });
  } else if (typeof w.enabled !== 'boolean') {
    errors.push({
      code: 'WORKFLOW_WORKTREE_INVALID_ENABLED',
      message: 'Workflow worktree enabled must be a boolean',
      path: `${configPath}.enabled`
    });
  }

  // Validate 'branch-prefix' field (optional string)
  if (w['branch-prefix'] !== undefined) {
    if (typeof w['branch-prefix'] !== 'string') {
      errors.push({
        code: 'WORKFLOW_WORKTREE_INVALID_BRANCH_PREFIX',
        message: 'Workflow worktree branch-prefix must be a string',
        path: `${configPath}.branch-prefix`
      });
    }
    // Note: We don't validate the prefix as a git branch name since it's just a prefix
  }

  // Validate 'path-prefix' field (optional string)
  if (w['path-prefix'] !== undefined) {
    if (typeof w['path-prefix'] !== 'string') {
      errors.push({
        code: 'WORKFLOW_WORKTREE_INVALID_PATH_PREFIX',
        message: 'Workflow worktree path-prefix must be a string',
        path: `${configPath}.path-prefix`
      });
    }
  }

  // Validate 'cleanup' field (optional enum)
  if (w.cleanup !== undefined) {
    if (typeof w.cleanup !== 'string') {
      errors.push({
        code: 'WORKFLOW_WORKTREE_INVALID_CLEANUP',
        message: 'Workflow worktree cleanup must be a string',
        path: `${configPath}.cleanup`
      });
    } else if (!VALID_CLEANUP_MODES.includes(w.cleanup as WorktreeCleanup)) {
      errors.push({
        code: 'WORKFLOW_WORKTREE_INVALID_CLEANUP_MODE',
        message: `Workflow worktree cleanup must be one of: ${VALID_CLEANUP_MODES.join(', ')}`,
        path: `${configPath}.cleanup`
      });
    }
  }

  return errors;
}
