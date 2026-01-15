"use strict";
/**
 * Workflow Resolution Module
 *
 * Handles loading and resolving workflow definitions from .claude/workflows/
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadWorkflow = loadWorkflow;
exports.resolveWorkflowRefs = resolveWorkflowRefs;
exports.listWorkflows = listWorkflows;
exports.clearWorkflowCache = clearWorkflowCache;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
/**
 * Cache for loaded workflows to avoid re-reading files
 */
const workflowCache = new Map();
/**
 * Load a workflow definition by name
 *
 * @param name - Workflow name (without .yaml extension)
 * @param workflowsDir - Directory containing workflow files
 * @returns Loaded workflow or null if not found
 */
function loadWorkflow(name, workflowsDir) {
    // Check cache first
    const cacheKey = `${workflowsDir}:${name}`;
    if (workflowCache.has(cacheKey)) {
        return workflowCache.get(cacheKey);
    }
    // Try to find the workflow file
    const possiblePaths = [
        path.join(workflowsDir, `${name}.yaml`),
        path.join(workflowsDir, `${name}.yml`),
        path.join(workflowsDir, name) // In case full filename is provided
    ];
    let workflowPath = null;
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
    const content = fs.readFileSync(workflowPath, 'utf8');
    const definition = yaml.load(content);
    const loaded = {
        definition,
        path: workflowPath
    };
    // Cache the result
    workflowCache.set(cacheKey, loaded);
    return loaded;
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
function resolveWorkflowRefs(workflow, workflowsDir, visited = new Set(), errors = []) {
    const resolved = new Map();
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
            const loaded = loadWorkflow(phase.workflow, workflowsDir);
            if (!loaded) {
                errors.push({
                    code: 'WORKFLOW_NOT_FOUND',
                    message: `Referenced workflow not found: ${phase.workflow}`,
                    path: `phases[${phase.id}].workflow`
                });
                continue;
            }
            resolved.set(phase.workflow, loaded);
            // Recursively resolve nested references
            const newVisited = new Set(visited);
            newVisited.add(phase.workflow);
            const nested = resolveWorkflowRefs(loaded.definition, workflowsDir, newVisited, errors);
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
function listWorkflows(workflowsDir) {
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
function clearWorkflowCache() {
    workflowCache.clear();
}
//# sourceMappingURL=resolve-workflows.js.map