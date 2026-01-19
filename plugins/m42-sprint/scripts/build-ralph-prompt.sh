#!/bin/bash

# Build Ralph Prompt - Goal-driven autonomous execution
# Generates prompts for Ralph Mode iterations based on current state
# Outputs prompt to stdout for use by sprint-loop.sh
#
# DETERMINISTIC WORKFLOW: Agent returns JSON, loop handles all YAML updates

set -euo pipefail

SPRINT_DIR="$1"
MODE="$2"
ITERATION="${3:-1}"

if [[ -z "$SPRINT_DIR" ]] || [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Valid sprint directory required" >&2
  exit 1
fi

if [[ -z "$MODE" ]]; then
  echo "Error: Mode required (planning, executing, reflecting)" >&2
  exit 1
fi

PROGRESS_FILE="$SPRINT_DIR/PROGRESS.yaml"
if [[ ! -f "$PROGRESS_FILE" ]]; then
  echo "Error: PROGRESS.yaml not found" >&2
  exit 1
fi

if ! command -v yq &> /dev/null; then
  echo "Error: yq is required" >&2
  exit 1
fi

# Read goal from PROGRESS.yaml
GOAL=$(yq -r '.goal // "No goal defined"' "$PROGRESS_FILE")

# Read workflow file path and optional prompts
WORKFLOW_FILE=$(yq -r '.workflow-file // ""' "$PROGRESS_FILE")
GOAL_PROMPT=""
REFLECTION_PROMPT=""

if [[ -n "$WORKFLOW_FILE" ]] && [[ -f "$WORKFLOW_FILE" ]]; then
  GOAL_PROMPT=$(yq -r '."goal-prompt" // ""' "$WORKFLOW_FILE")
  REFLECTION_PROMPT=$(yq -r '."reflection-prompt" // ""' "$WORKFLOW_FILE")
fi

# Get existing pending steps for context
PENDING_STEPS=$(yq -r '[.dynamic-steps // [] | .[] | select(.status == "pending")] | .[] | "- " + .id + ": " + .prompt' "$PROGRESS_FILE" 2>/dev/null || echo "")
COMPLETED_STEPS=$(yq -r '[.dynamic-steps // [] | .[] | select(.status == "completed")] | .[] | "- " + .id + ": " + .prompt' "$PROGRESS_FILE" 2>/dev/null || echo "")

# Get pattern results for context
# Pattern results tell Ralph what patterns accomplished in previous iterations
# Uses yq to extract data, then bash to format (more compatible with yq v4)
format_pattern_result() {
  local pattern="$1"
  local iteration="$2"
  local verified="$3"
  local message="$4"
  local show_iteration="$5"  # "true" to show iteration number

  local status_str
  if [[ "$verified" == "true" ]]; then
    status_str="✓ verified"
  else
    status_str="✗ verification failed"
  fi

  local result="- **${pattern}**"
  if [[ "$show_iteration" == "true" ]]; then
    result="${result} (iteration ${iteration})"
  fi
  result="${result}: ${status_str}"

  if [[ -n "$message" ]] && [[ "$message" != "null" ]] && [[ "$message" != "" ]]; then
    result="${result} - ${message}"
  fi

  echo "$result"
}

get_pattern_results() {
  local filter="${1:-all}"  # "all", "recent" (last iteration), or a specific iteration number
  local current_iter="$ITERATION"

  # Check if pattern-results exists and is non-empty
  local has_results
  has_results=$(yq -r '.pattern-results // [] | length' "$PROGRESS_FILE" 2>/dev/null || echo "0")

  if [[ "$has_results" == "0" ]]; then
    return
  fi

  local results=""
  local selector=""
  local show_iteration="false"

  case "$filter" in
    all)
      # Get all results, show iteration numbers
      selector="."
      show_iteration="true"
      ;;
    recent)
      # Get results from previous iteration (current - 1)
      local prev_iter=$((current_iter - 1))
      if [[ $prev_iter -lt 1 ]]; then
        return
      fi
      selector="select(.iteration == $prev_iter)"
      show_iteration="false"
      ;;
    *)
      # Specific iteration number
      selector="select(.iteration == $filter)"
      show_iteration="false"
      ;;
  esac

  # Extract pattern results as tab-separated values and format each
  while IFS=$'\t' read -r pattern iteration verified message; do
    if [[ -n "$pattern" ]]; then
      format_pattern_result "$pattern" "$iteration" "$verified" "$message" "$show_iteration"
    fi
  done < <(yq -r ".pattern-results[] | $selector | [.pattern, .iteration, .verified, .[\"verification-message\"] // \"\"] | @tsv" "$PROGRESS_FILE" 2>/dev/null)
}

