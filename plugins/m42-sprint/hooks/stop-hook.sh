#!/bin/bash

# Sprint Loop Stop Hook
# Prevents session exit when a sprint loop is active
# Feeds the sprint prompt back to continue task processing

set -euo pipefail

# Read hook input from stdin (advanced stop hook API)
HOOK_INPUT=$(cat)

# Find active loop state file in sprint directories
LOOP_STATE=""
for state_file in .claude/sprints/*/loop-state.md; do
  if [[ -f "$state_file" ]]; then
    LOOP_STATE="$state_file"
    break
  fi
done

if [[ -z "$LOOP_STATE" ]] || [[ ! -f "$LOOP_STATE" ]]; then
  # No active sprint loop - allow exit
  exit 0
fi

# Extract sprint directory from state file path
SPRINT_DIR=$(dirname "$LOOP_STATE")

# Parse markdown frontmatter (YAML between ---) and extract values
FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$LOOP_STATE")
ITERATION=$(echo "$FRONTMATTER" | grep '^iteration:' | sed 's/iteration: *//')
MAX_ITERATIONS=$(echo "$FRONTMATTER" | grep '^max_iterations:' | sed 's/max_iterations: *//')
# Extract completion_promise and strip surrounding quotes if present
COMPLETION_PROMISE=$(echo "$FRONTMATTER" | grep '^completion_promise:' | sed 's/completion_promise: *//' | sed 's/^"\(.*\)"$/\1/')

# Validate numeric fields before arithmetic operations
if [[ ! "$ITERATION" =~ ^[0-9]+$ ]]; then
  echo "Warning: Sprint loop state file corrupted" >&2
  echo "   File: $LOOP_STATE" >&2
  echo "   Problem: 'iteration' field is not a valid number (got: '$ITERATION')" >&2
  echo "" >&2
  echo "   This usually means the state file was manually edited or corrupted." >&2
  echo "   Sprint loop is stopping. Run /run-sprint again to start fresh." >&2
  rm "$LOOP_STATE"
  exit 0
fi

if [[ ! "$MAX_ITERATIONS" =~ ^[0-9]+$ ]]; then
  echo "Warning: Sprint loop state file corrupted" >&2
  echo "   File: $LOOP_STATE" >&2
  echo "   Problem: 'max_iterations' field is not a valid number (got: '$MAX_ITERATIONS')" >&2
  echo "" >&2
  echo "   This usually means the state file was manually edited or corrupted." >&2
  echo "   Sprint loop is stopping. Run /run-sprint again to start fresh." >&2
  rm "$LOOP_STATE"
  exit 0
fi

# Check if pause requested in PROGRESS.yaml
PROGRESS_FILE="$SPRINT_DIR/PROGRESS.yaml"
if [[ -f "$PROGRESS_FILE" ]]; then
  PAUSE_REQUESTED=$(grep -E '^pause-requested:\s*true' "$PROGRESS_FILE" || echo "")
  if [[ -n "$PAUSE_REQUESTED" ]]; then
    echo "Sprint loop: Pause requested - stopping gracefully."
    rm "$LOOP_STATE"
    exit 0
  fi
fi

# Check if max iterations reached
if [[ $MAX_ITERATIONS -gt 0 ]] && [[ $ITERATION -ge $MAX_ITERATIONS ]]; then
  echo "Sprint loop: Max iterations ($MAX_ITERATIONS) reached."
  rm "$LOOP_STATE"
  exit 0
fi

# Get transcript path from hook input
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path')

if [[ ! -f "$TRANSCRIPT_PATH" ]]; then
  echo "Warning: Sprint loop - Transcript file not found" >&2
  echo "   Expected: $TRANSCRIPT_PATH" >&2
  echo "   This is unusual and may indicate a Claude Code internal issue." >&2
  echo "   Sprint loop is stopping." >&2
  rm "$LOOP_STATE"
  exit 0
fi

