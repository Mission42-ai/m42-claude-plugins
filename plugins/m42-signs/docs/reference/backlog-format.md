# Backlog Format Reference

Schema and structure for the signs backlog file.

---

## Location

The backlog file is stored at:
```
.claude/learnings/backlog.yaml
```

---

## Schema

```yaml
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

---

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | integer | Yes | Schema version (currently 1) |
| `extracted-from` | string | No | Source session or sprint ID |
| `extracted-at` | string | No | ISO 8601 timestamp |
| `learnings` | array | Yes | List of learning entries |

### Learning Entry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique kebab-case identifier |
| `status` | enum | Yes | pending, approved, rejected, applied |
| `title` | string | Yes | Short description |
| `problem` | string | Yes | What went wrong |
| `solution` | string | Yes | How to fix/avoid |
| `target` | string | Yes | Path to CLAUDE.md file |
| `confidence` | enum | No | low, medium, high |
| `source` | object | No | Origin information |

---

## Status Values

| Status | Description |
|--------|-------------|
| `pending` | Awaiting review |
| `approved` | Ready to apply |
| `rejected` | Not useful, will not apply |
| `applied` | Written to CLAUDE.md |

---

## Confidence Levels

| Level | Description |
|-------|-------------|
| `low` | Single occurrence, unclear pattern |
| `medium` | Clear error with likely solution |
| `high` | Retry pattern with confirmed fix |

---

## Example

```yaml
version: 1
extracted-from: session-abc123
extracted-at: 2026-01-18T10:30:00Z

learnings:
  - id: use-absolute-paths-read
    status: pending
    title: Use absolute paths with Read tool
    problem: |
      Read tool fails silently when given relative paths.
      This caused multiple retries before realizing the issue.
    solution: |
      Always convert relative paths to absolute before calling Read.
      Use path.resolve() or equivalent.
    target: ./CLAUDE.md
    confidence: high
    source:
      tool: Read
      command: Read("./src/index.ts")
      error: File not found
```

---

[Back to Getting Started](../getting-started.md)
