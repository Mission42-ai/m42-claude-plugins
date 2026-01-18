# How to Review and Apply Signs

Approve, reject, or edit learnings before applying them to CLAUDE.md files.

---

## The Review Workflow

The learning lifecycle follows these stages:

```
extracted → pending → approved → applied
                   ↘ rejected
```

1. **Pending**: Newly extracted or added learnings await review
2. **Approved**: Validated and ready to apply
3. **Rejected**: Not useful, won't be applied
4. **Applied**: Written to target CLAUDE.md

---

## Quick Start

```bash
# Review pending learnings one by one
/m42-signs:review

# Apply all approved learnings
/m42-signs:apply
```

---

## Interactive Review

```bash
/m42-signs:review
```

For each pending learning, you see:

```
────────────────────────────────────
Learning: quote-variables-yq [high confidence]
Target: ./CLAUDE.md

Title: Quote Variables in yq Expressions

Problem:
  yq expressions with variable interpolation fail when
  variables contain special characters or spaces

Solution:
  Always wrap yq expressions in single quotes and use
  proper variable quoting: yq '.key = "'"$VAR"'"' file.yaml

Source: Bash: yq '.foo = "$BAR"' config.yaml
────────────────────────────────────

[A]pprove  [R]eject  [E]dit  [S]kip  [Q]uit
```

### Actions

| Key | Action | Description |
|-----|--------|-------------|
| A | Approve | Mark as ready to apply |
| R | Reject | Mark as not useful |
| E | Edit | Modify title, problem, or solution |
| S | Skip | Leave for later review |
| Q | Quit | Exit review (progress saved) |

---

## Editing Learnings

When you press `E` to edit, you can modify:

1. **Title** - Make it clearer or more specific
2. **Problem** - Add context or correct the description
3. **Solution** - Improve the guidance or add details
4. **Target** - Change the destination CLAUDE.md file

Example edit flow:

```
What would you like to edit?
[1] Title  [2] Problem  [3] Solution  [4] Target

> 3

Current solution:
  Always wrap yq expressions in single quotes...

New solution (press Enter twice to finish):
> Always wrap yq expressions in single quotes.
> Use proper variable quoting: yq '.key = "'"$VAR"'"' file.yaml
> For complex cases, use envsubst instead.
>

Updated! Continue review...
```

---

## Batch Operations

### Approve High-Confidence Learnings

Approve all pending high-confidence learnings at once:

```bash
/m42-signs:review --approve-all-high
```

This is useful after extraction when you trust the high-confidence patterns.

### Reject Low-Confidence Learnings

Reject all pending low-confidence learnings:

```bash
/m42-signs:review --reject-all-low
```

Useful for cleaning up noisy extractions.

### Combined Batch

```bash
# Approve high, reject low, then review medium interactively
/m42-signs:review --approve-all-high --reject-all-low
```

After batch operations, remaining medium-confidence learnings enter interactive review.

---

## Applying Signs

Write approved learnings to their target CLAUDE.md files:

```bash
/m42-signs:apply
```

### Preview with --dry-run

See what would be written without making changes:

```bash
/m42-signs:apply --dry-run
```

Output shows:
- Which files will be modified
- What content will be added
- Signs section formatting

### Filter by Target

Apply only to specific CLAUDE.md files:

```bash
/m42-signs:apply --targets "./CLAUDE.md,plugins/m42-signs/CLAUDE.md"
```

---

## Git Integration

### Create Commit After Apply

Commit applied signs with a descriptive message:

```bash
/m42-signs:apply --commit
```

This prompts for confirmation before committing.

### Auto-Commit Without Prompt

Skip the confirmation prompt:

```bash
/m42-signs:apply --auto-commit
```

### Commit Message Format

The generated commit message follows this pattern:

```
docs: add N signs to CLAUDE.md files

Applied learnings:
- quote-variables-yq → ./CLAUDE.md
- use-absolute-paths → plugins/foo/CLAUDE.md
```

### Git Workflow Example

```bash
# 1. Extract from recent session
/m42-signs:extract <session-id>

# 2. Review and approve
/m42-signs:review

# 3. Preview changes
/m42-signs:apply --dry-run

# 4. Apply with commit
/m42-signs:apply --commit
```

---

## Checking Status

View backlog summary:

```bash
/m42-signs:status
```

Shows:
- Count by status (pending, approved, rejected, applied)
- Count by confidence level
- Recent activity

---

## Related Guides

- [Add Signs Manually](./add-sign-manually.md) - Skip extraction
- [Extract from Session](./extract-from-session.md) - Automated extraction
- [Integrate with Sprint](./integrate-with-sprint.md) - Workflow integration
- [Getting Started](../getting-started.md) - Overview
