#!/usr/bin/env node
/**
 * CLI Entry Point for Sprint Runtime
 *
 * Provides commands matching the current bash interface:
 *   sprint run <dir> [options]
 *     --max-iterations <n>  Maximum iterations (0 = unlimited)
 *     --delay <ms>          Delay between iterations (default: 2000)
 *     -v, --verbose         Enable verbose logging
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import { runLoop } from './loop.js';
import { runClaude } from './claude-runner.js';
import { shouldCreateWorktree, resolveWorktreePath } from '../../compiler/dist/worktree-config.js';
import { createWorktree, getRepoRoot } from './worktree.js';
// ============================================================================
// Constants
// ============================================================================
export const CLI_VERSION = '1.0.0';
// ============================================================================
// Argument Parsing
// ============================================================================
/**
 * Parse and validate a non-negative integer parameter.
 * @returns The parsed number, or an error message string if invalid.
 */
function parseNonNegativeInt(value, paramName) {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed))
        return `Invalid number for ${paramName}: "${value}"`;
    if (parsed < 0)
        return `${paramName} must be non-negative`;
    return parsed;
}
/**
 * Parse command-line arguments.
 * Pure function with no side effects.
 *
 * @param args - Command line arguments (including node and script path)
 * @returns ParseResult with command, options, and any errors
 */
export function parseArgs(args) {
    const result = {
        command: '',
        options: {
            maxIterations: 0,
            delay: 2000,
            verbose: false,
        },
    };
    // Skip 'node' and script path
    const cliArgs = args.slice(2);
    // Check for global flags first
    if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
        result.command = 'help';
        result.showHelp = true;
        return result;
    }
    if (cliArgs.includes('--version')) {
        result.showVersion = true;
        return result;
    }
    // No command provided
    if (cliArgs.length === 0) {
        result.command = 'help';
        result.showHelp = true;
        return result;
    }
    // Get command
    const command = cliArgs[0];
    result.command = command;
    // Handle known commands
    if (command === 'run') {
        for (let i = 1; i < cliArgs.length; i++) {
            const arg = cliArgs[i];
            // Check for help in subcommand
            if (arg === '--help' || arg === '-h') {
                result.showHelp = true;
                return result;
            }
            // Parse options
            if (arg === '--max-iterations' || arg === '-n') {
                const value = cliArgs[++i];
                if (value !== undefined) {
                    const parsed = parseNonNegativeInt(value, 'max-iterations');
                    if (typeof parsed === 'string') {
                        result.error = parsed;
                        return result;
                    }
                    result.options.maxIterations = parsed;
                }
            }
            else if (arg === '--delay' || arg === '-d') {
                const value = cliArgs[++i];
                if (value !== undefined) {
                    const parsed = parseNonNegativeInt(value, 'delay');
                    if (typeof parsed === 'string') {
                        result.error = parsed;
                        return result;
                    }
                    result.options.delay = parsed;
                }
            }
            else if (arg === '--verbose' || arg === '-v') {
                result.options.verbose = true;
            }
            else if (!arg.startsWith('-')) {
                // Positional argument = directory (only set if not already set)
                // Bug 2 fix: prevent unknown flag values from overwriting directory
                if (!result.directory) {
                    result.directory = arg;
                }
            }
        }
        // Validate required arguments
        if (!result.directory) {
            result.error = 'Missing required argument: directory';
        }
    }
    else if (command === 'help') {
        result.showHelp = true;
    }
    else {
        result.error = `Unknown command: ${command}`;
    }
    return result;
}
// ============================================================================
// Command Execution
// ============================================================================
/**
 * Execute a CLI command.
 *
 * @param command - Command to execute ('run')
 * @param directory - Sprint directory
 * @param options - Loop options
 * @param loopFn - Optional loop function for testing (defaults to runLoop)
 * @returns Exit code (0 = success, 1 = failure)
 */
