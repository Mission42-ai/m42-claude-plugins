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
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Parse transcript script exists
  Given the plugin structure is set up
  When I check for the parse-transcript script
  Then plugins/m42-signs/scripts/parse-transcript.sh exists

Verification: `test -f plugins/m42-signs/scripts/parse-transcript.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Parse transcript script is executable
  Given the parse-transcript.sh script exists
  When I check its permissions
  Then the script has executable permission

Verification: `test -x plugins/m42-signs/scripts/parse-transcript.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Parse transcript script handles missing file argument
  Given the parse-transcript.sh script is executable
  When I run the script without arguments
  Then it exits with non-zero status and shows usage

Verification: `plugins/m42-signs/scripts/parse-transcript.sh 2>&1 | grep -qi "usage\|error\|required"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Parse transcript script handles non-existent file
  Given the parse-transcript.sh script is executable
  When I run the script with a non-existent file path
  Then it exits with non-zero status

Verification: `! plugins/m42-signs/scripts/parse-transcript.sh /nonexistent/file.jsonl 2>/dev/null`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Parse transcript outputs valid JSON
  Given a session transcript file exists in ~/.claude/projects/
  When I run parse-transcript.sh on any session file
  Then the output is valid JSON (array or objects)

Verification: `SESSION_FILE=$(find ~/.claude/projects/ -name "*.jsonl" -type f 2>/dev/null | head -1); test -n "$SESSION_FILE" && plugins/m42-signs/scripts/parse-transcript.sh "$SESSION_FILE" 2>/dev/null | jq -e '.' >/dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Reference file exists with frontmatter
  Given the skill structure is set up
  When I check for the transcript-format reference
  Then skills/managing-signs/references/transcript-format.md exists with frontmatter

Verification: `test -f plugins/m42-signs/skills/managing-signs/references/transcript-format.md && head -1 plugins/m42-signs/skills/managing-signs/references/transcript-format.md | grep -q "^---$"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Reference file has required frontmatter fields
  Given transcript-format.md exists
  When I check the frontmatter content
  Then it contains title, description, and skill fields

Verification: `head -20 plugins/m42-signs/skills/managing-signs/references/transcript-format.md | grep -q "^title:" && head -20 plugins/m42-signs/skills/managing-signs/references/transcript-format.md | grep -q "^description:" && head -20 plugins/m42-signs/skills/managing-signs/references/transcript-format.md | grep -q "^skill: managing-signs"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
