---
allowed-tools: Bash(test:*, mkdir:*, git:*), Read(*), Edit(*), Write(*), Glob(**/CLAUDE.md)
argument-hint: "[--dry-run] [--commit] [--targets <paths>]"
description: Apply approved learnings from backlog to CLAUDE.md files
model: sonnet
---

# Apply Learnings

Apply approved learnings from the backlog to their target CLAUDE.md files. Each learning is formatted as a sign and appended to the `## Signs` section.

## Options

- `--dry-run`: Preview changes without writing to files
- `--commit`: Create git commit after applying changes (prompts for user confirmation)
- `--auto-commit`: Automatically create git commit without prompting
- `--targets <paths>`: Apply only to specific CLAUDE.md files (comma-separated)

## Preflight Checks

1. Check if backlog file exists:
   !`test -f .claude/learnings/backlog.yaml && echo "EXISTS" || echo "NOT_EXISTS"`

## Context

Parse `$ARGUMENTS` for options:
- `--dry-run`: Show what would be changed without modifying files
- `--commit`: Stage and commit changes after successful apply (prompts user for confirmation)
- `--auto-commit`: Automatically stage and commit changes without prompting
- `--targets <paths>`: Filter to specific CLAUDE.md paths (comma-separated)

Based on preflight:
- If `EXISTS`: Proceed with apply flow
- If `NOT_EXISTS`: Show helpful message about empty backlog

## Task Instructions

### 1. Handle Missing Backlog

If backlog doesn't exist (NOT_EXISTS from preflight):

```
## Apply Learnings

No backlog found at .claude/learnings/backlog.yaml

The learning backlog is empty. You can:
- Add a learning manually: /m42-signs:add
- Extract from a session: /m42-signs:extract <session-id>
```

### 2. Read and Filter Backlog

If backlog exists:

1. Read `.claude/learnings/backlog.yaml`
2. Parse the YAML structure
3. Filter learnings to only `status: approved`
4. If `--targets` specified, further filter to matching target paths
5. If no approved learnings match, show message and exit

### 3. Group by Target

Group approved learnings by their `target` field:

```yaml
# Example grouping:
CLAUDE.md:
  - learning-1
  - learning-2
src/CLAUDE.md:
  - learning-3
```

### 4. Handle --dry-run Mode

If `--dry-run` flag is present:

For each target CLAUDE.md:

1. Show target path
2. List learnings that would be applied:
   ```
   ## Dry Run Preview

   ### Target: CLAUDE.md
   Would apply 2 learning(s):
   - quote-variables-in-yq: "Quote Variables in yq"
   - check-file-exists: "Check File Exists Before Read"

   ### Target: src/CLAUDE.md
   Would apply 1 learning(s):
   - validate-input: "Validate User Input"

   ---
   Total: 3 learning(s) would be applied to 2 file(s)
   Dry run complete - no changes written
   ```

3. Do NOT write to files
4. Do NOT update backlog status
5. Exit after preview

### 5. Apply to Each Target

For each target CLAUDE.md (not dry-run):

#### 5.1 Read or Create Target File

1. Check if target file exists using Glob
2. If file exists: Read current content
3. If file doesn't exist: Create new file with empty content

#### 5.2 Find or Create Signs Section

1. Search for `## Signs` section in file content
2. If section exists:
   - Find the position after the last `###` entry in the section
   - Or after `## Signs` header if section is empty
3. If section doesn't exist:
   - Add blank line at end of file
   - Add `## Signs` header

#### 5.3 Format and Append Each Learning

For each learning targeting this file:

```markdown
### <title>
**Problem**: <problem description>
**Solution**: <solution description>
**Origin**: <origin-reference>
```

Origin format:
- For extracted learnings with source: `Extracted from session (Tool: <source.tool>)`
- For manual learnings: `Manual addition via /m42-signs:add`
- Include: `[<confidence> confidence]`

Example:
```markdown
### Quote Variables in yq
**Problem**: yq expressions with special characters fail without proper quoting
**Solution**: Always wrap yq expressions in single quotes and use double quotes for string values
**Origin**: Extracted from session (Tool: Bash) [high confidence]
```

#### 5.4 Write Updated File

1. Use Write or Edit tool to save the modified CLAUDE.md
2. Track files modified for git commit

### 6. Update Backlog Status

