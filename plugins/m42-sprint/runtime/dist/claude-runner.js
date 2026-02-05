/**
 * Claude CLI Runner - TypeScript wrapper for Claude CLI with error handling
 *
 * Provides functions to invoke Claude CLI, capture output, extract JSON results,
 * and categorize errors for retry decisions.
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
// ============================================================================
// JSON Schema for Sprint Results
// ============================================================================
/**
 * JSON Schema that enforces structured output from Claude CLI for sprint tasks.
 * This schema validates the result reporting format:
 * - completed: {"status": "completed", "summary": "..."}
 * - failed: {"status": "failed", "summary": "...", "error": "..."}
 * - needs-human: {"status": "needs-human", "summary": "...", "humanNeeded": {...}}
 */
export const SPRINT_RESULT_SCHEMA = {
    type: 'object',
    required: ['status', 'summary'],
    properties: {
        status: {
            type: 'string',
            enum: ['completed', 'failed', 'needs-human'],
            description: 'The outcome status of the sprint task',
        },
        summary: {
            type: 'string',
            description: 'Brief description of what was accomplished or attempted',
        },
        error: {
            type: 'string',
            description: 'Error message when status is "failed"',
        },
        humanNeeded: {
            type: 'object',
            properties: {
                reason: {
                    type: 'string',
                    description: 'Why human intervention is required',
                },
                details: {
                    type: 'string',
                    description: 'Additional context for the human',
                },
            },
            required: ['reason'],
            description: 'Details when status is "needs-human"',
        },
    },
    additionalProperties: false,
};
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Extract JSON from markdown code blocks in output
 *
 * Searches for ```json ... ``` blocks and parses the first valid JSON found.
 * Returns undefined if no valid JSON block is found.
 */
export function extractJson(output) {
    // Match ```json ... ``` blocks
    const jsonBlockRegex = /```json\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = jsonBlockRegex.exec(output)) !== null) {
        const jsonContent = match[1].trim();
        if (!jsonContent) {
            continue;
        }
        try {
            return JSON.parse(jsonContent);
        }
        catch {
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
export function categorizeError(errorText) {
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
export function buildArgs(options) {
    const args = [];
    // Print mode flag (non-interactive)
    args.push('-p');
    // Skip permissions for non-interactive execution
    // Without this, Claude waits for permission prompts that can never be answered
    args.push('--dangerously-skip-permissions');
    // Use stream-json for structured output with tool calls and results
    // Note: stream-json requires --verbose when used with -p (print mode)
    // We omit --include-partial-messages to avoid noisy streaming deltas
    args.push('--verbose');
    args.push('--output-format', 'stream-json');
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
    // JSON Schema for structured output validation
    // This enforces Claude to return validated JSON matching the schema
    if (options.jsonSchema !== undefined) {
        args.push('--json-schema', JSON.stringify(options.jsonSchema));
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
export async function runClaude(options) {
    return new Promise((resolve) => {
        const args = buildArgs(options);
        // Spawn Claude CLI process
        // Note: env: process.env is required for spawn() to find 'claude' in PATH
        // IMPORTANT: Override PWD to match cwd - Claude Code uses PWD for project detection
        // Without this, spawned Claude inherits parent's PWD and resolves paths incorrectly
        // when running sprints in worktrees from the main repo
        // Override environment to ensure Claude Code uses the correct project directory
        // PWD: Standard shell working directory
        // GIT_WORK_TREE: Tells git which worktree to use (prevents following links to main repo)
        const spawnEnv = options.cwd
            ? {
                ...process.env,
                PWD: options.cwd,
                GIT_WORK_TREE: options.cwd,
            }
            : process.env;
        // Use shell with explicit cd to ensure cwd is set before Claude initializes
        // This is more reliable than spawn's cwd option for Claude Code's project detection
        // Shell escape function to properly handle arguments with special characters
        const shellEscape = (arg) => {
            // Use single quotes and escape any single quotes within
            return `'${arg.replace(/'/g, "'\\''")}'`;
        };
        const shellCommand = options.cwd
            ? `cd ${shellEscape(options.cwd)} && claude ${args.map(shellEscape).join(' ')}`
            : `claude ${args.map(shellEscape).join(' ')}`;
        const proc = spawn('sh', ['-c', shellCommand], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: spawnEnv,
            cwd: options.cwd, // CRITICAL: Set spawn's cwd to worktree path
        });
        let stdout = '';
        let stderr = '';
        let timeoutId;
        let timedOut = false;
        // Open file stream for real-time writing if outputFile specified
        let outputStream;
        if (options.outputFile) {
            outputStream = fs.createWriteStream(options.outputFile, { flags: 'w' });
        }
        // Set up timeout if specified
        if (options.timeout !== undefined) {
            timeoutId = setTimeout(() => {
                timedOut = true;
                proc.kill('SIGTERM');
            }, options.timeout);
        }
        // Capture stdout and stream to file in real-time
        proc.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            // Write to file immediately for real-time streaming
            if (outputStream) {
                outputStream.write(chunk);
            }
        });
        // Capture stderr
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        // Handle process exit
        proc.on('close', (code) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            const exitCode = code ?? 1;
            const success = exitCode === 0 && !timedOut;
            let error;
            if (timedOut) {
                error = 'timeout';
            }
            else if (stderr) {
                error = stderr;
            }
            else if (!success) {
                error = `Process exited with code ${exitCode}`;
            }
            // Parse stream-json output (NDJSON - one JSON object per line)
            // Each line is a streaming event: tool calls, responses, result, etc.
            const lines = stdout.trim().split('\n').filter(line => line.trim());
            const events = [];
            let resultEvent;
            for (const line of lines) {
                try {
                    const event = JSON.parse(line);
                    events.push(event);
                    // The final "result" event has the summary
                    if (event.type === 'result') {
                        resultEvent = event;
                    }
                }
                catch {
                    // Skip malformed lines
                }
            }
            // Extract text result from the final result event, or use raw stdout
            const textResult = resultEvent?.result ?? stdout;
            // Also check for JSON blocks in the text result (for structured responses)
            const jsonResult = extractJson(textResult);
            // Close the output stream (content was already streamed in real-time)
            if (outputStream) {
                outputStream.end();
            }
            // Write human-readable summary as .md file in logs folder
            if (options.outputFile) {
                try {
                    // Change transcriptions -> logs and .log -> .md
                    const summaryPath = options.outputFile
                        .replace(/transcriptions/, 'logs')
                        .replace(/\.log$/, '.md');
                    if (summaryPath !== options.outputFile) {
                        // Ensure logs directory exists
                        const logsDir = summaryPath.substring(0, summaryPath.lastIndexOf('/'));
                        if (!fs.existsSync(logsDir)) {
                            fs.mkdirSync(logsDir, { recursive: true });
                        }
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
                }
                catch (writeErr) {
                    // Log but don't fail - output capture is secondary to execution
                    console.error(`Failed to write summary to ${options.outputFile}:`, writeErr);
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
        proc.on('error', (err) => {
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
//# sourceMappingURL=claude-runner.js.map