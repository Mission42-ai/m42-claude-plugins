---
title: CLAUDE.md Best Practices
description: Writing style rules, anti-patterns, content checklist, and maintenance patterns for CLAUDE.md files. Reference when crafting or reviewing CLAUDE.md content.
keywords: writing style, anti-patterns, content checklist, maintenance, instructions, best practices
file-type: reference
skill: crafting-claudemd
---

# CLAUDE.md Best Practices

**Litmus test for every line**: "Would removing this cause Claude to make mistakes?" If not, cut it.

## Instruction Budget

Claude Code's system prompt includes ~50 internal instructions. Frontier models reliably follow ~150-200 total instructions. CLAUDE.md budget: **~100-150 instructions**. Every line must earn its place.

## Size Targets

| Metric | Target | Warning | Limit |
|--------|--------|---------|-------|
| Root CLAUDE.md | <300 lines | >300 lines | >500 lines |
| Character count | <10,000 | >12,000 | - |
| Per instruction | 1 line | >3 lines | - |

## Writing Style Rules

| Rule | Example | Anti-pattern |
|------|---------|-------------|
| Use imperative directives | "Use ES modules, not CommonJS" | "We generally prefer ES modules" |
| Always provide alternatives with prohibitions | "Never use --foo-bar; prefer --baz-qux instead" | "Never use --foo-bar" |
| Reserve emphasis for critical rules | One IMPORTANT: per 20 instructions | Every other line marked IMPORTANT |
| One instruction per bullet | "- Run tests before committing" | "- Run tests, and also make sure to..." |
| Structure with headers + bullets | Markdown headers grouping related bullets | Long narrative paragraphs |

## Content Categories Checklist

Include **only** categories where Claude's behavior needs correction:

| Category | Lines | What to include |
|----------|-------|-----------------|
| Project identity | 1-3 | Tech stack, framework version, core purpose |
| Commands | 5-15 | Build, test, lint, deploy - exact syntax |
| Architecture | 5-10 | Key directories, entry points, non-obvious structure |
| Code conventions | 3-10 | Only conventions Claude can't infer from code |
| Testing | 3-5 | Framework, fixture locations, mocking patterns |
| Git workflow | 3-5 | Branch naming, commit format, PR requirements |
| Security | 3-5 | Protected files, auth flow refs, validation rules |
| Environment | 3-5 | Required env var names (not values), local quirks |
| Domain knowledge | 3-5 | Business logic affecting code, terminology |
| Gotchas | 3-10 | Intentional oddities, fragile areas, "never modify" zones |
| MCP tools | 3-5 | Available tools, usage patterns, rate limits |

## Anti-Patterns

| Anti-pattern | Why it hurts | Fix |
|-------------|-------------|-----|
| Over-specified file (>500 lines) | Important rules drowned in noise | Aggressive pruning |
| Code style rules | Claude infers from existing code; linters enforce deterministic rules | Use hooks with linters |
| Relying on /init output | Generic, bloated, misses project-specific gotchas | Manual curation |
| Indiscriminate @imports | All load at startup, bloating every session | Motivated pointers with context |
| Sensitive information | API keys, connection strings exposed | Reference env var names only |
| Vague instructions | "Format code properly" wastes tokens without changing behavior | Specific directives |
| Explaining obvious structure | "The /tests directory contains tests" | Omit |

## Maintenance Pattern

Track additions using a failure-driven approach:

1. Claude makes a mistake
2. Determine if a CLAUDE.md instruction would prevent it
3. Add the instruction and observe behavior change
4. If no behavior change after testing, remove the instruction
5. Periodically audit: does each line still earn its place?

For teams: commit CLAUDE.md changes through code review. Personal preferences go in `CLAUDE.local.md` or `~/.claude/CLAUDE.md`.
