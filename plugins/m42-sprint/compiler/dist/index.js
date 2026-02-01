#!/usr/bin/env node
"use strict";
/**
 * Sprint Workflow Compiler CLI
 *
 * Compiles SPRINT.yaml + workflow definitions into PROGRESS.yaml
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
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const compile_js_1 = require("./compile.js");
const program = new commander_1.Command();
program
    .name('sprint-compile')
    .description('Compile sprint workflow definitions into PROGRESS.yaml')
    .version('1.0.0');
// Validate command
program
    .command('validate')
    .description('Validate a workflow file')
    .argument('<workflow-file>', 'Path to the workflow YAML file to validate')
    .action(async (workflowFile) => {
    try {
        // Resolve absolute path
        const absolutePath = path.resolve(workflowFile);
        // Check if file exists
        if (!fs.existsSync(absolutePath)) {
            console.error(JSON.stringify({
                valid: false,
                errors: [{
                        code: 'FILE_NOT_FOUND',
                        message: `Workflow file not found: ${absolutePath}`,
                        path: absolutePath
                    }],
                warnings: []
            }, null, 2));
            process.exit(1);
        }
        // Load and parse the workflow
        const content = fs.readFileSync(absolutePath, 'utf8');
        let workflow;
        try {
            workflow = yaml.load(content);
        }
        catch (err) {
            console.error(JSON.stringify({
                valid: false,
                errors: [{
                        code: 'YAML_PARSE_ERROR',
                        message: `Failed to parse YAML: ${err instanceof Error ? err.message : String(err)}`,
                        path: absolutePath
                    }],
                warnings: []
            }, null, 2));
            process.exit(1);
        }
        // Validate the workflow structure
        const { validateWorkflowDefinition } = await import('./validate.js');
        const workflowName = path.basename(absolutePath, path.extname(absolutePath));
        const errors = validateWorkflowDefinition(workflow, workflowName);
        // Separate errors and warnings
        const actualErrors = errors.filter(e => !e.code.includes('WARNING'));
        const warnings = errors.filter(e => e.code.includes('WARNING'));
        // Output JSON result
        const result = {
            valid: actualErrors.length === 0,
            errors: actualErrors,
            warnings: warnings
        };
        console.log(JSON.stringify(result, null, 2));
        process.exit(actualErrors.length === 0 ? 0 : 1);
    }
    catch (error) {
        console.error(JSON.stringify({
            valid: false,
            errors: [{
                    code: 'VALIDATION_ERROR',
                    message: error instanceof Error ? error.message : String(error)
                }],
            warnings: []
        }, null, 2));
        process.exit(1);
    }
});
program
    .argument('<sprint-dir>', 'Path to the sprint directory containing SPRINT.yaml')
    .option('-w, --workflows <dir>', 'Path to workflows directory', '.claude/workflows')
    .option('-o, --output <file>', 'Output file path (default: <sprint-dir>/PROGRESS.yaml)')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--dry-run', 'Validate and show result without writing')
    .option('--strict', 'Treat unresolved template variables as errors (fail compilation)')
    .action(async (sprintDir, options) => {
    try {
        // Resolve paths
        const absoluteSprintDir = path.resolve(sprintDir);
        const absoluteWorkflowsDir = path.resolve(options.workflows);
        const outputPath = options.output
            ? path.resolve(options.output)
            : path.join(absoluteSprintDir, 'PROGRESS.yaml');
        // Validate sprint directory exists
        if (!fs.existsSync(absoluteSprintDir)) {
            console.error(`Error: Sprint directory not found: ${absoluteSprintDir}`);
            process.exit(1);
        }
        // Validate SPRINT.yaml exists
        const sprintYamlPath = path.join(absoluteSprintDir, 'SPRINT.yaml');
        if (!fs.existsSync(sprintYamlPath)) {
            console.error(`Error: SPRINT.yaml not found in ${absoluteSprintDir}`);
            process.exit(1);
        }
        // Validate workflows directory exists
        if (!fs.existsSync(absoluteWorkflowsDir)) {
            console.error(`Error: Workflows directory not found: ${absoluteWorkflowsDir}`);
            console.error('Create it with: mkdir -p .claude/workflows');
            process.exit(1);
        }
        if (options.verbose) {
            console.log('Sprint Compiler Configuration:'); // intentional
            console.log(`  Sprint dir: ${absoluteSprintDir}`); // intentional
            console.log(`  Workflows dir: ${absoluteWorkflowsDir}`); // intentional
            console.log(`  Output: ${outputPath}`); // intentional
            console.log(''); // intentional
        }
        // Compile
        const config = {
            workflowsDir: absoluteWorkflowsDir,
            sprintDir: absoluteSprintDir,
            verbose: options.verbose,
            strict: options.strict
        };
        const result = await (0, compile_js_1.compile)(config);
        // Report warnings
        if (result.warnings.length > 0) {
            console.warn('\nWarnings:');
            result.warnings.forEach(w => console.warn(`  - ${w}`));
        }
        // Report errors
        if (!result.success || result.errors.length > 0) {
            console.error('\nErrors:');
            result.errors.forEach(e => {
                console.error(`  [${e.code}] ${e.message}`);
                if (e.path)
                    console.error(`    at: ${e.path}`);
            });
            process.exit(1);
        }
        // Output result
        if (result.progress) {
            const yamlOutput = yaml.dump(result.progress, {
                indent: 2,
                lineWidth: 120,
                noRefs: true,
                sortKeys: false
            });
            if (options.dryRun) {
                console.log('\n--- Compiled PROGRESS.yaml (dry-run) ---\n'); // intentional
                console.log(yamlOutput); // intentional
            }
            else {
                fs.writeFileSync(outputPath, yamlOutput, 'utf8');
                // Bug 5 fix: Remove stale checksum file to prevent runtime checksum mismatch
                const checksumPath = `${outputPath}.checksum`;
                if (fs.existsSync(checksumPath)) {
                    fs.unlinkSync(checksumPath);
                }
                console.log(`\nCompiled successfully: ${outputPath}`); // intentional
                // Summary
                const p = result.progress;
                console.log(`\nSummary:`); // intentional
                console.log(`  Phases: ${p.phases?.length ?? 0}`); // intentional
                const totalSteps = (p.phases ?? []).reduce((acc, phase) => acc + (phase.steps?.length || 0), 0);
                if (totalSteps > 0) {
                    console.log(`  Steps: ${totalSteps}`); // intentional
                }
                const totalSubPhases = (p.phases ?? []).reduce((acc, phase) => acc + (phase.steps?.reduce((a, s) => a + s.phases.length, 0) || 0), 0);
                if (totalSubPhases > 0) {
                    console.log(`  Sub-phases: ${totalSubPhases}`); // intentional
                }
            }
        }
    }
    catch (error) {
        console.error('Compilation failed:', error instanceof Error ? error.message : error);
        if (options.verbose && error instanceof Error) {
            console.error(error.stack);
        }
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=index.js.map