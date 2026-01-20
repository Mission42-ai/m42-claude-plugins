# Gherkin Scenarios: step-4

## Step Task
Test the complete large transcript handling workflow.

Test using the actual large transcript:
.claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl

Verify:
1. All 3 scripts execute without errors
2. Scripts reduce file size as expected
3. Extract command detects large transcript
4. Preprocessing artifacts are created
5. Full extraction completes successfully

Fix any issues discovered during testing.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Test Transcript Reference

Using `.claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl`:
- 169 lines (exceeds 100 line threshold)
- ~189KB size

---

## Scenario 1: extract-reasoning.sh executes without errors
```gherkin
Scenario: extract-reasoning.sh runs successfully on large transcript
  Given a large transcript file exists at development-step-0-qa.jsonl
  And the transcript has 169 lines (above 100 line threshold)
  When running extract-reasoning.sh on the transcript
  Then the script should exit with code 0
  And output valid JSONL lines with {text: ...} objects

Verification: `plugins/m42-signs/scripts/extract-reasoning.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl >/dev/null 2>&1 && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: transcript-summary.sh executes without errors
```gherkin
Scenario: transcript-summary.sh generates valid summary JSON
  Given a large transcript file exists at development-step-0-qa.jsonl
  When running transcript-summary.sh on the transcript
  Then the script should exit with code 0
  And output valid JSON with total_lines, assistant_messages, text_blocks, error_count, tool_sequence

Verification: `plugins/m42-signs/scripts/transcript-summary.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl | jq -e '.total_lines and .assistant_messages and .text_blocks != null and .error_count != null and .tool_sequence' >/dev/null 2>&1 && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: find-learning-lines.sh executes without errors
```gherkin
Scenario: find-learning-lines.sh finds learning indicators
  Given a large transcript file exists at development-step-0-qa.jsonl
  When running find-learning-lines.sh on the transcript
  Then the script should exit with code 0
  And output JSONL lines with {snippet: ...} objects if learning patterns exist

Verification: `plugins/m42-signs/scripts/find-learning-lines.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl 2>/dev/null; test $? -eq 0 && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: extract-reasoning.sh reduces transcript size
```gherkin
Scenario: extract-reasoning.sh produces smaller output than input
  Given a large transcript file with 169 lines
  When running extract-reasoning.sh on the transcript
  Then the output should have fewer lines than the input
  And reduction should be at least 2x (output < 85 lines)

Verification: `OUTPUT_LINES=$(plugins/m42-signs/scripts/extract-reasoning.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl 2>/dev/null | wc -l); test "$OUTPUT_LINES" -lt 85 && test "$OUTPUT_LINES" -gt 0 && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: transcript-summary.sh reports correct line count
```gherkin
Scenario: transcript-summary.sh accurately counts lines
  Given a large transcript file with 169 lines
  When running transcript-summary.sh on the transcript
  Then the total_lines field should equal 169

Verification: `TOTAL=$(plugins/m42-signs/scripts/transcript-summary.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl 2>/dev/null | jq -r '.total_lines'); test "$TOTAL" -eq 169 && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: extract.md has size detection preflight check
```gherkin
Scenario: Extract command includes size detection in preflight
  Given the extract.md command file exists
  When reading the preflight checks section
  Then it should contain wc -l for line counting
  And contain stat command for file size
  And mention the 100 line threshold

Verification: `grep -q "wc -l" plugins/m42-signs/commands/extract.md && grep -q "stat" plugins/m42-signs/commands/extract.md && grep -q "100" plugins/m42-signs/commands/extract.md && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: extract.md has Large Transcript Handling section
```gherkin
Scenario: Extract command documents large transcript workflow
  Given the extract.md command file exists
  When reading the content
  Then it should have a "Large Transcript Handling" section
  And reference transcript-summary.sh
  And reference extract-reasoning.sh
  And reference find-learning-lines.sh

Verification: `grep -q "## Large Transcript Handling" plugins/m42-signs/commands/extract.md && grep -q "transcript-summary.sh" plugins/m42-signs/commands/extract.md && grep -q "extract-reasoning.sh" plugins/m42-signs/commands/extract.md && grep -q "find-learning-lines.sh" plugins/m42-signs/commands/extract.md && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Preprocessing artifacts can be created
```gherkin
Scenario: Preprocessing creates temporary reasoning file
  Given a large transcript file exists
  When running extract-reasoning.sh and redirecting output
  Then a temporary file should be created with valid JSONL content
  And the file should contain fewer lines than the original

Verification: `plugins/m42-signs/scripts/extract-reasoning.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl > /tmp/reasoning-test-$$.jsonl 2>/dev/null && test -f /tmp/reasoning-test-$$.jsonl && LINES=$(wc -l < /tmp/reasoning-test-$$.jsonl) && test "$LINES" -gt 0 && test "$LINES" -lt 169 && rm -f /tmp/reasoning-test-$$.jsonl && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Unit Test Coverage

