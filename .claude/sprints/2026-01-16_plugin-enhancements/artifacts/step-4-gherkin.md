# Gherkin Scenarios: step-4

## Step Task
Track C - Step 1: Create Sprint Activity Hook Script

Implement PostToolCall hook for sprint activity logging.

Requirements:
- Create hooks/sprint-activity-hook.sh shell script
- Hook receives sprint directory path as argument
- Parse Claude Code tool call information from stdin (JSON format)
- Extract: tool name, file paths, key parameters, timestamps
- Write activity events to <sprint-dir>/.sprint-activity.jsonl in JSONL format
- Support verbosity levels: minimal, basic, detailed, verbose
- Event format: {"ts":"ISO-timestamp","type":"tool","tool":"ToolName","file":"path","level":"basic"}
- Handle different tool types: Read, Write, Edit, Bash, Grep, Glob, etc.
- Ensure atomic writes to prevent corruption
- Add error handling for malformed input

New file to create:
- hooks/sprint-activity-hook.sh

Reference:
- Claude Code hook documentation for PostToolCall format
- Existing hook examples in the codebase

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Hook script file exists
  Given the sprint plugin directory structure exists
  When I check for the hook script file
  Then hooks/sprint-activity-hook.sh exists in the plugin directory

Verification: `test -f plugins/m42-sprint/hooks/sprint-activity-hook.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Hook script is executable
  Given hooks/sprint-activity-hook.sh exists
  When I check the file permissions
  Then the script has executable permission

Verification: `test -x plugins/m42-sprint/hooks/sprint-activity-hook.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Hook script has proper shebang
  Given hooks/sprint-activity-hook.sh exists
  When I examine the first line of the script
  Then it starts with a valid bash shebang (#!/bin/bash or #!/usr/bin/env bash)

Verification: `head -1 plugins/m42-sprint/hooks/sprint-activity-hook.sh | grep -qE '^#!/(bin/bash|usr/bin/env bash)'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Hook script parses JSON input and writes JSONL output
  Given hooks/sprint-activity-hook.sh exists and is executable
  When I pipe PostToolUse JSON input with a Write tool event
  Then it writes a valid JSONL entry to the activity file

Verification: `SPRINT_DIR=$(mktemp -d) && echo '{"hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"/test/file.ts"},"tool_response":{"success":true}}' | bash plugins/m42-sprint/hooks/sprint-activity-hook.sh "$SPRINT_DIR" && test -f "$SPRINT_DIR/.sprint-activity.jsonl" && jq -e '.tool == "Write"' "$SPRINT_DIR/.sprint-activity.jsonl" >/dev/null && rm -rf "$SPRINT_DIR"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Hook script includes timestamp in ISO format
  Given hooks/sprint-activity-hook.sh exists and is executable
  When I pipe PostToolUse JSON input
  Then the output contains a valid ISO-8601 timestamp in the "ts" field

Verification: `SPRINT_DIR=$(mktemp -d) && echo '{"hook_event_name":"PostToolUse","tool_name":"Read","tool_input":{"file_path":"/test.txt"}}' | bash plugins/m42-sprint/hooks/sprint-activity-hook.sh "$SPRINT_DIR" && jq -e '.ts | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}")' "$SPRINT_DIR/.sprint-activity.jsonl" >/dev/null && rm -rf "$SPRINT_DIR"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Hook script supports verbosity levels via environment variable
  Given hooks/sprint-activity-hook.sh exists and is executable
  When I set SPRINT_ACTIVITY_VERBOSITY=verbose and pipe JSON input
  Then the output includes the "level" field set to "verbose"

Verification: `SPRINT_DIR=$(mktemp -d) && SPRINT_ACTIVITY_VERBOSITY=verbose bash -c 'echo "{\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"ls\"}}" | bash plugins/m42-sprint/hooks/sprint-activity-hook.sh "$SPRINT_DIR"' && jq -e '.level == "verbose"' "$SPRINT_DIR/.sprint-activity.jsonl" >/dev/null && rm -rf "$SPRINT_DIR"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Hook script extracts file path for file-based tools
  Given hooks/sprint-activity-hook.sh exists and is executable
  When I pipe PostToolUse JSON for an Edit tool with file_path
  Then the output includes the "file" field with the extracted path

Verification: `SPRINT_DIR=$(mktemp -d) && echo '{"hook_event_name":"PostToolUse","tool_name":"Edit","tool_input":{"file_path":"/src/main.ts","old_string":"foo","new_string":"bar"}}' | bash plugins/m42-sprint/hooks/sprint-activity-hook.sh "$SPRINT_DIR" && jq -e '.file == "/src/main.ts"' "$SPRINT_DIR/.sprint-activity.jsonl" >/dev/null && rm -rf "$SPRINT_DIR"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Hook script handles malformed JSON gracefully
  Given hooks/sprint-activity-hook.sh exists and is executable
  When I pipe invalid JSON input
  Then the script exits with code 0 (non-blocking) and does not write corrupted data

Verification: `SPRINT_DIR=$(mktemp -d) && echo 'not valid json {{{' | bash plugins/m42-sprint/hooks/sprint-activity-hook.sh "$SPRINT_DIR"; EXIT_CODE=$?; test "$EXIT_CODE" -eq 0 && { test ! -f "$SPRINT_DIR/.sprint-activity.jsonl" || ! grep -q 'not valid json' "$SPRINT_DIR/.sprint-activity.jsonl"; } && rm -rf "$SPRINT_DIR"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