# Get recent pattern results (from previous iteration)
RECENT_PATTERN_RESULTS=$(get_pattern_results "recent")
# Get all pattern results
ALL_PATTERN_RESULTS=$(get_pattern_results "all")

# Output JSON result reporting section (common to all modes)
output_json_instructions() {
  cat <<'JSONEOF'

## Result Reporting (IMPORTANT)

Do NOT modify PROGRESS.yaml directly. The sprint loop handles all state updates.
Report your result as JSON in your final output.

**Continue working (add/reorder steps):**
```json
{
  "status": "continue",
  "summary": "What was done this iteration",
  "completedStepIds": ["step-0", "step-1"],
  "pendingSteps": [
    {"id": "step-2", "prompt": "Existing step to do next"},
    {"id": null, "prompt": "New step to add"},
    {"id": "step-3", "prompt": "Existing step moved later"}
  ]
}
```

**Goal complete:**
```json
{
  "status": "goal-complete",
  "summary": "What was done this iteration",
  "completedStepIds": ["step-5"],
  "goalCompleteSummary": "Detailed summary of all accomplishments"
}
```

**Need human help:**
```json
{
  "status": "needs-human",
  "summary": "What was attempted",
  "humanNeeded": {"reason": "Why human is needed", "details": "Context"}
}
```

**Invoke a pattern (optional):**
When you're ready to EXECUTE something that should follow proven practices, invoke a pattern:
```json
{
  "status": "continue",
  "summary": "Designed the feature, ready to implement",
  "invokePattern": {
    "name": "implement-feature",
    "params": {
      "feature": "User authentication",
      "scope": "src/auth/**",
      "context": "JWT-based authentication with refresh tokens"
    }
  },
  "pendingSteps": [...]
}
```

### Available Patterns
- `implement-feature`: TDD implementation (params: feature, scope, context)
- `fix-bug`: Debug and fix workflow (params: issue, symptoms, location)
- `refactor`: Safe refactoring (params: target, goal, scope)
- `document`: Documentation update (params: subject, type, audience)

### JSON Field Reference

- `status`: Required. One of "continue", "goal-complete", "needs-human"
- `summary`: Required. Brief summary of this iteration's work
- `completedStepIds`: Array of step IDs you completed this iteration
- `pendingSteps`: Complete ordered list of ALL pending steps (existing + new). First item = next to execute
  - Set `id` to existing step ID to keep it, or `null` for new steps
  - The order you provide IS the execution order
- `goalCompleteSummary`: Final summary when goal is achieved
- `humanNeeded.reason` / `humanNeeded.details`: Required when status is "needs-human"
- `invokePattern`: Optional. Invoke a proven execution pattern (name + params)
JSONEOF
}

case "$MODE" in
  planning)
    # First iteration or after reflection - analyze goal, think deeply
    cat <<EOF
# Ralph Mode: Deep Thinking
Iteration: $ITERATION

## Your Goal
$GOAL

## The Ralph Mindset
This is not about rushing to implement everything. It's about **deep, thoughtful work**:

- Think deeply about the problem before acting
- Make ONE thoughtful contribution this iteration
- Reflect on the best approach, not just any approach
- Shape the work proactively - you design the process
- Quality of thought matters more than speed

Ask yourself:
- What do I need to understand first?
- What context would help me do this well?
- What's the right approach, not just a working approach?
- Am I solving the right problem?
EOF

    # Include goal-prompt template if defined
    if [[ -n "$GOAL_PROMPT" ]]; then
      cat <<EOF

## Goal Analysis Guidelines
$GOAL_PROMPT
EOF
    fi

    # Show recent pattern results if any (previous iteration)
    if [[ -n "$RECENT_PATTERN_RESULTS" ]]; then
      cat <<EOF

## Previous Iteration Pattern Results
$RECENT_PATTERN_RESULTS
EOF
    fi

    cat <<EOF

