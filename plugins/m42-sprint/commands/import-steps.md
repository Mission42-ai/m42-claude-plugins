---
allowed-tools: Bash(gh:*), Bash(ls:*), Read(*), Edit(*)
argument-hint: issues --label <label> | file <path.yaml>
description: Bulk import steps to sprint SPRINT.yaml
model: sonnet
---

# Import Steps to Sprint SPRINT.yaml

Bulk import steps from GitHub issues by label or from a YAML file.

## Preflight Checks

1. Find current sprint directory:
   !`ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

2. From the output above, identify the sprint directory path (e.g., `.claude/sprints/YYYY-MM-DD_name/`)

3. Check gh CLI availability (for issues import):
   !`gh --version 2>/dev/null | head -1 || echo "GH_NOT_AVAILABLE"`

## Context

Using the sprint directory identified in preflight, use the Read tool to read:
- `<sprint-dir>/SPRINT.yaml` - to get existing steps array

## Task Instructions

Parse the argument `$ARGUMENTS` to determine import source.

### Mode: issues --label <label>

When argument starts with `issues`:

1. Extract the label from `--label <label>` parameter
2. Fetch issues from GitHub:
   ```bash
   gh issue list --label "<label>" --state open --json number,title,body --limit 50
   ```
3. Parse returned JSON array
4. For each issue, create a step entry:
   ```yaml
   - prompt: |
       Implement GitHub issue #<number>
       Title: <issue title>
       <issue body>
   ```
5. Append all new steps to `steps:` array in SPRINT.yaml

### Mode: file <path.yaml>

When argument starts with `file`:

1. Extract file path from arguments
2. Verify file exists:
   ```bash
   test -f "<path>" && echo "FILE_OK" || echo "FILE_NOT_FOUND"
   ```
3. Read the YAML file containing step definitions
4. Expected file format:
   ```yaml
   steps:
     - prompt: |
         Step description here
     - prompt: |
         Another step description
   ```
5. Append all steps from file to `steps:` array in SPRINT.yaml

## Edit SPRINT.yaml

Use the Edit tool to:
1. Append new step entries to the `steps:` array

**Note:** Adding steps requires recompilation. This happens automatically when running `/run-sprint`.

## Success Output

Report:
- Import source (label or file path)
- Number of steps found
- Number of steps added
- Path to SPRINT.yaml

Example output for issues import:
```
Steps imported from GitHub issues:
  Label: bug
  Found: 6 issues
  Added: 6 steps

New steps:
  - Step 4: Implement GitHub issue #45 - Fix login timeout
  - Step 5: Implement GitHub issue #47 - Handle null response
  - Step 6: Implement GitHub issue #51 - Update error messages
  - Step 7: Implement GitHub issue #52 - Fix pagination
  - Step 8: Implement GitHub issue #55 - Resolve memory leak
  - Step 9: Implement GitHub issue #58 - Fix date parsing

Updated: .claude/sprints/2024-01-15_bugfix-sprint/SPRINT.yaml
Note: Run /run-sprint to compile and execute
```

Example output for file import:
```
Steps imported from file:
  Source: steps-to-import.yaml
  Found: 3 steps
  Added: 3 steps

New steps:
  - Step 2: Add user authentication
  - Step 3: Improve database module
  - Step 4: Update API documentation

Updated: .claude/sprints/2024-01-15_sprint/SPRINT.yaml
Note: Run /run-sprint to compile and execute
```

## Success Criteria

- All steps added to SPRINT.yaml steps array
- Step count displayed
- User informed that recompilation happens on `/run-sprint`
