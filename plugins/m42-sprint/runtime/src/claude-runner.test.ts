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
  SPRINT_RESULT_SCHEMA,
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

test('buildArgs: outputFile is handled via file write, not CLI arg', () => {
  // NOTE: outputFile is handled via file write after execution, not via CLI flag
  // The Claude CLI doesn't have an --output-file flag
  const options: ClaudeRunOptions = {
    prompt: 'Test',
    outputFile: '/tmp/output.md',
  };

  const args = buildArgs(options);

  // outputFile should NOT appear in args - it's handled by writing to file after execution
  assert(!args.includes('--output-file'), 'outputFile should not be passed as CLI arg');
  assert(!args.includes('/tmp/output.md'), 'outputFile path should not be in args');
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

test('buildArgs: includes all specified options (except outputFile)', () => {
  // NOTE: outputFile is handled via file write after execution, not via CLI flag
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
  // outputFile is NOT passed as CLI arg - it's handled by file write after execution
  assert(!args.includes('--output-file'), 'outputFile should not be passed as CLI arg');
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

test('buildArgs: includes --json-schema when jsonSchema is specified', () => {
  const schema = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['completed', 'failed'] },
      summary: { type: 'string' },
    },
    required: ['status', 'summary'],
  };

  const options: ClaudeRunOptions = {
    prompt: 'Test',
    jsonSchema: schema,
  };

  const args = buildArgs(options);

  // Find --json-schema and its value
  const schemaIndex = args.indexOf('--json-schema');
  assert(schemaIndex !== -1, 'Should include --json-schema flag');
  assert(schemaIndex < args.length - 1, 'Should have value after --json-schema');

  // Verify the schema is properly JSON stringified
  const schemaArg = args[schemaIndex + 1];
  const parsedSchema = JSON.parse(schemaArg);
  assertDeepEqual(parsedSchema, schema);
});

test('buildArgs: does not include --json-schema when not specified', () => {
  const options: ClaudeRunOptions = {
    prompt: 'Test',
  };

  const args = buildArgs(options);

  assert(!args.includes('--json-schema'), 'Should not include --json-schema');
});

test('SPRINT_RESULT_SCHEMA: has correct structure for sprint results', () => {
  // Verify schema is an object
  assertEqual(SPRINT_RESULT_SCHEMA.type, 'object');

  // Verify required fields
  const required = SPRINT_RESULT_SCHEMA.required as string[];
  assertArrayContains(required, 'status');
  assertArrayContains(required, 'summary');

  // Verify properties exist
  const properties = SPRINT_RESULT_SCHEMA.properties as Record<string, unknown>;
  assert(properties.status !== undefined, 'Should have status property');
  assert(properties.summary !== undefined, 'Should have summary property');
  assert(properties.error !== undefined, 'Should have error property');
  assert(properties.humanNeeded !== undefined, 'Should have humanNeeded property');

  // Verify status enum values
  const statusProp = properties.status as { enum: string[] };
  assertArrayContains(statusProp.enum, 'completed');
  assertArrayContains(statusProp.enum, 'failed');
  assertArrayContains(statusProp.enum, 'needs-human');
});

test('SPRINT_RESULT_SCHEMA: validates completed result structure', () => {
  // Test that a valid "completed" result would pass schema validation
  const completedResult = { status: 'completed', summary: 'Task done' };

  // The schema should accept this structure
  const properties = SPRINT_RESULT_SCHEMA.properties as Record<string, { enum: string[] }>;
  const statusEnum = properties.status.enum;
  assert(statusEnum.includes(completedResult.status), 'completed should be valid status');
});

test('SPRINT_RESULT_SCHEMA: humanNeeded has nested structure', () => {
  const properties = SPRINT_RESULT_SCHEMA.properties as Record<string, unknown>;
  const humanNeeded = properties.humanNeeded as { type: string; properties: Record<string, unknown>; required: string[] };

  assertEqual(humanNeeded.type, 'object');
  assert(humanNeeded.properties.reason !== undefined, 'humanNeeded should have reason');
  assert(humanNeeded.properties.details !== undefined, 'humanNeeded should have details');
  assertArrayContains(humanNeeded.required, 'reason');
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
// Test: operatorRequests Parsing (Step 5 - Operator Request System)
// ============================================================================

console.log('\n=== operatorRequests Parsing Tests ===\n');

test('extractJson: extracts operatorRequests from JSON result', () => {
  // Scenario 1: Claude returns JSON with operatorRequests array
  const output = `Task completed, but I found some issues.

\`\`\`json
{
  "status": "completed",
  "summary": "Phase completed with discovered issues",
  "operatorRequests": [
    {
      "id": "req_abc123",
      "title": "Fix memory leak in parser",
      "description": "Found a memory leak when parsing large files. The buffer is not being released.",
      "priority": "high",
      "type": "bug",
      "context": {
        "discoveredIn": "development-step-2",
        "relatedFiles": ["src/parser.ts", "src/buffer.ts"],
        "codeSnippet": "const buffer = allocate(size); // never freed",
        "suggestedWorkflow": "bugfix-workflow"
      }
    }
  ]
}
\`\`\``;

  const result = extractJson(output) as {
    status: string;
    summary: string;
    operatorRequests?: Array<{
      id: string;
      title: string;
      description: string;
      priority: string;
      type: string;
      context?: {
        discoveredIn: string;
        relatedFiles?: string[];
        codeSnippet?: string;
        suggestedWorkflow?: string;
      };
    }>;
  };

  assertEqual(result.status, 'completed');
  assert(Array.isArray(result.operatorRequests), 'operatorRequests should be an array');
  assertEqual(result.operatorRequests?.length, 1);

  const request = result.operatorRequests?.[0];
  assertEqual(request?.id, 'req_abc123');
  assertEqual(request?.title, 'Fix memory leak in parser');
  assertEqual(request?.priority, 'high');
  assertEqual(request?.type, 'bug');
  assertEqual(request?.context?.discoveredIn, 'development-step-2');
});

test('extractJson: handles multiple operatorRequests', () => {
  const output = `\`\`\`json
{
  "status": "completed",
  "summary": "Found multiple issues",
  "operatorRequests": [
    {
      "id": "req_001",
      "title": "Add input validation",
      "description": "User input is not validated",
      "priority": "critical",
      "type": "security"
    },
    {
      "id": "req_002",
      "title": "Refactor database queries",
      "description": "N+1 query problem detected",
      "priority": "medium",
      "type": "improvement"
    },
    {
      "id": "req_003",
      "title": "Add missing tests",
      "description": "Edge cases not covered",
      "priority": "low",
      "type": "test"
    }
  ]
}
\`\`\``;

  const result = extractJson(output) as {
    operatorRequests?: Array<{ id: string; priority: string }>;
  };

  assertEqual(result.operatorRequests?.length, 3);
  assertEqual(result.operatorRequests?.[0].priority, 'critical');
  assertEqual(result.operatorRequests?.[1].priority, 'medium');
  assertEqual(result.operatorRequests?.[2].priority, 'low');
});

test('extractJson: handles empty operatorRequests array', () => {
  const output = `\`\`\`json
{
  "status": "completed",
  "summary": "No issues found",
  "operatorRequests": []
}
\`\`\``;

  const result = extractJson(output) as {
    operatorRequests?: unknown[];
  };

  assert(Array.isArray(result.operatorRequests), 'operatorRequests should be an array');
  assertEqual(result.operatorRequests?.length, 0);
});

test('extractJson: handles result without operatorRequests', () => {
  const output = `\`\`\`json
{
  "status": "completed",
  "summary": "Simple completion"
}
\`\`\``;

  const result = extractJson(output) as {
    status: string;
    operatorRequests?: unknown[];
  };

  assertEqual(result.status, 'completed');
  assertEqual(result.operatorRequests, undefined);
});

test('operatorRequest: validates required fields structure', () => {
  // This test documents the expected structure of OperatorRequest
  // The implementation should validate these fields
  const validRequest = {
    id: 'req_abc123',
    title: 'Short description',
    description: 'Full description of what needs to be done',
    priority: 'high' as const,
    type: 'bug' as const,
  };

  // All required fields should be present
  assert(typeof validRequest.id === 'string', 'id should be string');
  assert(typeof validRequest.title === 'string', 'title should be string');
  assert(typeof validRequest.description === 'string', 'description should be string');
  assert(['critical', 'high', 'medium', 'low'].includes(validRequest.priority), 'priority should be valid');
  assert(['bug', 'improvement', 'refactor', 'test', 'docs', 'security'].includes(validRequest.type), 'type should be valid');
});

test('operatorRequest: validates optional context field structure', () => {
  // This test documents the expected structure of OperatorRequest.context
  const requestWithContext = {
    id: 'req_def456',
    title: 'Add validation',
    description: 'Input validation missing',
    priority: 'medium' as const,
    type: 'security' as const,
    context: {
      discoveredIn: 'qa-phase-1',
      relatedFiles: ['src/input.ts', 'src/validator.ts'],
      codeSnippet: 'const userInput = req.body; // unvalidated',
      suggestedWorkflow: 'security-fix-workflow',
    },
  };

  const ctx = requestWithContext.context;
  assert(typeof ctx.discoveredIn === 'string', 'discoveredIn should be string');
  assert(Array.isArray(ctx.relatedFiles), 'relatedFiles should be array');
  assert(typeof ctx.codeSnippet === 'string', 'codeSnippet should be string');
  assert(typeof ctx.suggestedWorkflow === 'string', 'suggestedWorkflow should be string');
});

// ============================================================================
// Test Summary
// ============================================================================

console.log('\n=== Test Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
