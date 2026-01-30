# Claude Code Configuration - m42-claude-plugins

## Learnings

- **Delegate technical planning to specialized commands**: When using `/m42-meta-toolkit:create-command`, `/m42-meta-toolkit:create-skill`, or similar, describe the issue and goal only. Don't prescribe implementation details - that's what the command is specialized for.

- **Use `plugin-development` workflow for sprints**: This is the standard workflow for this project. It uses TDD (RED/GREEN/REFACTOR) with operator-driven subagent delegation, includes documentation and tooling updates, and runs in isolated worktrees for parallel development.