// Default dependencies for production use
const defaultDeps = {
    runClaude,
};
/**
 * Format duration in human-readable form
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    else {
        return `${seconds}s`;
    }
}
export async function runCommand(command, directory, options, loopFn = runLoop, deps = defaultDeps) {
    if (command !== 'run') {
        console.error(`Unknown command: ${command}`);
        return 1;
    }
    try {
        const result = await loopFn(directory, options, deps);
        const isSuccess = result.finalState.status === 'completed' ||
            result.finalState.status === 'paused';
        // Print completion summary
        console.log('\n' + '='.repeat(60));
        console.log('SPRINT COMPLETE');
        console.log('='.repeat(60));
        console.log(`Status:     ${result.finalState.status.toUpperCase()}`);
        console.log(`Iterations: ${result.iterations}`);
        console.log(`Duration:   ${formatDuration(result.elapsedMs)}`);
        console.log('='.repeat(60) + '\n');
        // Write completion notification file for external monitoring
        const notificationPath = path.join(directory, '.sprint-complete');
        const notification = {
            status: result.finalState.status,
            iterations: result.iterations,
            durationMs: result.elapsedMs,
            durationHuman: formatDuration(result.elapsedMs),
            completedAt: new Date().toISOString(),
        };
        fs.writeFileSync(notificationPath, JSON.stringify(notification, null, 2));
        return isSuccess ? 0 : 1;
    }
    catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
}
// ============================================================================
// Help Text
// ============================================================================
function printHelp() {
    console.log(`
Sprint Runtime CLI v${CLI_VERSION}

Usage:
  sprint run <directory> [options]

Commands:
  run <dir>    Run the sprint loop for the specified directory

Options:
  -n, --max-iterations <n>  Maximum iterations (0 = unlimited, default: 0)
  -d, --delay <ms>          Delay between iterations in ms (default: 2000)
  -v, --verbose             Enable verbose logging
  -h, --help                Show this help message
  --version                 Show version number

Examples:
  sprint run ./my-sprint
  sprint run /path/to/sprint --max-iterations 10
  sprint run ./sprint -v -d 5000

Exit Codes:
  0    Sprint completed successfully or paused
  1    Sprint blocked, needs human, or error
`);
}
function printVersion() {
    console.log(`sprint v${CLI_VERSION}`);
}
// ============================================================================
// Worktree Setup
// ============================================================================
/**
 * Load SPRINT.yaml from a directory
 */
function loadSprintYaml(sprintDir) {
    const sprintYamlPath = path.join(sprintDir, 'SPRINT.yaml');
    if (!fs.existsSync(sprintYamlPath)) {
        return null;
    }
    const content = fs.readFileSync(sprintYamlPath, 'utf-8');
    return yaml.load(content);
}
/**
 * Load workflow YAML from .claude/workflows/
 */
function loadWorkflowYaml(workflowName, repoRoot) {
    const workflowPath = path.join(repoRoot, '.claude', 'workflows', `${workflowName}.yaml`);
    if (!fs.existsSync(workflowPath)) {
        return null;
    }
    const content = fs.readFileSync(workflowPath, 'utf-8');
    return yaml.load(content);
}
/**
 * Check if a worktree already exists for the given path
 */
