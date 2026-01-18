# Gherkin Scenarios: step-6

## Step Task
## Phase 2.4: Extraction Command

Implement /m42-signs:extract command:

### Tasks
1. Create commands/extract.md:
   - Proper frontmatter (description, allowed-tools, model)
   - Accept session ID or transcript file path
   - Find session file in ~/.claude/projects/ if ID given
   - Run parsing -> retry detection -> target inference pipeline
   - Generate learning entries in backlog format
   - Write to .claude/learnings/backlog.yaml (append mode)
   - Output summary of proposed learnings

2. Add options:
   - --dry-run: show what would be extracted
   - --confidence-min: filter by confidence level
   - --auto-approve: skip review for high-confidence

3. Handle edge cases:
   - No errors found -> "No learnings to extract"
   - Session file not found -> clear error
   - Malformed JSONL -> graceful failure

### Success Criteria
- Extract works with session ID and file path
- Proposed learnings are reasonable
- Backlog is properly updated


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Extract command file exists with proper structure
```gherkin
Scenario: Extract command file exists with proper structure
  Given the plugin structure is set up
  When I check for the extract command file
  Then plugins/m42-signs/commands/extract.md exists
```

Verification: `test -f plugins/m42-signs/commands/extract.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Extract command has required frontmatter fields
```gherkin
Scenario: Extract command has required frontmatter fields
  Given plugins/m42-signs/commands/extract.md exists
  When I check the frontmatter
  Then it contains allowed-tools, argument-hint, description, and model fields
```

Verification: `grep -q "^allowed-tools:" plugins/m42-signs/commands/extract.md && grep -q "^argument-hint:" plugins/m42-signs/commands/extract.md && grep -q "^description:" plugins/m42-signs/commands/extract.md && grep -q "^model:" plugins/m42-signs/commands/extract.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Extract command documents session ID input mode
```gherkin
Scenario: Extract command documents session ID input mode
  Given plugins/m42-signs/commands/extract.md exists
  When I check for session ID handling documentation
  Then the command describes finding session files in ~/.claude/projects/
```

Verification: `grep -qi "session.*id\|\.claude/projects\|session.*file" plugins/m42-signs/commands/extract.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Extract command documents --dry-run option
```gherkin
Scenario: Extract command documents --dry-run option
  Given plugins/m42-signs/commands/extract.md exists
  When I check for dry-run option documentation
  Then the --dry-run flag is documented
```

Verification: `grep -q "\-\-dry-run" plugins/m42-signs/commands/extract.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Extract command documents --confidence-min option
```gherkin
Scenario: Extract command documents --confidence-min option
  Given plugins/m42-signs/commands/extract.md exists
  When I check for confidence filter option documentation
  Then the --confidence-min flag is documented
```

Verification: `grep -q "\-\-confidence-min" plugins/m42-signs/commands/extract.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Extract command references pipeline scripts
```gherkin
Scenario: Extract command references pipeline scripts
  Given plugins/m42-signs/commands/extract.md exists
  When I check for pipeline script references
  Then the command references parse-transcript, find-retry-patterns, and infer-target scripts
```

Verification: `grep -q "parse-transcript" plugins/m42-signs/commands/extract.md && grep -q "find-retry-patterns\|retry.*pattern" plugins/m42-signs/commands/extract.md && grep -q "infer-target\|target.*infer" plugins/m42-signs/commands/extract.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Extract command handles edge cases
```gherkin
Scenario: Extract command handles edge cases
  Given plugins/m42-signs/commands/extract.md exists
  When I check for edge case handling documentation
  Then the command documents handling for no errors found, file not found, and malformed input
```

Verification: `grep -qi "no.*error\|no.*learning\|not.*found\|file.*not.*found\|malformed\|invalid\|graceful" plugins/m42-signs/commands/extract.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
