---
allowed-tools: Bash(test:*, mkdir:*), Read(*), Edit(*), Write(*), Glob(*)
argument-hint: [--direct] [<title>]
description: Add a new learning sign to backlog or directly to CLAUDE.md
model: sonnet
---

# Add Learning Sign

Add a new learning entry either to the backlog for review, or directly to a CLAUDE.md file.

## Preflight Checks

1. Check if learnings directory exists:
   !`test -d .claude/learnings && echo "EXISTS" || echo "NOT_EXISTS"`

2. If directory doesn't exist, it will be created when needed.

## Context

Read the backlog template for reference:
- `plugins/m42-signs/skills/managing-signs/assets/backlog-template.yaml`

If backlog exists, read it:
- `.claude/learnings/backlog.yaml`

## Task Instructions

Parse `$ARGUMENTS` for:
- `--direct` flag: If present, add sign directly to target CLAUDE.md (skip backlog)
- Optional `<title>`: Pre-provided title for the learning

### Interactive Input

If information is missing, prompt the user for:

1. **Title**: Short description of the learning (if not in arguments)
2. **Problem**: What went wrong or what issue was encountered
3. **Solution**: How to fix or avoid this issue
4. **Target**: Path to CLAUDE.md where this sign should live (default: `./CLAUDE.md`)
5. **Confidence**: How confident are you this is a valid pattern? (low/medium/high, default: medium)

### Validation

- Title must be non-empty and descriptive
- Problem must explain what went wrong
- Solution must explain how to fix/avoid
- Target must be a valid path ending in `CLAUDE.md`
- If target doesn't exist, warn user but allow (file will be created on apply)

### Generate ID

Convert title to kebab-case ID:
- Lowercase
- Replace spaces with hyphens
- Remove special characters
- Truncate to 50 chars max

### Add to Backlog (default)

If `--direct` is NOT specified:

1. Create `.claude/learnings/` directory if it doesn't exist:
   ```bash
   mkdir -p .claude/learnings
   ```

2. If `.claude/learnings/backlog.yaml` doesn't exist, create it from template:
   ```yaml
   version: 1
   extracted-from: manual
   extracted-at: <current ISO timestamp>
   learnings: []
   ```

3. Append new learning entry:
   ```yaml
   - id: <generated-id>
     status: pending
     title: <title>
     problem: |
       <problem>
     solution: |
       <solution>
     target: <target-path>
     confidence: <confidence>
     source:
       tool: manual
       command: "/m42-signs:add"
       error: null
   ```

4. Report success with learning ID and remind user to run `/m42-signs:review`

### Add Directly (--direct flag)

If `--direct` IS specified:

1. Read the target CLAUDE.md file (or prepare to create it)
2. Find or create the `## Signs (Accumulated Learnings)` section
3. Add the new sign in format:
   ```markdown
   ### <Title>
   **Problem**: <problem>
   **Solution**: <solution>
   **Origin**: Manual entry via /m42-signs:add
   ```
4. Report success with file path

## Success Criteria

- Learning added to backlog.yaml OR target CLAUDE.md
- User sees confirmation with:
  - Generated learning ID
  - Target file path
  - Next steps (/m42-signs:review for backlog, or "Sign applied" for --direct)
- Backlog.yaml passes validation if updated
