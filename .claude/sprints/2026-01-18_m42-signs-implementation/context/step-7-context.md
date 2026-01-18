# Step Context: step-7

## Task
## Phase 3.1: Interactive Review Command

Implement /m42-signs:review command:

### Tasks
1. Create commands/review.md:
   - Proper frontmatter (description, allowed-tools, model)
   - Load .claude/learnings/backlog.yaml
   - Filter to status: pending
   - For each learning:
     - Display: title, problem, solution, target, confidence
     - Show context (origin, source tool/error)
     - Prompt: [A]pprove / [R]eject / [E]dit / [S]kip / [Q]uit
   - Update status based on choice
   - Save changes after each decision

2. Add edit mode:
   - Allow editing title, problem, solution, target
   - Re-validate edited learning
   - Update confidence if significantly changed

3. Add batch operations:
   - --approve-all-high: auto-approve high confidence
   - --reject-all-low: auto-reject low confidence

### Success Criteria
- Interactive flow is intuitive
- Edits are validated before saving
- Batch operations are safe (with confirmation)


## Related Code Patterns

### Similar Implementation: plugins/m42-signs/commands/status.md
```markdown
---
allowed-tools: Bash(test:*, ls:*), Read(*)
argument-hint: ""
description: Show backlog status summary with counts by status
model: haiku
---

# Backlog Status

Display a summary of the learning backlog...

## Preflight Checks

1. Check if backlog file exists:
   !`test -f .claude/learnings/backlog.yaml && echo "EXISTS" || echo "NOT_EXISTS"`

## Context

Based on preflight output:
- If `EXISTS`: Read and parse the backlog file
- If `NOT_EXISTS`: Show helpful message about empty backlog
```

**Key pattern**: Check backlog existence first, handle empty state gracefully.

### Similar Implementation: plugins/m42-signs/commands/add.md
```markdown
---
allowed-tools: Bash(test:*, mkdir:*, ls:*), Read(*), Edit(*), Write(*), Glob(**/CLAUDE.md)
argument-hint: "[--direct] [title]"
description: Add a new learning sign manually to the backlog or directly to CLAUDE.md
model: sonnet
---

## Task Instructions

### 5. Handle Backlog Mode (default)

1. Ensure directory exists:
   mkdir -p .claude/learnings

2. If backlog.yaml doesn't exist, create it:
   version: 1
   extracted-from: null
   ...

3. Read current backlog.yaml

4. Append new learning entry

5. Write updated backlog.yaml
```

**Key pattern**: Read→Modify→Write workflow for backlog updates.

### Similar Implementation: plugins/m42-signs/commands/extract.md
```markdown
---
allowed-tools: Bash(test:*, mkdir:*, ls:*, find:*), Read(*), Write(*), Edit(*), Glob(*)
argument-hint: "<session-id|path> [--dry-run] [--confidence-min <level>] [--auto-approve]"
description: Extract learnings from session transcript to backlog
model: sonnet
---
```

**Key pattern**: Multi-flag argument parsing with `--flag-name` syntax.

## Required Imports
### Internal
- `plugins/m42-signs/scripts/validate-backlog.sh`: Re-validation after edits

### External
- `yq`: YAML reading and manipulation
- Built-in Read/Write/Edit tools

## Types/Interfaces to Use
```yaml
# From _shared-context.md - Backlog Schema
version: 1
extracted-from: <session-id or sprint-id>
extracted-at: <ISO timestamp>

learnings:
  - id: kebab-case-id
    status: pending | approved | rejected | applied
    title: Short description
    problem: |
      Multi-line description of what went wrong
    solution: |
      Multi-line description of how to fix/avoid
    target: path/to/CLAUDE.md
    confidence: low | medium | high
    source:
      tool: <tool name>
      command: <command that failed>
      error: <error message>
```

### Valid Status Values
- `pending`: Awaiting review (filter for these)
- `approved`: Ready to apply (set by [A]pprove)
- `rejected`: Will not be applied (set by [R]eject)
- `applied`: Already written to CLAUDE.md

### Valid Confidence Values
- `low`: Uncertain pattern
- `medium`: Likely pattern
- `high`: Verified pattern

## Integration Points
- Called by: User via `/m42-signs:review` command
- Calls:
  - Read tool for backlog.yaml
  - AskUserQuestion for interactive prompts
  - Edit/Write for updating backlog.yaml
  - validate-backlog.sh for re-validation after edits
- Tests: Manual verification via gherkin scenarios

## Implementation Notes

### Frontmatter Pattern
```yaml
---
allowed-tools: Bash(test:*, ls:*), Read(*), Edit(*), Write(*)
argument-hint: "[--approve-all-high] [--reject-all-low]"
description: Interactive review of pending learnings in backlog
model: sonnet
---
```

### Interactive Flow Pattern
Use AskUserQuestion tool with options for each learning:
1. Display learning details first
2. Present action choices: [A]pprove / [R]eject / [E]dit / [S]kip / [Q]uit
3. Process choice immediately
4. Save after each decision (not batched)
5. Move to next pending learning

### Edit Mode Pattern
When user selects [E]dit:
1. Present editable fields (title, problem, solution, target)
2. Collect changes via AskUserQuestion
3. Run validation: `plugins/m42-signs/scripts/validate-backlog.sh .claude/learnings/backlog.yaml`
4. If validation fails, show errors and re-prompt
5. If significantly changed (from script/auto extraction), consider lowering confidence to `medium`

### Batch Operations Pattern
For `--approve-all-high`:
1. Count high-confidence pending learnings
2. Show confirmation: "About to approve N high-confidence learnings. Continue? [Y/N]"
3. Only proceed on explicit confirmation
4. Update all matching entries status to `approved`

For `--reject-all-low`:
1. Count low-confidence pending learnings
2. Show confirmation: "About to reject N low-confidence learnings. Continue? [Y/N]"
3. Only proceed on explicit confirmation
4. Update all matching entries status to `rejected`

### YAML Manipulation with yq
```bash
# Count pending learnings
yq eval '[.learnings[] | select(.status == "pending")] | length' .claude/learnings/backlog.yaml

# Update status by id
yq eval -i '(.learnings[] | select(.id == "learning-id")).status = "approved"' .claude/learnings/backlog.yaml

# Update multiple fields
yq eval -i '
  (.learnings[] | select(.id == "learning-id")) |= (
    .title = "New Title" |
    .status = "approved"
  )
' .claude/learnings/backlog.yaml
```

### Display Format
```
## Learning: quote-variables-in-yq (1/3)

**Title**: Quote Variables in yq Expressions
**Confidence**: high
**Target**: scripts/CLAUDE.md

### Problem
yq fails silently when variables aren't quoted in expressions.
The output appears empty with no error message.

### Solution
Wrap expressions in single quotes with explicit expansion:
`yq eval '.key' "$FILE"` not `yq eval .key $FILE`

### Source
- Tool: Bash
- Command: yq eval .status PROGRESS.yaml
- Error: Output was empty

---
Actions: [A]pprove | [R]eject | [E]dit | [S]kip | [Q]uit
```

### Gherkin Verification Requirements
From artifacts/step-7-gherkin.md:
1. File must exist with required frontmatter (allowed-tools, description, model)
2. Must have argument-hint documenting --approve-all-high and --reject-all-low
3. Must document all interactive actions (Approve, Reject, Edit, Skip, Quit)
4. Must document display fields (title, problem, solution, target, confidence)
5. Must document status updates (pending → approved/rejected)
6. Must document edit mode with validation requirement
