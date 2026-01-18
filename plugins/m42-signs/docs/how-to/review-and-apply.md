# How to Review and Apply Signs

Approve, reject, or edit signs before applying them.

---

## Review Process

```bash
/m42-signs:review
```

For each pending sign, you can:
- **Approve**: Mark as ready to apply
- **Reject**: Mark as not useful
- **Edit**: Modify title, problem, or solution
- **Skip**: Leave for later

---

## Bulk Approve

Approve all high-confidence signs at once:

```bash
/m42-signs:review --approve-all-high
```

---

## Apply Signs

Write approved signs to CLAUDE.md files:

```bash
/m42-signs:apply
```

Preview first with dry-run:

```bash
/m42-signs:apply --dry-run
```

---

## Git Commit

Commit applied signs automatically:

```bash
/m42-signs:apply --commit
```

---

[Back to Getting Started](../getting-started.md)
