# Gherkin Scenarios: step-3

## Step Task
## Phase 2.1: Transcript Parsing Logic

Implement session transcript parsing:

### Tasks
1. Create scripts/parse-transcript.sh:
   - Read JSONL session file
   - Extract all messages with is_error: true
   - Correlate tool_use with tool_result
   - Output: tool name, command/input, error message

2. Create skills/managing-signs/references/transcript-format.md:
   - Include proper frontmatter (title, description, skill: managing-signs)
   - Document all message types from SESSION-TRACKING.md
   - Include jq query examples
   - Explain correlation logic
   - Keep it LLM-dense (tables, code examples, no prose)

3. Test parsing with:
   - Find a real session file in ~/.claude/projects/
   - Run parse-transcript.sh
   - Verify error extraction works

### Success Criteria
- Script handles all message types
- Errors are correctly correlated with their tool calls
- Output is structured and parsable
- Reference file has frontmatter and is dense

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Parse transcript script exists and is executable
Given the scripts directory structure is set up
When I check for the parse-transcript.sh script
Then scripts/parse-transcript.sh exists and is executable

Verification: `test -x scripts/parse-transcript.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Script requires jq dependency
Given scripts/parse-transcript.sh exists
When I check its content for jq usage
Then the script uses jq for JSON parsing

Verification: `grep -q 'jq ' scripts/parse-transcript.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Script extracts is_error:true messages
Given scripts/parse-transcript.sh exists
When I check its content for error extraction logic
Then the script filters for is_error field

Verification: `grep -qE 'is_error|"is_error"' scripts/parse-transcript.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Script correlates tool_use with tool_result
Given scripts/parse-transcript.sh exists
When I check its content for correlation logic
Then the script handles tool_use_id for correlation

Verification: `grep -qE 'tool_use_id|sourceToolAssistantUUID' scripts/parse-transcript.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Script outputs structured data (JSON or TSV)
Given scripts/parse-transcript.sh exists
When I check its output format
Then the script produces parsable structured output

Verification: `grep -qE '(--output|\.tool_name|printf.*\\t|jq.*\{)' scripts/parse-transcript.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Reference file exists with proper frontmatter
Given the skills/managing-signs/references directory exists
When I check for transcript-format.md
Then the file has YAML frontmatter with title, description, and skill fields

Verification: `head -10 skills/managing-signs/references/transcript-format.md | grep -E '^(title:|description:|skill:)' | wc -l | grep -q '[3-9]'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Reference file documents message types
Given skills/managing-signs/references/transcript-format.md exists
When I check its content for message type documentation
Then it documents user, assistant, tool_use, and tool_result types

Verification: `grep -E '(type.*user|type.*assistant|tool_use|tool_result)' skills/managing-signs/references/transcript-format.md | wc -l | awk '{if ($1 >= 3) exit 0; else exit 1}'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Script runs successfully on real session file
Given scripts/parse-transcript.sh exists and is executable
When I run it on a real session file from ~/.claude/projects/
Then the script executes without error (exit code 0)

Verification: `SESSION=$(ls ~/.claude/projects/-home-konstantin-projects-m42-claude-plugins/*.jsonl 2>/dev/null | head -1) && [ -n "$SESSION" ] && scripts/parse-transcript.sh "$SESSION" >/dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
