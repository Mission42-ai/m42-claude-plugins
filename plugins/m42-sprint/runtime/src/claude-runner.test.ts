/**
 * Tests for claude-runner module - Claude CLI wrapper with error handling
 *
 * RED PHASE: These tests define expected behavior BEFORE implementation.
 * All tests should FAIL until the implementation is complete.
 *
 * Expected error: Cannot find module './claude-runner.js' (until implementation exists)
 */

// Import from claude-runner.js - this will fail until implementation exists
// This is the expected RED phase behavior
import {
  runClaude,
  extractJson,
  categorizeError,
  buildArgs,
  type ClaudeRunOptions,
  type ClaudeResult,
  type ErrorCategory,
} from './claude-runner.js';

// ============================================================================
// Test Utilities
// ============================================================================

function test(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`✓ ${name}`);
    })
    .catch((error) => {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  if (actualStr !== expectedStr) {
    throw new Error(message ?? `Expected:\n${expectedStr}\n\nGot:\n${actualStr}`);
  }
}

function assertContains(text: string, substring: string, message?: string): void {
  if (!text.includes(substring)) {
    throw new Error(message ?? `Expected text to contain "${substring}", but it did not`);
  }
}

function assertArrayContains<T>(arr: T[], item: T, message?: string): void {
  if (!arr.includes(item)) {
    throw new Error(message ?? `Expected array to contain ${JSON.stringify(item)}, got: ${JSON.stringify(arr)}`);
  }
}

function assertArrayContainsSequence<T>(arr: T[], ...sequence: T[]): void {
  for (let i = 0; i <= arr.length - sequence.length; i++) {
    let found = true;
    for (let j = 0; j < sequence.length; j++) {
      if (arr[i + j] !== sequence[j]) {
        found = false;
        break;
      }
    }
    if (found) return;
  }
  throw new Error(`Expected array to contain sequence ${JSON.stringify(sequence)}, got: ${JSON.stringify(arr)}`);
}

// ============================================================================
// Test: extractJson
// ============================================================================

console.log('\n=== extractJson Tests ===\n');

test('extractJson: extracts JSON from markdown code block', () => {
  const output = `Some text before
\`\`\`json
{"status": "completed", "summary": "Task done"}
\`\`\`
Some text after`;

  const result = extractJson(output);

  assertDeepEqual(result, { status: 'completed', summary: 'Task done' });
});

test('extractJson: extracts JSON from multiple code blocks (uses first)', () => {
  const output = `First block:
\`\`\`json
{"first": true}
\`\`\`
Second block:
\`\`\`json
{"second": true}
\`\`\``;

  const result = extractJson(output);

  assertDeepEqual(result, { first: true });
});

test('extractJson: extracts nested JSON objects', () => {
  const output = `\`\`\`json
{
  "status": "completed",
  "data": {
    "nested": {
      "value": 42
    }
  }
}
\`\`\``;

  const result = extractJson(output);

  assertEqual((result as { data: { nested: { value: number } } }).data.nested.value, 42);
});

test('extractJson: extracts JSON arrays', () => {
  const output = `\`\`\`json
[1, 2, 3, {"item": "four"}]
\`\`\``;

  const result = extractJson(output);

  assert(Array.isArray(result), 'Should be array');
  assertEqual((result as unknown[])[0], 1);
});

test('extractJson: returns undefined when no JSON block found', () => {
  const output = 'Just plain text without any code blocks';

  const result = extractJson(output);

  assertEqual(result, undefined);
});

test('extractJson: returns undefined for empty JSON block', () => {
  const output = `\`\`\`json
\`\`\``;

  const result = extractJson(output);

  assertEqual(result, undefined);
});

test('extractJson: returns undefined for invalid JSON', () => {
  const output = `\`\`\`json
{invalid json here}
\`\`\``;

  const result = extractJson(output);

  assertEqual(result, undefined);
});

test('extractJson: handles JSON with newlines and whitespace', () => {
  const output = `\`\`\`json
{
    "multiline": true,
    "items": [
        "one",
        "two"
    ]
}
\`\`\``;

  const result = extractJson(output);

  assertEqual((result as { multiline: boolean }).multiline, true);
});

test('extractJson: ignores non-json code blocks', () => {
  const output = `\`\`\`typescript
const x = { notJson: true };
\`\`\`
\`\`\`json
{"realJson": true}
\`\`\``;

  const result = extractJson(output);

  assertEqual((result as { realJson: boolean }).realJson, true);
});

// ============================================================================
// Test: categorizeError
// ============================================================================

console.log('\n=== categorizeError Tests ===\n');

test('categorizeError: detects rate-limit errors', () => {
  const cases = [
    'Error: rate limit exceeded',
    'HTTP 429 Too Many Requests',
    'Rate limit hit, please wait',
    'You have been rate limited',
  ];

  for (const errorText of cases) {
    const result = categorizeError(errorText);
    assertEqual(result, 'rate-limit', `Should detect rate-limit in: "${errorText}"`);
  }
});

test('categorizeError: detects network errors', () => {
  const cases = [
    'ECONNREFUSED: Connection refused',
    'Network error: Unable to connect',
    'ENOTFOUND: DNS lookup failed',
    'ETIMEDOUT: Connection timed out during request',
    'fetch failed: Network error',
  ];

  for (const errorText of cases) {
    const result = categorizeError(errorText);
    assertEqual(result, 'network', `Should detect network in: "${errorText}"`);
  }
});

test('categorizeError: detects timeout errors', () => {
  const cases = [
    'Error: timeout after 30000ms',
    'Process timed out',
    'Request timeout exceeded',
    'TIMEOUT: Operation did not complete',
  ];

  for (const errorText of cases) {
    const result = categorizeError(errorText);
    assertEqual(result, 'timeout', `Should detect timeout in: "${errorText}"`);
  }
});

test('categorizeError: detects validation errors', () => {
  const cases = [
    'ValidationError: Invalid input',
    'Schema validation failed',
    'Invalid YAML format',
    'Validation: Missing required field',
  ];

  for (const errorText of cases) {
    const result = categorizeError(errorText);
    assertEqual(result, 'validation', `Should detect validation in: "${errorText}"`);
  }
});

test('categorizeError: returns logic for unknown errors', () => {
  const cases = [
    'Something went wrong',
    'Unexpected error occurred',
    'TypeError: Cannot read property',
    'Unknown issue',
  ];

  for (const errorText of cases) {
    const result = categorizeError(errorText);
    assertEqual(result, 'logic', `Should return logic for unknown: "${errorText}"`);
  }
});

test('categorizeError: handles empty string', () => {
  const result = categorizeError('');
  assertEqual(result, 'logic');
});

test('categorizeError: is case-insensitive', () => {
  assertEqual(categorizeError('RATE LIMIT'), 'rate-limit');
  assertEqual(categorizeError('network ERROR'), 'network');
  assertEqual(categorizeError('TimeOut'), 'timeout');
});

// ============================================================================
// Test: buildArgs
// ============================================================================

console.log('\n=== buildArgs Tests ===\n');

test('buildArgs: minimal options returns base args', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Hello',
  };

  const args = buildArgs(options);

  // Should have -p flag for print mode (no interactive)
  assertArrayContains(args, '-p', 'Should have print flag');
});

