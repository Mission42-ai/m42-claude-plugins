---
description: Show m42-signs plugin help and available commands
model: haiku
---

# M42 Signs Plugin Help

Please explain the following to the user:

## What is Signs?

The M42 Signs plugin implements the **Learning Loop** pattern for Claude Code agents.
It captures learnings from errors, retries, and corrections, then stores them as
"signs" in CLAUDE.md files where they're automatically injected into future sessions.

**Core concept:**
- When Claude makes mistakes and self-corrects, those learnings are captured
- Learnings go through a human review process (backlog → approve/reject)
- Approved learnings become "signs" stored in CLAUDE.md files
- Signs are automatically injected into context by Claude Code's native mechanism
- Future sessions benefit from accumulated project knowledge

## Available Commands

### Manual Sign Management

| Command | Description |
|---------|-------------|
| `/m42-signs:add [--direct]` | Add a learning manually to backlog or directly to CLAUDE.md |
| `/m42-signs:list [--format json]` | List all signs across CLAUDE.md files in project |
| `/m42-signs:status` | Show backlog status with counts by state |

### Automated Extraction

| Command | Description |
|---------|-------------|
| `/m42-signs:extract <session-id>` | Extract learnings from session transcript |

### Review & Apply

| Command | Description |
|---------|-------------|
| `/m42-signs:review` | Interactive review of pending learnings |
| `/m42-signs:apply [--commit]` | Apply approved learnings to CLAUDE.md files |

## Quick Start Example

```
# 1. Add a learning manually
/m42-signs:add
# (follow prompts for problem, solution, target)

# 2. Check backlog status
/m42-signs:status

# 3. Review pending learnings
/m42-signs:review

# 4. Apply approved learnings
/m42-signs:apply --commit

# 5. See all signs in project
/m42-signs:list
```

## Workflow Diagram

```
                    ┌──────────────────────┐
                    │   Session / Sprint   │
                    │  (errors, retries)   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │      /extract        │
                    │  Parse transcript    │
                    └──────────┬───────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
    ┌─────────┐         ┌─────────────┐        ┌─────────┐
    │  /add   │         │  backlog    │        │ /status │
    │ manual  │────────▶│  .yaml      │◀───────│ summary │
    └─────────┘         └──────┬──────┘        └─────────┘
                               │
                    ┌──────────▼───────────┐
                    │      /review         │
                    │  approve / reject    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │      /apply          │
                    │  Write to CLAUDE.md  │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │     ## Signs         │
                    │   in CLAUDE.md       │
                    │  (context injection) │
                    └──────────────────────┘
```

## Key Concepts

### Signs vs Learnings

- **Learning**: A captured pattern (problem + solution) in the backlog
- **Sign**: An approved learning written to a CLAUDE.md file

### Backlog

- Located at `.claude/learnings/backlog.yaml`
- Staging area for learnings before human review
- Each learning has: id, status, title, problem, solution, target, confidence

### Targets

- Each learning specifies a target CLAUDE.md file
- Target is inferred from file paths in the error context
- Can be overridden during review
- Signs go to the most contextually relevant location

### Confidence Levels

- **high**: Clear pattern, repeated occurrence, specific fix
- **medium**: Good pattern, but limited context
- **low**: Possible pattern, needs human validation

## Files

```
.claude/learnings/
  backlog.yaml        # Learning staging area

**/CLAUDE.md          # Sign storage locations
  ## Signs (Accumulated Learnings)
    ### Sign Title
    **Problem**: What went wrong
    **Solution**: How to fix/avoid
    **Origin**: Source reference
```

## Tips

- Start with `/m42-signs:add` to manually capture learnings
- Use `/m42-signs:status` to track backlog state
- Review learnings carefully - they persist in your codebase
- Signs in subdirectory CLAUDE.md files are more targeted
- Project root CLAUDE.md is the fallback for general learnings
