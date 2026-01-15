"use strict";
/**
 * Main Compiler Module
 *
 * Orchestrates the compilation of SPRINT.yaml into PROGRESS.yaml
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
exports.compile = compile;
exports.compileFromPaths = compileFromPaths;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const resolve_workflows_js_1 = require("./resolve-workflows.js");
const expand_foreach_js_1 = require("./expand-foreach.js");
const validate_js_1 = require("./validate.js");
/**
 * Main compilation function
 *
 * @param config - Compiler configuration
 * @returns Compilation result with progress or errors
 */
async function compile(config) {
    const errors = [];
    const warnings = [];
    // Load SPRINT.yaml
    const sprintYamlPath = path.join(config.sprintDir, 'SPRINT.yaml');
    let sprintDef;
    try {
        const content = fs.readFileSync(sprintYamlPath, 'utf8');
        sprintDef = yaml.load(content);
    }
    catch (err) {
        errors.push({
            code: 'SPRINT_LOAD_ERROR',
            message: `Failed to load SPRINT.yaml: ${err instanceof Error ? err.message : err}`,
            path: sprintYamlPath
        });
        return { success: false, errors, warnings };
    }
    // Validate SPRINT.yaml
    const sprintErrors = (0, validate_js_1.validateSprintDefinition)(sprintDef);
    if (sprintErrors.length > 0) {
        errors.push(...sprintErrors);
        return { success: false, errors, warnings };
    }
    if (config.verbose) {
        console.log(`Loaded SPRINT.yaml: ${sprintDef.steps.length} steps`);
    }
    // Load the main workflow
    const mainWorkflow = (0, resolve_workflows_js_1.loadWorkflow)(sprintDef.workflow, config.workflowsDir);
    if (!mainWorkflow) {
        errors.push({
            code: 'MAIN_WORKFLOW_NOT_FOUND',
            message: `Main workflow not found: ${sprintDef.workflow}`,
            path: 'workflow',
            details: {
                searchPath: config.workflowsDir,
                workflowName: sprintDef.workflow
            }
        });
        return { success: false, errors, warnings };
    }
    // Validate main workflow
    const workflowErrors = (0, validate_js_1.validateWorkflowDefinition)(mainWorkflow.definition, sprintDef.workflow);
    if (workflowErrors.length > 0) {
        errors.push(...workflowErrors);
        return { success: false, errors, warnings };
    }
    if (config.verbose) {
        console.log(`Loaded workflow: ${mainWorkflow.definition.name} (${mainWorkflow.definition.phases.length} phases)`);
    }
    // Resolve all workflow references (for cycle detection and validation)
    const referencedWorkflows = (0, resolve_workflows_js_1.resolveWorkflowRefs)(mainWorkflow.definition, config.workflowsDir, new Set([sprintDef.workflow]), errors);
    if (errors.length > 0) {
        return { success: false, errors, warnings };
    }
    // Validate all referenced workflows
    for (const [name, loaded] of referencedWorkflows) {
        const refErrors = (0, validate_js_1.validateWorkflowDefinition)(loaded.definition, name);
        errors.push(...refErrors);
    }
    if (errors.length > 0) {
        return { success: false, errors, warnings };
    }
    // Generate sprint ID
    const sprintId = sprintDef['sprint-id'] || generateSprintId(config.sprintDir);
    // Create template context
    const context = {
        sprint: {
            id: sprintId,
            name: sprintDef.name
        }
    };
    // Compile phases
    const compiledPhases = [];
    // Find the default step workflow (first for-each phase's workflow, or feature-standard)
    let defaultStepWorkflow = null;
    for (const phase of mainWorkflow.definition.phases) {
        if (phase['for-each'] === 'step' && phase.workflow) {
            defaultStepWorkflow = (0, resolve_workflows_js_1.loadWorkflow)(phase.workflow, config.workflowsDir);
            break;
        }
    }
    for (const phase of mainWorkflow.definition.phases) {
        if (phase['for-each'] === 'step') {
            // Expand for-each phase into steps
            const expandedPhase = (0, expand_foreach_js_1.expandForEach)(phase, sprintDef.steps, config.workflowsDir, defaultStepWorkflow, context, errors);
            compiledPhases.push(expandedPhase);
        }
        else {
            // Simple phase with prompt
            const simplePhase = (0, expand_foreach_js_1.compileSimplePhase)(phase, context);
            compiledPhases.push(simplePhase);
        }
    }
    if (errors.length > 0) {
        return { success: false, errors, warnings };
    }
    // Calculate statistics
    const stats = calculateStats(compiledPhases);
    // Create current pointer (start at first phase)
    const current = initializeCurrentPointer(compiledPhases);
    // Build compiled progress
    const progress = {
        'sprint-id': sprintId,
        status: 'not-started',
        phases: compiledPhases,
        current,
        stats
    };
    // Validate compiled progress
    const progressErrors = (0, validate_js_1.validateCompiledProgress)(progress);
    if (progressErrors.length > 0) {
        errors.push(...progressErrors);
        return { success: false, errors, warnings };
    }
    // Check for unresolved variables
    const unresolvedWarnings = (0, validate_js_1.checkUnresolvedVariables)(progress);
    warnings.push(...unresolvedWarnings);
    return {
        success: true,
        progress,
        errors,
        warnings
    };
}
/**
 * Generate a sprint ID from the directory name
 */
function generateSprintId(sprintDir) {
    const dirName = path.basename(sprintDir);
    // If directory already has date prefix, use as-is
    if (/^\d{4}-\d{2}-\d{2}_/.test(dirName)) {
        return dirName;
    }
    // Add date prefix
    const today = new Date().toISOString().split('T')[0];
    return `${today}_${dirName}`;
}
/**
 * Calculate statistics for compiled phases
 */
function calculateStats(phases) {
    let totalPhases = 0;
    let totalSteps = 0;
    for (const phase of phases) {
        totalPhases++;
        if (phase.steps) {
            totalSteps += phase.steps.length;
            // Count sub-phases within steps
            for (const step of phase.steps) {
                totalPhases += step.phases.length;
            }
        }
    }
    return {
        'started-at': null,
        'total-phases': totalPhases,
        'completed-phases': 0,
        'total-steps': totalSteps > 0 ? totalSteps : undefined,
        'completed-steps': totalSteps > 0 ? 0 : undefined
    };
}
/**
 * Initialize the current pointer to the first executable item
 */
function initializeCurrentPointer(phases) {
    if (phases.length === 0) {
        return { phase: 0, step: null, 'sub-phase': null };
    }
    const firstPhase = phases[0];
    if (firstPhase.steps && firstPhase.steps.length > 0) {
        // First phase has steps, point to first step's first sub-phase
        return {
            phase: 0,
            step: 0,
            'sub-phase': 0
        };
    }
    else {
        // Simple phase
        return {
            phase: 0,
            step: null,
            'sub-phase': null
        };
    }
}
/**
 * Convenience function to compile from file paths
 */
async function compileFromPaths(sprintDir, workflowsDir, verbose = false) {
    return compile({
        sprintDir: path.resolve(sprintDir),
        workflowsDir: path.resolve(workflowsDir),
        verbose
    });
}
//# sourceMappingURL=compile.js.map