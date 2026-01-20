# Worktree-Parallel Sprint Support - Concept

## Problem Statement

Users want to run multiple sprints concurrently in different git worktrees, but the current sprint system lacks worktree awareness, leading to:

1. **File conflicts**: Multiple sprints writing to the same PROGRESS.yaml
2. **Branch collisions**: Same sprint names creating conflicting branches
3. **No visibility**: Cannot see sprints running in other worktrees
4. **Race conditions**: Concurrent git operations without coordination

## Current State Analysis

### Existing Sprint Structure
```
.claude/
  sprints/
    YYYY-MM-DD_name/
      SPRINT.yaml       # Input definition
      PROGRESS.yaml     # Runtime state (generated)
      context/          # Sprint context
      artifacts/        # Outputs
```

### Current Limitations
- No worktree detection or identification
- PROGRESS.yaml has no worktree metadata
- Status commands only show current worktree
- No conflict detection between worktrees
- No shared lock mechanism

## Proposed Solution

### 1. Worktree Isolation

**Worktree Detection Module** (`runtime/src/worktree.ts`):
```typescript
interface WorktreeInfo {
  isWorktree: boolean;
  path: string;           // Absolute path to worktree root
  id: string;             // SHA256 hash of path (unique identifier)
  branch?: string;        // Current branch in worktree
}

function getWorktreeInfo(): WorktreeInfo
function validateWorktreeIsolation(): boolean
```

**PROGRESS.yaml Enhancement**:
```yaml
sprint-id: 2026-01-20_feature-auth
status: in-progress
worktree-id: a3f2e1d9...    # Hash of worktree path
worktree-path: /home/user/project-main  # For debugging
phases: [...]
```

### 2. Multi-Worktree Status View

**Command Enhancement**: `/sprint-status --all-worktrees`

Discover all worktrees:
```bash
git worktree list --porcelain
```

Output format:
```
Active Sprints Across Worktrees
================================

* /home/user/project-main/.claude/sprints/2026-01-20_feature-a/
  Worktree: main (current)
  Status: in-progress
  Phase: 3/8 (development)
  Branch: sprint/2026-01-20_feature-a

  /home/user/project-worktree1/.claude/sprints/2026-01-20_feature-b/
  Worktree: feature-branch
  Status: in-progress
  Phase: 1/8 (preflight)
  Branch: sprint/2026-01-20_feature-b

Total: 2 active sprints
```

### 3. Conflict Detection & Prevention

**Shared Lock Directory** (in repo root, shared across worktrees):
```
.sprint-locks/
  branch-sprint-2026-01-20-feature-a-{worktree-id}.lock
  git-operation-{worktree-id}.lock
```

**Lock Format**:
```json
{
  "worktree-id": "a3f2e1d9...",
  "worktree-path": "/home/user/project-main",
  "operation": "branch-creation",
  "created-at": "2026-01-20T12:00:00Z",
  "pid": 12345
}
```

**Conflict Detection**:
- Check for existing sprint with same branch name in other worktrees
- Warn before creating conflicting branches
- Auto-cleanup stale locks (>1 hour old, process dead)

**Locks Module** (`runtime/src/locks.ts`):
```typescript
interface SprintLock {
  worktreeId: string;
  worktreePath: string;
  operation: string;
  createdAt: string;
  pid: number;
}

async function acquireLock(operation: string): Promise<boolean>
async function releaseLock(operation: string): Promise<void>
async function checkConflict(sprintName: string): Promise<SprintLock | null>
async function cleanupStaleLocks(): Promise<number>
```

## Implementation Plan

### Step 0: Worktree Detection & Isolation
- Create worktree detection module
- Add worktree-id and worktree-path to PROGRESS.yaml
- Test isolation across multiple worktrees

### Step 1: Multi-Worktree Status View
- Enhance /sprint-status with --all-worktrees flag
- Discover and read PROGRESS.yaml from all worktrees
- Display unified view with worktree context

### Step 2: Conflict Detection & Prevention
- Implement lock mechanism for shared operations
- Add branch name conflict detection
- Auto-cleanup stale locks

### Step 3: Documentation
- User guide: Parallel Development with Worktrees
- Getting started: Setting up worktrees
- Reference: New flags and fields
- Troubleshooting: Conflict resolution

### Step 4: Integration Tests
- Test concurrent sprint execution
- Test conflict detection
- Test lock cleanup
- Test multi-worktree status view

## Benefits

1. **True Parallelism**: Multiple developers or agents can work concurrently
2. **Isolation**: Each worktree's sprints are independent
3. **Visibility**: See all sprints across all worktrees
4. **Safety**: Conflict detection prevents collisions
5. **Flexibility**: Use worktrees for parallel feature development

## Example Workflows

### Workflow 1: Parallel Feature Development
```bash
# Setup
git worktree add ../project-feature-a feature-a
git worktree add ../project-feature-b feature-b

# Terminal 1
cd ~/project-feature-a
/start-sprint implement-auth
/run-sprint .claude/sprints/2026-01-20_implement-auth

# Terminal 2
cd ~/project-feature-b
/start-sprint implement-payments
/run-sprint .claude/sprints/2026-01-20_implement-payments

# Monitor from anywhere
/sprint-status --all-worktrees
```

### Workflow 2: Experiment in Worktree
```bash
# Keep main sprint running
cd ~/project
/run-sprint .claude/sprints/2026-01-20_main-feature

# Experiment in separate worktree
git worktree add ../project-experiment experiment-branch
cd ../project-experiment
/start-sprint test-new-approach
/run-sprint .claude/sprints/2026-01-20_test-new-approach

# If experiment succeeds, merge branch
# If experiment fails, delete worktree
```

## Technical Considerations

### Worktree Detection
- Use `git rev-parse --git-common-dir` to detect worktrees
- Use `git worktree list` to enumerate all worktrees
- Handle bare repositories and submodules

### Performance
- Cache worktree list (invalidate on git operations)
- Parallel PROGRESS.yaml reads for --all-worktrees
- Limit status display to active sprints only

### Edge Cases
- Worktree deleted while sprint running (detect and handle)
- Stale locks from crashed processes (auto-cleanup)
- Sprint directory moved or renamed (detect via worktree-id mismatch)
- Repository without worktrees (works as before)

### Backwards Compatibility
- PROGRESS.yaml without worktree-id: treat as legacy, add on next write
- Existing sprints continue working unchanged
- --all-worktrees flag is optional (default behavior unchanged)

## Success Criteria

- ✅ Two sprints can run concurrently in different worktrees
- ✅ Each sprint is fully isolated (no file conflicts)
- ✅ /sprint-status --all-worktrees shows unified view
- ✅ Conflict detection prevents branch name collisions
- ✅ Documentation explains parallel workflow patterns
- ✅ Integration tests validate end-to-end behavior
- ✅ Backwards compatible with existing sprints
