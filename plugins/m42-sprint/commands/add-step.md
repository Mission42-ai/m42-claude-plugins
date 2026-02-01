---
allowed-tools: Bash(ls:*), Read(*), Edit(*)
argument-hint: <step-prompt>
description: Add step to sprint SPRINT.yaml
---

# Add Step to Sprint SPRINT.yaml

## Preflight Checks

1. Find current sprint directory:
   !`ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

2. From the output above, identify the sprint directory path (e.g., `.claude/sprints/YYYY-MM-DD_name/`)

## Context

Using the sprint directory identified in preflight, use the Read tool to read:
- `<sprint-dir>/SPRINT.yaml` - to get existing collections.step

## Task Instructions

Parse the argument `$ARGUMENTS` as the step prompt text.

1. Find the latest sprint directory from preflight output
2. Read SPRINT.yaml to get current collections.step
3. Create new step entry:
   ```yaml
   - prompt: |
       <step-prompt from $ARGUMENTS>
   ```
4. Append the new step to `collections.step:` in SPRINT.yaml
5. Report success with step position in array

**Note:** Adding a step requires recompilation. This happens automatically when running `/run-sprint`.

## Edit SPRINT.yaml

Use the Edit tool to:
1. Append the new step entry to `collections.step:`

## Success Criteria

- Step added to SPRINT.yaml collections.step
- User sees confirmation with step number (position in array)
- User informed that recompilation happens on `/run-sprint`
