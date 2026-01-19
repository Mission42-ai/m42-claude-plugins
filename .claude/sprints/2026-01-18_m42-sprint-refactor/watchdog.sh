#!/bin/bash
# Sprint Watchdog - Keeps the sprint running overnight
# Checks every 30 minutes, restarts if needed, logs status

SPRINT_DIR=".claude/sprints/2026-01-18_m42-sprint-refactor"
PROGRESS_FILE="$SPRINT_DIR/PROGRESS.yaml"
WATCHDOG_LOG="$SPRINT_DIR/watchdog.log"
SPRINT_LOOP="/home/konstantin/.claude/plugins/cache/m42-claude-plugins/m42-sprint/2.0.0/scripts/sprint-loop.sh"
CHECK_INTERVAL=1800  # 30 minutes in seconds
MIN_RUNTIME_HOURS=4  # Minimum hours to run

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$WATCHDOG_LOG"
}

check_and_restart() {
  local status iteration steps
  status=$(yq -r '.status // "unknown"' "$PROGRESS_FILE" 2>/dev/null)
  iteration=$(yq -r '.stats."current-iteration" // 0' "$PROGRESS_FILE" 2>/dev/null)
  steps=$(yq -r '."dynamic-steps" | length' "$PROGRESS_FILE" 2>/dev/null)
  pending=$(yq -r '[."dynamic-steps"[] | select(.status == "pending")] | length' "$PROGRESS_FILE" 2>/dev/null)

  log "Status: $status | Iteration: $iteration | Total steps: $steps | Pending: $pending"

  # Check if sprint loop is running
  if ! pgrep -f "sprint-loop.sh.*$SPRINT_DIR" > /dev/null 2>&1; then
    log "WARNING: Sprint loop not running!"

    # Check if sprint is completed or blocked
    if [[ "$status" == "completed" ]]; then
      log "Sprint completed successfully. Watchdog exiting."
      exit 0
    elif [[ "$status" == "blocked" ]] || [[ "$status" == "needs-human" ]]; then
      log "Sprint blocked or needs human. Watchdog exiting."
      exit 1
    else
      log "Restarting sprint loop..."
      nohup "$SPRINT_LOOP" "$SPRINT_DIR" >> "$WATCHDOG_LOG" 2>&1 &
      sleep 5
      if pgrep -f "sprint-loop.sh.*$SPRINT_DIR" > /dev/null 2>&1; then
        log "Sprint loop restarted successfully"
      else
        log "ERROR: Failed to restart sprint loop"
      fi
    fi
  else
    log "Sprint loop is running (OK)"
  fi

  # Check if Claude process is active (iteration is actually progressing)
  if ! pgrep -f "claude.*dangerously-skip-permissions" > /dev/null 2>&1; then
    log "NOTE: No active Claude process - may be between iterations"
  fi
}

# Initial log
log "=========================================="
log "Watchdog started - monitoring for $MIN_RUNTIME_HOURS hours"
log "Check interval: $CHECK_INTERVAL seconds (30 min)"
log "=========================================="

# Calculate end time
END_TIME=$(($(date +%s) + MIN_RUNTIME_HOURS * 3600))

# Main monitoring loop
while [[ $(date +%s) -lt $END_TIME ]]; do
  check_and_restart

  # Wait for next check
  log "Next check in 30 minutes..."
  sleep $CHECK_INTERVAL
done

log "Watchdog: Minimum runtime reached. Final status check..."
check_and_restart
log "Watchdog completed."
