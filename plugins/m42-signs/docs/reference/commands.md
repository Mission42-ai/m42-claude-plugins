# Commands Reference

Complete reference for all M42-Signs commands.

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `/m42-signs:add` | Add a sign manually |
| `/m42-signs:list` | List all signs in backlog |
| `/m42-signs:status` | Show backlog summary |
| `/m42-signs:extract` | Extract from session transcript |
| `/m42-signs:review` | Interactive review flow |
| `/m42-signs:apply` | Apply approved signs |
| `/m42-signs:help` | Show help information |

---

## /m42-signs:add

Add a learning sign manually.

**Usage:**
```bash
/m42-signs:add [--direct] [title]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `--direct` | No | Skip interactive prompts |
| `title` | No | Sign title (interactive if omitted) |

**Examples:**
```bash
# Interactive mode
/m42-signs:add

# Direct mode with all fields
/m42-signs:add --direct "Title" "Problem" "Solution" "./CLAUDE.md"
```

---

## /m42-signs:list

List all signs in the backlog.

**Usage:**
```bash
/m42-signs:list [--format json]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `--format` | No | Output format (table or json) |

---

## /m42-signs:status

Show backlog summary.

**Usage:**
```bash
/m42-signs:status
```

**Output:**
- Total signs count
- Count by status (pending, approved, applied, rejected)
- Backlog file location

---

## /m42-signs:extract

Extract learnings from session transcript.

**Usage:**
```bash
/m42-signs:extract <session-id|path> [--dry-run]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `session-id` | Yes | Session ID or path to transcript |
| `--dry-run` | No | Preview without adding to backlog |

---

## /m42-signs:review

Interactive review of pending signs.

**Usage:**
```bash
/m42-signs:review [--approve-all-high]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `--approve-all-high` | No | Auto-approve high confidence signs |

---

## /m42-signs:apply

Apply approved signs to CLAUDE.md files.

**Usage:**
```bash
/m42-signs:apply [--dry-run] [--commit]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `--dry-run` | No | Preview without writing files |
| `--commit` | No | Create git commit after applying |

---

## /m42-signs:help

Show help information.

**Usage:**
```bash
/m42-signs:help
```

---

[Back to Getting Started](../getting-started.md)
