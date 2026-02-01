# Claude Code Configuration - m42-claude-plugins

## Learnings

- **Delegate technical planning to specialized commands**: When using `/m42-meta-toolkit:create-command`, `/m42-meta-toolkit:create-skill`, or similar, describe the issue and goal only. Don't prescribe implementation details - that's what the command is specialized for.

- **Use `plugin-development` workflow for sprints**: This is the standard workflow for this project. It uses TDD (RED/GREEN/REFACTOR) with operator-driven subagent delegation, includes documentation and tooling updates, and runs in isolated worktrees for parallel development.

- **Version bump decisions require analyzing change nature, not just counting commits**: When deciding version bumps (MAJOR.MINOR.PATCH), it's tempting to just count commits or look at commit messages. But semantic versioning requires understanding the nature of changes: Breaking changes → MAJOR, New features → MINOR, Bug fixes and patches → PATCH. Solution: Follow systematic version bump analysis pattern: 1) Read sprint context (SPRINT.yaml title and description, step descriptions), 2) Analyze actual changes using git diff to see code modifications and categorize as bug fixes (PATCH), new features (MINOR), breaking API changes (MAJOR), or internal refactoring (usually PATCH), 3) Determine compatibility (backwards compatible? breaks APIs? adds new public functionality?), 4) Choose version by prioritizing the highest severity change level and documenting rationale. This structured approach ensures version numbers accurately reflect change impact.
