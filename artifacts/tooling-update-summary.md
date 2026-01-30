# Tooling Update Summary

Sprint: `2026-01-29_dependency-parallel-execution`
Date: 2026-01-29

## Implementation Summary

This sprint implemented **dependency-based parallel execution** for the m42-sprint plugin:
- New `depends-on` field on step items for declaring dependencies
- New `parallel-execution` config section (enabled, maxConcurrency, onDependencyFailure)
- New `StepScheduler` class API for DAG-based scheduling
- Documentation updates to USER-GUIDE.md, sprint-yaml-schema.md, api.md, writing-sprints.md

## Commands Reviewed

| Command | Status | Changes |
|---------|--------|---------|
| `add-step` | Unchanged | Simple command designed for quick step addition - users needing dependencies should edit SPRINT.yaml directly |
| `import-steps` | **Updated** | Added file format example with `id` and `depends-on` fields; added optional fields documentation; added note that GitHub imports need manual dependency editing |
| `init-sprint` | **Updated** | Added `depends-on` example in step comments; added `parallel-execution` config section in Workflow Mode template |
| `run-sprint` | Unchanged | Command interface unchanged; parallel execution is internal implementation detail; correctly documented at abstraction level |
| `sprint-status` | **Updated** | Added `[R]` status indicator for ready steps; added Dependency Information Display section showing blocked-by tracking |
| `cleanup-sprint` | Not reviewed | Unaffected by changes |
| `export-pdf` | Not reviewed | Unaffected by changes |
| `help` | Not reviewed | Unaffected by changes |
| `pause-sprint` | Not reviewed | Unaffected by changes |
| `resume-sprint` | Not reviewed | Unaffected by changes |
| `sprint-watch` | Not reviewed | Unaffected by changes |
| `start-sprint` | Not reviewed | Unaffected by changes |
| `stop-sprint` | Not reviewed | Unaffected by changes |

## Skills Reviewed

| Skill | Status | Changes |
|-------|--------|---------|
| `creating-sprints` | **Updated** | Added "Items with Dependencies (Parallel Execution)" section with example; added reference to USER-GUIDE.md parallel execution section |
| `orchestrating-sprints` | **Updated** | Added "Dependencies" row to Core Concepts table; added reference to StepScheduler API documentation |
| `creating-workflows` | Unchanged | Dependencies are SPRINT.yaml item-level, not workflow-level; skill correctly focuses on workflow definitions |

## Verification

- [x] All commands reflect current implementation
- [x] All skills reflect current capabilities
- [x] New features documented in appropriate tooling
- [x] No cosmetic-only changes made

## Files Modified

Commands:
- `plugins/m42-sprint/commands/import-steps.md`
- `plugins/m42-sprint/commands/init-sprint.md`
- `plugins/m42-sprint/commands/sprint-status.md`

Skills:
- `plugins/m42-sprint/skills/creating-sprints/SKILL.md`
- `plugins/m42-sprint/skills/orchestrating-sprints/SKILL.md`
