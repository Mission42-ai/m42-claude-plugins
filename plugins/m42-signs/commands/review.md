---
allowed-tools: Bash(test:*, ls:*), Read(*), Edit(*), Write(*), AskUserQuestion(*)
argument-hint: "[--approve-all-high] [--reject-all-low]"
description: Interactive review of pending learnings in backlog
model: sonnet
---

# Review Learnings

Interactively review pending learnings in the backlog. For each learning, you can Approve, Reject, Edit, Skip, or Quit.

## Batch Operations

- `--approve-all-high`: Auto-approve all high-confidence pending learnings (with confirmation)
- `--reject-all-low`: Auto-reject all low-confidence pending learnings (with confirmation)

## Preflight Checks

1. Check if backlog file exists:
   !`test -f .claude/learnings/backlog.yaml && echo "EXISTS" || echo "NOT_EXISTS"`

## Context

Parse `$ARGUMENTS` for batch operation flags:
- `--approve-all-high`: Batch approve high confidence learnings
- `--reject-all-low`: Batch reject low confidence learnings

If neither flag is present, run interactive review.

Based on preflight:
- If `EXISTS`: Proceed with review flow
- If `NOT_EXISTS`: Show helpful message about empty backlog

## Task Instructions

### 1. Handle Missing Backlog

If backlog doesn't exist (NOT_EXISTS from preflight):

```
## Review Learnings

No backlog found at .claude/learnings/backlog.yaml

The learning backlog is empty. You can:
- Add a learning manually: /m42-signs:add
- Extract from a session: /m42-signs:extract <session-id>
```

### 2. Read and Parse Backlog

If backlog exists:

1. Read `.claude/learnings/backlog.yaml`
2. Parse the YAML structure
3. Filter learnings to only `status: pending`
4. If no pending learnings, show message and exit

### 3. Handle Batch Operation: --approve-all-high

If `--approve-all-high` flag is present:

1. Count all pending learnings with `confidence: high`
2. Display count: "Found N high-confidence pending learnings"
3. If count == 0: "No high-confidence pending learnings to approve"
4. If count > 0:
   - Show confirmation: "About to approve N high-confidence learnings. Continue? [Y/N]"
   - Use AskUserQuestion with Yes/No options
   - On Yes: Update status from `pending` to `approved` for all matching learnings
   - On No: "Batch approval cancelled"
5. Save updated backlog.yaml
6. Show summary: "Approved N learnings"

### 4. Handle Batch Operation: --reject-all-low

If `--reject-all-low` flag is present:

1. Count all pending learnings with `confidence: low`
2. Display count: "Found N low-confidence pending learnings"
3. If count == 0: "No low-confidence pending learnings to reject"
4. If count > 0:
   - Show confirmation: "About to reject N low-confidence learnings. Continue? [Y/N]"
   - Use AskUserQuestion with Yes/No options
   - On Yes: Update status from `pending` to `rejected` for all matching learnings
   - On No: "Batch rejection cancelled"
5. Save updated backlog.yaml
6. Show summary: "Rejected N learnings"

### 5. Interactive Review Flow

For each pending learning (1 of N):

#### 5.1 Display Learning Details

Show the learning in this format:

```
## Learning: <id> (<current>/<total>)

**Title**: <title>
**Confidence**: <confidence>
**Target**: <target>

### Problem
<problem description - multi-line>

### Solution
<solution description - multi-line>

### Source
- Tool: <source.tool>
- Command: <source.command>
- Error: <source.error>

---
Actions: [A]pprove | [R]eject | [E]dit | [S]kip | [Q]uit
```

#### 5.2 Prompt for Action

Use AskUserQuestion with these options:
- **Approve**: Mark learning as approved (ready to apply)
- **Reject**: Mark learning as rejected (will not apply)
- **Edit**: Enter edit mode to modify fields
- **Skip**: Leave as pending, move to next
- **Quit**: Stop reviewing, save progress

#### 5.3 Process Action

**On Approve**:
1. Update the learning's status from `pending` to `approved`
2. Save backlog.yaml immediately
3. Show: "✓ Learning approved"
4. Move to next pending learning

**On Reject**:
1. Update the learning's status from `pending` to `rejected`
2. Save backlog.yaml immediately
3. Show: "✗ Learning rejected"
4. Move to next pending learning

**On Edit**:
1. Enter edit mode (see section 6)
2. After edit completes, return to this learning's action prompt

**On Skip**:
1. Keep status as `pending`
2. Show: "→ Skipped"
3. Move to next pending learning

**On Quit**:
1. Show review summary (approved/rejected/skipped counts)
2. Save any pending changes
3. Exit review

### 6. Edit Mode

When user selects Edit:

#### 6.1 Show Editable Fields

Present current values and ask which field to edit:

```
## Edit Learning: <id>

Current values:
- Title: <current title>
- Problem: <current problem>
- Solution: <current solution>
- Target: <current target>

Which field would you like to edit?
```

Use AskUserQuestion with options:
- Edit Title
- Edit Problem
- Edit Solution
- Edit Target
- Done Editing

#### 6.2 Collect New Value

For the selected field:
- **Title**: "Enter new title:"
- **Problem**: "Enter new problem description:"
- **Solution**: "Enter new solution description:"
- **Target**: "Enter new target path:" (suggest available CLAUDE.md files)

#### 6.3 Validate After Edit

After any edit:

1. Run validation: `plugins/m42-signs/scripts/validate-backlog.sh .claude/learnings/backlog.yaml`
2. If validation fails:
   - Show validation errors
   - Revert the change
   - Prompt to try again or cancel edit
3. If validation passes:
   - Save the change
   - Consider confidence adjustment (see 6.4)

#### 6.4 Confidence Adjustment

If the learning was from automated extraction (source.tool != "manual"):
- If title or solution is significantly changed (>50% different), show:
  "This learning was auto-extracted. Significant edits may affect confidence."
- Offer to adjust confidence: Keep current | Set to medium | Set to low

#### 6.5 Return to Review

After edit mode completes ("Done Editing"):
1. Save all changes to backlog.yaml
2. Re-display the learning with updated values
3. Return to action prompt (Approve/Reject/Edit/Skip/Quit)

### 7. Review Complete

When all pending learnings have been processed:

```
## Review Complete

| Action | Count |
|--------|-------|
| Approved | N |
| Rejected | N |
| Skipped | N |

Next steps:
- Run `/m42-signs:apply` to write approved learnings to CLAUDE.md files
- Run `/m42-signs:status` to see current backlog status
```

### 8. Handle Edge Cases

- **No pending learnings**: "No pending learnings to review"
- **Single learning**: Skip (N/M) counter, just show "Learning: <id>"
- **Invalid YAML**: "Error parsing backlog.yaml - check format"
- **File write error**: "Failed to save backlog.yaml - check permissions"

## Success Criteria

- Pending learnings are displayed with title, problem, solution, target, and confidence
- Interactive flow allows Approve, Reject, Edit, Skip, and Quit actions
- Status updates work correctly: pending → approved or pending → rejected
- Edit mode allows modifying title, problem, solution, and target
- Edits are validated before saving (using validate-backlog.sh)
- Batch operations (--approve-all-high, --reject-all-low) work with confirmation
- Changes are saved after each decision
- Review summary shows counts at completion
