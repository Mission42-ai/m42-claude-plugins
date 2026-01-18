# Step Context: step-2

## Task
## Phase 1.3: Manual Sign Management Commands

Implement /add, /list, /status, /help commands.

NOTE: Command files go in commands/ with simple names.
The plugin namespace is auto-prepended, so:
- commands/add.md becomes /m42-signs:add
- commands/list.md becomes /m42-signs:list
- commands/status.md becomes /m42-signs:status
- commands/help.md becomes /m42-signs:help

### Tasks
1. Create commands/add.md - Manual learning entry with interactive prompts
2. Create commands/list.md - List signs across CLAUDE.md files
3. Create commands/status.md - Show backlog summary
4. Create commands/help.md - Plugin overview and usage

## Related Code Patterns

### Command Structure Pattern: m42-sprint/commands/add-step.md
```markdown
---
allowed-tools: Bash(ls:*), Read(*), Edit(*)
argument-hint: <step-prompt>
description: Add step to sprint SPRINT.yaml
model: sonnet
---

# Title

## Preflight Checks
!`ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

## Context
Using the sprint directory identified in preflight, use the Read tool to read...

## Task Instructions
Parse the argument `$ARGUMENTS` as the step prompt text.
1. Find the latest sprint directory from preflight output
2. Read SPRINT.yaml to get current steps array
...

## Success Criteria
- Step added to SPRINT.yaml steps array
- User sees confirmation with step position
```

### Help Command Pattern: m42-sprint/commands/help.md
```markdown
---
description: "Show sprint plugin help and available commands"
model: haiku
---

# M42 Sprint Plugin Help

Please explain the following to the user:

## What is Sprint?
[Description of plugin purpose]

## Available Commands
| Command | Description |
|---------|-------------|
| `/command-name` | What it does |
```

### Status Command Pattern: m42-sprint/commands/sprint-status.md
```markdown
---
allowed-tools: Bash(ls:*), Read(*)
argument-hint: ""
description: Show sprint progress dashboard
model: haiku
---

# Sprint Status Dashboard

## Preflight Checks
!`ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

## Context
Read relevant files...

## Task Instructions
1. Parse YAML for data
2. Calculate statistics
3. Display formatted output
4. Handle edge cases:
   - No data found: helpful message
   - Missing file: graceful fallback
```

## Required Imports
### Internal
- **managing-signs skill**: Backlog schema reference, templates
- **validate-backlog.sh**: For validating backlog structure

### External
- **yq**: YAML processing in shell commands
- **jq**: JSON processing (for --format json in list command)

## Types/Interfaces to Use

### Backlog Schema (from references/backlog-schema.md)
```yaml
version: 1
extracted-from: <session-id|sprint-id|null>
extracted-at: <ISO timestamp|null>

learnings:
  - id: kebab-case-id
    status: pending | approved | rejected | applied
    title: Short description
    problem: |
      Multi-line problem description
    solution: |
      Multi-line solution description
    target: path/to/CLAUDE.md
    confidence: low | medium | high
    source:  # optional
      tool: <tool name>
      command: <command>
      error: <error message>
```

### CLAUDE.md Sign Format
```markdown
## Signs (Accumulated Learnings)

### Sign Title
**Problem**: Description of what went wrong
**Solution**: How to fix/avoid
**Origin**: <source reference>
```

## Integration Points

### Called by
- User invokes `/m42-signs:add`, `/m42-signs:list`, `/m42-signs:status`, `/m42-signs:help`

### Calls/Uses
- Read tool for file access
- Edit tool for modifying backlog.yaml and CLAUDE.md
- Bash for file existence checks (ls, test)
- Glob for finding CLAUDE.md files
- Grep for parsing ## Signs sections

### Related Files
- `.claude/learnings/backlog.yaml` - Learning backlog storage
- `**/CLAUDE.md` - Sign storage locations
- `plugins/m42-signs/scripts/validate-backlog.sh` - Validation utility
- `plugins/m42-signs/skills/managing-signs/assets/backlog-template.yaml` - Empty backlog template

## Implementation Notes

### add.md Command
1. **Frontmatter**: allowed-tools needs Read, Edit, Write, Glob, Bash(test:*, mkdir:*)
2. **Interactive input**: Use direct prompting in task instructions (Claude natively handles this)
3. **--direct flag**: Check `$ARGUMENTS` for presence of `--direct`
4. **Backlog creation**: If .claude/learnings/backlog.yaml doesn't exist, create from template
5. **Target validation**: Warn if target CLAUDE.md doesn't exist (but allow creation)
6. **ID generation**: Auto-generate kebab-case ID from title

### list.md Command
1. **Find all CLAUDE.md files**: Use Glob with `**/CLAUDE.md`
2. **Parse Signs sections**: Regex for `### <Title>` under `## Signs`
3. **Extract Origin**: Parse `**Origin**: ` line
4. **--format json**: Check $ARGUMENTS, output array of objects
5. **Table format**: Default output with Location | Title | Origin columns

### status.md Command
1. **Graceful handling**: If no backlog.yaml exists, show "No backlog found" message
2. **Count by status**: Use yq to count each status value
3. **Show pending list**: If pending count > 0, list them briefly
4. **Actionable next steps**: Suggest /m42-signs:review if pending, /m42-signs:apply if approved

### help.md Command
1. **No allowed-tools needed**: Pure documentation output
2. **List all commands**: /m42-signs:add, /m42-signs:list, /m42-signs:status, /m42-signs:extract, /m42-signs:review, /m42-signs:apply
3. **Workflow diagram**: ASCII art showing capture → backlog → review → apply flow
4. **Usage examples**: Concrete examples for each command

### Common Patterns
- Preflight checks use `!` backtick syntax
- Handle missing files gracefully (exit codes, echo fallbacks)
- Use haiku model for simple read-only commands
- Use sonnet model for commands that modify files
- Output clear success criteria for each command
