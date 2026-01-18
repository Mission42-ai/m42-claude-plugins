# Gherkin Scenarios: step-4

## Step Task
## Phase 2.2: Error Pattern Detection

Implement retry pattern identification:

### Tasks
1. Create scripts/find-retry-patterns.sh:
   - Input: parsed transcript with errors
   - Detect sequences: error -> retry -> success
   - Extract the diff (what changed between attempts)
   - Group by tool type (Bash, Edit, etc.)

2. Add heuristics for common patterns:
   - Command syntax fixes (quoting, escaping)
   - File path corrections
   - Permission/access fixes
   - API retry with rate limiting

3. Create confidence scoring:
   - High: Clear fix, obvious pattern
   - Medium: Plausible fix, moderate evidence
   - Low: Unclear if fix was causal

### Success Criteria
- Script detects at least 80% of retry patterns
- Confidence scores are reasonable
- False positives are < 20%

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Find retry patterns script exists
  Given the plugin structure is set up
  When I check for the find-retry-patterns script
  Then plugins/m42-signs/scripts/find-retry-patterns.sh exists

Verification: `test -f plugins/m42-signs/scripts/find-retry-patterns.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Find retry patterns script is executable
  Given the find-retry-patterns.sh script exists
  When I check its permissions
  Then the script has executable permission

Verification: `test -x plugins/m42-signs/scripts/find-retry-patterns.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Script handles missing transcript argument
  Given the find-retry-patterns.sh script is executable
  When I run the script without arguments
  Then it exits with non-zero status and shows usage

Verification: `plugins/m42-signs/scripts/find-retry-patterns.sh 2>&1 | grep -qi "usage\|error\|required"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Script handles non-existent file gracefully
  Given the find-retry-patterns.sh script is executable
  When I run the script with a non-existent file path
  Then it exits with non-zero status

Verification: `! plugins/m42-signs/scripts/find-retry-patterns.sh /nonexistent/file.jsonl 2>/dev/null`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Script outputs valid JSON structure
  Given a session transcript file exists in ~/.claude/projects/
  When I run find-retry-patterns.sh on any session file
  Then the output is valid JSON containing a patterns array

Verification: `SESSION_FILE=$(find ~/.claude/projects/ -name "*.jsonl" -type f 2>/dev/null | head -1); test -n "$SESSION_FILE" && plugins/m42-signs/scripts/find-retry-patterns.sh "$SESSION_FILE" 2>/dev/null | jq -e '.patterns | type == "array"' >/dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Output includes confidence scoring
  Given a session transcript file exists
  When I run find-retry-patterns.sh on a session file
  Then patterns include confidence field with valid values (low/medium/high)

Verification: `SESSION_FILE=$(find ~/.claude/projects/ -name "*.jsonl" -type f 2>/dev/null | head -1); test -n "$SESSION_FILE" && plugins/m42-signs/scripts/find-retry-patterns.sh "$SESSION_FILE" 2>/dev/null | jq -e 'if .patterns | length > 0 then .patterns[0].confidence | . == "low" or . == "medium" or . == "high" else true end' >/dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Output includes tool type grouping
  Given a session transcript file exists
  When I run find-retry-patterns.sh on a session file
  Then patterns include tool field identifying the tool type

Verification: `SESSION_FILE=$(find ~/.claude/projects/ -name "*.jsonl" -type f 2>/dev/null | head -1); test -n "$SESSION_FILE" && plugins/m42-signs/scripts/find-retry-patterns.sh "$SESSION_FILE" 2>/dev/null | jq -e 'if .patterns | length > 0 then .patterns[0] | has("tool") else true end' >/dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Output includes pattern type classification
  Given a session transcript file exists
  When I run find-retry-patterns.sh on a session file
  Then patterns include pattern_type field for categorization

Verification: `SESSION_FILE=$(find ~/.claude/projects/ -name "*.jsonl" -type f 2>/dev/null | head -1); test -n "$SESSION_FILE" && plugins/m42-signs/scripts/find-retry-patterns.sh "$SESSION_FILE" 2>/dev/null | jq -e 'if .patterns | length > 0 then .patterns[0] | has("pattern_type") else true end' >/dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
