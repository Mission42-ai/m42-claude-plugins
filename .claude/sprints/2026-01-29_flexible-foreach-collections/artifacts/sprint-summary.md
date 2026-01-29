# Sprint Summary: 2026-01-29_flexible-foreach-collections

## Completed Steps

### Step 0: Flexible For-Each Collections Implementation
Implemented the core flexible for-each collections feature in the m42-sprint compiler:
- Replaced `steps:` array with `collections:` namespace in SPRINT.yaml schema
- `for-each` now accepts any collection name (not just literal `'step'`)
- Template variables: `{{item.*}}` (generic) + `{{<type>.*}}` (type-specific)
- Custom properties support in collection items
- Updated type definitions, validation, compilation, and expansion logic

### Step 1: Command Rename
Renamed `/start-sprint` command to `/init-sprint`:
- Renamed command file from `start-sprint.md` to `init-sprint.md`
- Updated all references across plugin documentation and skills
- Verified no remaining references to old command name

### Step 2: Workflow Template Updates
Updated all workflow templates to use new collections syntax:
- `.claude/workflows/` templates converted to `{{item.*}}` variables
- Plugin templates (`minimal-workflow.yaml`, `gherkin-step-workflow.yaml`, `orchestrated-workflow.yaml`) updated
- Skill documentation updated with new `collections:` format examples

### Documentation Phase
Updated all user-facing documentation:
- User Guide: Model selection examples converted to `collections:` syntax
- Getting Started: All `/start-sprint` → `/init-sprint`, YAML examples converted
- Reference: Schema documentation updated with `collections:` namespace

### Tooling Update Phase
Synchronized all commands and skills with implementation:
- 4 commands updated (`init-sprint`, `run-sprint`, `export-pdf`, `help`)
- 3 commands unchanged (work with PROGRESS.yaml, unaffected)
- Skills updated: `creating-sprints` references updated

## Test Coverage
- Tests added: 72 total tests
- All tests passing: Yes
- Test suites: validation (42), E2E (5), workflow resolution (3), model selection (12), workflow reference (10)

## Files Changed
### Compiler Source (TypeScript)
- `types.ts` - Updated interfaces for collections namespace
- `validate.ts` - Validation logic for new schema
- `compile.ts` - Compilation logic updates
- `expand-foreach.ts` - For-each expansion with generic item variables
- `*.test.ts` - Test files updated

### Documentation
- `docs/USER-GUIDE.md`
- `docs/getting-started/quick-start.md`
- `docs/getting-started/first-sprint.md`
- `docs/reference/sprint-yaml-schema.md`
- `README.md`

### Commands & Skills
- `commands/init-sprint.md` (renamed)
- `commands/run-sprint.md`
- `commands/help.md`
- `skills/creating-sprints/references/*`

### Workflow Templates
- `.claude/workflows/*.yaml` (16 files)
- `plugins/m42-sprint/templates/*.yaml`

## Commits
- `1ef61f3` qa: sprint verification complete
- `d06d72a` tooling: commands and skills synced
- `0ba7071` docs(getting-started): update for flexible collections
- `688ba25` docs(reference): update for flexible collections
- `86ceecc` docs(user-guide): update for flexible collections
- `928c13b` preflight: sprint context prepared

## Ready for Review
- Build: PASS
- Tests: PASS (72/72)
- Lint: N/A (no lint script in project)
- Docs: Updated
