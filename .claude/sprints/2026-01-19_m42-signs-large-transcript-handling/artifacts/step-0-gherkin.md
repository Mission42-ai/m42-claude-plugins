# Gherkin Scenarios: step-0

## Step Task
Create preprocessing scripts for m42-signs plugin to handle large transcripts.

Create these 3 bash scripts in plugins/m42-signs/scripts/:

1. extract-reasoning.sh - Extract assistant text blocks using jq
2. transcript-summary.sh - Generate quick stats (line count, errors, tool sequence)
3. find-learning-lines.sh - Pattern-match high-value reasoning lines

All scripts should:
- Use jq for JSON processing
- Check for jq availability with clear error
- Follow the patterns in parse-transcript.sh (deprecated reference)
- Be executable (chmod +x)

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: extract-reasoning.sh exists and is executable

```gherkin
Scenario: extract-reasoning.sh exists and is executable
  Given the m42-signs plugin scripts directory exists
  When I check for extract-reasoning.sh
  Then the script file exists at plugins/m42-signs/scripts/extract-reasoning.sh
  And the script is executable
```

Verification: `test -x plugins/m42-signs/scripts/extract-reasoning.sh && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: extract-reasoning.sh checks for jq availability

```gherkin
Scenario: extract-reasoning.sh checks for jq availability
  Given extract-reasoning.sh exists
  When I examine the script contents
  Then it contains a check for jq command availability
  And it exits with error if jq is not found
```

Verification: `grep -q 'command -v jq' plugins/m42-signs/scripts/extract-reasoning.sh && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: extract-reasoning.sh outputs valid JSON lines with text objects

```gherkin
Scenario: extract-reasoning.sh outputs valid JSON lines with text objects
  Given extract-reasoning.sh exists and is executable
  And a valid JSONL transcript file exists
  When I run extract-reasoning.sh with the transcript
  Then the output is valid JSONL format
  And each line contains a "text" field
  And the output is smaller than the original file
```

Verification: `./plugins/m42-signs/scripts/extract-reasoning.sh .claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl 2>/dev/null | head -3 | jq -e '.text' > /dev/null && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: transcript-summary.sh exists and is executable

```gherkin
Scenario: transcript-summary.sh exists and is executable
  Given the m42-signs plugin scripts directory exists
  When I check for transcript-summary.sh
  Then the script file exists at plugins/m42-signs/scripts/transcript-summary.sh
  And the script is executable
```

Verification: `test -x plugins/m42-signs/scripts/transcript-summary.sh && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: transcript-summary.sh outputs required statistics fields

```gherkin
Scenario: transcript-summary.sh outputs required statistics fields
  Given transcript-summary.sh exists and is executable
  And a valid JSONL transcript file exists
  When I run transcript-summary.sh with the transcript
  Then the output is valid JSON
  And contains "total_lines" field with a number
  And contains "assistant_messages" field with a number
  And contains "text_blocks" field with a number
  And contains "error_count" field with a number
  And contains "tool_sequence" field with an array
```

Verification: `./plugins/m42-signs/scripts/transcript-summary.sh .claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl 2>/dev/null | jq -e '.total_lines and .assistant_messages and .text_blocks and .error_count and .tool_sequence' > /dev/null && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: find-learning-lines.sh exists and is executable

```gherkin
Scenario: find-learning-lines.sh exists and is executable
  Given the m42-signs plugin scripts directory exists
  When I check for find-learning-lines.sh
  Then the script file exists at plugins/m42-signs/scripts/find-learning-lines.sh
  And the script is executable
```

Verification: `test -x plugins/m42-signs/scripts/find-learning-lines.sh && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: find-learning-lines.sh outputs snippet objects matching learning patterns

```gherkin
Scenario: find-learning-lines.sh outputs snippet objects matching learning patterns
  Given find-learning-lines.sh exists and is executable
  And a valid JSONL transcript file exists with assistant reasoning
  When I run find-learning-lines.sh with the transcript
  Then the output is valid JSONL format
  And each line contains a "snippet" field
  And snippets are limited to 150 characters or less
```

Verification: `./plugins/m42-signs/scripts/find-learning-lines.sh .claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl 2>/dev/null | head -3 | jq -e '.snippet | length <= 150' > /dev/null && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: All scripts follow shell best practices (set -euo pipefail)

```gherkin
Scenario: All scripts follow shell best practices
  Given all three preprocessing scripts exist
  When I examine each script's header
  Then each script contains "set -euo pipefail"
  And each script has a shebang line "#!/bin/bash"
```

Verification: `for script in extract-reasoning.sh transcript-summary.sh find-learning-lines.sh; do grep -q 'set -euo pipefail' "plugins/m42-signs/scripts/$script" || exit 1; done && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Test Script Coverage

Since this sprint involves bash scripts (not TypeScript), tests are implemented as executable bash test scripts.

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| `tests/test-extract-reasoning.sh` | 4 | 1, 2, 3, 8 |
| `tests/test-transcript-summary.sh` | 3 | 4, 5, 8 |
| `tests/test-find-learning-lines.sh` | 3 | 6, 7, 8 |
| `tests/run-all-tests.sh` | aggregator | all |

## RED Phase Verification

Tests are expected to FAIL at this point because the implementation scripts don't exist yet:

```bash
# Individual verifications - all should FAIL:
test -x plugins/m42-signs/scripts/extract-reasoning.sh
# Expected: FAIL (exit code 1 - file doesn't exist)

test -x plugins/m42-signs/scripts/transcript-summary.sh
# Expected: FAIL (exit code 1 - file doesn't exist)

test -x plugins/m42-signs/scripts/find-learning-lines.sh
# Expected: FAIL (exit code 1 - file doesn't exist)

# Run all tests:
./tests/run-all-tests.sh
# Expected: 0/8 tests pass
```
