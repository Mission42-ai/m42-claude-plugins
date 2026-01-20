# Step Context: step-4

## Task
Test the complete large transcript handling workflow.

Test using the actual large transcript:
`.claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl`

Verify:
1. All 3 scripts execute without errors
2. Scripts reduce file size as expected
3. Extract command detects large transcript
4. Preprocessing artifacts are created
5. Full extraction completes successfully

Fix any issues discovered during testing.

## Implementation Plan
Based on gherkin scenarios, implement in this order:
1. Run each preprocessing script to verify execution (Scenarios 1-3)
2. Validate output size reduction (Scenario 4)
3. Verify summary accuracy (Scenario 5)
4. Check extract.md command documentation (Scenarios 6-7)
5. Test end-to-end artifact creation (Scenario 8)

## Test Transcript Details

| Property | Value |
|----------|-------|
| Path | `.claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl` |
| Line count | 169 lines |
| Status | Above 100-line threshold |

Alternative test transcript (if needed):
- `.claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl` (82 lines, ~200KB)

## Related Code Patterns

### Pattern from: plugins/m42-signs/scripts/extract-reasoning.sh
```bash
#!/bin/bash
set -euo pipefail

FILE="${1:-}"
# Validation...

# Extract assistant text blocks with meaningful content (>50 chars)
jq -c '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "text" and .text != null and (.text | length) > 50) |
  {text: .text}
' "$FILE"
```

### Pattern from: plugins/m42-signs/scripts/transcript-summary.sh
```bash
# Generate summary statistics using slurp mode
jq -s '
{
  total_lines: length,
  assistant_messages: [.[] | select(.type == "assistant")] | length,
  text_blocks: [...] | length,
  error_count: [...] | length,
  tool_sequence: [...]
}
' "$FILE"
```

### Pattern from: plugins/m42-signs/scripts/find-learning-lines.sh
```bash
# Find learning patterns and output snippets (max 150 chars, max 30 lines)
jq -c '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "text") |
  select(.text | test("I notice|I see that|This means|..."; "i")) |
  {snippet: (.text | .[0:150])}
' "$FILE" | head -30
```

## Required Imports
### Internal
- None (shell scripts)

### External
- `jq`: JSON processor for all transcript parsing
- `wc`: Line counting (standard)
- `stat`: File size detection (standard)
- `head`: Output limiting (standard)
- `split`: Chunk creation (standard)

## Types/Interfaces to Use

### Transcript JSONL Schema (from extract.md)
```json
// assistant message with learning-worthy content
{
  "type": "assistant",
  "message": {
    "content": [
      {"type": "text", "text": "reasoning text..."},
      {"type": "tool_use", "id": "toolu_xxx", "name": "Read", "input": {...}}
    ]
  }
}
```

### Script Output Schemas

**extract-reasoning.sh output** (JSONL):
```json
{"text": "extracted reasoning text..."}
```

**transcript-summary.sh output** (JSON):
```json
{
  "total_lines": 169,
  "assistant_messages": 45,
  "text_blocks": 67,
  "error_count": 3,
  "tool_sequence": ["Read", "Bash", "Write", ...]
}
```

**find-learning-lines.sh output** (JSONL):
```json
{"snippet": "I notice that... (truncated to 150 chars)"}
```

## Integration Points
- **Called by**: `plugins/m42-signs/commands/extract.md` (during large transcript preprocessing)
- **Calls**: Standard Unix tools (jq, wc, stat, head, split)
- **Subagent**: `plugins/m42-signs/agents/chunk-analyzer.md` (for parallel mode)

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| Scripts (3) | Verify | Confirm execution without errors |
| extract.md | Verify | Confirm documentation is present |
| Test artifacts | Create | Temporary files for verification |

## Gherkin Verification Commands

### Scenario 1: extract-reasoning.sh executes
```bash
plugins/m42-signs/scripts/extract-reasoning.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl >/dev/null 2>&1 && echo "PASS" || echo "FAIL"
```

### Scenario 2: transcript-summary.sh executes
```bash
plugins/m42-signs/scripts/transcript-summary.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl | jq -e '.total_lines' >/dev/null 2>&1 && echo "PASS" || echo "FAIL"
```

### Scenario 3: find-learning-lines.sh executes
```bash
plugins/m42-signs/scripts/find-learning-lines.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl 2>/dev/null; test $? -eq 0 && echo "PASS" || echo "FAIL"
```

### Scenario 4: Size reduction (expect <85 lines from 169)
```bash
OUTPUT_LINES=$(plugins/m42-signs/scripts/extract-reasoning.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl 2>/dev/null | wc -l)
test "$OUTPUT_LINES" -lt 85 && test "$OUTPUT_LINES" -gt 0 && echo "PASS" || echo "FAIL"
```

### Scenario 5: Summary reports correct line count
```bash
TOTAL=$(plugins/m42-signs/scripts/transcript-summary.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl 2>/dev/null | jq -r '.total_lines')
test "$TOTAL" -eq 169 && echo "PASS" || echo "FAIL"
```

### Scenario 6: extract.md has size detection
```bash
grep -q "wc -l" plugins/m42-signs/commands/extract.md && grep -q "stat" plugins/m42-signs/commands/extract.md && grep -q "100" plugins/m42-signs/commands/extract.md && echo "PASS" || echo "FAIL"
```

### Scenario 7: extract.md has Large Transcript Handling section
```bash
grep -q "## Large Transcript Handling" plugins/m42-signs/commands/extract.md && grep -q "transcript-summary.sh" plugins/m42-signs/commands/extract.md && grep -q "extract-reasoning.sh" plugins/m42-signs/commands/extract.md && grep -q "find-learning-lines.sh" plugins/m42-signs/commands/extract.md && echo "PASS" || echo "FAIL"
```

### Scenario 8: Artifact creation works
```bash
plugins/m42-signs/scripts/extract-reasoning.sh .claude/sprints/2026-01-19_m42-signs-large-transcript-handling/transcripts/development-step-0-qa.jsonl > /tmp/reasoning-test-$$.jsonl 2>/dev/null
LINES=$(wc -l < /tmp/reasoning-test-$$.jsonl)
test -f /tmp/reasoning-test-$$.jsonl && test "$LINES" -gt 0 && test "$LINES" -lt 169 && rm -f /tmp/reasoning-test-$$.jsonl && echo "PASS" || echo "FAIL"
```

## Key Testing Notes

1. **Script location**: All scripts are in `plugins/m42-signs/scripts/`
2. **Execution**: Scripts need execute permission (`chmod +x` if missing)
3. **Dependencies**: All scripts require `jq` to be installed
4. **Output**: Scripts output to stdout; errors to stderr
5. **Exit codes**: Scripts use standard exit codes (0 = success, non-zero = error)

## Expected Outcomes

| Scenario | Expected Result |
|----------|-----------------|
| 1 | exit 0, JSONL output with `{text: ...}` objects |
| 2 | exit 0, valid JSON with required fields |
| 3 | exit 0, JSONL output (may be empty if no patterns found) |
| 4 | Output lines < 85 (at least 2x reduction) |
| 5 | `total_lines` = 169 |
| 6 | All grep patterns match in extract.md |
| 7 | All documentation patterns present |
| 8 | Temp file created, has content, fewer lines than input |
