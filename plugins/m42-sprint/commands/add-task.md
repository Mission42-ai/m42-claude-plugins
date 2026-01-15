---
allowed-tools: Bash(gh:*), Bash(ls:*), Read(*), Edit(*)
argument-hint: issue <number> | refactor <path> --goal "..." | docs <path> --changes "..." | custom --desc "..." --done "..."
description: Add task to sprint queue
model: sonnet
---

# Add Task to Sprint Queue

## Preflight Checks

Find current sprint directory:
!`ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

Verify PROGRESS.yaml exists in sprint:
!`SPRINT_DIR=$(ls -dt .claude/sprints/*/ 2>/dev/null | head -1); test -f "$SPRINT_DIR/PROGRESS.yaml" && echo "PROGRESS_OK: $SPRINT_DIR/PROGRESS.yaml" || echo "NO_PROGRESS_FILE"`

Check gh CLI for issue type:
!`command -v gh >/dev/null && echo "GH_OK" || echo "GH_MISSING"`

## Context

Read current PROGRESS.yaml to get task count and existing tasks:
!`SPRINT_DIR=$(ls -dt .claude/sprints/*/ 2>/dev/null | head -1); cat "$SPRINT_DIR/PROGRESS.yaml" 2>/dev/null || echo "Cannot read PROGRESS.yaml"`

## Task Instructions

Parse the argument `$ARGUMENTS` to determine task type and parameters.

### Type: issue <number>

When argument starts with `issue`:

1. Extract issue number from arguments
2. Fetch issue details:
   ```bash
   gh issue view <number> --json title,body,labels --jq '{title: .title, labels: [.labels[].name]}'
   ```
3. Generate task ID: `implement-issue-<number>`
4. Create task entry:
   ```yaml
   - id: implement-issue-<number>
     type: implement-issue
     command: null  # Optional: task-specific workflow command
     issue-number: <number>
     title: "<issue title>"
     priority: medium
   ```
5. Add to queue array in PROGRESS.yaml
6. Increment stats.tasks-total

### Type: refactor <path> --goal "..."

When argument starts with `refactor`:

1. Extract path and goal from arguments
2. Verify target path exists:
   ```bash
   test -e "<path>" && echo "PATH_OK" || echo "PATH_NOT_FOUND"
   ```
3. Generate task ID: `refactor-<basename of path>`
4. Create task entry:
   ```yaml
   - id: refactor-<name>
     type: refactor
     command: null  # Optional: task-specific workflow command
     target-path: <path>
     goal: "<goal>"
     priority: medium
   ```
5. Add to queue array in PROGRESS.yaml
6. Increment stats.tasks-total

### Type: docs <path> --changes "..."

When argument starts with `docs`:

1. Extract doc path and changes description from arguments
2. Verify doc path exists:
   ```bash
   test -f "<path>" && echo "DOC_OK" || echo "DOC_NOT_FOUND"
   ```
3. Generate task ID: `update-docs-<basename without extension>`
4. Create task entry:
   ```yaml
   - id: update-docs-<name>
     type: update-docs
     command: null  # Optional: task-specific workflow command
     doc-path: <path>
     changes: "<changes>"
     priority: low
   ```
5. Add to queue array in PROGRESS.yaml
6. Increment stats.tasks-total

### Type: custom --desc "..." --done "..."

When argument starts with `custom`:

1. Extract description and done-when criteria from arguments
2. Generate task ID: `custom-<short-slug-from-desc>`
3. Create task entry:
   ```yaml
   - id: custom-<slug>
     type: custom
     command: null  # Optional: task-specific workflow command
     description: "<description>"
     done-when: "<done criteria>"
     priority: medium
   ```
4. Add to queue array in PROGRESS.yaml
5. Increment stats.tasks-total

## Edit PROGRESS.yaml

Use the Edit tool to:
1. Add the new task entry to the `queue` array
2. Update `stats.tasks-total` by incrementing the count

## Success Criteria

- Task entry added to PROGRESS.yaml queue array
- Unique task ID generated (e.g., implement-issue-42)
- stats.tasks-total incremented
- User sees confirmation with task ID and queue position
