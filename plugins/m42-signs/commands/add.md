---
allowed-tools: Bash(test:*, mkdir:*, ls:*), Read(*), Edit(*), Write(*), Glob(**/CLAUDE.md)
argument-hint: "[--direct] [title]"
description: Add a new learning sign manually to the backlog or directly to CLAUDE.md
model: sonnet
---

# Add Learning Sign

Add a new learning sign manually. By default, adds to the backlog for review. Use `--direct` to write directly to CLAUDE.md.

## Preflight Checks

1. Check if backlog directory exists:
   !`test -d .claude/learnings && echo "EXISTS" || echo "NOT_EXISTS"`

2. Check if backlog file exists:
   !`test -f .claude/learnings/backlog.yaml && echo "EXISTS" || echo "NOT_EXISTS"`

## Context

Parse the argument `$ARGUMENTS` to determine:
- If `--direct` flag is present: write directly to target CLAUDE.md
- If title is provided: use as sign title
- Otherwise: prompt interactively for all fields

If backlog directory doesn't exist (NOT_EXISTS from preflight), you'll need to create it.

## Task Instructions

### 1. Parse Arguments

Check `$ARGUMENTS` for:
- `--direct` flag: If present, skip backlog and write to CLAUDE.md directly
- Any remaining text: Use as initial title (user can confirm/modify)

### 2. Gather Learning Details

Interactively collect:

1. **Title**: Short description (1 line, used as section header)
   - Ask: "What is a short title for this learning?"
   - Validate: Non-empty, reasonable length

2. **Problem**: What went wrong or what issue was encountered
   - Ask: "Describe the problem you encountered:"
   - Accept: Multi-line input

3. **Solution**: How to fix or avoid the issue
   - Ask: "Describe the solution or how to avoid this:"
   - Accept: Multi-line input

4. **Target**: Which CLAUDE.md should receive this sign
   - Ask: "Which CLAUDE.md should this sign be added to?"
   - Suggest: Use Glob to find existing CLAUDE.md files in project
   - Default: `CLAUDE.md` (project root)
   - Validate: Path ends in CLAUDE.md

5. **Confidence** (backlog only): How confident is this learning
   - Ask: "Confidence level? (low/medium/high)"
   - Default: `medium`

### 3. Generate ID

Create kebab-case ID from title:
- Lowercase
- Replace spaces with hyphens
- Remove special characters
- Truncate to ~50 chars
- Example: "Quote Variables in yq" → "quote-variables-in-yq"

### 4. Handle --direct Mode

If `--direct` flag was provided:

1. Read the target CLAUDE.md file (or note it doesn't exist)
2. Look for existing `## Signs` section
3. If section exists: Append new sign after existing signs
4. If section doesn't exist: Create it at end of file
5. Format sign as:
   ```markdown
   ### <Title>
   **Problem**: <problem description>
   **Solution**: <solution description>
   **Origin**: Manual addition via /m42-signs:add
   ```

### 5. Handle Backlog Mode (default)

If `--direct` flag was NOT provided:

1. Ensure directory exists:
   ```bash
   mkdir -p .claude/learnings
   ```

2. If backlog.yaml doesn't exist, create it:
   ```yaml
   version: 1
   extracted-from: null
   extracted-at: null

   learnings: []
   ```

3. Read current backlog.yaml

4. Append new learning entry:
   ```yaml
   - id: <generated-id>
     status: pending
     title: <title>
     problem: |
       <problem>
     solution: |
       <solution>
     target: <target-path>
     confidence: <low|medium|high>
     source:
       tool: manual
       command: /m42-signs:add
       error: null
   ```

5. Write updated backlog.yaml

## Success Criteria

- Learning details collected with validation
- For `--direct`: Sign written to target CLAUDE.md with proper formatting
- For backlog mode: Learning added to .claude/learnings/backlog.yaml with status `pending`
- User sees confirmation with:
  - ID assigned
  - Target location
  - Next steps (run `/m42-signs:review` for backlog items)
