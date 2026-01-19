#!/bin/bash

# Preflight Check - Validate sprint environment before execution
# Run this before starting the sprint loop to catch issues early

set -euo pipefail

SPRINT_DIR="$1"

if [[ -z "$SPRINT_DIR" ]] || [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Valid sprint directory required" >&2
  exit 1
fi

PROGRESS_FILE="$SPRINT_DIR/PROGRESS.yaml"
SPRINT_FILE="$SPRINT_DIR/SPRINT.yaml"
ERRORS=()

echo "Running preflight checks..."

# Check 1: Required tools are available
echo "  Checking required tools..."
if ! command -v yq &> /dev/null; then
  ERRORS+=("Required tool 'yq' is not installed")
fi

if ! command -v node &> /dev/null; then
  ERRORS+=("Required tool 'node' is not installed")
fi

if ! command -v claude &> /dev/null; then
  ERRORS+=("Required tool 'claude' CLI is not installed")
fi

# Check 2: Sprint directory is writable
echo "  Checking directory permissions..."
if [[ ! -w "$SPRINT_DIR" ]]; then
  ERRORS+=("Sprint directory is not writable: $SPRINT_DIR")
fi

# Check 3: PROGRESS.yaml is valid and not corrupted
echo "  Validating PROGRESS.yaml..."
if [[ ! -f "$PROGRESS_FILE" ]]; then
  ERRORS+=("PROGRESS.yaml not found")
else
  if ! yq -e '.' "$PROGRESS_FILE" > /dev/null 2>&1; then
    ERRORS+=("PROGRESS.yaml is corrupted or invalid YAML")
  else
    # Check required fields exist
    SPRINT_ID=$(yq -r '.["sprint-id"] // ""' "$PROGRESS_FILE")
    if [[ -z "$SPRINT_ID" ]]; then
      ERRORS+=("PROGRESS.yaml missing required field: sprint-id")
    fi

    STATUS=$(yq -r '.status // ""' "$PROGRESS_FILE")
    if [[ -z "$STATUS" ]]; then
      ERRORS+=("PROGRESS.yaml missing required field: status")
    fi

    # Check for mode-specific required fields
    # Standard mode requires 'phases', Ralph mode requires 'goal'
    MODE=$(yq -r '.mode // "standard"' "$PROGRESS_FILE")
    if [[ "$MODE" == "ralph" ]]; then
      GOAL=$(yq -r '.goal // ""' "$PROGRESS_FILE")
      if [[ -z "$GOAL" ]]; then
        ERRORS+=("PROGRESS.yaml missing required field for ralph mode: goal")
      fi
    else
      PHASES=$(yq -r '.phases // "null"' "$PROGRESS_FILE")
      if [[ "$PHASES" == "null" ]]; then
        ERRORS+=("PROGRESS.yaml missing required field: phases")
      fi
    fi
  fi
fi

# Check 4: All referenced workflow files exist (if SPRINT.yaml references external workflows)
echo "  Checking workflow references..."
if [[ -f "$SPRINT_FILE" ]]; then
  # Check if workflow field references an external file
  WORKFLOW=$(yq -r '.workflow // ""' "$SPRINT_FILE")
  if [[ -n "$WORKFLOW" ]] && [[ "$WORKFLOW" != "null" ]]; then
    # Check if it's a file reference (not a built-in workflow name)
    if [[ "$WORKFLOW" == *.yaml ]] || [[ "$WORKFLOW" == *.yml ]]; then
      # Could be relative to sprint dir or absolute
      if [[ "$WORKFLOW" == /* ]]; then
        WORKFLOW_PATH="$WORKFLOW"
      else
        WORKFLOW_PATH="$SPRINT_DIR/$WORKFLOW"
      fi
      if [[ ! -f "$WORKFLOW_PATH" ]]; then
        ERRORS+=("Referenced workflow file not found: $WORKFLOW")
      fi
    fi
  fi
fi

# Report results
echo ""
if [[ ${#ERRORS[@]} -eq 0 ]]; then
  echo "Preflight checks passed."
  exit 0
else
  echo "Preflight checks FAILED:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi
