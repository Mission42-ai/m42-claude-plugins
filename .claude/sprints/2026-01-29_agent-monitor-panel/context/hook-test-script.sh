#!/bin/bash
# Test hook to discover how session_id and other fields work with parallel agents
# Install: Add to .claude/settings.json hooks section
# Usage: Run claude with multiple parallel Task calls and check /tmp/hook-events.jsonl

LOG_FILE="${CLAUDE_PROJECT_DIR:-/tmp}/.hook-events.jsonl"

# Read JSON from stdin
INPUT=$(cat)

# Add timestamp and write to log
echo "$INPUT" | jq -c '. + {logged_at: (now | todate)}' >> "$LOG_FILE"

exit 0
