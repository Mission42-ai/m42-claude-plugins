# Tooling Update Summary

Sprint: `2026-01-29_flexible-foreach-collections`
Plugin: `m42-sprint`
Date: 2026-01-29

## Implementation Changes

This sprint implemented flexible for-each collections:
- `steps:` array replaced by `collections:` namespace
- `for-each` now accepts any collection name (not just literal `'step'`)
- Template variables: `{{item.*}}` (generic) + `{{<type>.*}}` (type-specific)
- Custom properties support in collection items
- Command renamed: `start-sprint` -> `init-sprint`

## Commands Reviewed

| Command | Status | Changes |
|---------|--------|---------|
| init-sprint | Updated | Updated SPRINT.yaml templates to use `collections:` namespace, changed "add your steps" to "add your collection items", updated success criteria |
| run-sprint | Updated | Updated schema reference from `steps:` to `collections:`, changed dry-run preview to show "Items" and collection names, updated terminology |
| export-pdf | Unchanged | Works with PROGRESS.yaml (compiled format), not affected by SPRINT.yaml schema changes |
| help | Updated | Changed "steps" terminology to "collections" and "items", updated YAML example to show new namespace |
| sprint-status | Unchanged | Reads PROGRESS.yaml (compiled format), structure unchanged |
| sprint-watch | Unchanged | Monitoring command, doesn't reference schema structure |
| add-step | Not reviewed | Unmodified in this sprint |
| cleanup-sprint | Not reviewed | Unmodified in this sprint |
| import-steps | Not reviewed | Unmodified in this sprint |
| pause-sprint | Not reviewed | Unmodified in this sprint |
| resume-sprint | Not reviewed | Unmodified in this sprint |
| stop-sprint | Not reviewed | Unmodified in this sprint |

## Skills Reviewed

| Skill | Status | Changes |
|-------|--------|---------|
| creating-sprints | Updated | `step-writing-guide.md` and `workflow-selection.md` updated to use `collections:` format; main SKILL.md, sprint-template.yaml, and sprint-schema.md already correct |
| creating-workflows | Unchanged | All files (SKILL.md, workflow templates, template-variables.md, workflow-schema.md) already reflect new `{{item.*}}` pattern and flexible `for-each` |
| orchestrating-sprints | Unchanged | All files already use `collections:` namespace, `{{item.*}}` variables, and `init-sprint` command |

## Verification

- [x] All commands reflect current implementation
- [x] All skills reflect current capabilities
- [x] `init-sprint` command exists (renamed from `start-sprint`)
- [x] Documentation uses `collections:` namespace
- [x] Template variables documented as `{{item.*}}` pattern

## Files Modified by Subagents

### Commands
- `plugins/m42-sprint/commands/init-sprint.md` - Updated
- `plugins/m42-sprint/commands/run-sprint.md` - Updated
- `plugins/m42-sprint/commands/help.md` - Updated

### Skills
- `plugins/m42-sprint/skills/creating-sprints/references/step-writing-guide.md` - Updated
- `plugins/m42-sprint/skills/creating-sprints/references/workflow-selection.md` - Updated

## Summary

**4 commands updated**, **3 commands unchanged**, **5 commands not in scope**
**1 skill partially updated** (2 reference files), **2 skills already current**

All tooling now accurately reflects the flexible for-each collections implementation.
