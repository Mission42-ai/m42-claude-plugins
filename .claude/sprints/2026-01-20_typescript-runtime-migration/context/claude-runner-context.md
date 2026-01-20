# Step Context: claude-runner

## Task
GIVEN the need to invoke Claude CLI from TypeScript
WHEN creating the runner module
THEN wrap Claude CLI with proper error handling and result parsing

## Scope
Create NEW file: plugins/m42-sprint/runtime/src/claude-runner.ts

## Acceptance Criteria

### Main Function
- [ ] `runClaude(options: ClaudeRunOptions)` → Promise<ClaudeResult>

### Options Interface
- [ ] prompt: string (required)
- [ ] outputFile?: string
- [ ] maxTurns?: number
- [ ] model?: string
- [ ] allowedTools?: string[]
- [ ] continueSession?: string
- [ ] cwd?: string
- [ ] timeout?: number

### Result Interface
- [ ] success: boolean
- [ ] output: string (full stdout)
- [ ] exitCode: number
- [ ] jsonResult?: unknown (parsed from ```json block)
- [ ] error?: string (stderr or error message)

### Implementation
- [ ] Use child_process.spawn for Claude CLI
- [ ] Send prompt via stdin
- [ ] Capture stdout and stderr
- [ ] Extract JSON from ```json blocks in output
- [ ] Handle timeouts gracefully

### Error Handling
- [ ] Detect rate-limit errors
- [ ] Detect network errors
- [ ] Detect timeout errors
- [ ] Return appropriate error category

### Tests
- [ ] Test: successful run returns output
- [ ] Test: JSON extraction works
- [ ] Test: exit code captured
- [ ] Test: error handling (mock failures)

## Files to Create
- plugins/m42-sprint/runtime/src/claude-runner.ts
- plugins/m42-sprint/runtime/src/claude-runner.test.ts (already exists from RED phase)

## Implementation Plan
Based on gherkin scenarios, implement in this order:
1. Define interfaces: `ClaudeRunOptions`, `ClaudeResult`, `ErrorCategory`
2. Implement `extractJson()` - JSON extraction from markdown code blocks
3. Implement `categorizeError()` - error classification function
4. Implement `buildArgs()` - CLI argument builder
5. Implement `runClaude()` - main function using spawn with stdin/stdout handling

## Related Code Patterns

### Pattern from: scripts/sprint-loop.sh (lines 1235-1239)
Claude CLI invocation pattern in bash:
```bash
claude -p "$PROMPT" \
  --dangerously-skip-permissions \
  --output-format stream-json \
  --verbose \
  > "$TRANSCRIPT_FILE" 2>&1
```

### Pattern from: scripts/sprint-loop.sh (lines 673-711)
JSON extraction from transcript - extract from `result` field in stream-json output:
```bash
# Extract from result field in stream-json output
result_text=$(jq -rs '[.[] | select(.type=="result")] | last | .result // empty' "$transcript_file" 2>/dev/null)

# Extract JSON from markdown code block (```json ... ```)
json_block=$(echo "$result_text" | sed -n '/```json/,/```/p' | sed '1d;$d')
```

### Pattern from: runtime/src/yaml-ops.ts (lines 1-20)
Module structure and imports:
```typescript
/**
 * Module description
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
// Always use .js extension in imports (NodeNext resolution)
import { SomeType } from './types.js';
```

### Pattern from: runtime/src/transition.ts (lines 19-21)
ErrorCategory type (already exists):
```typescript
/** Error category types for classification and retry configuration */
export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';
```

### Pattern from: shared-context (Test Pattern)
Test file template:
```typescript
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error}`);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
```

## Required Imports
### Internal
- None (standalone module, but exports used by executor.ts later)

### External
- `child_process`: spawn for CLI invocation
- Node built-ins: No external npm packages needed

## Types/Interfaces to Define
```typescript
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
```

## Integration Points
- **Called by**: executor.ts (to be created in a later step)
- **Calls**: Node child_process.spawn, no internal module dependencies
- **Used by**: sprint loop orchestration for invoking Claude CLI

## Key Implementation Details

### spawn vs exec
Use `spawn` instead of `exec` because:
- Better for long-running processes
- Stream stdout/stderr in real-time
- Proper handling of large outputs (no buffer limits)

### Prompt Delivery
The bash script uses `-p "$PROMPT"` flag. For TypeScript:
```typescript
const args = buildArgs(options);
// Prompt goes via -p flag, not stdin
args.push('-p', options.prompt);
```

### CLI Arguments Mapping
| Option | CLI Flag |
|--------|----------|
| prompt | `-p <prompt>` |
| maxTurns | `--max-turns <n>` |
| model | `--model <model>` |
| outputFile | `--output-file <path>` |
| allowedTools | `--allowed-tools <tool>` (repeated) |
| continueSession | `--continue <session>` |

### Error Detection Patterns
```typescript
// Rate limit detection
/rate.?limit|429|too many requests/i

// Network error detection
/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network.?error|fetch failed/i

// Timeout detection
/timeout|timed.?out/i

// Validation error detection
/validation|invalid|schema/i
```

### JSON Extraction Strategy
1. Parse stdout line-by-line for stream-json format
2. Find last entry with `type: "result"`
3. Extract `result` field text
4. Parse ```json ... ``` blocks from result text
5. Return first valid JSON object

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-sprint/runtime/src/claude-runner.ts` | Create | Main implementation |
| `plugins/m42-sprint/runtime/package.json` | Modify | Add to test script |

## package.json Update
Add claude-runner test to existing test script:
```json
"test": "npm run build && node dist/transition.test.js && node dist/yaml-ops.test.js && node dist/prompt-builder.test.js && node dist/claude-runner.test.js"
```

## Notes from RED Phase
- Tests are already created in `claude-runner.test.ts` (35+ tests)
- Tests expect these exports: `runClaude`, `extractJson`, `categorizeError`, `buildArgs`
- Tests expect these type exports: `ClaudeRunOptions`, `ClaudeResult`, `ErrorCategory`
- Current test state: FAIL (module not found) - expected for RED phase
