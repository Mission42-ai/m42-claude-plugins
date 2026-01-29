---
allowed-tools: Bash(git:*), Bash(ls:*), Bash(rm:*), Bash(test:*), Bash(mkdir:*), Bash(cp:*), Read(*), Edit(*)
description: Clean up sprint worktree after completion
---

# Cleanup Sprint

Remove worktree and optionally delete branch after sprint completes.

## Arguments

- `<sprint-path>`: Path to sprint directory (optional, defaults to most recent)
- `--force`: Skip confirmation and safety checks for uncommitted/unpushed changes
- `--keep-branch`: Keep the git branch after removing worktree
- `--archive`: Archive sprint directory before removal
- `--dry-run`: Show what would be done without doing it

## Preflight Checks

1. Find the sprint directory:
   ```bash
   # If argument provided, use it
   # Otherwise find most recent sprint
   ls -dt .claude/sprints/*/ 2>/dev/null | head -1
   ```

2. Read `PROGRESS.yaml` to get:
   - Sprint ID
   - Status (must be terminal: completed, blocked, or paused)
   - Worktree configuration (path, branch, cleanup mode)

3. Verify sprint is in a terminal state. If not, output:
   ```
   Cannot clean up sprint - status is {status}.

   Sprint must be completed, blocked, or paused before cleanup.
   Use /stop-sprint to stop an in-progress sprint first.
   ```

## Context Gathering

Read from `<sprint-dir>/PROGRESS.yaml`:
- `sprint-id`: The sprint identifier
- `status`: Must be completed, blocked, paused, or pending
- `worktree.enabled`: Whether worktree was created
- `worktree.path`: Absolute path to the worktree
- `worktree.branch`: Branch name used for the worktree
- `worktree.cleanup`: Cleanup mode (never, on-complete, on-merge)

## Safety Checks

Before cleanup, verify:

1. **Uncommitted Changes**: Check for uncommitted changes in worktree
   ```bash
   cd <worktree-path> && git status --porcelain
   ```
   If output is not empty and --force not specified:
   ```
   Cannot clean up - worktree has uncommitted changes.

   Changes detected in: <worktree-path>

   Options:
   - Commit your changes: cd <worktree-path> && git add . && git commit
   - Discard changes: use --force flag
   - Stash changes: cd <worktree-path> && git stash
   ```

2. **Unpushed Commits**: Check for commits not pushed to remote
   ```bash
   # Check if branch has upstream and commits ahead
   git rev-parse --abbrev-ref <branch>@{upstream} 2>/dev/null
   git rev-list --count <upstream>..<branch>
   ```
   If unpushed commits exist and --force not specified:
   ```
   Cannot clean up - branch has unpushed commits.

   Branch '<branch>' has N commit(s) not pushed to remote.

   Options:
   - Push changes: git push origin <branch>
   - Force cleanup: use --force flag (commits will be lost if branch deleted)
   ```

3. **In-Progress Status**: Never clean up if status is 'in-progress'
   ```
   Cannot clean up - sprint is still in progress.

   Stop the sprint first with: /stop-sprint
   ```

## Task Instructions

### 1. Dry Run Mode (--dry-run)

If `--dry-run` flag is present, output what would be done without doing it:

```
Dry run - no changes will be made.

Sprint: <sprint-id>
Worktree: <worktree-path>
Branch: <branch>
Status: <status>

Actions that would be performed:
  [ ] Remove worktree: git worktree remove <worktree-path>
  [ ] Delete branch: git branch -d <branch>
  [ ] Archive sprint: cp -r <sprint-dir> .claude/sprints/archive/
```

### 2. Archive Sprint (--archive)

If `--archive` flag is present, archive sprint directory before removal:

```bash
# Create archive directory if needed
mkdir -p .claude/sprints/archive

# Copy sprint directory to archive
cp -r <sprint-dir> .claude/sprints/archive/<sprint-id>
```

### 3. Remove Worktree

If worktree exists at the configured path:

```bash
# Prune any stale worktree references first
git worktree prune

# Remove the worktree
git worktree remove "<worktree-path>"

# If --force and worktree has changes:
git worktree remove --force "<worktree-path>"
```

### 4. Delete Branch

Unless `--keep-branch` flag is present:

```bash
# Check if branch is merged to main/master
git branch --merged main | grep <branch>

# If merged, safe delete:
git branch -d <branch>

# If not merged and --force:
git branch -D <branch>

# If not merged and no --force:
# Warn but proceed - branch deletion is optional
```

### 5. Output Results

Format output as:

```
Sprint cleanup complete.

Worktree: <worktree-path>
Branch: <branch>
Status: <status>

Actions:
  [x] Worktree removed
  [x] Branch deleted (was merged to main)
  [x] Sprint archived to .claude/sprints/archive/

Note: Sprint directory still exists at <sprint-dir>
To fully remove: rm -rf <sprint-dir>
```

Or if cleanup mode is "never":

```
Cleanup skipped.

Sprint: <sprint-id>
Cleanup mode: never

The worktree is configured to persist indefinitely.
To force cleanup, edit PROGRESS.yaml and set worktree.cleanup to "on-complete",
then run /cleanup-sprint again.

Or manually remove:
  git worktree remove <worktree-path>
  git branch -d <branch>
```

## Error Handling

### Worktree Already Removed

If worktree path doesn't exist:
```
Worktree not found at <worktree-path>.

The worktree may have already been removed.
Proceeding with branch cleanup...
```

### Branch Already Deleted

If branch doesn't exist:
```
Branch '<branch>' not found.

The branch may have already been deleted or merged.
```

### Permission Errors

```
Failed to remove worktree: <error-message>

Try:
  - Check file permissions in <worktree-path>
  - Close any editors with open files in the worktree
  - Use --force to attempt forced removal
```

## Success Criteria

- Worktree is removed (if it existed)
- Branch is deleted (unless --keep-branch or errors)
- Sprint is archived (if --archive specified)
- User is informed of all actions taken
- Warnings shown for any partial failures
