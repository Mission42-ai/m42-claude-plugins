# Step Context: step-11

## Task
Create the primary user documentation for m42-signs plugin:
1. docs/getting-started.md with prerequisites, installation, quick tutorial
2. docs/ folder structure with how-to/ and reference/ subdirectories
3. Update README.md with concise overview and link to documentation

## Related Code Patterns

### Similar Implementation: m42-sprint/docs/getting-started/quick-start.md
```markdown
# Quick Start

Get your first sprint running in under 5 minutes.

---

## Prerequisites

Before starting, verify you have these tools installed:

```bash
# Check yq (required for YAML processing)
yq --version
```

---

## Step 1: Create a Sprint
...
```

**Pattern notes:**
- Time estimate in header ("under 5 minutes")
- Clear prerequisites section with verification commands
- Step-by-step numbered sections with clear headings
- "What happens" explanation after each command
- "Expected output" code blocks
- "Quick Reference" summary at end
- Links to next steps/related docs

### Similar Implementation: m42-sprint/docs/index.md
```markdown
# M42 Sprint Documentation

Find the right docs for where you are in your journey.

---

## New Here?
| Guide | Time | What You'll Learn |
|-------|------|-------------------|

---

## Document Map
```
docs/
├── index.md
├── getting-started/
├── concepts/
├── reference/
├── guides/
└── troubleshooting/
```
```

**Pattern notes:**
- Clear navigation with tables
- Document map showing structure
- Learning paths for different audiences
- Section dividers (`---`) between major sections

### Similar Implementation: m42-sprint/docs/reference/commands.md
```markdown
# Command Reference

Complete reference for all M42-Sprint commands organized by category.

## Quick Reference
| Command | Description | Category |
|---------|-------------|----------|
| `/start-sprint <name>` | Initialize new sprint | Lifecycle |

---

## Lifecycle Commands
### /start-sprint
**Usage:**
```bash
/start-sprint <sprint-name>
```

**Arguments:**
| Argument | Required | Description |
```

**Pattern notes:**
- Quick reference table at top
- Commands grouped by category
- Each command has: Usage, Arguments table, Examples, Output, Notes
- Consistent heading hierarchy

## Required Imports
### Internal
- No TypeScript imports (pure Markdown documentation)

### External
- None (Markdown files)

## Types/Interfaces to Use
N/A - documentation task, no code types needed.

## Integration Points
- **Referenced by**: README.md (link to docs/)
- **References**: All command files in `commands/*.md` for accurate documentation
- **Gherkin scenarios**: 7 scenarios in step-11-gherkin.md

## Commands to Document

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/m42-signs:add` | Add learning manually | `[--direct] [title]` |
| `/m42-signs:list` | List all signs | `[--format json]` |
| `/m42-signs:status` | Show backlog summary | (none) |
| `/m42-signs:extract` | Extract from session | `<session-id\|path> [--dry-run]` |
| `/m42-signs:review` | Interactive review | `[--approve-all-high]` |
| `/m42-signs:apply` | Apply approved learnings | `[--dry-run] [--commit]` |

## Directory Structure to Create

```
plugins/m42-signs/
├── README.md              # UPDATE: Add docs link + quick example
└── docs/
    ├── getting-started.md # CREATE: Main entry point
    ├── how-to/            # CREATE: Directory with placeholders
    │   ├── add-sign-manually.md
    │   ├── extract-from-session.md
    │   ├── review-and-apply.md
    │   └── integrate-with-sprint.md
    └── reference/         # CREATE: Directory with placeholders
        ├── commands.md
        └── backlog-format.md
```

## Implementation Notes

1. **Getting Started Guide Structure**
   - Prerequisites: Claude Code installed, plugin enabled, yq/jq available
   - Installation: `claude plugins add m42-signs`
   - Quick tutorial: add → list → status workflow
   - Link to how-to guides

2. **README.md Updates**
   - Keep concise (current is ~17 lines)
   - Add "Quick Example" section with code block
   - Add "Documentation" section with link to docs/getting-started.md
   - Consider adding feature list

3. **How-To Placeholders**
   - Can be minimal for now (title + "Coming soon" or brief outline)
   - Gherkin only requires directory to exist

4. **Reference Placeholders**
   - commands.md can reference existing command files
   - backlog-format.md can reference skills/managing-signs/references/backlog-schema.md

## Gherkin Scenarios Summary

1. `docs/getting-started.md` exists
2. Getting started contains "prerequisite" (case-insensitive)
3. Getting started contains workflow commands (`/m42-signs:add` or similar)
4. `docs/how-to/` directory exists
5. `docs/reference/` directory exists
6. README.md contains "getting-started" link
7. README.md contains code example (``` block) and "example/usage/quick start"

## Key Patterns from Reference Implementation (m42-sprint)

- Use `---` dividers between major sections
- Include time estimates where helpful
- Provide "What happens" explanations
- Show expected command outputs
- Add "Next steps" navigation
- Use tables for quick references
- Keep sections scannable with clear headers
