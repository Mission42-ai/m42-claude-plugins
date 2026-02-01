# Parallel Development with Git Worktrees

Run multiple sprints simultaneously in isolated git worktrees—each with its own branch, working directory, and Claude session.

## Why Worktrees?

Standard git workflow limits you to one active branch at a time. Switching branches to work on something else means:
- Stashing or committing incomplete work
- Losing your terminal/IDE context
- Risk of mixing changes between tasks

**Git worktrees** solve this by creating additional working directories, each tracking a different branch—all sharing the same repository history.

**M42 Sprint's worktree integration** automates this setup, so you can:
- Run a feature sprint while a bugfix sprint proceeds independently
- Keep each sprint's changes completely isolated
- Have multiple Claude sessions working in parallel

## Quick Start

### Enable Worktree Mode

Add `--worktree` when starting a sprint:

```bash
/init-sprint feature-auth --worktree

# Output:
# Sprint initialized with dedicated worktree!
#
# Location: .claude/sprints/2026-01-20_feature-auth/
# Worktree: ../2026-01-20_feature-auth-worktree
# Branch: sprint/2026-01-20_feature-auth
#
# To run the sprint:
#   cd ../2026-01-20_feature-auth-worktree
#   /run-sprint .claude/sprints/2026-01-20_feature-auth
```

### Run the Sprint

Navigate to the worktree and start the sprint:

```bash
cd ../2026-01-20_feature-auth-worktree
/run-sprint .claude/sprints/2026-01-20_feature-auth
```

Claude now operates in the worktree directory—all file operations, git commits, and changes happen in isolation from your main working directory.

### Monitor All Sprints

View status across all worktrees:

```bash
/sprint-status --all-worktrees

# Output:
# Active Sprints Across Worktrees:
#
# * /home/user/project (main)
#   └─ No active sprint
#
#   /home/user/2026-01-20_feature-auth-worktree (sprint/2026-01-20_feature-auth)
#   └─ feature-auth: in-progress (3/8 phases)
#
#   /home/user/2026-01-20_bugfix-login-worktree (sprint/2026-01-20_bugfix-login)
#   └─ bugfix-login: in-progress (2/5 phases)
```

## Configuration

### Sprint-Level Configuration

Define worktree settings in SPRINT.yaml:

```yaml
name: User Authentication
workflow: sprint-default

worktree:
  enabled: true
  branch: sprint/{sprint-id}           # Default
  path: ../{sprint-id}-worktree        # Default
  cleanup: on-complete                  # Default

collections:
  step:
    - prompt: Implement user authentication with JWT tokens
```

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable dedicated worktree for this sprint |
| `branch` | string | `sprint/{sprint-id}` | Git branch name (supports variables) |
| `path` | string | `../{sprint-id}-worktree` | Worktree directory path (supports variables) |
| `cleanup` | string | `on-complete` | When to remove worktree: `never`, `on-complete`, `on-merge` |

### Template Variables

Use these variables in `branch` and `path` templates:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `{sprint-id}` | `2026-01-20_feature-auth` | Full sprint identifier |
| `{sprint-name}` | `feature-auth` | Sprint name (without date prefix) |
| `{date}` | `2026-01-20` | Sprint creation date |
| `{workflow}` | `sprint-default` | Workflow name |

**Examples:**

```yaml
# Feature branch pattern
worktree:
  enabled: true
  branch: feature/{sprint-name}
  path: ../features/{sprint-name}

# Date-organized worktrees
worktree:
  enabled: true
  branch: sprint/{date}/{sprint-name}
  path: ../worktrees/{date}_{sprint-name}
```

### Workflow-Level Defaults

Set default worktree behavior for all sprints using a workflow:

```yaml
# .claude/workflows/feature-development.yaml
name: Feature Development
description: Development workflow with automatic worktree isolation

worktree:
  enabled: true
  branch-prefix: feature/
  path-prefix: ../features/
  cleanup: on-complete

phases:
  - id: develop
    for-each: step
    workflow: plan-execute-verify
```

When starting a sprint with this workflow:

