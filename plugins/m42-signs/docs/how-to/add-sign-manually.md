# How to Add a Sign Manually

Add signs directly from your development experience without session extraction.

---

## When to Add Signs Manually

Use manual sign addition when:

- You encounter a problem during development and immediately know the solution
- A pattern emerges that isn't in a session transcript (e.g., learned from documentation)
- You want to add institutional knowledge from team experience
- The automated extraction missed something you know is valuable

Use **automated extraction** instead when:

- You have a session transcript with error → success patterns
- You want to bulk-extract multiple learnings efficiently
- The context is already captured in tool calls and errors

---

## Quick Start

```bash
/m42-signs:add
```

Follow the interactive prompts to provide:
- Title
- Problem description
- Solution
- Target CLAUDE.md path
- Confidence level

---

## Using the --direct Flag

Skip the backlog and write directly to a CLAUDE.md file:

```bash
/m42-signs:add --direct
```

This prompts for all fields but writes immediately to the target file instead of adding to the backlog for review.

### Example: Adding a Direct Sign

```bash
/m42-signs:add --direct
# Title: Quote Variables in yq Expressions
# Problem: yq expressions with variable interpolation fail when variables contain special characters
# Solution: Always wrap yq expressions in single quotes and use proper variable quoting: yq '.key = "'"$VAR"'"' file.yaml
# Target: ./CLAUDE.md
```

Result in `./CLAUDE.md`:

```markdown
## Signs (Accumulated Learnings)

### Quote Variables in yq Expressions
**Problem**: yq expressions with variable interpolation fail when variables contain special characters
**Solution**: Always wrap yq expressions in single quotes and use proper variable quoting: `yq '.key = "'"$VAR"'"' file.yaml`
**Origin**: Added manually
```

---

## Examples of Good Sign Content

### Example 1: Tool-Specific Pattern

**Title**: Use Absolute Paths with Read Tool

**Problem**: Relative file paths in Read tool calls fail when working directory context is ambiguous

**Solution**: Always use absolute paths starting with `/` for Read tool calls; compute paths relative to project root using `${PWD}` if needed

### Example 2: Project-Specific Convention

**Title**: TypeScript Files Require Build Before Test

**Problem**: Tests fail with "module not found" errors when TypeScript files are modified but not compiled

**Solution**: Run `npm run build` before `npm test` after modifying any `.ts` file outside of the watch mode

### Example 3: API Behavior

**Title**: GitHub API Rate Limits Require Authentication

**Problem**: `gh api` calls fail with 403 errors after ~60 requests without authentication

**Solution**: Ensure `gh auth status` returns authenticated before bulk API operations; use `--limit` flag to batch requests

---

## Tips for Quality Signs

| Aspect | Good Practice | Bad Practice |
|--------|--------------|--------------|
| Title | "Quote Variables in yq" | "yq bug" |
| Problem | Specific error context | "It doesn't work" |
| Solution | Concrete steps/code | "Fix the code" |
| Target | Most relevant CLAUDE.md | Always project root |

---

## Related Guides

- [Extract Signs from Sessions](./extract-from-session.md) - Automated extraction
- [Review and Apply Signs](./review-and-apply.md) - Review workflow
- [Getting Started](../getting-started.md) - Overview
