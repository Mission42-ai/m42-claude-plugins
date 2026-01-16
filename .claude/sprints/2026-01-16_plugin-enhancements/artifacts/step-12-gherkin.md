# Gherkin Scenarios: step-12

## Step Task
Track D - Step 5: Implement Improved Error Recovery

Add automatic retry with backoff and smart failure detection.

Requirements:
- Implement automatic retry with configurable exponential backoff (1s, 5s, 30s)
- Add retry configuration to SPRINT.yaml:
  ```yaml
  retry:
    maxAttempts: 3
    backoffMs: [1000, 5000, 30000]
    retryOn: [network, rate-limit, timeout]
  ```
- Classify errors into categories:
  - network: Connection failures, DNS issues
  - rate-limit: API rate limiting (429 errors)
  - timeout: Execution timeout exceeded
  - validation: Schema/input validation failures
  - logic: Claude reasoning/execution errors
- Implement recovery strategies per error type:
  - network/rate-limit/timeout: Auto-retry with backoff
  - validation: Log and skip (or block for human review)
  - logic: Capture context and queue for human intervention
- Preserve partial completion on failure (don't lose work)
- Add "intervention queue" for unrecoverable errors
- Display retry status in phase cards (attempt 2/3, next retry in Xs)
- Add manual "Force Retry" button that bypasses backoff

Files to modify:
- scripts/sprint-loop.sh (retry logic)
- compiler/src/compiler.ts (retry config parsing)
- compiler/src/status-server/page.ts (retry status UI)

New files:
- compiler/src/error-classifier.ts (error classification logic)

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Error classifier module exists
```gherkin
Scenario: Error classifier module exists with required exports
  Given the project structure is set up
  When I check for the error classifier module
  Then compiler/src/error-classifier.ts exists with classification functions

Verification: `test -f /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/error-classifier.ts && grep -q "export.*function classifyError\|export.*const classifyError\|export { classifyError" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/error-classifier.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Error classifier handles all error categories
```gherkin
Scenario: Error classifier categorizes errors correctly
  Given compiler/src/error-classifier.ts exists
  When I check for error category constants
  Then all five error categories are defined (network, rate-limit, timeout, validation, logic)

Verification: `grep -q "network" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/error-classifier.ts && grep -q "rate-limit" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/error-classifier.ts && grep -q "timeout" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/error-classifier.ts && grep -q "validation" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/error-classifier.ts && grep -q "logic" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/error-classifier.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Compiler parses retry configuration
```gherkin
Scenario: Compiler parses retry config from SPRINT.yaml
  Given compiler/src/compile.ts exists
  When I check for retry configuration parsing
  Then retry config handling is present in the compiler

Verification: `grep -qE "retry|maxAttempts|backoffMs|retryOn" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/compile.ts || grep -qE "retry|maxAttempts|backoffMs|retryOn" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Sprint loop implements retry with exponential backoff
```gherkin
Scenario: Sprint loop has exponential backoff retry logic
  Given scripts/sprint-loop.sh exists
  When I check for backoff implementation
  Then exponential backoff logic is present

Verification: `grep -qE "backoff|BACKOFF" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/scripts/sprint-loop.sh && grep -qE "sleep.*\[|backoffMs|1000.*5000.*30000" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Sprint loop classifies errors and applies recovery strategies
```gherkin
Scenario: Sprint loop uses error classification for recovery
  Given scripts/sprint-loop.sh exists
  When I check for error classification integration
  Then error classification determines retry behavior

Verification: `grep -qE "classify|error.*type|error.*category|retryable|ERROR_TYPE" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/scripts/sprint-loop.sh && grep -qE "intervention|human.*queue|needs-human" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Status page displays retry status in phase cards
```gherkin
Scenario: Status page shows retry attempt and countdown
  Given compiler/src/status-server/page.ts exists
  When I check for retry status UI elements
  Then retry attempt counter and countdown are rendered

Verification: `grep -qE "retry.*attempt|attempt.*[0-9]|retry-count|retryCount" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts && grep -qE "next.*retry|countdown|retry.*in.*[0-9]" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Force Retry button exists and bypasses backoff
```gherkin
Scenario: Force Retry button is implemented
  Given compiler/src/status-server/page.ts exists
  When I check for force retry button
  Then force retry button with immediate retry action exists

Verification: `grep -qEi "force.*retry|retry.*force" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts && grep -qEi "force.*retry.*btn|retry.*button|forceRetry" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: TypeScript compiles without errors
```gherkin
Scenario: Error classifier and updated modules compile cleanly
  Given all implementation files exist
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build 2>&1 | tail -1 | grep -v "error"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scoring Summary
| Scenario | Description | Pass Criteria |
|----------|-------------|---------------|
| 1 | Error classifier module exists | File exists + exports classifyError |
| 2 | All error categories defined | All 5 categories present |
| 3 | Compiler parses retry config | Retry config in compiler/types |
| 4 | Exponential backoff logic | Backoff array and sleep logic |
| 5 | Error classification integration | Classify + intervention queue |
| 6 | Retry status UI | Attempt counter + countdown |
| 7 | Force Retry button | Button + action handler |
| 8 | TypeScript compiles | Clean build |

**Total Required: 8/8**
