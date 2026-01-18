# Step Context: step-9

## Task
## Phase 3.3: Git Integration

Add optional git commit support:

### Tasks
1. Update commands/apply.md with git logic:
   - After applying changes, offer to commit
   - Commit message format: "signs: apply N learnings"
   - Include list of affected files
   - Support --auto-commit flag

2. Add safety checks:
   - Verify repo is clean (or at least no conflicts)
   - Stage only CLAUDE.md and backlog.yaml changes
   - Allow user to abort before committing

3. Handle edge cases:
   - Not in a git repo -> skip git integration
   - User declines commit -> just save changes

### Success Criteria
- Commits are atomic and clear
- No unrelated changes are included
- User has full control over committing

## Related Code Patterns

### Similar Implementation: preflight-patterns.md (Git Repository Checks)
```markdown
## Preflight Checks

- Git repository: !`git rev-parse --git-dir 2>/dev/null && echo "yes" || echo "no"`
- Clean working tree: !`git status --short`
- Current branch: !`git branch --show-current`
```

### Similar Implementation: review.md (User Confirmation Pattern)
```markdown
#### 5.2 Prompt for Action

Use AskUserQuestion with these options:
- **Approve**: Mark learning as approved (ready to apply)
- **Reject**: Mark learning as rejected (will not apply)
- **Edit**: Enter edit mode to modify fields
- **Skip**: Leave as pending, move to next
- **Quit**: Stop reviewing, save progress
```

### Similar Implementation: advanced-patterns.md (Git Detection)
```markdown
- Repository and branch status: !`git rev-parse --git-dir 2>/dev/null && git branch --show-current | grep -v '^main$' && echo "✓ Safe to proceed" || echo "✗ Either not a git repo or on main branch"`
```

### Similar Implementation: creating-hooks examples.md (Git Repo Check)
```bash
# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    # Not a git repo or git not available
    exit 0
fi
```

### Similar Implementation: m42-sprint (Auto-commit Configuration)
```yaml
# From sprint-template.yaml
options:
  auto-commit: true  # Automatically commit after each step
```

## Required Imports
### Internal
- Existing `apply.md` command structure: Base command to extend
- Review command pattern: User confirmation flow with AskUserQuestion
- Preflight patterns: Git detection checks

### External
- `git`: Standard git commands (add, commit, status, rev-parse)
- No new external packages needed

## Types/Interfaces to Use
```yaml
# Commit message format from CONCEPT.md
# "signs: apply N learnings"

# Files to stage:
# - Modified CLAUDE.md files (from target paths)
# - .claude/learnings/backlog.yaml

# Flags pattern:
# --commit: Interactive commit (offer to user)
# --auto-commit: Automatic commit without prompting
```

## Integration Points
- Called by: User via `/m42-signs:apply --commit` or `--auto-commit`
- Calls:
  - `git rev-parse --git-dir` (detect git repo)
  - `git status --short` (check for conflicts)
  - `git add <files>` (stage specific files)
  - `git commit -m <message>` (create atomic commit)
- Tests: Manual verification via gherkin scenarios in step-9-gherkin.md

## Implementation Notes

### Flag Behavior
- `--commit`: After applying changes, ask user if they want to commit using AskUserQuestion
- `--auto-commit`: Automatically create commit without prompting (skips user confirmation)
- Neither flag: Just save changes, no git operations

### Git Safety Checks
1. Detect if in git repo: `git rev-parse --git-dir 2>/dev/null`
   - If not in git repo → skip all git operations, just save changes
2. Check for conflicts: `git status --short` should not contain merge conflict markers
3. Stage only relevant files: Explicit `git add` for each modified file

### Commit Message Format
```
signs: apply N learning(s) to M CLAUDE.md file(s)

Applied:
- <learning-id>: <title> → <target>
- <learning-id>: <title> → <target>
```

### User Control Flow
1. After applying changes, if `--commit` flag:
   - Show summary of what will be committed
   - Use AskUserQuestion: "Create git commit?" with Yes/No options
   - On Yes: Stage files and create commit
   - On No: "Commit skipped - changes saved but not committed"

2. If `--auto-commit` flag:
   - Skip user prompt
   - Directly stage and commit

### Edge Cases
- **Not in git repo**: Silent skip of git operations
- **User declines**: Only file changes are saved
- **Commit fails**: Report error but keep file changes
- **No changes applied**: Don't create empty commit

### Gherkin Scenarios to Pass
1. Command documents `--commit` flag
2. Command documents `--auto-commit` flag
3. Commit message format "signs: apply N learning" is documented
4. Safety check for git repo existence documented
5. Only CLAUDE.md and backlog.yaml staged
6. User control over committing documented
7. Edge case for non-git repos documented
