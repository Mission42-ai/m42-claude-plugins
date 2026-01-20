/**
 * Claude CLI Runner - TypeScript wrapper for Claude CLI with error handling
 *
 * Provides functions to invoke Claude CLI, capture output, extract JSON results,
 * and categorize errors for retry decisions.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract JSON from markdown code blocks in output
 *
 * Searches for ```json ... ``` blocks and parses the first valid JSON found.
 * Returns undefined if no valid JSON block is found.
 */
export function extractJson(output: string): unknown | undefined {
  // Match ```json ... ``` blocks
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)```/g;

  let match: RegExpExecArray | null;
  while ((match = jsonBlockRegex.exec(output)) !== null) {
    const jsonContent = match[1].trim();
    if (!jsonContent) {
      continue;
    }
    try {
      return JSON.parse(jsonContent);
    } catch {
      // Invalid JSON, try next block
      continue;
    }
  }

  return undefined;
}

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
export function categorizeError(errorText: string): ErrorCategory {
  // Rate limit detection
  if (/rate.?limit|429|too many requests/i.test(errorText)) {
    return 'rate-limit';
  }

  // Network error detection
  if (/econnrefused|enotfound|etimedout|network.?error|fetch failed/i.test(errorText)) {
    return 'network';
  }

  // Timeout detection
  if (/timeout|timed.?out/i.test(errorText)) {
    return 'timeout';
  }

  // Validation error detection
  if (/validation|invalid|schema/i.test(errorText)) {
    return 'validation';
  }

  // Default to logic error
  return 'logic';
}

/**
 * Build CLI arguments array from options
 *
 * Maps ClaudeRunOptions to Claude CLI flags.
 */
export function buildArgs(options: ClaudeRunOptions): string[] {
  const args: string[] = [];

  // Print mode flag (non-interactive)
  args.push('-p');

  // Skip permissions for non-interactive execution
  // Without this, Claude waits for permission prompts that can never be answered
  args.push('--dangerously-skip-permissions');

  // Use stream-json with partial messages for full transcript capture
  // This outputs all tool calls, responses, and streaming events
  args.push('--output-format', 'stream-json');
  args.push('--include-partial-messages');

  // Max turns
  if (options.maxTurns !== undefined) {
    args.push('--max-turns', String(options.maxTurns));
  }

  // Model
  if (options.model !== undefined) {
    args.push('--model', options.model);
  }

  // NOTE: outputFile is handled via file write after execution, not via CLI flag
  // The Claude CLI doesn't have an --output-file flag

  // Allowed tools (each tool gets its own --allowed-tools flag)
  if (options.allowedTools !== undefined) {
    for (const tool of options.allowedTools) {
      args.push('--allowed-tools', tool);
    }
  }

  // Continue session
  if (options.continueSession !== undefined) {
    args.push('--continue', options.continueSession);
  }

  return args;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Run Claude CLI with the given options
 *
 * Spawns a Claude CLI process, sends the prompt via stdin,
 * captures stdout/stderr, and returns a structured result.
 */
export async function runClaude(options: ClaudeRunOptions): Promise<ClaudeResult> {
  return new Promise((resolve) => {
    const args = buildArgs(options);

    // Spawn Claude CLI process
    const proc = spawn('claude', args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | undefined;
    let timedOut = false;

    // Set up timeout if specified
    if (options.timeout !== undefined) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
      }, options.timeout);
    }

    // Capture stdout
    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Capture stderr
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle process exit
    proc.on('close', (code: number | null) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const exitCode = code ?? 1;
      const success = exitCode === 0 && !timedOut;

      let error: string | undefined;
      if (timedOut) {
        error = 'timeout';
      } else if (stderr) {
        error = stderr;
      } else if (!success) {
        error = `Process exited with code ${exitCode}`;
      }

      // Parse stream-json output (NDJSON - one JSON object per line)
      // Each line is a streaming event: tool calls, responses, result, etc.
      const lines = stdout.trim().split('\n').filter(line => line.trim());
      const events: Array<Record<string, unknown>> = [];
      let resultEvent: {
        type?: string;
        subtype?: string;
        result?: string;
        session_id?: string;
        duration_ms?: number;
        total_cost_usd?: number;
        num_turns?: number;
        is_error?: boolean;
      } | undefined;

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          events.push(event);
          // The final "result" event has the summary
          if (event.type === 'result') {
            resultEvent = event as typeof resultEvent;
          }
        } catch {
          // Skip malformed lines
        }
      }

      // Extract text result from the final result event, or use raw stdout
      const textResult = resultEvent?.result ?? stdout;

      // Also check for JSON blocks in the text result (for structured responses)
      const jsonResult = extractJson(textResult);

      // Write full transcript to file if outputFile was specified
      if (options.outputFile) {
        try {
          // Write the raw NDJSON stream as the transcript
          // This preserves all tool calls, responses, and events
          fs.writeFileSync(options.outputFile, stdout, 'utf8');

          // Also write a human-readable summary as .md file
          const summaryPath = options.outputFile.replace(/\.log$/, '.md');
          if (summaryPath !== options.outputFile) {
            const summaryContent = [
              `# Claude Execution Log`,
              ``,
              `**Session ID**: ${resultEvent?.session_id ?? 'N/A'}`,
              `**Duration**: ${resultEvent?.duration_ms ? `${(resultEvent.duration_ms / 1000).toFixed(1)}s` : 'N/A'}`,
              `**Cost**: ${resultEvent?.total_cost_usd ? `$${resultEvent.total_cost_usd.toFixed(4)}` : 'N/A'}`,
              `**Turns**: ${resultEvent?.num_turns ?? 'N/A'}`,
              `**Status**: ${resultEvent?.subtype ?? (success ? 'success' : 'error')}`,
              `**Events**: ${events.length}`,
              ``,
              `## Final Output`,
              ``,
              textResult,
            ].join('\n');
            fs.writeFileSync(summaryPath, summaryContent, 'utf8');
          }
        } catch (writeErr) {
          // Log but don't fail - output capture is secondary to execution
          console.error(`Failed to write output to ${options.outputFile}:`, writeErr);
        }
      }

      resolve({
        success,
        output: textResult,
        exitCode,
        jsonResult,
        error,
      });
    });

    // Handle spawn error
    proc.on('error', (err: Error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      resolve({
        success: false,
        output: '',
        exitCode: 1,
        error: err.message,
      });
    });

    // Send prompt via stdin and close
    proc.stdin.write(options.prompt);
    proc.stdin.end();
  });
}
