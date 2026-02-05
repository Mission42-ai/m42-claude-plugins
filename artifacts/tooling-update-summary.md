# Tooling Update Summary

Sprint: `2026-02-05_claudemd-commands`
Date: 2026-02-05

## Implementation Changes Reviewed

1. **m42-meta-toolkit**: Removed `model: sonnet` from 4 command frontmatters; added 2 new commands (optimize-claudemd, scan-claudemd); added 1 new agent (claudemd-writer); added 1 new skill (crafting-claudemd)
2. **m42-signs**: Changed hardcoded `plugins/m42-signs/` script paths to `${CLAUDE_PLUGIN_ROOT}/` in extract.md and review.md
3. **m42-sprint**: Major runtime changes — worktree context warnings in prompt-builder/loop, improved cwd/environment handling in claude-runner, nested worktree detection in cli; plugin-development workflow disabled worktree and learning hook

## m42-meta-toolkit — Commands Reviewed

| Command | Status | Changes |
|---------|--------|---------|
| `create-command` | Unchanged | `model: sonnet` already removed |
| `create-hook` | Unchanged | `model: sonnet` already removed |
| `create-skill` | Unchanged | `model: sonnet` already removed |
| `create-subagent` | Unchanged | `model: sonnet` already removed |
| `optimize-claudemd` (NEW) | **Needs Update** | Still has `model: sonnet` in frontmatter — inconsistent with the removal from the other 4 commands |
| `scan-claudemd` (NEW) | Unchanged | No `model` in frontmatter — consistent |

## m42-meta-toolkit — Skills Reviewed

| Skill | Status | Changes |
|-------|--------|---------|
| `creating-commands` | **Needs Update** | Template shows `model: sonnet` (line 93), lists `model` as required field (line 72), quality review checklist requires `model` present (references/command-quality-review.md:178). All inconsistent with model removal from commands. |
| `creating-subagents` | **Needs Update (minor)** | SKILL.md recommends `model: inherit` (correct), but 4 reference examples hardcode `model: sonnet` (subagent-examples.md:112,147,210; color-codes.md:203) |
| `crafting-claudemd` (NEW) | Unchanged | Well-formed, follows established patterns |
| `crafting-agentic-prompts` | Unchanged | No model frontmatter references |
| `creating-hooks` | Unchanged | No model selection in frontmatter |
| `creating-skills` | Unchanged | No model field in skill schema |
| `writing-ai-docs` | Unchanged | No model references |

## m42-meta-toolkit — Agents Reviewed

| Agent | Status | Changes |
|-------|--------|---------|
| `claudemd-writer` (NEW) | Unchanged | Uses `model: inherit` — consistent with current guidance |

## m42-signs — Commands Reviewed

| Command | Status | Changes |
|---------|--------|---------|
| `extract` | Unchanged | Already uses `${CLAUDE_PLUGIN_ROOT}/` paths |
| `review` | Unchanged | Already uses `${CLAUDE_PLUGIN_ROOT}/` paths |
| `add` | Unchanged | No script references |
| `apply` | Unchanged | No script references |
| `help` | Unchanged | No script references |
| `list` | Unchanged | No script references |
| `status` | Unchanged | No script references |

## m42-signs — Skills Reviewed

| Skill | Status | Changes |
|-------|--------|---------|
| `learning-extraction` | Unchanged | No hardcoded plugin paths |
| `managing-signs` | Unchanged | No hardcoded plugin paths |

## m42-sprint — Commands Reviewed

| Command | Status | Changes |
|---------|--------|---------|
| `run-sprint` | Unchanged | Correctly delegates to runtime CLI which handles worktree internally |
| `start-sprint` | **Needs Update** | Contains deprecated `depends-on` example in SPRINT.yaml template (lines 187-191) |
| `init-sprint` | Unchanged | No depends-on references; worktree docs are for init-time, not runtime |
| `cleanup-sprint` | Unchanged | Worktree cleanup references remain valid |
| `sprint-status` | Unchanged | Read-only status display; consistent |
| `help` | Unchanged (low priority) | Pre-existing gap: missing /sprint-watch and /cleanup-sprint in commands table |
| `export-pdf` | Unchanged | No runtime references |
| `add-step` | Unchanged | No runtime references |
| `import-steps` | Unchanged | No runtime references |
| `pause-sprint` | Unchanged | Pause mechanism unchanged |
| `resume-sprint` | Unchanged | Resume mechanism unchanged |
| `stop-sprint` | Unchanged | Stop mechanism unchanged |
| `sprint-watch` | Unchanged | Status server; no runtime interaction |

## m42-sprint — Skills Reviewed

| Skill | Status | Changes |
|-------|--------|---------|
| `creating-sprints` | **Needs Update** | Reference files (sprint-schema.md, step-writing-guide.md) still document `depends-on` as supported feature with full examples |
| `creating-workflows` | Unchanged (low priority) | Lists plugin-development as having worktree isolation but it's now disabled by default |
| `orchestrating-sprints` | Unchanged | No runtime internals referenced |
| `validating-workflows` | Unchanged | No runtime internals referenced |

## Verification

- [x] All commands reviewed for affected plugins
- [x] All skills reviewed for affected plugins
- [x] Cross-plugin consistency checked
- [ ] `optimize-claudemd.md` needs `model: sonnet` removed from frontmatter
- [ ] `creating-commands` skill needs model field documentation updated
- [ ] `creating-subagents` skill reference examples need `model: sonnet` → `model: inherit`
- [ ] `start-sprint.md` needs deprecated `depends-on` example removed
- [ ] `creating-sprints` skill references need `depends-on` documentation removed

## Priority Issues

| Priority | File | Issue |
|----------|------|-------|
| High | `plugins/m42-meta-toolkit/commands/optimize-claudemd.md` | `model: sonnet` in frontmatter contradicts removal from other commands |
| High | `plugins/m42-meta-toolkit/skills/creating-commands/SKILL.md` | Template, required fields list, and quality review all reference `model` as required |
| Medium | `plugins/m42-meta-toolkit/skills/creating-subagents/references/` | 4 examples hardcode `model: sonnet` instead of `model: inherit` |
| Medium | `plugins/m42-sprint/commands/start-sprint.md` | `depends-on` in SPRINT.yaml template example (deprecated feature) |
| Medium | `plugins/m42-sprint/skills/creating-sprints/references/` | Full `depends-on` documentation as supported feature |
| Low | `plugins/m42-sprint/skills/creating-workflows/SKILL.md` | Plugin-development worktree description vs. disabled default |
