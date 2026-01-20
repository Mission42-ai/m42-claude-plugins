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

## Finding Session IDs

Session transcripts are stored in `~/.claude/projects/<encoded-path>/`. The encoded path replaces `/` with `-`.

### List Available Sessions

```bash
# Compute your project's encoded path
PROJECT_PATH=$(pwd | sed 's|/|-|g')

# List sessions
ls -lt ~/.claude/projects/$PROJECT_PATH/*.jsonl | head -10
```

### Find Recent Sessions

The most recent session is typically the one you just finished:

```bash
ls -t ~/.claude/projects/$PROJECT_PATH/*.jsonl | head -1
```

### Session ID Format

Session files are named `<session-id>.jsonl`. The session ID is a UUID-style identifier:

```
a1b2c3d4-5678-90ab-cdef-1234567890ab.jsonl
```

---

## Running /m42-signs:extract

### Basic Extraction

```bash
/m42-signs:extract a1b2c3d4-5678-90ab-cdef-1234567890ab
```

This:
1. Parses the session transcript
2. Identifies tool errors
3. Detects retry patterns (error → success sequences)
4. Infers target CLAUDE.md files
5. Adds findings to backlog with confidence scores

### Extract from File Path

You can also provide a direct path to a transcript file:

```bash
/m42-signs:extract ~/.claude/projects/-home-user-myproject/session.jsonl
```

Or from sprint transcripts:

```bash
/m42-signs:extract .claude/sprints/my-sprint/transcripts/
```

---

## Using --dry-run

Preview what would be extracted without modifying the backlog:

```bash
/m42-signs:extract <session-id> --dry-run
```

Output shows:
- Number of errors found
- Retry patterns detected
- Proposed learnings with confidence levels
- Target CLAUDE.md file assignments

---

## Understanding Confidence Levels

Extracted learnings are assigned confidence scores based on pattern clarity:

| Level | Meaning | Typical Pattern |
|-------|---------|-----------------|
| **high** | Clear error→success with same tool/command | Tool failed, retried with fix, succeeded |
| **medium** | Retry pattern detected but less clear | Multiple errors before success, modified approach |
| **low** | Error found but resolution unclear | Error occurred but success pattern not found |

### Filter by Confidence

Extract only high-confidence learnings:

```bash
/m42-signs:extract <session-id> --confidence-min high
```

Extract medium and above:

```bash
/m42-signs:extract <session-id> --confidence-min medium
```

---

## Filtering Options

### Auto-Approve High Confidence

Automatically approve high-confidence learnings during extraction:

```bash
/m42-signs:extract <session-id> --auto-approve
```

This marks high-confidence learnings as `approved` instead of `pending`.

### Combined Options

```bash
# Preview high-confidence learnings only
/m42-signs:extract <session-id> --dry-run --confidence-min high

# Extract and auto-approve high confidence
/m42-signs:extract <session-id> --confidence-min medium --auto-approve
```

---

## What Gets Extracted

The extraction process identifies:

### Tool Errors

Any tool result with `is_error: true`:

```json
{"type": "user", "content": [{"type": "tool_result", "is_error": true, "content": "File not found: foo.md"}]}
```

### Retry Patterns

Sequences where the same tool is called again after an error:

1. `Bash: npm test` → Error: "missing dependency"
2. `Bash: npm install` → Success
3. `Bash: npm test` → Success

This pattern indicates learning: "run npm install before npm test when dependencies missing"

### File Path Context

File paths from tool calls help determine target CLAUDE.md:

- Tool called with `plugins/foo/bar.ts` → Target: `plugins/foo/CLAUDE.md`
- Tool called with `src/components/Button.tsx` → Target: `src/CLAUDE.md` or `./CLAUDE.md`

---

## After Extraction

Review and apply the extracted signs:

```bash
# Review pending learnings
/m42-signs:review

# Apply approved signs to CLAUDE.md files
/m42-signs:apply
```

---

## Related Guides

- [Handle Large Transcripts](./handle-large-transcripts.md) - Preprocessing for transcripts >100 lines
- [Add Signs Manually](./add-sign-manually.md) - Manual sign creation
- [Review and Apply](./review-and-apply.md) - Review workflow
- [Getting Started](../getting-started.md) - Overview
