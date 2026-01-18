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

## Scenario 1: Find retry patterns script exists and is executable
Given the scripts directory structure is set up
When I check for the find-retry-patterns.sh script
Then plugins/m42-signs/scripts/find-retry-patterns.sh exists and is executable

Verification: `test -x plugins/m42-signs/scripts/find-retry-patterns.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Script accepts parsed transcript input
Given plugins/m42-signs/scripts/find-retry-patterns.sh exists
When I check its content for input handling
Then the script accepts a JSONL session file as input

Verification: `grep -qE '(SESSION_FILE|session.*jsonl|\$1.*jsonl)' plugins/m42-signs/scripts/find-retry-patterns.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Script detects error-retry-success sequences
Given plugins/m42-signs/scripts/find-retry-patterns.sh exists
When I check its content for retry pattern detection logic
Then the script identifies error followed by retry followed by success

Verification: `grep -qE '(retry|sequence|error.*success|is_error.*false)' plugins/m42-signs/scripts/find-retry-patterns.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Script extracts diff between attempts
Given plugins/m42-signs/scripts/find-retry-patterns.sh exists
When I check its content for diff extraction
Then the script compares inputs between error and success calls

Verification: `grep -qE '(diff|change|delta|compare|input.*input|before.*after)' plugins/m42-signs/scripts/find-retry-patterns.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Script groups patterns by tool type
Given plugins/m42-signs/scripts/find-retry-patterns.sh exists
When I check its content for tool type grouping
Then the script groups results by tool_name (Bash, Edit, etc.)

Verification: `grep -qE '(tool_name|tool_type|group.*tool|Bash|Edit|Read|Write)' plugins/m42-signs/scripts/find-retry-patterns.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Script implements common pattern heuristics
Given plugins/m42-signs/scripts/find-retry-patterns.sh exists
When I check its content for heuristic patterns
Then the script includes heuristics for common fixes (quoting, paths, permissions)

Verification: `grep -qE '(quot|escap|path|permission|syntax|heuristic|pattern)' plugins/m42-signs/scripts/find-retry-patterns.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Script includes confidence scoring
Given plugins/m42-signs/scripts/find-retry-patterns.sh exists
When I check its content for confidence scoring
Then the script assigns confidence levels (high/medium/low) to detected patterns

Verification: `grep -qE '(confidence|high|medium|low|score)' plugins/m42-signs/scripts/find-retry-patterns.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Script produces structured output
Given plugins/m42-signs/scripts/find-retry-patterns.sh exists
When I check its output format
Then the script outputs JSON with pattern details and confidence

Verification: `grep -qE '(--json|jq.*\{|"tool_name"|"confidence"|printf.*json)' plugins/m42-signs/scripts/find-retry-patterns.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