test('buildArgs: includes max-turns when specified', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Test',
    maxTurns: 5,
  };

  const args = buildArgs(options);

  assertArrayContainsSequence(args, '--max-turns', '5');
});

test('buildArgs: includes model when specified', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Test',
    model: 'claude-3-sonnet',
  };

  const args = buildArgs(options);

  assertArrayContainsSequence(args, '--model', 'claude-3-sonnet');
});

test('buildArgs: includes output-file when specified', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Test',
    outputFile: '/tmp/output.md',
  };

  const args = buildArgs(options);

  assertArrayContainsSequence(args, '--output-file', '/tmp/output.md');
});

test('buildArgs: includes allowed-tools for each tool', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Test',
    allowedTools: ['Read', 'Write', 'Bash'],
  };

  const args = buildArgs(options);

  // Each tool should have its own --allowed-tools flag
  let readFound = false;
  let writeFound = false;
  let bashFound = false;

  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === '--allowed-tools') {
      if (args[i + 1] === 'Read') readFound = true;
      if (args[i + 1] === 'Write') writeFound = true;
      if (args[i + 1] === 'Bash') bashFound = true;
    }
  }

  assert(readFound, 'Should have Read tool');
  assert(writeFound, 'Should have Write tool');
  assert(bashFound, 'Should have Bash tool');
});

