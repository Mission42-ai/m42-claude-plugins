/**
 * Main Compiler Module
 *
 * Orchestrates the compilation of SPRINT.yaml into PROGRESS.yaml
 */
import type { CompilerConfig, CompilerResult } from './types.js';
/**
 * Main compilation function
 *
 * @param config - Compiler configuration
 * @returns Compilation result with progress or errors
 */
export declare function compile(config: CompilerConfig): Promise<CompilerResult>;
/**
 * Convenience function to compile from file paths
 */
export declare function compileFromPaths(sprintDir: string, workflowsDir: string, verbose?: boolean): Promise<CompilerResult>;
//# sourceMappingURL=compile.d.ts.map