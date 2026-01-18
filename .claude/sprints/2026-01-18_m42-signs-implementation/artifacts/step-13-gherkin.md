# Gherkin Scenarios: step-13

## Step Task
## Phase 5.3: Reference Documentation

Create comprehensive reference docs:

### Tasks
1. Create docs/reference/commands.md:
   - All commands with full syntax
   - All options/flags documented
   - Examples for each command
   - Common errors and solutions

2. Create docs/reference/backlog-format.md:
   - Complete YAML schema
   - All fields explained
   - Status transitions
   - Example entries

3. Create docs/reference/sign-format.md:
   - How signs appear in CLAUDE.md
   - Formatting conventions
   - Origin tracking explained

### Success Criteria
- Reference is comprehensive
- Easy to find specific information
- Code examples are copy-pasteable

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Commands reference file exists
```gherkin
Scenario: Commands reference file exists
  Given the docs/reference directory structure
  When I check for the commands reference file
  Then docs/reference/commands.md exists

Verification: `test -f plugins/m42-signs/docs/reference/commands.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Commands reference documents all commands
```gherkin
Scenario: Commands reference documents all commands
  Given docs/reference/commands.md exists
  When I check for documentation of all seven commands
  Then each command (add, list, status, extract, review, apply, help) is documented

Verification: `grep -q "/m42-signs:add" plugins/m42-signs/docs/reference/commands.md && grep -q "/m42-signs:list" plugins/m42-signs/docs/reference/commands.md && grep -q "/m42-signs:status" plugins/m42-signs/docs/reference/commands.md && grep -q "/m42-signs:extract" plugins/m42-signs/docs/reference/commands.md && grep -q "/m42-signs:review" plugins/m42-signs/docs/reference/commands.md && grep -q "/m42-signs:apply" plugins/m42-signs/docs/reference/commands.md && grep -q "/m42-signs:help" plugins/m42-signs/docs/reference/commands.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Commands reference includes usage examples
```gherkin
Scenario: Commands reference includes usage examples
  Given docs/reference/commands.md exists
  When I check for code examples
  Then copy-pasteable bash examples are present

Verification: `grep -c '```bash' plugins/m42-signs/docs/reference/commands.md | awk '{exit ($1 >= 5 ? 0 : 1)}'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Backlog format reference file exists
```gherkin
Scenario: Backlog format reference file exists
  Given the docs/reference directory structure
  When I check for the backlog format reference file
  Then docs/reference/backlog-format.md exists

Verification: `test -f plugins/m42-signs/docs/reference/backlog-format.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Backlog format includes complete schema documentation
```gherkin
Scenario: Backlog format includes complete schema documentation
  Given docs/reference/backlog-format.md exists
  When I check for schema elements
  Then status values, fields, and examples are documented

Verification: `grep -q "status" plugins/m42-signs/docs/reference/backlog-format.md && grep -q "pending" plugins/m42-signs/docs/reference/backlog-format.md && grep -q "approved" plugins/m42-signs/docs/reference/backlog-format.md && grep -q "applied" plugins/m42-signs/docs/reference/backlog-format.md && grep -q "rejected" plugins/m42-signs/docs/reference/backlog-format.md && grep -q "confidence" plugins/m42-signs/docs/reference/backlog-format.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Sign format reference file exists
```gherkin
Scenario: Sign format reference file exists
  Given the docs/reference directory structure
  When I check for the sign format reference file
  Then docs/reference/sign-format.md exists

Verification: `test -f plugins/m42-signs/docs/reference/sign-format.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Sign format documents CLAUDE.md formatting conventions
```gherkin
Scenario: Sign format documents CLAUDE.md formatting conventions
  Given docs/reference/sign-format.md exists
  When I check for CLAUDE.md formatting documentation
  Then sign format, section structure, and origin tracking are documented

Verification: `grep -q "CLAUDE.md" plugins/m42-signs/docs/reference/sign-format.md && grep -q "Signs" plugins/m42-signs/docs/reference/sign-format.md && grep -q "Origin" plugins/m42-signs/docs/reference/sign-format.md && grep -q "Problem" plugins/m42-signs/docs/reference/sign-format.md && grep -q "Solution" plugins/m42-signs/docs/reference/sign-format.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```
