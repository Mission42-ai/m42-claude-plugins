# Gherkin Scenarios: step-9

## Step Task
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

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Command documents --commit flag
  Given the apply command file exists
  When I check for --commit flag documentation
  Then the flag is documented in the command options section

Verification: `grep -q "\-\-commit" plugins/m42-signs/commands/apply.md && grep -q "git commit" plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Command documents --auto-commit flag
  Given the apply command file exists
  When I check for --auto-commit flag documentation
  Then the flag is documented with description of automatic commit behavior

Verification: `grep -qE "\-\-auto-commit|auto-commit" plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Commit message format is specified
  Given the apply command documents git integration
  When I check for commit message format
  Then the format "signs: apply N learning" pattern is documented

Verification: `grep -qE "signs:.*apply.*learning|commit message.*format" plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Safety check for git repo existence is documented
  Given the apply command handles git operations
  When I check for git repo detection
  Then documentation describes handling when not in a git repo

Verification: `grep -qiE "not.*git.*repo|git.*repo.*exist|skip.*git|no.*git" plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Only relevant files are staged
  Given the apply command creates git commits
  When I check for file staging logic
  Then documentation specifies staging only CLAUDE.md and backlog.yaml

Verification: `grep -q "CLAUDE.md" plugins/m42-signs/commands/apply.md && grep -q "backlog.yaml" plugins/m42-signs/commands/apply.md && grep -qE "stage|git add" plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: User control over committing is documented
  Given the apply command supports git commits
  When I check for user confirmation/abort option
  Then documentation describes user's ability to decline or abort commit

Verification: `grep -qiE "abort|decline|skip|cancel|user.*control|confirm|offer.*commit" plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Edge case handling for non-git repos is documented
  Given the apply command has git integration
  When I check for non-git-repo edge case
  Then documentation describes saving changes without committing when not in a git repo

Verification: `grep -qiE "(not.*git|no.*git|outside.*git).*(skip|save|changes|continue)" plugins/m42-signs/commands/apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
