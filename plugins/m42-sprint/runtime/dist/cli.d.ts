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
import { LoopOptions, LoopResult, LoopDependencies } from './loop.js';
export declare const CLI_VERSION = "1.0.0";
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
/**
 * Parse command-line arguments.
 * Pure function with no side effects.
 *
 * @param args - Command line arguments (including node and script path)
 * @returns ParseResult with command, options, and any errors
 */
export declare function parseArgs(args: string[]): ParseResult;
export declare function runCommand(command: string, directory: string, options: LoopOptions, loopFn?: (dir: string, opts: LoopOptions, deps?: LoopDependencies) => Promise<LoopResult>, deps?: LoopDependencies): Promise<number>;
//# sourceMappingURL=cli.d.ts.map