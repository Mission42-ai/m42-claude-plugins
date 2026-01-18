---
allowed-tools: Bash(test:*), Read(*)
argument-hint: ""
description: Show learning backlog status and summary
model: haiku
---

# Backlog Status

Display the current state of the learning backlog with counts by status.

## Preflight Checks

1. Check if backlog exists:
   !`test -f .claude/learnings/backlog.yaml && echo "EXISTS" || echo "NOT_EXISTS"`

## Context

If the backlog exists, use Read tool to read:
- `.claude/learnings/backlog.yaml`

## Task Instructions

### If Backlog Doesn't Exist

Display helpful message:
```
No backlog found at .claude/learnings/backlog.yaml

To get started:
  /m42-signs:add       - Add a learning manually
  /m42-signs:extract   - Extract learnings from session transcript
```

### If Backlog Exists

1. Read and parse `.claude/learnings/backlog.yaml`

2. Count learnings by status:
   - `pending` - Awaiting review
   - `approved` - Ready to apply
   - `rejected` - Won't apply
   - `applied` - Already written to CLAUDE.md

3. Display summary table:
   ```
   Learning Backlog Status
   ========================

   | Status   | Count |
   |----------|-------|
   | pending  |     3 |
   | approved |     2 |
   | rejected |     1 |
   | applied  |     5 |
   | -------- | ----- |
   | Total    |    11 |
   ```

4. If there are pending learnings (count > 0):
   ```
   Pending Learnings:
     - [high] yq-variable-quoting: Quote Variables in yq Expressions
     - [medium] test-before-commit: Run Tests Before Committing
     - [low] use-haiku-for-status: Use haiku for Read-Only Commands

   Next: Run /m42-signs:review to approve or reject these learnings.
   ```

5. If there are approved learnings (count > 0):
   ```
   Approved learnings ready to apply: 2

   Next: Run /m42-signs:apply to write approved signs to CLAUDE.md files.
   ```

6. If all learnings are applied or rejected:
   ```
   All learnings processed. Extract more with /m42-signs:extract
   or add manually with /m42-signs:add.
   ```

### Edge Cases

- Empty learnings array: "Backlog is empty. Add learnings with /m42-signs:add or /m42-signs:extract"
- Invalid YAML structure: "Backlog file exists but has invalid format. Check .claude/learnings/backlog.yaml"
- Missing version field: Warn but continue with best-effort parsing

## Success Criteria

- Status counts are accurate
- Pending learnings are listed with confidence and title
- Actionable next steps are shown based on current state
- Graceful handling when no backlog exists
