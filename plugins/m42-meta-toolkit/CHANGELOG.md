# Changelog

All notable changes to the m42-meta-toolkit plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-06

### Added
- New `crafting-claudemd` skill for CLAUDE.md authoring guidance
- New `optimize-claudemd` command for optimizing existing CLAUDE.md files
- New `scan-claudemd` command for scanning and analyzing CLAUDE.md files
- New `claudemd-writer` subagent for CLAUDE.md documentation creation

### Changed
- Removed hardcoded `model: sonnet` from create-command, create-hook, create-skill, and create-subagent commands (inherits model from context)

## [1.0.0] - 2026-02-01

### Added
- Initial release
- Commands: create-command, create-hook, create-skill, create-subagent
- Skills: creating-commands, creating-hooks, creating-skills, creating-subagents, crafting-agentic-prompts, writing-ai-docs
- Subagents: artifact-quality-reviewer, agent-creator, skill-creator, doc-writer, command-creator
