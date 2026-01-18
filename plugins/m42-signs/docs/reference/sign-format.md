# Sign Format Reference

How signs appear in CLAUDE.md files after being applied.

---

## Overview

Signs are accumulated learnings that get written to CLAUDE.md files. Claude Code automatically injects CLAUDE.md content into every conversation, making signs a permanent part of the agent's context.

This "Ralph Loop" pattern transforms failures into guidance that prevents future errors.

---

## CLAUDE.md Section Structure

Signs are written to a dedicated section within CLAUDE.md files:

```markdown
# Project Title

[... existing project content ...]

## Signs (Accumulated Learnings)

### Sign Title Here
**Problem**: Description of what went wrong
**Solution**: How to fix or avoid this issue
**Origin**: source-reference
```

### Section Placement

- The `## Signs (Accumulated Learnings)` section is added at the end of the file
- If the section already exists, new signs are appended to it
- Existing content in CLAUDE.md is never modified or removed

---

## Individual Sign Format

Each sign follows this exact structure:

```markdown
### Sign Title
**Problem**: What went wrong or caused issues
**Solution**: How to fix or avoid this in the future
**Origin**: source-reference
```

### Field Details

| Field | Format | Description |
|-------|--------|-------------|
| Title | `### Title` | H3 heading, taken from backlog `title` field |
| Problem | `**Problem**: text` | Bold label followed by problem description |
| Solution | `**Solution**: text` | Bold label followed by solution description |
| Origin | `**Origin**: ref` | Bold label followed by source reference |

### Multi-line Content

For multi-line problem or solution text, the content wraps naturally:

```markdown
### Use Absolute Paths with Read Tool
**Problem**: Read tool fails silently when given relative paths.
This caused multiple retries before realizing the issue.
The error message doesn't clearly indicate the path resolution problem.
**Solution**: Always convert relative paths to absolute before calling Read.
Use path.resolve() or equivalent in Node.js environments.
**Origin**: session-abc123
```

---

## Origin Tracking

The `**Origin**` field tracks where a sign came from.

### Origin Formats

| Source | Format | Example |
|--------|--------|---------|
| Session extraction | `session-{id}` | `session-abc123def` |
| Sprint extraction | `sprint-{date}` | `sprint-2026-01-18` |
| Manual addition | `manual` | `manual` |
| Imported | `import-{source}` | `import-shared-signs` |

### Origin Examples

```markdown
**Origin**: session-abc123def

**Origin**: sprint-2026-01-18_feature-implementation

**Origin**: manual

**Origin**: import-team-patterns
```

---

## Complete CLAUDE.md Example

Here's how a CLAUDE.md file looks after signs are applied:

```markdown
# My Project

## Build Commands
- `npm run build`: Build the project
- `npm run test`: Run tests

## Code Style
- Use TypeScript for all new code
- Follow existing naming conventions

## Signs (Accumulated Learnings)

### Use Absolute Paths with Read Tool
**Problem**: Read tool fails silently when given relative paths.
This caused multiple retries before realizing the issue.
**Solution**: Always convert relative paths to absolute before calling Read.
Use path.resolve() or equivalent.
**Origin**: session-abc123

### Check File Exists Before Editing
**Problem**: Edit tool fails if the file doesn't exist, requiring a switch
to Write tool instead.
**Solution**: Before using Edit, verify the file exists with Glob or Read.
Use Write for new files, Edit for existing files.
**Origin**: manual

### Use npm ci in Docker Builds
**Problem**: npm install modifies package-lock.json in Docker builds,
causing layer cache invalidation.
**Solution**: Use npm ci for reproducible installs in CI/Docker environments.
**Origin**: sprint-2026-01-15
```

---

## Formatting Conventions

### Do's

- Keep titles concise (5-10 words recommended)
- Start problem descriptions with what actually happened
- Make solutions actionable and specific
- Include code examples in solutions when helpful

### Don'ts

- Don't duplicate existing CLAUDE.md content
- Don't include sensitive information (API keys, credentials)
- Don't make signs too verbose (aim for scannability)
- Don't use markdown formatting inside Problem/Solution text

### Example: Good vs Poor Signs

**Good:**
```markdown
### Escape Regex Special Characters in Grep
**Problem**: Grep patterns with brackets fail to match because brackets
are interpreted as regex character classes.
**Solution**: Escape special characters with backslash: `grep "\[pattern\]"`.
**Origin**: session-xyz789
```

**Poor:**
```markdown
### Grep Issue
**Problem**: It didn't work when I tried to search.
**Solution**: Do it differently.
**Origin**: manual
```

---

## Multiple Target Files

Signs can be targeted to different CLAUDE.md files based on scope:

| Scope | Target Path | Use Case |
|-------|-------------|----------|
| Project-wide | `./CLAUDE.md` | General patterns for entire project |
| Directory-specific | `./src/CLAUDE.md` | Patterns specific to source code |
| Component-specific | `./src/api/CLAUDE.md` | API-specific patterns |

### Target Inference

When extracting from transcripts, targets are inferred from:
1. File paths in failed tool calls
2. Working directory context
3. Fallback to project root `./CLAUDE.md`

---

## Special Cases

### Creating New CLAUDE.md Files

If the target CLAUDE.md doesn't exist:
- `/add --direct` will create it with just the Signs section
- `/apply` will fail and report the missing file

### Empty Signs Section

A CLAUDE.md may have an empty Signs section:

```markdown
## Signs (Accumulated Learnings)

<!-- No signs yet. Learnings will appear here after review and apply. -->
```

### Duplicate Prevention

The apply command checks for duplicate signs by:
1. Comparing title text (case-insensitive)
2. Signs with matching titles are skipped
3. A warning is shown for skipped duplicates

---

## See Also

- [Backlog Format Reference](./backlog-format.md) - Staging area schema
- [Commands Reference](./commands.md) - All available commands
- [Getting Started Guide](../getting-started.md) - Introduction and tutorials

---

[Back to Getting Started](../getting-started.md)
