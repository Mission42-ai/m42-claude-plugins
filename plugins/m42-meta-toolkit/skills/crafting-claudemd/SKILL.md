---
name: crafting-claudemd
description: Domain knowledge for crafting effective CLAUDE.md files. Covers file hierarchy, writing style, content organization, monorepo strategy, anti-patterns, and validation. Includes scripts for scanning project structure and validating files. This skill should be used when creating CLAUDE.md files, reviewing existing CLAUDE.md files, organizing CLAUDE.md for monorepos, or optimizing Claude Code configuration. Triggers on "create CLAUDE.md", "improve CLAUDE.md", "review CLAUDE.md", "CLAUDE.md best practices", "optimize CLAUDE.md", "monorepo CLAUDE.md".
---

# Crafting CLAUDE.md

CLAUDE.md is Claude Code's highest-leverage configuration point, loaded into every conversation as part of the system prompt. This skill provides the domain knowledge for creating, reviewing, and organizing CLAUDE.md files that maximize Claude's code quality and consistency.

## Quick Assessment

To understand the current state of CLAUDE.md configuration in a project, run:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/scan_claudemd.sh" /path/to/project
```

This discovers all CLAUDE.md files, CLAUDE.local.md files, and `.claude/rules/` entries with line counts and loading behavior annotations (startup vs lazy-loaded).

To validate an existing CLAUDE.md file against best practices:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/validate_claudemd.py" /path/to/CLAUDE.md
```

Checks file size, heading structure, anti-patterns (vague instructions, negative-only constraints, emphasis overuse), and content coverage.

## Core Design Principle

Every CLAUDE.md instruction consumes tokens on every session and competes with ~50 internal Claude Code instructions for attention. Frontier models reliably follow ~150-200 total instructions, leaving a budget of ~100-150 for CLAUDE.md content.

**The litmus test for every line**: "Would removing this cause Claude to make mistakes?" If not, cut it.

## Essential Sections

A well-crafted root CLAUDE.md follows the **WHAT/WHY/HOW framework** and stays under 300 lines:

1. **Project identity** (1-3 lines): Tech stack, framework version, core purpose
2. **Commands** (5-15 lines): Build, test, lint, deploy with exact syntax
3. **Architecture** (5-10 lines): Key directories and non-obvious structure only
4. **Code conventions** (3-10 lines): Only what Claude can't infer from existing code
5. **Gotchas and warnings** (3-10 lines): Things Claude will get wrong without instruction

For the full content categories checklist and writing style rules, read `references/claudemd-best-practices.md`.

## File Organization Decision Tree

```text
Does this instruction apply to EVERY task in the repo?
├── Yes → Root CLAUDE.md
└── No
    ├── Applies to specific file types? → .claude/rules/ with paths: frontmatter
    ├── Applies to specific subtree? → Subfolder CLAUDE.md (lazy-loaded)
    └── Specialized workflow? → Consider a Skill instead
```

**Key distinction**: Subfolder CLAUDE.md files are **lazy-loaded** (only when Claude accesses files there). `@import` syntax loads at startup. Lazy loading is the primary tool for managing complex projects without bloating every session.

For complete loading hierarchy, monorepo patterns, and advanced patterns (motivated pointers, hooks integration), read `references/claudemd-architecture.md`.

## Writing Style Quick Reference

| Do | Don't |
|----|-------|
| "Use ES modules, not CommonJS" | "We generally prefer ES modules" |
| "Never use --foo; prefer --bar instead" | "Never use --foo" |
| One instruction per bullet point | Multi-sentence bullets |
| Markdown headers + bullets | Long narrative paragraphs |
| Reference files: "For auth details, see @docs/auth.md" | @import every doc at startup |

## Common Anti-Patterns

| Anti-pattern | Fix |
|-------------|-----|
| File >500 lines | Aggressive pruning; split to subfolder CLAUDE.md |
| Code style rules Claude already follows | Remove (Claude infers from existing code) |
| Deterministic formatting rules | Move to linter/formatter hooks |
| Explaining obvious directory structure | Omit entirely |
| Negative-only constraints without alternatives | Add "instead, use X" |
| Extensive code examples | Reference files: "See @src/utils/example.ts for the pattern" |
| Sensitive information (API keys) | Reference env var names, deny Read(.env) in settings |

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/scan_claudemd.sh` | Discover all CLAUDE.md files in a project with line counts and loading behavior | `bash "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/scan_claudemd.sh" [project-root]` |
| `scripts/validate_claudemd.py` | Validate CLAUDE.md against best practices (size, structure, anti-patterns) | `python3 "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/validate_claudemd.py" <file-or-directory>` |

**Common validation failures**: Line count warnings (>300) indicate the file should be split into subfolder CLAUDE.md files. Vague instruction warnings mean rewriting as specific imperative directives. Negative-only constraint warnings require adding an alternative ("instead, use X").

## References

| Reference | Use when |
|-----------|----------|
| `references/claudemd-best-practices.md` | Writing or reviewing CLAUDE.md content (style rules, anti-patterns, content checklist, maintenance) |
| `references/claudemd-architecture.md` | Designing file organization (loading hierarchy, monorepo strategy, rules directory, lazy loading, cross-tool compatibility) |
