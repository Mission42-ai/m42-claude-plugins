---
allowed-tools: Bash(gh:*), Bash(ls:*), Read(*), Edit(*)
argument-hint: issues --label <label> [--sort priority] | file <path.yaml>
description: Bulk import tasks to sprint queue
model: sonnet
---

# Import Tasks to Sprint Queue

Bulk import tasks from GitHub issues by label or from a YAML file.

## Preflight Checks

Find current sprint directory:
!`ls -dt /home/konstantin/projects/m42-core/.claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

Verify PROGRESS.yaml exists in sprint:
!`SPRINT_DIR=$(ls -dt /home/konstantin/projects/m42-core/.claude/sprints/*/ 2>/dev/null | head -1); test -f "$SPRINT_DIR/PROGRESS.yaml" && echo "PROGRESS_OK: $SPRINT_DIR/PROGRESS.yaml" || echo "NO_PROGRESS_FILE"`

Check gh CLI availability (for issues import):
!`command -v gh >/dev/null && gh auth status 2>&1 | head -1 || echo "GH_NOT_AVAILABLE"`

## Context

Read current PROGRESS.yaml to get existing tasks:
!`SPRINT_DIR=$(ls -dt /home/konstantin/projects/m42-core/.claude/sprints/*/ 2>/dev/null | head -1); cat "$SPRINT_DIR/PROGRESS.yaml" 2>/dev/null || echo "Cannot read PROGRESS.yaml"`

## Task Instructions

Parse the argument `$ARGUMENTS` to determine import source.

### Mode: issues --label <label> [--sort priority]

When argument starts with `issues`:

1. Extract the label from `--label <label>` parameter
2. Fetch issues from GitHub:
   ```bash
   gh issue list --label "<label>" --state open --json number,title,labels --limit 50
   ```
3. Parse returned JSON array
4. For each issue in the array:
   - Generate task ID: `implement-issue-<number>`
   - Skip if task ID already exists in queue
   - Create task entry:
     ```yaml
     - id: implement-issue-<number>
       type: implement-issue
       issue-number: <number>
       title: "<issue title>"
       priority: medium
     ```
5. If `--sort priority` is specified:
   - Sort tasks by priority labels before adding
   - Priority order: priority-critical > priority-high > priority-medium > priority-low
   - Issues with `priority-critical` label get `priority: critical`
   - Issues with `priority-high` label get `priority: high`
   - Issues with `priority-low` label get `priority: low`
   - Default: `priority: medium`
6. Add all new tasks to `queue` array in PROGRESS.yaml
7. Update `stats.tasks-total` by adding the count of new tasks

### Mode: file <path.yaml>

When argument starts with `file`:

1. Extract file path from arguments
2. Verify file exists:
   ```bash
   test -f "<path>" && echo "FILE_OK" || echo "FILE_NOT_FOUND"
   ```
3. Read the YAML file containing task definitions
4. Expected file format:
   ```yaml
   tasks:
     - type: implement-issue
       issue-number: 42
       title: "Task title"
       priority: high
     - type: refactor
       target-path: src/module.ts
       goal: "Improve performance"
       priority: medium
     - type: custom
       description: "Custom task description"
       done-when: "Acceptance criteria"
       priority: low
   ```
5. Validate each task has required fields for its type:
   - `implement-issue`: requires `issue-number`, `title`
   - `refactor`: requires `target-path`, `goal`
   - `update-docs`: requires `doc-path`, `changes`
   - `custom`: requires `description`, `done-when`
6. Generate task IDs:
   - `implement-issue-<number>` for issue tasks
   - `refactor-<basename>` for refactor tasks
   - `update-docs-<basename>` for docs tasks
   - `custom-<slug>` for custom tasks (slug from description)
7. Skip tasks whose IDs already exist in queue
8. Add all valid tasks to `queue` array in PROGRESS.yaml
9. Update `stats.tasks-total` by adding the count of new tasks

## Edit PROGRESS.yaml

Use the Edit tool to:
1. Append new task entries to the `queue` array
2. Update `stats.tasks-total` with the new total count

## Success Output

Report:
- Import source (label or file path)
- Number of tasks found
- Number of tasks added (excluding duplicates)
- Number of tasks skipped (already in queue)
- Updated total queue length
- Path to PROGRESS.yaml

Example output for issues import:
```
Tasks imported from GitHub issues:
  Label: bug
  Found: 8 issues
  Added: 6 tasks
  Skipped: 2 (already in queue)

New tasks:
  - implement-issue-45: Fix login timeout
  - implement-issue-47: Handle null response
  - implement-issue-51: Update error messages
  - implement-issue-52: Fix pagination
  - implement-issue-55: Resolve memory leak
  - implement-issue-58: Fix date parsing

Queue length: 9 tasks
Updated: .claude/sprints/2024-01-15_bugfix-sprint/PROGRESS.yaml
```

Example output for file import:
```
Tasks imported from file:
  Source: tasks-to-import.yaml
  Found: 5 tasks
  Added: 5 tasks
  Skipped: 0

New tasks:
  - implement-issue-42: Add user authentication
  - refactor-database: Improve database module
  - update-docs-api: Update API documentation
  - custom-cleanup: Remove deprecated code
  - custom-optimize: Optimize build pipeline

Queue length: 8 tasks
Updated: .claude/sprints/2024-01-15_sprint/PROGRESS.yaml
```

## Success Criteria

- All matching issues/tasks added to PROGRESS.yaml queue
- Task count displayed with breakdown (found, added, skipped)
- Duplicate tasks correctly skipped
- stats.tasks-total updated to reflect new total
