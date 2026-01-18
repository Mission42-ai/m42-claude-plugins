# Backlog Format Reference

Complete schema and structure for the signs backlog file.

---

## Location

The backlog file is stored at:
```
.claude/learnings/backlog.yaml
```

This location is relative to the project root. The directory is created automatically when the first sign is added.

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

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | integer | Yes | Schema version (currently `1`). Used for future migrations. |
| `extracted-from` | string | No | Source identifier - session ID or sprint ID where learnings originated |
| `extracted-at` | string | No | ISO 8601 timestamp of when extraction occurred |
| `learnings` | array | Yes | List of learning entries (may be empty `[]`) |

---

## Learning Entry Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier in kebab-case format. Auto-generated from title if not provided. |
| `status` | enum | Current lifecycle state: `pending`, `approved`, `rejected`, or `applied` |
| `title` | string | Short description (recommended: 5-10 words). Appears as sign heading in CLAUDE.md. |
| `problem` | string | What went wrong. Supports multi-line YAML literal (`\|`) or folded (`>`) style. |
| `solution` | string | How to fix or avoid. Supports multi-line YAML literal (`\|`) or folded (`>`) style. |
| `target` | string | Path to destination CLAUDE.md file. Relative paths resolved from project root. |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `confidence` | enum | `medium` | Confidence level in the learning: `low`, `medium`, or `high` |
| `source` | object | `null` | Origin information when extracted from transcripts |

---

## Status Values

| Status | Description | Can Transition To |
|--------|-------------|-------------------|
| `pending` | Awaiting human review | `approved`, `rejected` |
| `approved` | Reviewed and ready to apply | `applied` |
| `rejected` | Not useful, won't be applied | (terminal state) |
| `applied` | Written to CLAUDE.md | (terminal state) |

### Status Transition Diagram

```
                    ┌──────────┐
                    │          │
    ┌───────────────►  pending ◄───────────────┐
    │               │          │               │
    │               └────┬─────┘               │
    │                    │                     │
    │         ┌──────────┴──────────┐          │
    │         │                     │          │
    │         ▼                     ▼          │
    │   ┌──────────┐          ┌──────────┐     │
    │   │          │          │          │     │
    │   │ approved │          │ rejected │     │
    │   │          │          │          │     │
    │   └────┬─────┘          └──────────┘     │
    │        │                                 │
    │        │ /apply                          │
    │        ▼                                 │
    │   ┌──────────┐                           │
    │   │          │                           │
    │   │ applied  │                           │
    │   │          │                           │
    │   └──────────┘                           │
    │                                          │
    │   New sign        Extracted sign         │
    └─ /add ────────────── /extract ───────────┘
```

### Transition Rules

- New signs from `/add` start as `pending`
- Extracted signs from `/extract` start as `pending` (or `approved` with `--auto-approve`)
- Only `pending` signs can be reviewed
- Only `approved` signs can be applied
- `rejected` and `applied` are terminal states (no further transitions)

---

## Confidence Levels

| Level | Description | Extraction Trigger |
|-------|-------------|-------------------|
| `low` | Single occurrence, unclear pattern | One-time error without retry |
| `medium` | Clear error with likely solution | Error with identifiable cause |
| `high` | Retry pattern with confirmed fix | Error followed by successful retry |

### Confidence Scoring Heuristics

When extracting from transcripts:
- **High**: Error → retry → success sequence detected
- **Medium**: Error with clear message and identifiable tool
- **Low**: Ambiguous error or unclear resolution

---

## Source Object

The `source` field captures origin information when learnings are extracted from session transcripts.

| Subfield | Type | Description |
|----------|------|-------------|
| `tool` | string | Name of the tool that produced the error (e.g., `Bash`, `Read`, `Write`) |
| `command` | string | The actual command or tool invocation that failed |
| `error` | string | Error message returned by the tool |
| `session` | string | (Optional) Session ID where this error occurred |
| `timestamp` | string | (Optional) ISO 8601 timestamp of the error |

### Source Example

```yaml
source:
  tool: Bash
  command: npm run build
  error: "error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'"
  session: abc123def
  timestamp: 2026-01-18T10:30:00Z
```

---

## ID Generation

Sign IDs are generated automatically using these rules:
1. Convert title to lowercase
2. Replace spaces with hyphens
3. Remove special characters
4. Truncate to 50 characters
5. Append suffix if duplicate exists

Example: "Use absolute paths with Read tool" → `use-absolute-paths-with-read-tool`

---

## Complete Example

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

  - id: check-file-exists-before-edit
    status: approved
    title: Check file exists before editing
    problem: |
      Edit tool fails if the file doesn't exist, requiring a switch
      to Write tool instead.
    solution: |
      Before using Edit, verify the file exists with Glob or Read.
      Use Write for new files, Edit for existing files.
    target: ./src/CLAUDE.md
    confidence: medium
    source:
      tool: Edit
      command: Edit("./new-file.ts", ...)
      error: "File does not exist"

  - id: npm-ci-in-docker
    status: applied
    title: Use npm ci instead of npm install in Docker
    problem: |
      npm install modifies package-lock.json in Docker builds,
      causing layer cache invalidation.
    solution: |
      Use npm ci for reproducible installs in CI/Docker environments.
    target: ./CLAUDE.md
    confidence: high
```

---

## See Also

- [Commands Reference](./commands.md) - All available commands
- [Sign Format Reference](./sign-format.md) - How signs appear in CLAUDE.md
- [Getting Started Guide](../getting-started.md) - Introduction and tutorials

---

[Back to Getting Started](../getting-started.md)
