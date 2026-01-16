# Step Context: step-4

## Task
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

## Related Code Patterns

### Similar Implementation: plugins/m42-sprint/scripts/preflight-check.sh
```bash
#!/bin/bash
set -euo pipefail

SPRINT_DIR="$1"

if [[ -z "$SPRINT_DIR" ]] || [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Valid sprint directory required" >&2
  exit 1
fi
```
**Pattern**: Argument validation, error handling to stderr, using `set -euo pipefail`

### Similar Implementation: plugins/m42-sprint/scripts/sprint-loop.sh
```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```
**Pattern**: Getting script directory, structured bash with functions

## Required Imports
### Internal
- None (shell script, not TypeScript)

### External (CLI tools)
- `jq`: JSON parsing and validation
- `date`: ISO timestamp generation

## Types/Interfaces to Use

### PostToolUse Input Schema (from hook-schemas.md)
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "hook_event_name": "PostToolUse",
  "tool_name": "ToolName",
  "tool_input": {
    // Tool-specific parameters
    // For Write: { "file_path": "...", "content": "..." }
    // For Bash: { "command": "...", "description": "..." }
    // For Read: { "file_path": "...", "offset": 0, "limit": 100 }
    // For Edit: { "file_path": "...", "old_string": "...", "new_string": "..." }
  },
  "tool_response": {
    // Tool-specific response
  }
}
```

### Output Event Format (JSONL)
```json
{"ts":"2026-01-16T13:00:00Z","type":"tool","tool":"Write","file":"/path/to/file.ts","level":"basic"}
```

### Verbosity Levels
- `minimal`: Only tool name and timestamp
- `basic`: Tool name, file path (if applicable), timestamp
- `detailed`: Includes file path, key parameters (e.g., command for Bash)
- `verbose`: Full tool_input and tool_response

## Integration Points
- **Called by**: Claude Code PostToolUse hook event
- **Reads from**: stdin (JSON from Claude Code)
- **Writes to**: `<sprint-dir>/.sprint-activity.jsonl`
- **Configuration**: `SPRINT_ACTIVITY_VERBOSITY` environment variable

## Tool-Specific File Path Extraction

| Tool | File Path Field |
|------|-----------------|
| Read | `tool_input.file_path` |
| Write | `tool_input.file_path` |
| Edit | `tool_input.file_path` |
| Glob | `tool_input.path` (directory) |
| Grep | `tool_input.path` |
| NotebookEdit | `tool_input.notebook_path` |

## Implementation Notes
- **Atomic writes**: Use temp file + mv pattern to prevent corruption
- **Exit code 0**: Required for non-blocking (even on errors) per test scenario 8
- **jq validation**: Use `jq -e` to validate JSON input
- **Shebang**: `#!/usr/bin/env bash` (cross-platform compatible per scenario 3)
- **Verbosity default**: Should default to "basic" if not specified
- **Executable permission**: Script must be made executable (chmod +x)

## Test Scenarios Summary
1. File exists: `plugins/m42-sprint/hooks/sprint-activity-hook.sh`
2. Is executable: `test -x`
3. Valid shebang: `#!/bin/bash` or `#!/usr/bin/env bash`
4. Parses JSON and writes JSONL with correct tool field
5. Timestamp in ISO-8601 format in "ts" field
6. Respects `SPRINT_ACTIVITY_VERBOSITY` environment variable
7. Extracts file path from Edit tool input
8. Exits 0 on malformed JSON (non-blocking)

## Directory Structure After Implementation
```
plugins/m42-sprint/
├── hooks/
│   └── sprint-activity-hook.sh   # NEW: PostToolUse hook script
├── scripts/
│   ├── sprint-loop.sh
│   ├── preflight-check.sh
│   └── build-sprint-prompt.sh
├── commands/
├── compiler/
├── skills/
└── docs/
```