## This Iteration
1. Think deeply about the goal and what it really requires
2. Create thoughtful steps that reflect your understanding
3. Take ONE meaningful action if you're ready - or just plan if you need more clarity
4. Report your result as JSON (see below)

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## EXIT after this iteration
EOF

    output_json_instructions
    ;;

  executing)
    # Has pending steps - work on next step thoughtfully
    STEP_ID=$(yq -r '[.dynamic-steps[] | select(.status == "pending")][0].id // "null"' "$PROGRESS_FILE")
    STEP_PROMPT=$(yq -r "[.dynamic-steps[] | select(.id == \"$STEP_ID\")][0].prompt // \"No prompt\"" "$PROGRESS_FILE")

    if [[ "$STEP_ID" == "null" ]]; then
      echo "Error: No pending step found" >&2
      exit 1
    fi

    cat <<EOF
# Ralph Mode: Thoughtful Work
Iteration: $ITERATION

## Goal (context)
$GOAL

## Current Task: $STEP_ID
$STEP_PROMPT
EOF

    # Show recent pattern results if any
    if [[ -n "$RECENT_PATTERN_RESULTS" ]]; then
      cat <<EOF

## Previous Iteration Pattern Results
The following patterns were invoked in the previous iteration:
$RECENT_PATTERN_RESULTS

Use these results to inform your next steps. If a pattern failed verification, consider what went wrong.
EOF
    fi

    cat <<EOF

## The Ralph Mindset
You don't need to complete everything in one iteration. Focus on:

- **Think first**: Understand what this task really requires
- **One thoughtful contribution**: Make meaningful progress, not rushed completion
- **Reflect as you work**: Is this the right approach? Should the plan change?
- **Shape the process**: Add, reorder, or refine steps based on what you learn
- **Quality over speed**: A well-thought solution beats a quick hack

It's okay to:
- Partially complete a task and continue next iteration
- Realize the task needs to be broken down differently
- Discover that other work should come first
- Add context-gathering or research as new steps
EOF

    # Show other pending steps for context
    if [[ -n "$PENDING_STEPS" ]]; then
      OTHER_PENDING=$(echo "$PENDING_STEPS" | grep -v "^- $STEP_ID:" || true)
      if [[ -n "$OTHER_PENDING" ]]; then
        cat <<EOF

## Other Pending Steps
$OTHER_PENDING
EOF
      fi
    fi

    cat <<EOF

## This Iteration
1. Think about what this task really needs
2. Make ONE thoughtful contribution toward it
3. Reflect: Should the plan change based on what you learned?
4. Report your result as JSON (see below)

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## EXIT after this iteration
EOF

    output_json_instructions
    ;;

  reflecting)
    # No pending steps - time for deep reflection
    COMPLETED_COUNT=$(yq -r '[.dynamic-steps[] | select(.status == "completed")] | length' "$PROGRESS_FILE")

    cat <<EOF
# Ralph Mode: Deep Reflection
Iteration: $ITERATION

## Goal
$GOAL

## What's Been Done ($COMPLETED_COUNT steps)
$COMPLETED_STEPS
EOF

    # Show all pattern results in reflection mode
    if [[ -n "$ALL_PATTERN_RESULTS" ]]; then
      cat <<EOF

## Pattern Executions
The following patterns were invoked during this sprint:
$ALL_PATTERN_RESULTS
EOF
    fi

    cat <<EOF

No pending steps remain. This is a moment for genuine reflection.

## The Ralph Mindset
Take time to think deeply:

- **Step back**: Look at the big picture, not just the tasks
- **Evaluate honestly**: Is the goal truly achieved, or just partially?
- **Consider quality**: Does the work meet the standard it should?
- **Think about what's missing**: Edge cases? Documentation? Tests? Refinement?
- **Be honest**: If it's not ready, it's not ready

Questions to consider:
- Would I be proud to ship this?
- What would I want to improve if I had more time?
- Are there insights worth capturing as learnings?
- Did I discover something that should change how we work?
EOF

    # Include reflection-prompt template if defined
    if [[ -n "$REFLECTION_PROMPT" ]]; then
      cat <<EOF

## Reflection Guidelines
$REFLECTION_PROMPT
EOF
    fi

    cat <<EOF

## Your Options

**Goal Truly Achieved**
If the work is genuinely complete and meets the quality bar, report "goal-complete"

**More Work Needed**
If there's meaningful work remaining, add thoughtful next steps

**Need Human Input**
If you're blocked or need decisions you can't make, report "needs-human"

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## EXIT after this reflection
EOF

    output_json_instructions
    ;;

  *)
    echo "Error: Unknown mode '$MODE'. Use: planning, executing, reflecting" >&2
    exit 1
    ;;
esac
