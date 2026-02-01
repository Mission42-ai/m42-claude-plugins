/**
 * Claude CLI Runner - TypeScript wrapper for Claude CLI with error handling
 *
 * Provides functions to invoke Claude CLI, capture output, extract JSON results,
 * and categorize errors for retry decisions.
 */
/**
 * Options for running Claude CLI
 */
export interface ClaudeRunOptions {
    /** The prompt to send to Claude (required) */
    prompt: string;
    /** File path to write Claude output */
    outputFile?: string;
    /** Maximum number of turns/iterations */
    maxTurns?: number;
    /** Model to use (e.g., 'claude-opus-4') */
    model?: string;
    /** List of allowed tools for Claude */
    allowedTools?: string[];
    /** Session ID to continue from */
    continueSession?: string;
    /** Working directory for Claude process */
    cwd?: string;
    /** Timeout in milliseconds */
    timeout?: number;
    /** JSON Schema to enforce structured output (uses --json-schema CLI flag) */
    jsonSchema?: Record<string, unknown>;
}
/**
 * Result from Claude CLI invocation
 */
export interface ClaudeResult {
    /** Whether the invocation was successful (exit code 0) */
    success: boolean;
    /** Full stdout from Claude */
    output: string;
    /** Process exit code */
    exitCode: number;
    /** Parsed JSON from ```json block if present */
    jsonResult?: unknown;
    /** Error message from stderr or error description */
    error?: string;
}
/**
 * Error categories for classification and retry decisions
 */
export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';
/**
 * JSON Schema that enforces structured output from Claude CLI for sprint tasks.
 * This schema validates the result reporting format:
 * - completed: {"status": "completed", "summary": "..."}
 * - failed: {"status": "failed", "summary": "...", "error": "..."}
 * - needs-human: {"status": "needs-human", "summary": "...", "humanNeeded": {...}}
 */
export declare const SPRINT_RESULT_SCHEMA: Record<string, unknown>;
/**
 * Extract JSON from markdown code blocks in output
 *
 * Searches for ```json ... ``` blocks and parses the first valid JSON found.
 * Returns undefined if no valid JSON block is found.
 */
export declare function extractJson(output: string): unknown | undefined;
/**
 * Categorize an error message for retry decisions
 *
 * Categories:
 * - rate-limit: Rate limiting or 429 errors
 * - network: Connection/DNS/network errors
 * - timeout: Timeout errors
 * - validation: Schema/validation errors
 * - logic: Unknown/other errors (default)
 */
export declare function categorizeError(errorText: string): ErrorCategory;
/**
 * Build CLI arguments array from options
 *
 * Maps ClaudeRunOptions to Claude CLI flags.
 */
export declare function buildArgs(options: ClaudeRunOptions): string[];
/**
 * Run Claude CLI with the given options
 *
 * Spawns a Claude CLI process, sends the prompt via stdin,
 * captures stdout/stderr, and returns a structured result.
 */
export declare function runClaude(options: ClaudeRunOptions): Promise<ClaudeResult>;
//# sourceMappingURL=claude-runner.d.ts.map