```bash
/init-sprint auth --workflow feature-development

# Automatically creates:
#   Branch: feature/2026-01-20_auth
#   Worktree: ../features/2026-01-20_auth-worktree
```

### Configuration Hierarchy

Sprint-level settings override workflow defaults:

```
1. SPRINT.yaml worktree config (highest priority)
2. Workflow worktree defaults
3. Built-in defaults (lowest priority)
```

## Cleanup Modes

Control when worktrees are automatically removed:

| Mode | Behavior |
|------|----------|
| `never` | Worktree persists indefinitely; manual cleanup required |
| `on-complete` | Remove when sprint status becomes `completed` |
| `on-merge` | Remove after sprint branch is merged to main/master |

### Manual Cleanup

Use `/cleanup-sprint` for manual worktree removal:

```bash
# Cleanup completed sprint
/cleanup-sprint .claude/sprints/2026-01-20_feature-auth

# Preview cleanup without executing
/cleanup-sprint .claude/sprints/2026-01-20_feature-auth --dry-run

# Force cleanup (bypasses safety checks)
/cleanup-sprint .claude/sprints/2026-01-20_feature-auth --force

# Keep branch, only remove worktree
/cleanup-sprint .claude/sprints/2026-01-20_feature-auth --keep-branch

# Archive sprint directory before cleanup
/cleanup-sprint .claude/sprints/2026-01-20_feature-auth --archive
```

### Safety Checks

Cleanup will warn and pause if:
- Worktree has uncommitted changes
- Branch has unpushed commits
- Sprint is still `in-progress`

Use `--force` to override (with caution).

## Example Workflows

### Workflow 1: Parallel Feature Development

Run two features simultaneously:

```bash
# Terminal 1: Start auth feature
/init-sprint feature-auth --worktree
cd ../2026-01-20_feature-auth-worktree
/run-sprint .claude/sprints/2026-01-20_feature-auth

# Terminal 2: Start payments feature
/init-sprint feature-payments --worktree
cd ../2026-01-20_feature-payments-worktree
/run-sprint .claude/sprints/2026-01-20_feature-payments
```

Both sprints execute independently with their own:
- Git branches
- Working directories
- Claude sessions
- PROGRESS.yaml tracking

### Workflow 2: Automatic Worktree via Workflow

Configure workflow with worktree defaults:

```yaml
# .claude/workflows/feature-development.yaml
name: Feature Development
worktree:
  enabled: true
  branch-prefix: feature/
  cleanup: on-complete

phases:
  - id: develop
    for-each: step
    workflow: plan-execute-verify
```

Start sprint (worktree created automatically):

```bash
/init-sprint user-dashboard --workflow feature-development

# Output:
# Creating dedicated worktree for sprint...
# Branch: feature/2026-01-20_user-dashboard (created from main)
# Worktree: ../2026-01-20_user-dashboard-worktree
#
# To run the sprint:
#   cd ../2026-01-20_user-dashboard-worktree
#   /run-sprint .claude/sprints/2026-01-20_user-dashboard
```

Run sprint in worktree:

```bash
cd ../2026-01-20_user-dashboard-worktree
/run-sprint .claude/sprints/2026-01-20_user-dashboard

# Claude now operates in the worktree directory
# All file operations are relative to worktree root
```

### Workflow 3: Bugfix with Preserved Context

Fix a bug without disrupting your main work:

```bash
# You're in the middle of feature development on main...

# Start bugfix in separate worktree
/init-sprint hotfix-login --workflow bugfix-workflow --worktree

# Fix runs independently
cd ../2026-01-20_hotfix-login-worktree
/run-sprint .claude/sprints/2026-01-20_hotfix-login

# After completion, merge and cleanup
git checkout main
git merge sprint/2026-01-20_hotfix-login
/cleanup-sprint .claude/sprints/2026-01-20_hotfix-login
```

### Workflow 4: Team Parallel Sprints

Multiple team members working on different features:

```bash
# Developer A: Authentication
/init-sprint auth --worktree
# Creates: ../2026-01-20_auth-worktree on branch sprint/2026-01-20_auth

# Developer B: Dashboard
/init-sprint dashboard --worktree
# Creates: ../2026-01-20_dashboard-worktree on branch sprint/2026-01-20_dashboard

# Developer C: API refactor
/init-sprint api-refactor --worktree
# Creates: ../2026-01-20_api-refactor-worktree on branch sprint/2026-01-20_api-refactor
```