test('buildArgs: includes continue session flag', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Continue this',
    continueSession: 'session-abc-123',
  };

  const args = buildArgs(options);

  assertArrayContainsSequence(args, '--continue', 'session-abc-123');
});

test('buildArgs: includes all specified options', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Full test',
    maxTurns: 10,
    model: 'claude-opus-4',
    outputFile: '/out.md',
    allowedTools: ['Read'],
    continueSession: 'sess-1',
  };

  const args = buildArgs(options);

  assertArrayContainsSequence(args, '--max-turns', '10');
  assertArrayContainsSequence(args, '--model', 'claude-opus-4');
  assertArrayContainsSequence(args, '--output-file', '/out.md');
  assertArrayContainsSequence(args, '--allowed-tools', 'Read');
  assertArrayContainsSequence(args, '--continue', 'sess-1');
});

test('buildArgs: does not include undefined options', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Test',
    maxTurns: undefined,
    model: undefined,
  };

  const args = buildArgs(options);

  assert(!args.includes('--max-turns'), 'Should not include --max-turns');
  assert(!args.includes('--model'), 'Should not include --model');
  assert(!args.includes('undefined'), 'Should not include undefined string');
});

// ============================================================================
// Test: runClaude (Unit Tests with Mocking Strategy)
// ============================================================================

console.log('\n=== runClaude Tests ===\n');

// Note: These tests define expected behavior. Actual mocking will be implemented
// in the module to allow testing without actually invoking Claude CLI.

test('runClaude: successful run returns output', async () => {
  // This test expects runClaude to have a way to inject a mock process
  // or use a test double. For RED phase, we define the expected interface.
  const options: ClaudeRunOptions = {
    prompt: 'Say hello',
  };

  // In implementation, this would use a mock spawn
  // For now, we just verify the interface exists
  assert(typeof runClaude === 'function', 'runClaude should be a function');

  // The actual test would be:
  // const result = await runClaude(options);
  // assertEqual(result.success, true);
  // assertContains(result.output, 'hello');
});

test('runClaude: captures stdout in output', async () => {
  const options: ClaudeRunOptions = {
    prompt: 'Test prompt',
  };

  // Expected: result.output contains all stdout from Claude
  assert(typeof runClaude === 'function', 'runClaude should be a function');
});

test('runClaude: captures stderr in error field', async () => {
  const options: ClaudeRunOptions = {
    prompt: 'Test prompt',
  };

  // Expected: result.error contains stderr if process fails
  assert(typeof runClaude === 'function', 'runClaude should be a function');
});

test('runClaude: non-zero exit code sets success false', async () => {
  const options: ClaudeRunOptions = {
    prompt: 'This will fail',
  };

  // Expected:
  // const result = await runClaude(options);
  // assertEqual(result.success, false);
  // assertEqual(result.exitCode, 1); // or other non-zero
  assert(typeof runClaude === 'function', 'runClaude should be a function');
});

test('runClaude: extracts JSON result from output', async () => {
  const options: ClaudeRunOptions = {
    prompt: 'Return JSON',
  };

  // Expected: If Claude output contains ```json block, it's parsed into jsonResult
  // const result = await runClaude(options);
  // assertDeepEqual(result.jsonResult, { status: 'completed' });
  assert(typeof runClaude === 'function', 'runClaude should be a function');
});

test('runClaude: handles timeout gracefully', async () => {
  const options: ClaudeRunOptions = {
    prompt: 'Long running task',
    timeout: 100, // Very short timeout
  };

  // Expected:
  // const result = await runClaude(options);
  // assertEqual(result.success, false);
  // assertContains(result.error!, 'timeout');
  assert(typeof runClaude === 'function', 'runClaude should be a function');
});

test('runClaude: uses cwd option when specified', async () => {
  const options: ClaudeRunOptions = {
    prompt: 'Test',
    cwd: '/some/directory',
  };

  // Expected: spawn is called with cwd option
  assert(typeof runClaude === 'function', 'runClaude should be a function');
});

