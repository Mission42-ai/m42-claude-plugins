# Issue 1: Worktree Config Not Inherited from Workflow

## Summary
When a sprint references a workflow with `worktree.enabled: true`, the worktree
is not automatically created. User must manually pass `--worktree` flag to
`start-sprint`, which defeats the purpose of workflow-level configuration.

## Evidence
Sprint `2026-01-29_flexible-foreach-collections` was started with:
- SPRINT.yaml referencing `workflow: plugin-development`
- plugin-development.yaml has `worktree.enabled: true`
- Result: Sprint ran on `main` branch in main repo (wrong)
- Expected: Sprint should run in dedicated worktree on sprint branch

## Root Cause Analysis

### run-sprint command
Location: `plugins/m42-sprint/commands/run-sprint.md`

Current behavior:
1. Loads SPRINT.yaml
2. Compiles workflow if needed
3. Launches sprint loop
4. **Does NOT check workflow for worktree config**
5. **Does NOT create worktree**

### start-sprint command
Location: `plugins/m42-sprint/commands/start-sprint.md`

Current behavior:
1. Creates sprint directory structure
2. Supports `--worktree` flag for manual worktree creation
3. **Does NOT auto-enable worktree from workflow config**

### plugin-development workflow
Location: `.claude/workflows/plugin-development.yaml`

Has worktree config that's being ignored:
```yaml
worktree:
  enabled: true
  branch-prefix: sprint/
  path-prefix: trees/
```

## Fix Requirements

### Option A: Fix in run-sprint (Recommended)
Before compilation, run-sprint should:
1. Load referenced workflow definition
2. Check for `worktree.enabled: true`
3. If enabled and worktree doesn't exist:
   - Create branch: `{branch-prefix}{sprint-id}`
   - Create worktree: `{path-prefix}/{sprint-id}`
   - Copy sprint files to worktree
   - Continue execution in worktree

### Option B: Fix in start-sprint
When `--workflow <name>` is provided:
1. Load workflow definition
2. If `worktree.enabled: true`, automatically enable worktree
3. Don't require manual `--worktree` flag

### Both commands should be fixed for complete solution.

## Test Cases
1. Sprint with `workflow: plugin-development` auto-creates worktree
2. Sprint with workflow that has `worktree.enabled: false` stays in main repo
3. Sprint without workflow reference stays in main repo
4. Re-running sprint with existing worktree reuses it (doesn't fail)