# Read last assistant message from transcript (JSONL format - one JSON per line)
# First check if there are any assistant messages
if ! grep -q '"role":"assistant"' "$TRANSCRIPT_PATH"; then
  echo "Warning: Sprint loop - No assistant messages found in transcript" >&2
  echo "   Transcript: $TRANSCRIPT_PATH" >&2
  echo "   This is unusual and may indicate a transcript format issue" >&2
  echo "   Sprint loop is stopping." >&2
  rm "$LOOP_STATE"
  exit 0
fi

# Extract last assistant message with explicit error handling
LAST_LINE=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" | tail -1)
if [[ -z "$LAST_LINE" ]]; then
  echo "Warning: Sprint loop - Failed to extract last assistant message" >&2
  echo "   Sprint loop is stopping." >&2
  rm "$LOOP_STATE"
  exit 0
fi

# Parse JSON with error handling
LAST_OUTPUT=$(echo "$LAST_LINE" | jq -r '
  .message.content |
  map(select(.type == "text")) |
  map(.text) |
  join("\n")
' 2>&1)

# Check if jq succeeded
if [[ $? -ne 0 ]]; then
  echo "Warning: Sprint loop - Failed to parse assistant message JSON" >&2
  echo "   Error: $LAST_OUTPUT" >&2
  echo "   This may indicate a transcript format issue" >&2
  echo "   Sprint loop is stopping." >&2
  rm "$LOOP_STATE"
  exit 0
fi

if [[ -z "$LAST_OUTPUT" ]]; then
  echo "Warning: Sprint loop - Assistant message contained no text content" >&2
  echo "   Sprint loop is stopping." >&2
  rm "$LOOP_STATE"
  exit 0
fi

# Check for completion promise (handles pipe-separated alternatives)
if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
  # Extract text from <promise> tags using Perl for multiline support
  PROMISE_TEXT=$(echo "$LAST_OUTPUT" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")

  if [[ -n "$PROMISE_TEXT" ]]; then
    # Check against pipe-separated completion promises
    IFS='|' read -ra PROMISES <<< "$COMPLETION_PROMISE"
    for promise in "${PROMISES[@]}"; do
      if [[ "$PROMISE_TEXT" = "$promise" ]]; then
        echo "Sprint loop: Detected <promise>$promise</promise>"
        rm "$LOOP_STATE"
        exit 0
      fi
    done
  fi
fi

# Not complete - continue loop with SAME PROMPT
NEXT_ITERATION=$((ITERATION + 1))

# Extract prompt (everything after the closing ---)
# Skip first --- line, skip until second --- line, then print everything after
PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' "$LOOP_STATE")

if [[ -z "$PROMPT_TEXT" ]]; then
  echo "Warning: Sprint loop - State file corrupted or incomplete" >&2
  echo "   File: $LOOP_STATE" >&2
  echo "   Problem: No prompt text found" >&2
  echo "" >&2
  echo "   This usually means:" >&2
  echo "     - State file was manually edited" >&2
  echo "     - File was corrupted during writing" >&2
  echo "" >&2
  echo "   Sprint loop is stopping. Run /run-sprint again to start fresh." >&2
  rm "$LOOP_STATE"
  exit 0
fi

# Update iteration in frontmatter (portable across macOS and Linux)
TEMP_FILE="${LOOP_STATE}.tmp.$$"
sed "s/^iteration: .*/iteration: $NEXT_ITERATION/" "$LOOP_STATE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$LOOP_STATE"

# Build system message with iteration count and sprint name
SPRINT_NAME=$(basename "$SPRINT_DIR")
SYSTEM_MSG="Sprint '$SPRINT_NAME' iteration $NEXT_ITERATION | Stop: SPRINT COMPLETE, SPRINT BLOCKED, or SPRINT PAUSED"

# Output JSON to block the stop and feed prompt back
jq -n \
  --arg prompt "$PROMPT_TEXT" \
  --arg msg "$SYSTEM_MSG" \
  '{
    "decision": "block",
    "reason": $prompt,
    "systemMessage": $msg
  }'

exit 0
