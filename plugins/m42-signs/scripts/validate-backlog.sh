#!/bin/bash
set -euo pipefail

# Validate a learning backlog YAML file
# Usage: validate-backlog.sh <backlog-file>

FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "Error: Backlog file path required" >&2
  echo "Usage: validate-backlog.sh <backlog-file>" >&2
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "Error: File not found: $FILE" >&2
  exit 1
fi

# Check required tool
if ! command -v yq &> /dev/null; then
  echo "Error: Required tool 'yq' is not installed" >&2
  exit 1
fi

ERRORS=()
WARNINGS=()

# Check 1: Valid YAML syntax
if ! yq eval '.' "$FILE" > /dev/null 2>&1; then
  ERRORS+=("Invalid YAML syntax")
fi

# Check 2: Required top-level fields (use has() for yq v4 compatibility)
for field in version extracted-from extracted-at learnings; do
  if ! yq eval -e "has(\"$field\")" "$FILE" > /dev/null 2>&1; then
    ERRORS+=("Missing required field: $field")
  fi
done

# Check 3: Learnings is an array
if ! yq eval -e '.learnings | type == "!!seq"' "$FILE" > /dev/null 2>&1; then
  ERRORS+=("Field 'learnings' must be an array")
fi

# Check 4: Validate each learning entry
LEARNING_COUNT=$(yq eval '.learnings | length' "$FILE" 2>/dev/null || echo "0")

for ((i=0; i<LEARNING_COUNT; i++)); do
  # Required fields for each learning (use has() for yq v4 compatibility)
  for field in id status title problem solution target confidence; do
    if ! yq eval -e ".learnings[$i] | has(\"$field\")" "$FILE" > /dev/null 2>&1; then
      ERRORS+=("Learning [$i]: missing required field '$field'")
    fi
  done

  # Validate status enum
  STATUS=$(yq eval ".learnings[$i].status" "$FILE" 2>/dev/null || echo "")
  if [[ -n "$STATUS" && "$STATUS" != "null" ]]; then
    case "$STATUS" in
      pending|approved|rejected|applied) ;;
      *) ERRORS+=("Learning [$i]: invalid status '$STATUS' (must be: pending, approved, rejected, applied)") ;;
    esac
  fi

  # Validate confidence enum
  CONFIDENCE=$(yq eval ".learnings[$i].confidence" "$FILE" 2>/dev/null || echo "")
  if [[ -n "$CONFIDENCE" && "$CONFIDENCE" != "null" ]]; then
    case "$CONFIDENCE" in
      low|medium|high) ;;
      *) ERRORS+=("Learning [$i]: invalid confidence '$CONFIDENCE' (must be: low, medium, high)") ;;
    esac
  fi

  # Check target path exists (warning only)
  TARGET=$(yq eval ".learnings[$i].target" "$FILE" 2>/dev/null || echo "")
  if [[ -n "$TARGET" && "$TARGET" != "null" ]]; then
    # Resolve relative to file's directory or current directory
    if [[ ! -f "$TARGET" ]]; then
      WARNINGS+=("Learning [$i]: target path does not exist: $TARGET")
    fi
  fi
done

# Report results
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "Warnings:"
  for warn in "${WARNINGS[@]}"; do
    echo "  - $warn"
  done
fi

if [[ ${#ERRORS[@]} -eq 0 ]]; then
  echo "Validation passed."
  exit 0
else
  echo "Validation FAILED:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi
