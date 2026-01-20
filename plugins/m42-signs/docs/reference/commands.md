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

Add a learning sign manually to the backlog or directly to a CLAUDE.md file.

### Syntax

```bash
/m42-signs:add [--direct] [title]
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--direct` | No | Write directly to CLAUDE.md, bypassing the backlog staging area |
| `title` | No | Initial sign title. If omitted, prompts interactively |

### Examples

```bash
# Interactive mode - prompts for all fields
/m42-signs:add
```

```bash
# Start with a title, prompt for remaining fields
/m42-signs:add "Always use absolute paths"
```

```bash
# Direct mode - bypass backlog, write straight to CLAUDE.md
/m42-signs:add --direct "Use absolute paths" "Relative paths fail silently" "Convert to absolute with path.resolve()" "./CLAUDE.md"
```

### Interactive Flow

When called without `--direct`, the command prompts for:
1. **Title** - Short description of the learning
2. **Problem** - What went wrong (multi-line supported)
3. **Solution** - How to fix/avoid (multi-line supported)
4. **Target** - Path to CLAUDE.md file (defaults to `./CLAUDE.md`)
5. **Confidence** - low, medium, or high

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Backlog file not found" | First time using signs | Backlog is created automatically |
| "Invalid target path" | Target doesn't end in CLAUDE.md | Specify a valid CLAUDE.md path |
| "CLAUDE.md not found" | Target file doesn't exist | Create the target CLAUDE.md first |

---

## /m42-signs:list

List all signs currently in the backlog.

### Syntax

```bash
/m42-signs:list [--format <format>]
```

### Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--format` | No | `table` | Output format: `table` or `json` |

### Examples

```bash
# Default table output
/m42-signs:list
```

```bash
# JSON output for scripting
/m42-signs:list --format json
```

### Output Columns

| Column | Description |
|--------|-------------|
| ID | Unique kebab-case identifier |
| Status | pending, approved, rejected, applied |
| Title | Short description |
| Target | Destination CLAUDE.md path |
| Confidence | low, medium, high |

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "No backlog found" | No signs have been added yet | Add a sign with `/m42-signs:add` or extract with `/m42-signs:extract` |
| "Empty backlog" | All signs have been applied or rejected | Extract new learnings from sessions |

---

## /m42-signs:status

Show a summary of the current backlog state.

### Syntax

```bash
/m42-signs:status
```

### Output

Displays:
- Total signs count
- Breakdown by status (pending, approved, rejected, applied)
- Backlog file location
- Last modified timestamp

### Example

```bash
/m42-signs:status
# Output:
# Backlog Status
# ══════════════════════════════════════
# Location: .claude/learnings/backlog.yaml
# Total: 12 signs
#
# By Status:
#   pending:  5
#   approved: 3
#   rejected: 2
#   applied:  2
```

---

## /m42-signs:extract

Extract learnings from a Claude session transcript by analyzing patterns, reasoning, and error sequences. Supports automatic preprocessing for large transcripts.

### Synopsis

```
/m42-signs:extract <session-id|path> [options]
```

### Description

Analyzes a Claude Code session transcript to extract **signs** - contextual learnings that help future agents work more effectively. The command goes beyond error detection to capture:
- Architectural insights discovered during implementation
- Project conventions not obvious from code alone
- Pitfalls and gotchas that could trip up future agents
- Effective strategies that worked well

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-id\|path>` | Yes | Session ID or full path to transcript JSONL file |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--dry-run` | boolean | false | Preview extracted learnings without writing to backlog |
| `--confidence-min` | enum | `low` | Minimum confidence level to include: `low`, `medium`, or `high` |
| `--auto-approve` | boolean | false | Automatically approve high-confidence learnings |
| `--focus` | string | none | Focus extraction on specific area (e.g., "api", "testing", "build") |
| `--preprocess-only` | boolean | false | Generate preprocessing artifacts without LLM analysis |
| `--parallel` | boolean | false | Enable parallel chunk processing for large transcripts |

### Large Transcript Handling

Preprocessing activates automatically when **either** condition is met:

| Metric | Threshold | Effect |
|--------|-----------|--------|
| Line count | >100 lines | Preprocessing mode activates |
| File size | >500KB | Preprocessing mode activates |

When activated, the command:
1. Generates a summary of the transcript (`transcript-summary.sh`)
2. Identifies high-value learning patterns (`find-learning-lines.sh`)
3. Extracts reasoning blocks to a smaller file (`extract-reasoning.sh`)
4. Analyzes the condensed content

If the extracted reasoning contains 100+ blocks, it is split into 50-block chunks for analysis. Use `--parallel` to process chunks concurrently via subagents.

### Examples

```bash
# Extract from session ID (found in ~/.claude/projects/)
/m42-signs:extract abc123def
```

```bash
# Extract from file path
/m42-signs:extract ~/.claude/projects/myproject/session-abc123.jsonl
```

```bash
# Preview without saving
/m42-signs:extract abc123def --dry-run
```

```bash
# Only extract medium and high confidence learnings
/m42-signs:extract abc123def --confidence-min medium
```

```bash
# Extract and auto-approve high confidence
/m42-signs:extract abc123def --auto-approve
```