Since this step involves bash scripts and markdown commands (not TypeScript), there are no traditional unit tests. The gherkin verification commands above serve as integration tests.

| Test Type | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| Script execution tests | 3 | 1, 2, 3 |
| Output validation tests | 2 | 4, 5 |
| Command documentation tests | 2 | 6, 7 |
| Artifact creation tests | 1 | 8 |

## RED Phase Verification

For step-4 integration testing, the RED phase is unique - the scripts and documentation should already exist from previous steps. The "RED" here means we define what must pass before proceeding to verify/fix.

Run verification script to check current state:

```bash
#!/bin/bash
# Run from repo root
echo "=== Step 4 RED Phase - Integration Test Definitions ==="
echo ""

TRANSCRIPT=".claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl"
SCORE=0
TOTAL=8

echo "Test transcript: $TRANSCRIPT"
echo "Lines: $(wc -l < "$TRANSCRIPT")"
echo ""

# Scenario 1
echo -n "Scenario 1 (extract-reasoning executes): "
if plugins/m42-signs/scripts/extract-reasoning.sh "$TRANSCRIPT" >/dev/null 2>&1; then
  echo "PASS"; ((SCORE++))
else
  echo "FAIL"
fi

# Scenario 2
echo -n "Scenario 2 (transcript-summary executes): "
if plugins/m42-signs/scripts/transcript-summary.sh "$TRANSCRIPT" | jq -e '.total_lines' >/dev/null 2>&1; then
  echo "PASS"; ((SCORE++))
else
  echo "FAIL"
fi

# Scenario 3
echo -n "Scenario 3 (find-learning-lines executes): "
if plugins/m42-signs/scripts/find-learning-lines.sh "$TRANSCRIPT" 2>/dev/null; test $? -eq 0; then
  echo "PASS"; ((SCORE++))
else
  echo "FAIL"
fi

# Scenario 4
echo -n "Scenario 4 (extract-reasoning reduces size): "
OUTPUT_LINES=$(plugins/m42-signs/scripts/extract-reasoning.sh "$TRANSCRIPT" 2>/dev/null | wc -l)
if test "$OUTPUT_LINES" -lt 85 && test "$OUTPUT_LINES" -gt 0; then
  echo "PASS ($OUTPUT_LINES lines)"; ((SCORE++))
else
  echo "FAIL ($OUTPUT_LINES lines)"
fi

# Scenario 5
echo -n "Scenario 5 (summary reports correct lines): "
TOTAL_LINES=$(plugins/m42-signs/scripts/transcript-summary.sh "$TRANSCRIPT" 2>/dev/null | jq -r '.total_lines')
if test "$TOTAL_LINES" -eq 169; then
  echo "PASS"; ((SCORE++))
else
  echo "FAIL (got $TOTAL_LINES, expected 169)"
fi

# Scenario 6
echo -n "Scenario 6 (extract.md has size detection): "
if grep -q "wc -l" plugins/m42-signs/commands/extract.md && grep -q "stat" plugins/m42-signs/commands/extract.md; then
  echo "PASS"; ((SCORE++))
else
  echo "FAIL"
fi

# Scenario 7
echo -n "Scenario 7 (extract.md has Large Transcript section): "
if grep -q "## Large Transcript Handling" plugins/m42-signs/commands/extract.md; then
  echo "PASS"; ((SCORE++))
else
  echo "FAIL"
fi

# Scenario 8
echo -n "Scenario 8 (artifacts can be created): "
TMP_FILE="/tmp/reasoning-test-$$.jsonl"
plugins/m42-signs/scripts/extract-reasoning.sh "$TRANSCRIPT" > "$TMP_FILE" 2>/dev/null
LINES=$(wc -l < "$TMP_FILE")
if test -f "$TMP_FILE" && test "$LINES" -gt 0 && test "$LINES" -lt 169; then
  rm -f "$TMP_FILE"
  echo "PASS"; ((SCORE++))
else
  rm -f "$TMP_FILE"
  echo "FAIL"
fi

echo ""
echo "=== Score: $SCORE/$TOTAL ==="
if test "$SCORE" -eq "$TOTAL"; then
  echo "All scenarios PASS - integration complete"
else
  echo "Some scenarios FAIL - proceed to GREEN phase to fix issues"
fi
```

## Integration Test Summary

This step verifies:

1. **Script Execution** (Scenarios 1-3): All preprocessing scripts run without errors
2. **Output Quality** (Scenarios 4-5): Scripts produce correct, reduced output
3. **Documentation** (Scenarios 6-7): Extract command is properly enhanced
4. **Workflow** (Scenario 8): End-to-end preprocessing artifact creation works

The GREEN phase will run these tests and fix any failing scenarios.
