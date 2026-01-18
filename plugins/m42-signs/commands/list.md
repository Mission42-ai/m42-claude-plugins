---
allowed-tools: Bash(ls:*, test:*), Read(*), Glob(**/CLAUDE.md), Grep(*)
argument-hint: "[--format json]"
description: List all signs across CLAUDE.md files in the project
model: haiku
---

# List Signs

Find and display all learning signs across CLAUDE.md files in the project.

## Preflight Checks

1. Find CLAUDE.md files in project:
   !`find . -name "CLAUDE.md" -type f 2>/dev/null | head -20 || echo "NO_FILES"`

## Context

Parse `$ARGUMENTS` to check for:
- `--format json`: Output as JSON array instead of table

Use Glob tool to find all `**/CLAUDE.md` files in the project.

## Task Instructions

### 1. Find All CLAUDE.md Files

Use Glob with pattern `**/CLAUDE.md` to locate all CLAUDE.md files in the project.
Filter out files in:
- `node_modules/`
- `.git/`
- Other typical ignored directories

### 2. Parse Signs from Each File

For each CLAUDE.md file found:

1. Read the file content
2. Look for `## Signs` section (or `## Signs (Accumulated Learnings)`)
3. Within that section, find all `### <Title>` subsections
4. For each sign, extract:
   - **Title**: The `###` heading text
   - **Origin**: Parse `**Origin**:` line if present
   - If no Origin found, use "Unknown"

### 3. Build Results Table

Default output format (table):

```
## Signs Found

| Location | Title | Origin |
|----------|-------|--------|
| CLAUDE.md | Fix yq quoting | session-abc123 |
| scripts/CLAUDE.md | Always use -e flag | Manual |
| src/CLAUDE.md | Check file exists first | sprint-2026-01-10 |

Total: 3 signs across 2 files
```

If no signs found:
```
No signs found in any CLAUDE.md files.

To add a sign manually, use: /m42-signs:add
To extract signs from a session, use: /m42-signs:extract
```

### 4. Handle --format json

If `--format json` is in `$ARGUMENTS`, output JSON instead:

```json
{
  "signs": [
    {
      "location": "CLAUDE.md",
      "title": "Fix yq quoting",
      "origin": "session-abc123"
    },
    {
      "location": "scripts/CLAUDE.md",
      "title": "Always use -e flag",
      "origin": "Manual"
    }
  ],
  "total": 2,
  "files_scanned": 5
}
```

### 5. Handle Edge Cases

- **No CLAUDE.md files**: Report "No CLAUDE.md files found in project"
- **CLAUDE.md without Signs section**: Skip silently, don't report as having 0 signs
- **Malformed Signs section**: Extract what's possible, note any parse issues
- **Very large projects**: Limit scan to first 100 CLAUDE.md files, note if truncated

## Success Criteria

- All CLAUDE.md files in project scanned (excluding node_modules, .git)
- Signs section parsed and signs extracted with title and origin
- Output formatted as table (default) or JSON (with --format json)
- Clear summary with total count
- Handles missing Signs sections gracefully