After successfully writing to a target:

1. For each applied learning, update status from `approved` to `applied`
2. Save updated backlog.yaml
3. Status transition: `approved` → `applied`

### 7. Handle Git Integration (--commit / --auto-commit)

If `--commit` or `--auto-commit` flag is present and changes were made:

#### 7.1 Git Repository Detection

First, check if we're in a git repository:

```bash
git rev-parse --git-dir 2>/dev/null
```

**Edge case: Not in a git repo** → Skip all git operations silently and continue. Changes are still saved to files but no commit is created. Report: "Changes saved (git commit skipped - not in a git repository)"

#### 7.2 Safety Checks

Before staging and committing:

1. **Check for conflicts**: Run `git status --short` and check for merge conflict markers (`UU`, `AA`, `DD` prefixes)
   - If conflicts detected: Report error and skip git commit, but keep file changes saved

2. **Stage only relevant files**: Only stage the specific files modified by this command:
   - Modified CLAUDE.md files (from target paths)
   - `.claude/learnings/backlog.yaml`

   ```bash
   git add <modified-claude-md-file-1>
   git add <modified-claude-md-file-2>
   git add .claude/learnings/backlog.yaml
   ```

   **Important**: Do NOT use `git add .` or `git add -A`. Only stage the specific files we modified to ensure atomic, focused commits.

#### 7.3 User Control Flow

**If `--commit` flag (interactive mode):**

1. Show summary of what will be committed:
   ```
   ## Proposed Git Commit

   Files to be staged:
   - CLAUDE.md (2 signs added)
   - src/CLAUDE.md (1 sign added)
   - .claude/learnings/backlog.yaml

   Commit message format: "signs: apply 3 learning(s)"
   ```

2. Use AskUserQuestion to offer commit options:
   - **Commit**: Proceed with staging and commit
   - **Skip**: Decline commit but keep changes saved

3. **On Commit**: Stage files and create commit
4. **On Skip/Abort**: Report "Commit skipped - changes saved but not committed"

**If `--auto-commit` flag:**

1. Skip user prompt entirely
2. Directly stage files and create commit
3. Report commit hash on success

#### 7.4 Create the Commit

1. Stage all modified CLAUDE.md files:
   ```bash
   git add <list-of-modified-files>
   ```

2. Stage updated backlog:
   ```bash
   git add .claude/learnings/backlog.yaml
   ```

3. Generate commit message in format:
   ```
   signs: apply N learning(s) to M CLAUDE.md file(s)

   Applied:
   - <learning-id>: <title> → <target>
   - ...
   ```

4. Create commit:
   ```bash
   git commit -m "<message>"
   ```

5. Show commit hash on success

#### 7.5 Edge Cases

- **Not in a git repo**: Skip git integration and save changes without committing
- **User declines commit** (with `--commit`): Only file changes are saved, report "changes saved but not committed"
- **Commit fails** (e.g., hook rejection): Report error but keep file changes saved
- **No changes applied**: Don't create an empty commit, report "no changes to commit"

### 8. Output Summary

After all operations complete:

```
## Apply Complete

| Target | Learnings Applied |
|--------|-------------------|
| CLAUDE.md | 2 |
| src/CLAUDE.md | 1 |

Total: 3 learning(s) applied to 2 file(s)
Backlog updated: 3 entries changed from approved to applied

Next steps:
- Review applied signs in target CLAUDE.md files
- Run `/m42-signs:status` to see current backlog status
```

If `--commit` was used:
```
Git commit created: <commit-hash>
```

### 9. Handle Edge Cases

- **No approved learnings**: "No approved learnings to apply. Run `/m42-signs:review` first."
- **Target path invalid**: Skip and report error, continue with others
- **File write fails**: Keep status as `approved`, report error, continue with others
- **All targets filtered out by --targets**: "No approved learnings match specified targets"
- **Mixed success/failure**: Report both successful applies and failures in summary

## Success Criteria

- Only learnings with `status: approved` are processed
- Signs are properly formatted with Problem, Solution, and Origin fields
- `## Signs` section is created if it doesn't exist
- Status is updated from `approved` to `applied` after successful write
- `--dry-run` shows preview without making changes
- `--commit` creates git commit with descriptive message
- `--targets` filters to specified CLAUDE.md paths only
- Summary shows count of applied learnings per target
