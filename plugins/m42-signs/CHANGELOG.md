# Changelog

All notable changes to the m42-signs plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-29

### Added
- `--auto-apply-high` flag for extract command to auto-approve and apply high-confidence learnings
- Auto-apply workflow for high-confidence learnings with git commit support
- Git tools permission for extract command

### Changed
- Updated managing-signs skill documentation

## [0.1.0] - 2025-01-18

### Added
- Initial release
- Learning extraction from session transcripts using LLM analysis
- Backlog management for pending learnings
- Sign application to CLAUDE.md files
- Commands: add, apply, extract, help, list, review, status
