# Gherkin Scenarios: step-2

## Step Task
Enhance extract.md command with large transcript handling workflow.

Modify: plugins/m42-signs/commands/extract.md

Add:
1. Size detection in preflight checks (after line 30)
2. New arguments: --preprocess-only, --parallel
3. Large Transcript Handling section with preprocessing workflow
4. Instructions for using chunk-analyzer subagent

The command should automatically detect large transcripts (>100 lines or >500KB)
and activate preprocessing mode.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Size detection in preflight checks
```gherkin
Scenario: Extract command includes transcript size detection in preflight checks
  Given plugins/m42-signs/commands/extract.md exists
  When the preflight checks section is examined
  Then it must include a check that uses "wc -l" for line count
  And it must include a check that uses "stat" for file size
```

Verification: `grep -A10 "## Preflight Checks" plugins/m42-signs/commands/extract.md | grep -q "wc -l" && grep -A15 "## Preflight Checks" plugins/m42-signs/commands/extract.md | grep -q "stat" && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Large transcript detection threshold documented
```gherkin
Scenario: Extract command documents large transcript thresholds
  Given plugins/m42-signs/commands/extract.md exists
  When the content is examined
  Then it must mention "100" (line threshold)
  And it must mention "500" (KB threshold)
  And it must mention "Large transcript" in context of detection
```

Verification: `grep -q "100.*line\|100 line" plugins/m42-signs/commands/extract.md && grep -q "500.*KB\|500KB" plugins/m42-signs/commands/extract.md && grep -qi "large transcript" plugins/m42-signs/commands/extract.md && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: --preprocess-only argument documented
```gherkin
Scenario: Extract command documents --preprocess-only argument
  Given plugins/m42-signs/commands/extract.md exists
  When the Arguments section is examined
  Then it must include "--preprocess-only" as a valid argument
  And it must explain its purpose (generate artifacts without LLM analysis)
```

Verification: `grep -q "\-\-preprocess-only" plugins/m42-signs/commands/extract.md && grep -A3 "\-\-preprocess-only" plugins/m42-signs/commands/extract.md | grep -qi "artifact\|preprocess\|without.*LLM\|without.*analysis" && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: --parallel argument documented
```gherkin
Scenario: Extract command documents --parallel argument
  Given plugins/m42-signs/commands/extract.md exists
  When the Arguments section is examined
  Then it must include "--parallel" as a valid argument
  And it must explain its purpose (parallel chunk processing)
```

Verification: `grep -q "\-\-parallel" plugins/m42-signs/commands/extract.md && grep -A3 "\-\-parallel" plugins/m42-signs/commands/extract.md | grep -qi "parallel\|chunk" && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Large Transcript Handling section exists
```gherkin
Scenario: Extract command has a dedicated Large Transcript Handling section
  Given plugins/m42-signs/commands/extract.md exists
  When the section headers are examined
  Then it must contain "## Large Transcript Handling" section
```

Verification: `grep -q "^## Large Transcript Handling" plugins/m42-signs/commands/extract.md && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Preprocessing script references included
```gherkin
Scenario: Large Transcript Handling references the preprocessing scripts
  Given plugins/m42-signs/commands/extract.md has Large Transcript Handling section
  When the section content is examined
  Then it must reference "transcript-summary.sh" script
  And it must reference "find-learning-lines.sh" script
  And it must reference "extract-reasoning.sh" script
```

Verification: `grep -q "transcript-summary.sh" plugins/m42-signs/commands/extract.md && grep -q "find-learning-lines.sh" plugins/m42-signs/commands/extract.md && grep -q "extract-reasoning.sh" plugins/m42-signs/commands/extract.md && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: chunk-analyzer subagent integration documented
```gherkin
Scenario: Extract command documents chunk-analyzer subagent usage
  Given plugins/m42-signs/commands/extract.md has Large Transcript Handling section
  When the section content is examined
  Then it must reference "chunk-analyzer" subagent
  And it must mention spawning or using Task() for parallel processing
```