Each developer works in their worktree. No branch conflicts, no stashing.

## Conflict Detection

The system prevents common conflicts when running parallel sprints:

### Branch Conflicts

If you try to use a branch already in use:

```bash
/init-sprint feature-auth --worktree

# Warning: Branch 'sprint/2026-01-20_feature-auth' already exists
# and is active in worktree: /home/user/project-auth-worktree
#
# Suggestions:
#   1. Use a different name: /init-sprint feature-auth-v2 --worktree
#   2. Clean up existing: /cleanup-sprint .claude/sprints/2026-01-20_feature-auth
#   3. Reuse existing branch: /init-sprint feature-auth --worktree --reuse-branch
```

### Sprint Conflicts

If the same sprint is already running:

```bash
/run-sprint .claude/sprints/2026-01-20_feature-auth

# Warning: Sprint "feature-auth" is already running in another worktree:
#   Worktree: /home/user/2026-01-20_feature-auth-worktree
#   Status: in-progress
#
# Suggestions:
#   1. Monitor existing: /sprint-status --all-worktrees
#   2. Stop existing: cd /home/user/2026-01-20_feature-auth-worktree && /stop-sprint
```

## Troubleshooting

### Worktree Creation Fails

**Symptom:** Error when creating worktree

**Common causes:**

1. **Branch already exists:**
   ```bash
   # Solution: Use --reuse-branch or different name
   /init-sprint feature-auth --worktree --reuse-branch
   # or
   /init-sprint feature-auth-v2 --worktree
   ```

2. **Directory already exists:**
   ```bash
   # Solution: Remove directory or use different path
   rm -rf ../2026-01-20_feature-auth-worktree
   /init-sprint feature-auth --worktree
   ```

3. **Git repository not initialized:**
   ```bash
   # Solution: Initialize git first
   git init
   git add .
   git commit -m "Initial commit"
   ```

### Orphaned Worktrees

**Symptom:** Worktrees remain after sprint completion

**Solution:**

```bash
# List all git worktrees
git worktree list

# Remove stale worktree references
git worktree prune

# Manually remove worktree
git worktree remove ../path-to-worktree

# Force remove if it has uncommitted changes
git worktree remove ../path-to-worktree --force
```

### Sprint Running in Wrong Directory

**Symptom:** Claude operates in main repo instead of worktree

**Cause:** Running `/run-sprint` from main repo instead of worktree

**Solution:**

```bash
# Always cd to worktree first
cd ../2026-01-20_feature-auth-worktree
/run-sprint .claude/sprints/2026-01-20_feature-auth
```

The sprint's `working-dir` in PROGRESS.yaml determines where Claude executes. Verify it's set correctly:

```yaml
# PROGRESS.yaml
worktree:
  enabled: true
  path: /home/user/2026-01-20_feature-auth-worktree
  working-dir: /home/user/2026-01-20_feature-auth-worktree  # Claude runs here
```

### Recovering from Interrupted Sprints

**Symptom:** Sprint stopped mid-execution, worktree left in inconsistent state

**Recovery steps:**

1. **Check sprint status:**
   ```bash
   cd ../worktree-directory
   cat .claude/sprints/*/PROGRESS.yaml | grep status
   ```

2. **Resume if paused:**
   ```bash
   /resume-sprint
   /run-sprint .claude/sprints/2026-01-20_feature-auth
   ```

3. **Force cleanup if corrupted:**
   ```bash
   /cleanup-sprint .claude/sprints/2026-01-20_feature-auth --force
   ```

4. **Manual git cleanup:**
   ```bash
   # From main repo
   git worktree prune
   git worktree remove ../worktree-path --force
   git branch -D sprint/2026-01-20_feature-auth
   ```

### Cross-Worktree File Access

**Symptom:** Sprint tries to access files in another worktree

**Cause:** Path confusion or incorrect configuration

