---
allowed-tools: Bash(test:*, ls:*), Read(*)
argument-hint: ""
description: Show backlog status summary with counts by status
model: haiku
---

# Backlog Status

Display a summary of the learning backlog, showing counts by status and listing pending items.

## Preflight Checks

1. Check if backlog file exists:
   !`test -f .claude/learnings/backlog.yaml && echo "EXISTS" || echo "NOT_EXISTS"`

## Context

Based on preflight output:
- If `EXISTS`: Read and parse the backlog file
- If `NOT_EXISTS`: Show helpful message about empty backlog

## Task Instructions

### 1. Handle Missing Backlog

If backlog doesn't exist (NOT_EXISTS from preflight):

```
## Backlog Status

No backlog found at .claude/learnings/backlog.yaml

The learning backlog is empty. You can:
- Add a learning manually: /m42-signs:add
- Extract from a session: /m42-signs:extract <session-id>
```

### 2. Read and Parse Backlog

If backlog exists:

1. Read `.claude/learnings/backlog.yaml`
2. Parse the YAML structure
3. Extract the `learnings` array

### 3. Count by Status

Count learnings by status value:
- `pending`: Awaiting review
- `approved`: Ready to apply
- `rejected`: Will not be applied
- `applied`: Already written to CLAUDE.md

### 4. Display Summary Table

```
## Backlog Status

| Status | Count |
|--------|-------|
| Pending | 3 |
| Approved | 1 |
| Rejected | 0 |
| Applied | 5 |

**Total**: 9 learnings
```

### 5. List Pending Items

If there are pending learnings (count > 0), list them:

```
## Pending Review (3)

1. **quote-variables-in-yq** → scripts/CLAUDE.md
   Quote Variables in yq Expressions

2. **check-file-exists** → CLAUDE.md
   Always Check File Existence Before Read

3. **use-glob-not-find** → tools/CLAUDE.md
   Prefer Glob Tool Over find Command

To review pending learnings: /m42-signs:review
```

### 6. Suggest Next Actions

Based on status counts:

- If pending > 0: "Run `/m42-signs:review` to review pending learnings"
- If approved > 0: "Run `/m42-signs:apply` to apply approved learnings"
- If all applied/rejected: "All learnings have been processed"

### 7. Handle Edge Cases

- **Empty learnings array**: "Backlog exists but is empty"
- **Invalid YAML**: "Error parsing backlog.yaml - run validate script"
- **Unknown status values**: Count separately as "Unknown"

## Success Criteria

- Backlog status displayed with counts by status
- Pending learnings listed with ID, target, and title
- Clear next action suggestions based on current state
- Graceful handling when backlog doesn't exist
- Helpful empty state message
