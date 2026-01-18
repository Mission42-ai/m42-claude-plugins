---
allowed-tools: Bash(find:*), Read(*), Glob(*), Grep(*)
argument-hint: [--format json]
description: List all signs across CLAUDE.md files in the project
model: haiku
---

# List Signs

Find and display all signs (accumulated learnings) stored in CLAUDE.md files throughout the project.

## Preflight Checks

1. Find all CLAUDE.md files in the project:
   !`find . -name "CLAUDE.md" -type f 2>/dev/null | head -20 || echo "NO_FILES"`

## Context

Use Glob to find all CLAUDE.md files:
- Pattern: `**/CLAUDE.md`

For each file found, use Read to check for `## Signs` sections.

## Task Instructions

Parse `$ARGUMENTS` for:
- `--format json`: Output as JSON array instead of table

### Discovery

1. Use Glob with pattern `**/CLAUDE.md` to find all CLAUDE.md files
2. For each file, read its contents
3. Look for the `## Signs (Accumulated Learnings)` or `## Signs` section

### Parsing

For each CLAUDE.md with a Signs section:
1. Extract sign entries (look for `### <Title>` patterns under ## Signs)
2. For each sign, extract:
   - **Title**: From `### Title` heading
   - **Origin**: From `**Origin**: <value>` line (if present, otherwise "Unknown")
   - **Location**: Relative path to the CLAUDE.md file

### Output Format

**Default (table)**:
```
Signs Found: 5

| Location | Title | Origin |
|----------|-------|--------|
| ./CLAUDE.md | Quote Variables in yq | Sprint 2024-01-15 |
| ./plugins/m42-sprint/CLAUDE.md | Use haiku for status | Manual entry |
| ./src/CLAUDE.md | Validate inputs early | Session abc123 |
```

**JSON format (--format json)**:
```json
[
  {
    "location": "./CLAUDE.md",
    "title": "Quote Variables in yq",
    "origin": "Sprint 2024-01-15"
  },
  {
    "location": "./plugins/m42-sprint/CLAUDE.md",
    "title": "Use haiku for status",
    "origin": "Manual entry"
  }
]
```

### Edge Cases

- No CLAUDE.md files found: "No CLAUDE.md files found in project."
- CLAUDE.md files exist but no Signs sections: "No signs found. Add your first with /m42-signs:add"
- Signs section exists but is empty: Skip that file
- Malformed sign entries: Best-effort parsing, skip unparseable entries

## Success Criteria

- All CLAUDE.md files in project are scanned
- Signs are extracted and displayed with correct Location, Title, Origin
- JSON format works when --format json is specified
- Graceful handling of projects with no signs
