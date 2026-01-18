# How to Extract Signs from a Session

Automatically extract learnings from Claude session transcripts.

---

## Quick Start

```bash
# Find your session ID
ls ~/.claude/projects/$(pwd | sed 's/\//-/g')/

# Extract from that session
/m42-signs:extract <session-id>
```

---

## What Gets Extracted

The extraction process identifies:
- Tool errors (is_error: true)
- Retry patterns (error → success sequences)
- File path context

---

## Dry Run

Preview without adding to backlog:

```bash
/m42-signs:extract <session-id> --dry-run
```

---

## After Extraction

Review and apply the extracted signs:

```bash
/m42-signs:review
/m42-signs:apply
```

---

[Back to Getting Started](../getting-started.md)