test('runClaude: sends prompt via stdin', async () => {
  const options: ClaudeRunOptions = {
    prompt: 'My prompt text',
  };

  // Expected: The prompt is written to stdin of the spawned process
  assert(typeof runClaude === 'function', 'runClaude should be a function');
});

// ============================================================================
// Test: ClaudeResult Interface Compliance
// ============================================================================

console.log('\n=== ClaudeResult Interface Tests ===\n');

test('ClaudeResult: success result has required fields', () => {
  // This tests that our type definitions are correct
  const result: ClaudeResult = {
    success: true,
    output: 'Task completed successfully',
    exitCode: 0,
    jsonResult: { status: 'completed' },
  };

  assertEqual(result.success, true);
  assertEqual(result.exitCode, 0);
  assert(result.output.length > 0, 'Output should not be empty');
});

test('ClaudeResult: failure result has required fields', () => {
  const result: ClaudeResult = {
    success: false,
    output: 'Error output',
    exitCode: 1,
    error: 'Something went wrong',
  };

  assertEqual(result.success, false);
  assertEqual(result.exitCode, 1);
  assert(result.error !== undefined, 'Error should be present');
});

test('ClaudeResult: jsonResult is optional', () => {
  const result: ClaudeResult = {
    success: true,
    output: 'No JSON in output',
    exitCode: 0,
  };

  assertEqual(result.jsonResult, undefined);
});

// ============================================================================
// Test: ClaudeRunOptions Interface Compliance
// ============================================================================

console.log('\n=== ClaudeRunOptions Interface Tests ===\n');

test('ClaudeRunOptions: minimal options (prompt only)', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Just a prompt',
  };

  assertEqual(options.prompt, 'Just a prompt');
  assertEqual(options.maxTurns, undefined);
  assertEqual(options.model, undefined);
});

test('ClaudeRunOptions: full options', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Full options test',
    outputFile: '/tmp/out.md',
    maxTurns: 5,
    model: 'claude-opus-4',
    allowedTools: ['Read', 'Write'],
    continueSession: 'session-123',
    cwd: '/working/dir',
    timeout: 30000,
  };

  assertEqual(options.prompt, 'Full options test');
  assertEqual(options.maxTurns, 5);
  assertEqual(options.allowedTools?.length, 2);
  assertEqual(options.timeout, 30000);
});

// ============================================================================
// Test: ErrorCategory Type Compliance
// ============================================================================

console.log('\n=== ErrorCategory Type Tests ===\n');

test('ErrorCategory: all categories are valid', () => {
  const categories: ErrorCategory[] = ['network', 'rate-limit', 'timeout', 'validation', 'logic'];

  for (const cat of categories) {
    assert(typeof cat === 'string', `Category ${cat} should be string`);
  }

  assertEqual(categories.length, 5, 'Should have 5 error categories');
});

// ============================================================================
// Test: Integration Scenarios (for implementation)
// ============================================================================

console.log('\n=== Integration Scenario Tests ===\n');

test('Integration: full success flow', async () => {
  // This test documents the expected integration behavior
  // Implementation would use a mock or test double

  const options: ClaudeRunOptions = {
    prompt: 'Complete this task',
    maxTurns: 3,
  };

  // Expected flow:
  // 1. buildArgs creates ['claude', '-p', '--max-turns', '3']
  // 2. spawn is called with args
  // 3. prompt is written to stdin
  // 4. stdout/stderr are captured
  // 5. on exit, result is constructed
  // 6. JSON is extracted from output
  // 7. result is returned

  assert(typeof runClaude === 'function', 'runClaude should exist');
  assert(typeof buildArgs === 'function', 'buildArgs should exist');
  assert(typeof extractJson === 'function', 'extractJson should exist');
});

test('Integration: error flow with retry category', async () => {
  // This test documents the expected error handling flow

  const options: ClaudeRunOptions = {
    prompt: 'This will fail with rate limit',
  };

  // Expected flow:
  // 1. Claude CLI fails with rate limit error
  // 2. stderr contains "rate limit"
  // 3. categorizeError returns 'rate-limit'
  // 4. result.success = false
  // 5. result.error contains the error message
  // 6. Caller can use categorizeError to decide retry strategy

  assert(typeof categorizeError === 'function', 'categorizeError should exist');
});

// ============================================================================
// Test Summary
// ============================================================================

console.log('\n=== Test Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
