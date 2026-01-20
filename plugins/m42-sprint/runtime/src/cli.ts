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

import { runLoop, LoopOptions, LoopResult, LoopDependencies } from './loop.js';
import { runClaude } from './claude-runner.js';

// ============================================================================
// Constants
// ============================================================================

export const CLI_VERSION = '1.0.0';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of parsing CLI arguments
 */
export interface ParseResult {
  command: string;
  directory?: string;
  options: {
    maxIterations: number;
    delay: number;
    verbose: boolean;
  };
  showHelp?: boolean;
  showVersion?: boolean;
  error?: string;
}

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * Parse and validate a non-negative integer parameter.
 * @returns The parsed number, or an error message string if invalid.
 */
function parseNonNegativeInt(value: string, paramName: string): number | string {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return `Invalid number for ${paramName}: "${value}"`;
  if (parsed < 0) return `${paramName} must be non-negative`;
  return parsed;
}

/**
 * Parse command-line arguments.
 * Pure function with no side effects.
 *
 * @param args - Command line arguments (including node and script path)
 * @returns ParseResult with command, options, and any errors
 */
export function parseArgs(args: string[]): ParseResult {
  const result: ParseResult = {
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
      } else if (arg === '--delay' || arg === '-d') {
        const value = cliArgs[++i];
        if (value !== undefined) {
          const parsed = parseNonNegativeInt(value, 'delay');
          if (typeof parsed === 'string') {
            result.error = parsed;
            return result;
          }
          result.options.delay = parsed;
        }
      } else if (arg === '--verbose' || arg === '-v') {
        result.options.verbose = true;
      } else if (!arg.startsWith('-')) {
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
  } else if (command === 'help') {
    result.showHelp = true;
  } else {
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
const defaultDeps: LoopDependencies = {
  runClaude,
};

export async function runCommand(
  command: string,
  directory: string,
  options: LoopOptions,
  loopFn: (dir: string, opts: LoopOptions, deps?: LoopDependencies) => Promise<LoopResult> = runLoop,
  deps: LoopDependencies = defaultDeps
): Promise<number> {
  if (command !== 'run') {
    console.error(`Unknown command: ${command}`);
    return 1;
  }

  try {
    const result = await loopFn(directory, options, deps);
    const isSuccess = result.finalState.status === 'completed' ||
                      result.finalState.status === 'paused';
    return isSuccess ? 0 : 1;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

// ============================================================================
// Help Text
// ============================================================================

function printHelp(): void {
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

function printVersion(): void {
  console.log(`sprint v${CLI_VERSION}`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
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
    const exitCode = await runCommand(
      parsed.command,
      parsed.directory,
      parsed.options
    );
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
