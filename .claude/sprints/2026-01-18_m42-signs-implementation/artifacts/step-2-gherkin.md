# Gherkin Scenarios: step-2

## Step Task
## Phase 1.3: Manual Sign Management Commands

Implement /add, /list, /status, /help commands.

NOTE: Command files go in commands/ with simple names.
The plugin namespace is auto-prepended, so:
- commands/add.md becomes /m42-signs:add
- commands/list.md becomes /m42-signs:list
- commands/status.md becomes /m42-signs:status
- commands/help.md becomes /m42-signs:help

### Tasks
1. Create commands/add.md:
   - Proper frontmatter (description, allowed-tools, model)
   - Interactive prompts for problem/solution/target
   - Support --direct flag to skip backlog
   - Add learning to backlog.yaml or CLAUDE.md directly
   - Validation of inputs

2. Create commands/list.md:
   - Find all CLAUDE.md files in project
   - Parse ## Signs sections
   - Display table: Location | Title | Origin
   - Support --format json option

3. Create commands/status.md:
   - Read .claude/learnings/backlog.yaml
   - Count by status (pending/approved/rejected/applied)
   - Show summary table
   - List pending learnings if any

4. Create commands/help.md:
   - Overview of all commands (as /m42-signs:<command>)
   - Usage examples
   - Workflow diagram

### Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Add command file exists with proper structure
  Given the plugin directory structure exists
  When I check for the add command file
  Then plugins/m42-signs/commands/add.md exists

Verification: `test -f plugins/m42-signs/commands/add.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Add command has valid frontmatter
  Given plugins/m42-signs/commands/add.md exists
  When I check the frontmatter structure
  Then it contains description, allowed-tools, and model fields

Verification: `head -20 plugins/m42-signs/commands/add.md | grep -q "^---" && head -20 plugins/m42-signs/commands/add.md | grep -qE "^description:" && head -20 plugins/m42-signs/commands/add.md | grep -qE "^allowed-tools:" && head -20 plugins/m42-signs/commands/add.md | grep -qE "^model:"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: List command file exists with proper structure
  Given the plugin directory structure exists
  When I check for the list command file
  Then plugins/m42-signs/commands/list.md exists with valid frontmatter

Verification: `test -f plugins/m42-signs/commands/list.md && head -20 plugins/m42-signs/commands/list.md | grep -q "^---" && head -20 plugins/m42-signs/commands/list.md | grep -qE "^description:"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Status command file exists with proper structure
  Given the plugin directory structure exists
  When I check for the status command file
  Then plugins/m42-signs/commands/status.md exists with valid frontmatter

Verification: `test -f plugins/m42-signs/commands/status.md && head -20 plugins/m42-signs/commands/status.md | grep -q "^---" && head -20 plugins/m42-signs/commands/status.md | grep -qE "^description:"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Help command file exists with proper structure
  Given the plugin directory structure exists
  When I check for the help command file
  Then plugins/m42-signs/commands/help.md exists with valid frontmatter

Verification: `test -f plugins/m42-signs/commands/help.md && head -20 plugins/m42-signs/commands/help.md | grep -q "^---" && head -20 plugins/m42-signs/commands/help.md | grep -qE "^description:"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Add command supports --direct flag documentation
  Given plugins/m42-signs/commands/add.md exists
  When I search for --direct flag handling
  Then the command documents the --direct flag for skipping backlog

Verification: `grep -q "\-\-direct" plugins/m42-signs/commands/add.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: List command supports --format json documentation
  Given plugins/m42-signs/commands/list.md exists
  When I search for --format option handling
  Then the command documents the --format json option

Verification: `grep -qE "\-\-format|json" plugins/m42-signs/commands/list.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Help command lists all m42-signs commands
  Given plugins/m42-signs/commands/help.md exists
  When I check for command documentation
  Then it references /add, /list, /status, and /apply commands

Verification: `grep -q "/m42-signs:add\|/add" plugins/m42-signs/commands/help.md && grep -q "/m42-signs:list\|/list" plugins/m42-signs/commands/help.md && grep -q "/m42-signs:status\|/status" plugins/m42-signs/commands/help.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Verification Summary

| Scenario | Description | Verification |
|----------|-------------|--------------|
| 1 | add.md exists | `test -f plugins/m42-signs/commands/add.md` |
| 2 | add.md has valid frontmatter | Check for ---, description, allowed-tools, model |
| 3 | list.md exists with frontmatter | File and frontmatter check |
| 4 | status.md exists with frontmatter | File and frontmatter check |
| 5 | help.md exists with frontmatter | File and frontmatter check |
| 6 | add.md documents --direct | grep for --direct |
| 7 | list.md documents --format json | grep for format/json |
| 8 | help.md lists commands | grep for command references |