```bash
# Focus extraction on API-related learnings
/m42-signs:extract abc123def --focus api
```

```bash
# Preprocess only - generate artifacts without LLM analysis
/m42-signs:extract large-session.jsonl --preprocess-only
```

```bash
# Parallel processing for very large transcripts (100+ reasoning blocks)
/m42-signs:extract huge-session.jsonl --parallel
```

```bash
# Combined: parallel processing with focus on testing patterns
/m42-signs:extract huge-session.jsonl --parallel --focus testing
```

### What Gets Extracted

The command analyzes the transcript for multiple learning types:

| Category | Examples |
|----------|----------|
| **Architectural patterns** | Component relationships, design decisions, data flow |
| **Project conventions** | Naming patterns, file organization, code style |
| **Pitfalls & gotchas** | Things that look right but fail, edge cases |
| **Effective strategies** | Debugging techniques, testing approaches |
| **Tool errors** | Failed tool calls with error messages |
| **Retry patterns** | Error followed by successful retry (highest confidence) |

### Confidence Levels

| Level | Criteria | Typical Pattern |
|-------|----------|-----------------|
| `high` | Clear pattern, explicitly verified, highly reusable | Error → retry → success sequence |
| `medium` | Good insight, reasonable evidence, somewhat reusable | Error with identifiable cause |
| `low` | Possible pattern, limited evidence, context-specific | Single occurrence, unclear resolution |

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Session not found" | Invalid session ID | Check `~/.claude/projects/` for valid session files |
| "Invalid transcript format" | File is not valid JSONL | Ensure file is a Claude session transcript |
| "No learnings extracted" | No learning-worthy content found | Transcript may be procedural without insights |
| "jq: command not found" | Missing jq dependency for preprocessing | Install jq (`brew install jq` or `apt install jq`) |

### See Also

- [Scripts Reference](./scripts.md) - Preprocessing helper scripts
- [Handle Large Transcripts](../how-to/handle-large-transcripts.md) - Detailed preprocessing guide
- [Extract from Session](../how-to/extract-from-session.md) - Step-by-step extraction workflow

---

## /m42-signs:review

Interactively review pending signs in the backlog.

### Syntax

```bash
/m42-signs:review [options]
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--approve-all-high` | No | Batch approve all high-confidence pending signs |
| `--reject-all-low` | No | Batch reject all low-confidence pending signs |

### Examples

```bash
# Interactive review of all pending signs
/m42-signs:review
```

```bash
# Batch approve high confidence, then review remaining
/m42-signs:review --approve-all-high
```

```bash
# Batch reject low confidence
/m42-signs:review --reject-all-low
```

```bash
# Combine batch operations
/m42-signs:review --approve-all-high --reject-all-low
```

### Interactive Flow

For each pending sign, you can:
- **[a]pprove** - Mark as approved for application
- **[r]eject** - Mark as rejected (won't be applied)
- **[e]dit** - Modify title, problem, solution, or target
- **[s]kip** - Leave as pending, review later
- **[q]uit** - Exit review (changes are saved)

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "No pending signs" | All signs already reviewed | Extract new learnings or reset rejected signs |
| "Backlog locked" | Another process is modifying | Wait and retry |

---

## /m42-signs:apply

Apply approved signs to their target CLAUDE.md files.

### Syntax

```bash
/m42-signs:apply [options]
```

### Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--dry-run` | No | false | Preview changes without writing files |
| `--commit` | No | false | Create git commit after applying (with confirmation) |
| `--auto-commit` | No | false | Create git commit without confirmation |
| `--targets` | No | all | Filter to specific CLAUDE.md files (comma-separated paths) |

### Examples

```bash
# Apply all approved signs
/m42-signs:apply
```

```bash
# Preview what would be applied
/m42-signs:apply --dry-run
```

```bash
# Apply and create git commit (with confirmation)
/m42-signs:apply --commit
```

```bash
# Apply and auto-commit without prompting
/m42-signs:apply --auto-commit
```

```bash
# Only apply to specific targets
/m42-signs:apply --targets "./CLAUDE.md,./src/CLAUDE.md"
```

### What Happens

1. Reads all approved signs from backlog
2. Groups by target CLAUDE.md file
3. For each target:
   - Creates `## Signs (Accumulated Learnings)` section if missing
   - Appends each sign in formatted structure
4. Updates sign status to `applied`
5. Optionally creates git commit

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "No approved signs" | Nothing to apply | Review pending signs with `/m42-signs:review` |
| "Target not found" | CLAUDE.md doesn't exist | Create the target file first or update the sign's target |
| "Git working tree dirty" | Uncommitted changes when using --commit | Commit or stash changes first |

---

## /m42-signs:help

Display help information about M42-Signs commands.

### Syntax

```bash
/m42-signs:help
```

### Output

Shows:
- List of all available commands
- Brief description of each
- Link to full documentation

---

## See Also

- [Backlog Format Reference](./backlog-format.md) - YAML schema for backlog file
- [Sign Format Reference](./sign-format.md) - How signs appear in CLAUDE.md
- [Getting Started Guide](../getting-started.md) - Introduction and tutorials

---

[Back to Getting Started](../getting-started.md)