function worktreeExists(worktreePath, repoRoot) {
    try {
        const output = execSync('git worktree list --porcelain', {
            cwd: repoRoot,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const lines = output.split('\n');
        for (const line of lines) {
            if (line.startsWith('worktree ') && line.slice(9) === worktreePath) {
                return true;
            }
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Copy sprint files to the worktree
 */
function copySprintFiles(sourceDir, targetDir) {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    // Copy all files recursively
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        if (entry.isDirectory()) {
            copySprintFiles(sourcePath, targetPath);
        }
        else {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}
/**
 * Setup worktree if configured in sprint/workflow.
 * Returns the actual sprint directory to use (worktree dir or original).
 */
async function setupWorktreeIfNeeded(sprintDir) {
    // Resolve absolute path
    const absoluteSprintDir = path.resolve(sprintDir);
    // Get repo root
    const repoRoot = getRepoRoot(absoluteSprintDir);
    if (!repoRoot) {
        console.log('Not in a git repository, skipping worktree check');
        return absoluteSprintDir;
    }
    // Load SPRINT.yaml
    const sprintDef = loadSprintYaml(absoluteSprintDir);
    if (!sprintDef) {
        console.error('Error: Could not load SPRINT.yaml from', absoluteSprintDir);
        process.exit(1);
    }
    // Load workflow
    const workflowDef = loadWorkflowYaml(sprintDef.workflow, repoRoot);
    if (!workflowDef) {
        console.error(`Error: Could not load workflow "${sprintDef.workflow}" from ${repoRoot}/.claude/workflows/`);
        process.exit(1);
    }
    // Check if worktree should be created
    if (!shouldCreateWorktree(sprintDef, workflowDef)) {
        return absoluteSprintDir;
    }
    // Determine sprint ID
    const sprintId = sprintDef['sprint-id'] || path.basename(absoluteSprintDir);
    // Resolve worktree paths
    const resolved = resolveWorktreePath(sprintId, workflowDef.worktree, sprintDef.worktree);
    const worktreePath = path.isAbsolute(resolved.path)
        ? resolved.path
        : path.resolve(repoRoot, resolved.path);
    // Check if worktree already exists
    if (worktreeExists(worktreePath, repoRoot)) {
        console.log(`Worktree already exists at ${worktreePath}`);
        const targetSprintDir = path.join(worktreePath, '.claude', 'sprints', sprintId);
        if (fs.existsSync(targetSprintDir)) {
            return targetSprintDir;
        }
        // Worktree exists but sprint dir doesn't - copy files
        console.log(`Copying sprint files to existing worktree...`);
        copySprintFiles(absoluteSprintDir, targetSprintDir);
        return targetSprintDir;
    }
    // Check if worktree directory already exists (but not as a git worktree)
    if (fs.existsSync(worktreePath)) {
        console.log(`Directory already exists at ${worktreePath}, using existing directory`);
        const targetSprintDir = path.join(worktreePath, '.claude', 'sprints', sprintId);
        if (!fs.existsSync(targetSprintDir)) {
            console.log(`Copying sprint files...`);
            copySprintFiles(absoluteSprintDir, targetSprintDir);
        }
        return targetSprintDir;
    }
    // Create worktree
    console.log(`Creating worktree for sprint ${sprintId}...`);
    console.log(`  Branch: ${resolved.branch}`);
    console.log(`  Path: ${worktreePath}`);
    const worktreeConfig = {
        enabled: true,
        branch: resolved.branch,
        path: resolved.path,
        cleanup: resolved.cleanup,
    };
    const result = createWorktree(worktreeConfig, sprintId, sprintDef.workflow, repoRoot, { reuseExistingBranch: true });
    if (!result.success) {
        console.error(`Error creating worktree: ${result.error}`);
        if (result.suggestion) {
            console.error(`Suggestion: ${result.suggestion}`);
        }
        process.exit(1);
    }
    console.log(`Worktree created at ${result.worktreePath}`);
    // Copy sprint files to the new worktree
    const targetSprintDir = result.sprintDir;
    console.log(`Copying sprint files to ${targetSprintDir}...`);
    copySprintFiles(absoluteSprintDir, targetSprintDir);
    console.log(`Sprint will run in worktree: ${targetSprintDir}`);
    return targetSprintDir;
}
// ============================================================================
// Main Entry Point
// ============================================================================
async function main() {
    const parsed = parseArgs(process.argv);
    // Handle version
    if (parsed.showVersion) {
        printVersion();
        process.exit(0);
    }
    // Handle help
    if (parsed.showHelp) {
        printHelp();
        process.exit(0);
    }
    // Handle errors
    if (parsed.error) {
        console.error(`Error: ${parsed.error}`);
        printHelp();
        process.exit(1);
    }
    // Execute command
    if (parsed.command === 'run' && parsed.directory) {
        // Setup worktree if needed and get the actual sprint directory
        const actualSprintDir = await setupWorktreeIfNeeded(parsed.directory);
        const exitCode = await runCommand(parsed.command, actualSprintDir, parsed.options);
        process.exit(exitCode);
    }
    // No valid command
    printHelp();
    process.exit(1);
}
// Run main if this is the entry point
const isMainModule = process.argv[1]?.endsWith('cli.js') ||
    process.argv[1]?.endsWith('cli.ts');
if (isMainModule) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=cli.js.map