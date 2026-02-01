---
description: Show m42-signs plugin help and available commands
model: haiku
---

# M42 Signs Plugin Help

Please explain the following to the user:

## What is Signs?

The M42 Signs plugin implements a **learning loop** for Claude Code. It captures learnings from errors and successful recoveries, storing them as "signs" in CLAUDE.md files throughout your codebase.

**Core concept - The Learning Loop:**
```
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │   CAPTURE → EXTRACT → BACKLOG → REVIEW → APPLY             │
  │      ↑                                       │              │
  │      │         Errors become signs           │              │
  │      └───────────────────────────────────────┘              │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

Signs are contextually injected into Claude's context when working in relevant directories, helping prevent repeat mistakes and encoding team knowledge permanently.

## Available Commands

### Manual Sign Management

| Command | Description |
|---------|-------------|
| `/m42-signs:add [--direct]` | Add a learning sign manually |
| `/m42-signs:list [--format json]` | List all signs across CLAUDE.md files |
| `/m42-signs:status` | Show backlog status and pending items |
| `/m42-signs:help` | Show this help message |

### Extraction & Processing

| Command | Description |
|---------|-------------|
| `/m42-signs:extract <session-id>` | Extract learnings from session transcript |
| `/m42-signs:review` | Interactive review of pending learnings |
| `/m42-signs:apply [--commit]` | Apply approved learnings to CLAUDE.md files |

## Quick Start

### Add a Learning Manually

```
# Add to backlog for review
/m42-signs:add

# Add directly to CLAUDE.md (skip backlog)
/m42-signs:add --direct
```

### Extract from Session

```
# Extract learnings from a session
/m42-signs:extract abc123def

# Check what was extracted
/m42-signs:status

# Review and approve/reject
/m42-signs:review

# Apply approved learnings
/m42-signs:apply --commit
```

### View Current Signs

```
# List all signs in project
/m42-signs:list

# Get JSON output for tooling
/m42-signs:list --format json
```

## Workflow

### 1. Capture (Automatic or Manual)

Learnings come from two sources:
- **Automatic**: `/extract` parses session transcripts for error→retry→success patterns
- **Manual**: `/add` lets you record learnings as you work

### 2. Backlog (Staging Area)

Extracted learnings go to `.claude/learnings/backlog.yaml`:
- Each learning has `pending` status initially
- Includes problem, solution, target CLAUDE.md, confidence

### 3. Review (Human Decision)

Use `/review` to approve, reject, or edit learnings:
- Approve: Mark for application
- Reject: Remove from backlog
- Edit: Modify before approving

### 4. Apply (Write to CLAUDE.md)

Use `/apply` to write approved learnings as signs:
- Signs added to `## Signs` section in target CLAUDE.md
- Optional `--commit` creates git commit
- Status changes to `applied`

## Sign Format

Signs are stored in CLAUDE.md files under a `## Signs` section:

```markdown
## Signs (Accumulated Learnings)

### Quote Variables in yq Expressions
**Problem**: yq fails silently when variables aren't quoted
**Solution**: Wrap expressions in single quotes with explicit expansion
**Origin**: session-abc123
```

## File Locations

| File | Purpose |
|------|---------|
| `.claude/learnings/backlog.yaml` | Pending learnings for review |
| `**/CLAUDE.md` | Sign storage (contextually injected) |
| `~/.claude/projects/*/` | Session transcripts for extraction |

## Tips

- Start with `/add --direct` for one-off learnings
- Use `/extract` after sessions with many errors
- Signs in nested CLAUDE.md files are contextual (only loaded in that subtree)
- Keep signs focused: one problem, one solution
- Review confidence levels: `high` means verified pattern
