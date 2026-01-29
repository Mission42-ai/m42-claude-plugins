# Tooling Update Summary

## Overview

This sprint synchronized all commands and skills for **m42-signs** and **m42-sprint** plugins with implementation changes.

### Key Implementation Changes

1. **`steps` → `collections`**: Sprint definitions now use `collections` (a keyed map) instead of `steps` (a flat array)
2. **New `paused-at-breakpoint` status**: Added breakpoint support for human review
3. **Gate checks**: Quality gates with `gate`, `on-fail.prompt`, `on-fail.max-retries` configuration
4. **`CollectionItem`** replaces `SprintStep` with support for custom properties

---

## Commands Reviewed

### m42-signs Plugin

| Command | Status | Changes |
|---------|--------|---------|
| extract.md | Unchanged | Already documented `--auto-apply-high` flag correctly |
| add.md | Unchanged | Not affected by changes |
| apply.md | Unchanged | Not affected by changes |
| help.md | Unchanged | Not affected by changes |
| list.md | Unchanged | Not affected by changes |
| review.md | Unchanged | Not affected by changes |
| status.md | Unchanged | Not affected by changes |

### m42-sprint Plugin

| Command | Status | Changes |
|---------|--------|---------|
| run-sprint.md | **Updated** | Added `paused-at-breakpoint` status; Added "Breakpoints and Quality Gates" section documenting `break: true` and `gate` configuration |
| init-sprint.md | **Updated** | Removed duplicate "Ralph Mode Features" section |
| help.md | Unchanged | Already correctly uses `collections` format; no `start-sprint` references |
| resume-sprint.md | Unchanged | Already documents `paused-at-breakpoint` handling correctly |
| sprint-status.md | **Updated** | Added `paused-at-breakpoint` status color; Added `[B]` indicator for breakpoint phases; Added gate tracking documentation |
| sprint-watch.md | Unchanged | Documentation matches implementation |
| stop-sprint.md | **Updated** | Corrected terminal states list; Fixed field handling (pause-reason vs pause-requested) |
| export-pdf.md | **Updated** | Corrected success output format to match implementation |
| start-sprint.md | **Deleted** | Merged into init-sprint command |
| add-step.md | Unchanged | Not affected by changes |
| import-steps.md | Unchanged | Not affected by changes |
| pause-sprint.md | Unchanged | Not affected by changes |
| cleanup-sprint.md | Unchanged | Not affected by changes |

---

## Skills Reviewed

### m42-signs Plugin

| Skill | Status | Changes |
|-------|--------|---------|
| managing-signs | **Updated** | Fixed `/m42-signs:list` description; Added missing `/status` and `/help` commands; Improved `/add` and `/review` descriptions |

### m42-sprint Plugin

| Skill | Status | Changes |
|-------|--------|---------|
| creating-sprints | Unchanged | Already fully updated to use `collections` format |
| creating-workflows | **Updated** | Added gate/breakpoint concepts to SKILL.md; Updated workflow-schema.md with `break` and `gate` fields; Added GateCheck interface; Added Pattern 8 (Gated Deployment) to workflow-patterns.md; Updated validation-checklist.md with gate/breakpoint checks |
| orchestrating-sprints | **Updated** | Updated sprint-setup.md to use `collections` format; Added `break`/`gate` to workflow-definitions.md; Added `paused-at-breakpoint` to progress-schema.md; Added gate tracking schema; Updated asset templates; Added troubleshooting entries |

---

## Verification

- [x] All commands reflect current implementation
- [x] All skills reflect current capabilities
- [x] `steps` → `collections` migration documented in all affected files
- [x] Breakpoints (`break: true`) documented where applicable
- [x] Quality gates (`gate`) documented where applicable
- [x] `paused-at-breakpoint` status documented in status-related commands
- [x] Deleted `start-sprint.md` (merged into `init-sprint.md`)
- [x] No orphan references to old `steps` array format

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Commands reviewed | 14 |
| Commands updated | 5 |
| Commands unchanged | 8 |
| Commands deleted | 1 |
| Skills reviewed | 4 |
| Skills updated | 3 |
| Skills unchanged | 1 |
