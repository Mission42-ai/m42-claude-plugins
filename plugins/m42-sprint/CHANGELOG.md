# Changelog

All notable changes to the m42-sprint plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
