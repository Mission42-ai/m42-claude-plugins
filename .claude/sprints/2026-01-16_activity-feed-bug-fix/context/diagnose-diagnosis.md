# Activity Feed Bug Diagnosis

## Summary

**Root Cause:** The `.sprint-hooks.json` file is generated but **never applied** to Claude Code. Hooks must be registered in Claude Code's settings files to execute.

## Investigation Details

### 1. Hook Configuration File

Location: `.claude/sprints/2026-01-16_activity-feed-bug-fix/.sprint-hooks.json`

The hook config file **exists** and is properly formatted:
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "bash /home/konstantin/.claude/plugins/cache/m42-claude-plugins/m42-sprint/2.0.0/hooks/sprint-activity-hook.sh /home/konstantin/projects/m42-claude-plugins/.claude/sprints/2026-01-16_activity-feed-bug-fix"
      }]
    }]
  }
}
```

### 2. Hook Script

Location: `plugins/m42-sprint/hooks/sprint-activity-hook.sh`

The script **exists** and is properly implemented. It:
- Reads PostToolUse JSON from stdin
- Extracts tool name, file path, and parameters
- Writes events to `.sprint-activity.jsonl` in the sprint directory

### 3. The Actual Bug

**File:** `plugins/m42-sprint/scripts/sprint-loop.sh` (line 651)

```bash
# Note: HOOK_CONFIG is accepted but not used - Claude Code hooks are configured via settings files
CLI_OUTPUT=$(claude -p "$PROMPT" --dangerously-skip-permissions 2>&1 | tee "$LOG_FILE")
```

The `--hook-config` parameter is:
1. Accepted by the script's argument parser (line 85-86)
2. **Never actually used** when invoking Claude
3. The comment on line 651 explicitly states this is known but unfixed

### 4. Why Hooks Don't Work

Claude Code hooks can only be configured via:
- `~/.claude/settings.json` (global)
- `.claude/settings.json` (project-level)

The CLI does **not** support a `--hook-config` flag. The `.sprint-hooks.json` file is generated per-sprint but has no effect because:
1. It's not in a location Claude Code reads
2. Claude Code CLI has no option to specify hook configuration at runtime

### 5. Activity File Status

The file `.sprint-activity.jsonl` **does not exist** in the sprint directory, confirming the hook is never executed.

## Affected Files

| File | Issue |
|------|-------|
| `plugins/m42-sprint/scripts/sprint-loop.sh` | `--hook-config` parameter is dead code |
| `plugins/m42-sprint/commands/run-sprint.md` | Documents hook config generation but it's ineffective |
| `plugins/m42-sprint/docs/USER-GUIDE.md` | May reference non-functional hook feature |

## Root Cause Chain

```
1. /run-sprint command generates .sprint-hooks.json
           ↓
2. sprint-loop.sh accepts --hook-config but ignores it
           ↓
3. claude CLI invoked without hook configuration
           ↓
4. PostToolUse hook never fires
           ↓
5. .sprint-activity.jsonl never created
           ↓
6. ActivityWatcher has nothing to watch
           ↓
7. Activity Feed shows no events
```

## Fix Options

### Option A: Register Hooks in Settings (Recommended)

Modify `run-sprint.md` to:
1. Merge hook configuration into project `.claude/settings.json`
2. Remove hook configuration after sprint completes

### Option B: Alternative Activity Tracking

Use a different mechanism that doesn't rely on Claude Code hooks:
- Periodic log file parsing
- Direct integration with sprint-loop.sh output

### Option C: Request Claude Code Feature

Request a CLI option like `--hooks-file` to pass hook configuration at runtime.

## Recommendation

**Option A** is the most practical fix. The command should:
1. Backup existing `.claude/settings.json`
2. Merge hooks into settings before sprint starts
3. Restore original settings after sprint completes