**Solution:** Each sprint should only access files within its own worktree. If you need shared context:

1. Copy context files into the sprint's `context/` directory
2. Use git to merge/cherry-pick specific commits
3. Reference absolute paths only for read-only access

## Best Practices

### Naming Conventions

Use descriptive, unique names to avoid conflicts:

```bash
# Good - descriptive and unique
/init-sprint auth-jwt-tokens --worktree
/init-sprint dashboard-v2-redesign --worktree

# Avoid - too generic
/init-sprint feature --worktree
/init-sprint update --worktree
```

### Worktree Location

Keep worktrees in a predictable location:

```yaml
# Organized by date
worktree:
  path: ../sprints/{date}_{sprint-name}

# Or by type
worktree:
  path: ../features/{sprint-name}  # for features
  path: ../fixes/{sprint-name}     # for bugfixes
```

### Cleanup Regularly

Don't let worktrees accumulate:

```bash
# Review all worktrees weekly
git worktree list

# Clean up completed sprints
/cleanup-sprint .claude/sprints/old-sprint --archive
```

### Monitor Resource Usage

Each worktree is a full copy of your working directory. On large repositories:
- Monitor disk space
- Clean up promptly after merging
- Consider shallow clones for CI/CD scenarios

## Technical Details

### How Worktree Isolation Works

When a worktree sprint starts:

1. **Branch Creation:** New branch created from current HEAD
2. **Worktree Setup:** `git worktree add <path> <branch>`
3. **Sprint Directory:** `.claude/sprints/<id>/` created in worktree
4. **PROGRESS.yaml:** Records `working-dir` as worktree root

During execution:
- Claude's `cwd` is set to `working-dir` (worktree root)
- Git operations affect the worktree's branch
- File operations are relative to worktree root
- PROGRESS.yaml lives in the sprint directory within worktree

### Lock Mechanism

Parallel sprints use a lock system to prevent conflicts:

```
.sprint-locks/                    # Shared directory at repo root
├── branch-create-abc123.lock     # Prevents duplicate branch creation
├── sprint-run-def456.lock        # Tracks running sprints
└── ...
```

Locks include:
- Operation type (branch-create, sprint-run, etc.)
- Worktree ID (12-char hash of path)
- Timestamp (for stale lock detection)
- Process ID (for orphan detection)

Stale locks (>1 hour) are automatically cleaned up.

### Worktree ID Generation

Each worktree gets a unique 12-character ID:

```typescript
// djb2 hash of absolute worktree path
worktreeId = hash("/home/user/2026-01-20_feature-auth-worktree")
// Result: "a7b3c9d2e1f0"
```

This ID appears in PROGRESS.yaml and lock files for conflict detection.

### Automatic Context Injection

When running in worktree mode, the sprint system automatically injects execution context into every phase prompt. This happens transparently whenever `worktree.enabled` is `true` in PROGRESS.yaml.

**What gets injected:**

| Information | Description |
|-------------|-------------|
| Working Directory | Absolute path to the worktree root |
| Branch | Current sprint branch name |
| Main Repo | Path to the main repository worktree |

**Injected guidelines:**

The context also includes operational guidelines for the agent:
1. Use relative paths for all file operations
2. All git commits go to the sprint branch automatically
3. Reading from main repo is allowed for research, but all changes must be made in the worktree
4. Stay in the worktree for all git operations

**Why this matters:**

Agents operating in worktrees need to understand their execution environment. Without context injection, an agent might:
- Use absolute paths that break when the worktree moves
- Accidentally operate in the main repository
- Create commits on the wrong branch

Context injection ensures agents follow best practices automatically, without requiring explicit instructions in every phase prompt.

**Configuration:**

None required. Context injection activates automatically when worktree mode is enabled. The context is prepended to each phase prompt before execution.

## See Also

- [Commands Reference](../reference/commands.md) - Full command documentation
- [SPRINT.yaml Schema](../reference/sprint-yaml-schema.md) - Sprint configuration reference
- [Workflow YAML Schema](../reference/workflow-yaml-schema.md) - Workflow configuration reference
- [Troubleshooting](../troubleshooting/common-issues.md) - Common issues and solutions
