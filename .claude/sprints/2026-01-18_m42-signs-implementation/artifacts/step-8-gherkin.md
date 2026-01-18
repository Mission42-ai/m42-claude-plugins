# Gherkin Scenarios: step-8

## Step Task
## Phase 3.2: Apply Command

Implement /m42-signs:apply command:

### Tasks
1. Create commands/apply.md:
   - Proper frontmatter (description, allowed-tools, model)
   - Load backlog, filter to status: approved
   - Group learnings by target CLAUDE.md
   - For each target:
     - Read or create CLAUDE.md
     - Find or create ## Signs section
     - Append formatted learning entry
     - Update backlog: status -> applied
   - Output summary of applied changes

2. Create skills/managing-signs/references/claude-md-format.md:
   - Proper frontmatter (title, description, skill: managing-signs)
   - Document sign format
   - Show examples with proper structure
   - Explain origin tracking
   - Keep LLM-dense

3. Add options:
   - --commit: create git commit after applying
   - --dry-run: show what would be changed
   - --targets: apply only to specific CLAUDE.md files

### Success Criteria
- CLAUDE.md files are properly formatted
- Signs section is clearly delimited
- Applied learnings are removed from pending


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Apply Command File Exists
  Given the step implementation is complete
  When I check for the apply command file
  Then plugins/m42-signs/commands/apply.md exists

Verification: `test -f plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Apply Command Has Valid Frontmatter
  Given plugins/m42-signs/commands/apply.md exists
  When I check the frontmatter structure
  Then it contains description, allowed-tools, and model fields

Verification: `grep -q "^---" plugins/m42-signs/commands/apply.md && grep -q "description:" plugins/m42-signs/commands/apply.md && grep -q "allowed-tools:" plugins/m42-signs/commands/apply.md && grep -q "model:" plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Apply Command Supports Required Options
  Given plugins/m42-signs/commands/apply.md exists
  When I check for option documentation
  Then --dry-run, --commit, and --targets options are documented

Verification: `grep -q "\-\-dry-run" plugins/m42-signs/commands/apply.md && grep -q "\-\-commit" plugins/m42-signs/commands/apply.md && grep -q "\-\-targets" plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Claude-MD Format Reference Exists
  Given the step implementation is complete
  When I check for the format reference file
  Then plugins/m42-signs/skills/managing-signs/references/claude-md-format.md exists

Verification: `test -f plugins/m42-signs/skills/managing-signs/references/claude-md-format.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Claude-MD Format Reference Has Valid Frontmatter
  Given plugins/m42-signs/skills/managing-signs/references/claude-md-format.md exists
  When I check the frontmatter structure
  Then it contains title, description, and skill fields

Verification: `grep -q "^---" plugins/m42-signs/skills/managing-signs/references/claude-md-format.md && grep -q "title:" plugins/m42-signs/skills/managing-signs/references/claude-md-format.md && grep -q "description:" plugins/m42-signs/skills/managing-signs/references/claude-md-format.md && grep -q "skill:" plugins/m42-signs/skills/managing-signs/references/claude-md-format.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Apply Command Documents Status Transition
  Given plugins/m42-signs/commands/apply.md exists
  When I check for status transition documentation
  Then the command documents updating status to 'applied'

Verification: `grep -q "applied" plugins/m42-signs/commands/apply.md && grep -qE "(status.*applied|approved.*applied)" plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
