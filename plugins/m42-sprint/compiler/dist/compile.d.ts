/**
 * Main Compiler Module
 *
 * Orchestrates the compilation of SPRINT.yaml into PROGRESS.yaml
 */
import type { CompiledTopPhase, CompilerConfig, CompilerResult, CompiledDependencyGraph } from './types.js';
/**
 * Build dependency graphs for all for-each phases
 *
 * Creates a CompiledDependencyGraph for each for-each phase that has steps
 * with dependencies. Each node in the graph tracks:
 * - depends-on: the original dependencies from SPRINT.yaml
 * - blocked-by: initially same as depends-on, cleared at runtime as deps complete
 *
 * @param phases - The compiled top phases
 * @returns Array of dependency graphs (one per for-each phase with dependencies)
 */
export declare function buildDependencyGraphs(phases: CompiledTopPhase[]): CompiledDependencyGraph[];
/**
 * Format a YAML parsing error with line numbers and context
 *
 * @param err - The error from yaml.load()
 * @param filePath - Path to the file that failed to parse
 * @returns Formatted error message with context
 */
export declare function formatYamlError(err: unknown, filePath: string): string;
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