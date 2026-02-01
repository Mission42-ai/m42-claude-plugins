# Changelog

All notable changes to the m42-sprint plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-02-01

### Removed
- **BREAKING**: Removed `depends-on` field for step dependencies
- **BREAKING**: Removed parallel step execution feature
- **BREAKING**: Removed `parallel-execution` configuration block from SPRINT.yaml schema
- Removed `dependency-graph` section from PROGRESS.yaml
- Removed failure policies (`skip-dependents`, `continue`, `fail-phase`)

### Changed
- Steps now execute sequentially in the order defined
- Simplified documentation to reflect sequential-only execution model

## [2.5.2] - 2026-02-01

### Fixed
- Add missing `parallel-execution` property to `SprintDefinition` type (fixes TypeScript compilation error)

## [2.5.1] - 2026-02-01

### Changed
- Removed deprecated "Ralph" terminology from all documentation
- Consolidated documentation to use standard sprint/workflow terminology
- Removed obsolete concept docs (`ralph-loop.md`, `ralph-mode.md`)
- Streamlined commands and skills documentation

## [2.5.0] - 2026-01-30

### Added
- Agent monitoring system with real-time workflow visualization in status dashboard
- AgentWatcher class for tracking Claude agent activity via `.agent-events.jsonl`
- Agent monitor hook (`hooks/agent-monitor-hook.sh`) for capturing lifecycle events
- SSE broadcasting of agent events for live dashboard updates
- n8n-style workflow node visualization showing agent status per step

## [2.4.0] - 2026-01-29

### Added
- DAG scheduler for parallel step execution with dependency resolution
- Step dependency support via `depends-on` field in steps
- `dependency-graph` section in PROGRESS.yaml for tracking execution order
- Parallel execution config with `max-concurrent` limiting
- Step injection with dependency awareness
- Failure policies: `skip-dependents`, `continue`, `fail-phase`
- Automatic worktree context injection - prepends execution context (working directory, branch, main repo path) to phase prompts when running in worktree mode

### Fixed
- Simplified worktree working directory resolution to use `working-dir` field directly

### Changed
- Documentation updates for parallel execution and dependency features
- Added model hints to all commands for optimal model selection

## [2.3.0] - 2026-01-29

### Added
- New `init-sprint` command for initializing sprint directory structures
- Breakpoint support with `paused-at-breakpoint` status and `BREAKPOINT_REACHED` events
- Worktree configuration module for isolated sprint development
- Gate configuration compilation with timeout and retry defaults

### Changed
- Improved template variable substitution with type-specific patterns
- Documentation updates for commands and workflows

## [2.2.0] - 2025-01-29

### Added
- Flexible `for-each` collections with explicit collection definitions in SPRINT.yaml
- Support for any string value in `for-each` field (not limited to 'step' type)
- Collection items can have custom properties beyond `prompt`

### Changed
- `for-each` now uses `collection` field to reference named collections
- Default collection remains `steps` when `for-each: step` is used

## [2.1.0] - 2025-01-20

### Added
- Worktree isolation for parallel sprint development
- Per-iteration hooks for learning extraction
- Sprint status dashboard with real-time updates

### Changed
- Improved progress tracking with PROGRESS.yaml checksums

## [2.0.0] - 2025-01-18

### Added
- Polymorphic task types (prompt, command, workflow)
- Workflow references for reusable phase definitions
- Template variable expansion in prompts

### Changed
- Complete rewrite of sprint compiler
- New SPRINT.yaml schema with phases support

### Removed
- Legacy single-step sprint format

## [1.0.0] - 2025-01-10

### Added
- Initial release
- Basic sprint orchestration with sequential task execution
- PROGRESS.yaml tracking
- Sprint commands: run-sprint, sprint-status, stop-sprint
