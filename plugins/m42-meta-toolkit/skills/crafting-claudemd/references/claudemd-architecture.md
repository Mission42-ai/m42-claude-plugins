---
title: CLAUDE.md Architecture and Loading
description: File discovery hierarchy, loading behavior, monorepo strategy, rules directory, lazy loading, and advanced patterns. Reference when designing CLAUDE.md file organization.
keywords: loading order, hierarchy, monorepo, lazy loading, rules directory, @import, progressive disclosure
file-type: reference
skill: crafting-claudemd
---

# CLAUDE.md Architecture and Loading

**Contents**: File Discovery Hierarchy | Rules Directory | Lazy Loading vs @import | Monorepo Strategy | Advanced Patterns | Cross-Tool Compatibility

## File Discovery Hierarchy

Claude Code loads files in this order at session start:

| Location | Scope | Loading | Version controlled? |
|----------|-------|---------|-------------------|
| Enterprise policy path | Organization-wide | Startup | Managed via MDM/Ansible |
| `./CLAUDE.md` | Team project | Startup | Yes |
| `./.claude/CLAUDE.md` | Team project (cleaner root) | Startup | Yes |
| `./CLAUDE.local.md` | Personal per-project | Startup | No (auto-gitignored) |
| `~/.claude/CLAUDE.md` | Personal global | Startup | N/A |
| `.claude/rules/*.md` | Scoped project rules | Startup | Yes |
| `~/.claude/rules/*.md` | Personal global rules | Startup | N/A |
| Parent directory CLAUDE.md | Monorepo inheritance | Startup (walks upward) | Varies |
| Child directory CLAUDE.md | Subtree-specific | **Lazy** (on file access) | Varies |

**Priority**: Project > User > Enterprise. Within a project, more specific files take precedence. All loaded files **combine** rather than replace.

**Critical detail**: Content is wrapped in `<system-reminder>` tag stating it "may or may not be relevant." Claude **actively ignores** instructions it deems irrelevant to the current task. Universally applicable instructions are more effective than situational ones.

## Rules Directory

`.claude/rules/*.md` files are loaded at startup with same priority as `.claude/CLAUDE.md`.

**Conditional rules** use YAML frontmatter with glob patterns:

```yaml
---
paths:
  - "src/api/**/*.ts"
---
```

Rules without `paths` apply unconditionally. Supports subdirectory organization (`rules/frontend/`, `rules/backend/`).

## Lazy Loading vs @import

| Mechanism | When loaded | Token impact | Use for |
|-----------|------------|--------------|---------|
| Subfolder CLAUDE.md | When Claude accesses files in that subtree | On-demand only | Component-specific conventions |
| `@path/to/file.md` | Startup (eager) | Every session | Critical cross-cutting docs |
| Motivated pointers | When Claude decides to read | On-demand | Detailed reference docs |

**@import details**: Supports recursive imports up to 5 hops deep. Resolves relative paths from importing file. Triggers approval dialog on first use.

## Monorepo Strategy

```
/monorepo/
├── CLAUDE.md                    # Shared: commit conventions, repo-wide standards
├── CLAUDE.local.md              # Personal overrides (auto-gitignored)
├── .claude/
│   └── rules/
│       ├── security.md          # Always-on security rules
│       └── frontend/
│           └── react.md         # Conditional (paths: src/frontend/**)
├── frontend/
│   └── CLAUDE.md                # React patterns (lazy-loaded)
├── backend/
│   └── CLAUDE.md                # API conventions (lazy-loaded)
└── shared/
    └── CLAUDE.md                # Shared library conventions (lazy-loaded)
```

**Content allocation decision tree**:

```
Does this instruction apply to EVERY task in the repo?
├── Yes → Root CLAUDE.md
└── No
    ├── Applies to specific file types? → .claude/rules/ with paths:
    └── Applies to specific subtree? → Subfolder CLAUDE.md (lazy-loaded)
```

**When to create subfolder CLAUDE.md**:
- Subdirectory has distinct conventions, frameworks, or tooling
- Component-specific instructions exceed 10-15 lines
- Root CLAUDE.md growing beyond 300 lines
- Teams own different sections with different standards

## Advanced Patterns

### Progressive Disclosure (Motivated Pointers)

Instead of @importing everything, pitch Claude on **when and why** to read each file:

```markdown
## Reference docs
- For complex auth flows or AuthError debugging, see @docs/authentication.md
- For database migration procedures, see @docs/migrations.md
```

### Hooks for Deterministic Rules

CLAUDE.md: heuristic guidance ("prefer named exports")
Hooks: hard requirements ("always run formatter after editing")

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write",
      "hooks": [{ "type": "command", "command": "npx prettier --write $FILE" }]
    }]
  }
}
```

### Skills for Specialized Knowledge

Move specialized instructions (migration procedures, deployment workflows) to `.claude/skills/`. Skills load **on-demand** unlike CLAUDE.md which loads every session.

## Cross-Tool Compatibility

| Tool | Config file | Key difference |
|------|-------------|---------------|
| Claude Code | CLAUDE.md | Lazy-loaded subfolders, `<system-reminder>` wrapping |
| Codex | AGENTS.md | Override files (AGENTS.override.md), 32 KiB limit |
| Cursor | .cursor/rules/ | Activation modes (Always, Auto-Attached, Agent-Requested, Manual) |
| Windsurf | - | Auto-generated memories, 12,000 char limit |
| Copilot | .github/copilot-instructions.md | Org-level instructions, `applyTo` frontmatter |

Claude Code can reference AGENTS.md via `@AGENTS.md` import.
