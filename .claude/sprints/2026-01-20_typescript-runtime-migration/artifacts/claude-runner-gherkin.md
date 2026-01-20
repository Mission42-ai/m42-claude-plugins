# Gherkin Scenarios: claude-runner

## Step Task
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
- plugins/m42-sprint/runtime/src/claude-runner.test.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Successful Run Returns Output
```gherkin
Scenario: Successful Claude CLI invocation returns output
  Given a Claude CLI that will succeed
  When runClaude is called with a prompt "Hello, world"
  Then the result success should be true
  And the result output should contain the Claude response
  And the result exitCode should be 0

Verification: `cd plugins/m42-sprint/runtime && node dist/claude-runner.test.js 2>&1 | grep -q "✓ runClaude: successful run returns output"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: JSON Extraction from Output
```gherkin
Scenario: Extract JSON from Claude output markdown blocks
  Given Claude CLI output containing a json code block
  When extractJson is called with the output
  Then the JSON content should be parsed and returned
  And non-JSON content outside the block should be ignored

Verification: `cd plugins/m42-sprint/runtime && node dist/claude-runner.test.js 2>&1 | grep -q "✓ extractJson: extracts JSON from markdown code block"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Exit Code Captured
```gherkin
Scenario: Exit code is captured from Claude process
  Given a Claude CLI that exits with code 1
  When runClaude is called
  Then the result exitCode should be 1
  And the result success should be false

Verification: `cd plugins/m42-sprint/runtime && node dist/claude-runner.test.js 2>&1 | grep -q "✓ runClaude: non-zero exit code sets success false"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Rate Limit Error Detection
```gherkin
Scenario: Detect rate limit errors in output
  Given Claude CLI output containing "rate limit" or "429"
  When categorizeError is called
  Then the category should be "rate-limit"

Verification: `cd plugins/m42-sprint/runtime && node dist/claude-runner.test.js 2>&1 | grep -q "✓ categorizeError: detects rate-limit errors"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Network Error Detection
```gherkin
Scenario: Detect network errors in output
  Given Claude CLI output containing "ECONNREFUSED" or "network error"
  When categorizeError is called
  Then the category should be "network"

Verification: `cd plugins/m42-sprint/runtime && node dist/claude-runner.test.js 2>&1 | grep -q "✓ categorizeError: detects network errors"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Timeout Error Detection
```gherkin
Scenario: Detect timeout errors
  Given a Claude CLI that times out
  When runClaude is called with a timeout
  Then the result success should be false
  And the result error should indicate timeout
  And categorizeError should return "timeout"

Verification: `cd plugins/m42-sprint/runtime && node dist/claude-runner.test.js 2>&1 | grep -q "✓ categorizeError: detects timeout errors"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: CLI Arguments Built Correctly
```gherkin
Scenario: Build correct CLI arguments from options
  Given ClaudeRunOptions with maxTurns, model, and allowedTools
  When buildArgs is called
  Then the arguments should include --max-turns with value
  And the arguments should include --model with value
  And the arguments should include --allowedTools for each tool

Verification: `cd plugins/m42-sprint/runtime && node dist/claude-runner.test.js 2>&1 | grep -q "✓ buildArgs: includes all specified options"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Continue Session Option
```gherkin
Scenario: Continue previous Claude session
  Given ClaudeRunOptions with continueSession set
  When buildArgs is called
  Then the arguments should include --continue with session ID

Verification: `cd plugins/m42-sprint/runtime && node dist/claude-runner.test.js 2>&1 | grep -q "✓ buildArgs: includes continue session flag"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Unit Test Coverage
| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| claude-runner.test.ts | 20+ | 1, 2, 3, 4, 5, 6, 7, 8 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/runtime && npm run build && npm test
# Expected: FAIL (no implementation yet)
# Error: Cannot find module './claude-runner.js'
```