Verification: `grep -qi "chunk-analyzer" plugins/m42-signs/commands/extract.md && grep -qi "Task\|spawn" plugins/m42-signs/commands/extract.md && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Chunking workflow documented
```gherkin
Scenario: Extract command documents the chunking workflow
  Given plugins/m42-signs/commands/extract.md has Large Transcript Handling section
  When the workflow steps are examined
  Then it must mention "split" for creating chunks
  And it must document chunk size (50 blocks)
  And it must document aggregating/deduplicating results
```

Verification: `grep -qi "split" plugins/m42-signs/commands/extract.md && grep -q "50" plugins/m42-signs/commands/extract.md && grep -qi "aggregate\|deduplicate\|combine" plugins/m42-signs/commands/extract.md && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Unit Test Coverage

Since this is a markdown command definition (not TypeScript), tests are shell-based verification scripts.

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| `tests/step-2-extract-command.sh` | 8 | 1, 2, 3, 4, 5, 6, 7, 8 |

## Test Script

```bash
#!/bin/bash
# Test script for extract.md command enhancements
# Location: tests/step-2-extract-command.sh

set -euo pipefail

COMMAND_PATH="plugins/m42-signs/commands/extract.md"
SCORE=0
TOTAL=8

echo "=== Testing extract.md Command Enhancements ==="
echo ""

# Scenario 1: Size detection in preflight checks
echo -n "Scenario 1: Size detection in preflight checks... "
if grep -A10 "## Preflight Checks" "$COMMAND_PATH" 2>/dev/null | grep -q "wc -l" && \
   grep -A15 "## Preflight Checks" "$COMMAND_PATH" | grep -q "stat"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 2: Large transcript detection threshold documented
echo -n "Scenario 2: Large transcript thresholds documented... "
if grep -q "100.*line\|100 line" "$COMMAND_PATH" 2>/dev/null && \
   grep -q "500.*KB\|500KB" "$COMMAND_PATH" && \
   grep -qi "large transcript" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 3: --preprocess-only argument documented
echo -n "Scenario 3: --preprocess-only argument documented... "
if grep -q "\-\-preprocess-only" "$COMMAND_PATH" 2>/dev/null && \
   grep -A3 "\-\-preprocess-only" "$COMMAND_PATH" | grep -qi "artifact\|preprocess\|without.*LLM\|without.*analysis"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 4: --parallel argument documented
echo -n "Scenario 4: --parallel argument documented... "
if grep -q "\-\-parallel" "$COMMAND_PATH" 2>/dev/null && \
   grep -A3 "\-\-parallel" "$COMMAND_PATH" | grep -qi "parallel\|chunk"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 5: Large Transcript Handling section exists
echo -n "Scenario 5: Large Transcript Handling section exists... "
if grep -q "^## Large Transcript Handling" "$COMMAND_PATH" 2>/dev/null; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 6: Preprocessing script references included
echo -n "Scenario 6: Preprocessing script references... "
if grep -q "transcript-summary.sh" "$COMMAND_PATH" 2>/dev/null && \
   grep -q "find-learning-lines.sh" "$COMMAND_PATH" && \
   grep -q "extract-reasoning.sh" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 7: chunk-analyzer subagent integration documented
echo -n "Scenario 7: chunk-analyzer subagent integration... "
if grep -qi "chunk-analyzer" "$COMMAND_PATH" 2>/dev/null && \
   grep -qi "Task\|spawn" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 8: Chunking workflow documented
echo -n "Scenario 8: Chunking workflow documented... "
if grep -qi "split" "$COMMAND_PATH" 2>/dev/null && \
   grep -q "50" "$COMMAND_PATH" && \
   grep -qi "aggregate\|deduplicate\|combine" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

echo ""
echo "=== Results: $SCORE/$TOTAL ==="

if [ "$SCORE" -eq "$TOTAL" ]; then
    echo "All scenarios PASSED"
    exit 0
else
    echo "Some scenarios FAILED"
    exit 1
fi
```

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
./tests/step-2-extract-command.sh
# Expected: FAIL (implementation not yet in extract.md)
```
