#!/bin/bash
set -euo pipefail

# DEPRECATED: This script is no longer used by /m42-signs:extract
# The extraction command now uses LLM-based analysis which infers targets
# based on semantic understanding of what the learning is about.
#
# Kept for reference - shows path-based target inference logic.
#
# Infer target CLAUDE.md for learning signs based on file paths
# Analyzes paths to find common directory prefix and existing CLAUDE.md files
#
# Usage: infer-target.sh [--json] <path1> [path2] [path3] ...
# Output: Target CLAUDE.md path (plain text or JSON with --json flag)

# Parse --json flag
JSON_OUTPUT=false
PATHS=()

for arg in "$@"; do
  if [[ "$arg" == "--json" ]]; then
    JSON_OUTPUT=true
  else
    PATHS+=("$arg")
  fi
done

# Check for required arguments
if [[ ${#PATHS[@]} -eq 0 ]]; then
  echo "Error: At least one file path required" >&2
  echo "Usage: infer-target.sh [--json] <path1> [path2] [path3] ..." >&2
  exit 1
fi

# Normalize a path: remove trailing slashes, handle ./ prefix
normalize_path() {
  local path="$1"
  # Remove trailing slashes
  path="${path%/}"
  # Remove leading ./ if present
  path="${path#./}"
  # Return the path
  echo "$path"
}

# Get directory part of a path
get_dir() {
  local path="$1"
  local dir
  dir=$(dirname "$path")
  if [[ "$dir" == "." ]]; then
    echo ""
  else
    echo "$dir"
  fi
}

# Find common prefix of two paths
common_prefix_two() {
  local p1="$1"
  local p2="$2"

  # Split into arrays by /
  IFS='/' read -ra arr1 <<< "$p1"
  IFS='/' read -ra arr2 <<< "$p2"

  local common=""
  local min_len=${#arr1[@]}
  [[ ${#arr2[@]} -lt $min_len ]] && min_len=${#arr2[@]}

  for ((i=0; i<min_len; i++)); do
    if [[ "${arr1[$i]}" == "${arr2[$i]}" ]]; then
      if [[ -n "$common" ]]; then
        common="$common/${arr1[$i]}"
      else
        common="${arr1[$i]}"
      fi
    else
      break
    fi
  done

  echo "$common"
}

# Find common prefix across all paths
find_common_prefix() {
  local paths=("$@")

  if [[ ${#paths[@]} -eq 0 ]]; then
    echo ""
    return
  fi

  if [[ ${#paths[@]} -eq 1 ]]; then
    # For single path, use parent directory
    get_dir "${paths[0]}"
    return
  fi

  # Start with first path's directory
  local prefix
  prefix=$(get_dir "${paths[0]}")

  # Find common prefix with each subsequent path's directory
  for ((i=1; i<${#paths[@]}; i++)); do
    local dir
    dir=$(get_dir "${paths[$i]}")
    prefix=$(common_prefix_two "$prefix" "$dir")
  done

  echo "$prefix"
}

# Check for existing CLAUDE.md in directory hierarchy (walking up)
find_existing_claude_md() {
  local start_dir="$1"
  local current="$start_dir"

  # Don't walk up past project root (indicated by no more slashes or empty)
  while [[ -n "$current" ]]; do
    local claude_md="$current/CLAUDE.md"
    if [[ -f "$claude_md" ]]; then
      echo "$claude_md"
      return 0
    fi

    # Move up one directory
    local parent
    parent=$(dirname "$current")
    if [[ "$parent" == "$current" ]] || [[ "$parent" == "." ]]; then
      break
    fi
    current="$parent"
  done

  # Check root level
  if [[ -f "CLAUDE.md" ]]; then
    echo "CLAUDE.md"
    return 0
  fi

  return 1
}

# Normalize all paths
NORMALIZED_PATHS=()
for path in "${PATHS[@]}"; do
  NORMALIZED_PATHS+=("$(normalize_path "$path")")
done

# Find common prefix
COMMON_PREFIX=$(find_common_prefix "${NORMALIZED_PATHS[@]}")

# Build reasoning
REASONING=""

# Determine target CLAUDE.md
TARGET=""

if [[ -z "$COMMON_PREFIX" ]]; then
  # No common prefix - use root CLAUDE.md
  TARGET="CLAUDE.md"
  REASONING="No common prefix found among paths, using project root CLAUDE.md"
else
  # Check for existing CLAUDE.md in hierarchy
  if EXISTING=$(find_existing_claude_md "$COMMON_PREFIX"); then
    TARGET="$EXISTING"
    REASONING="Common prefix is $COMMON_PREFIX/, existing CLAUDE.md found at $EXISTING"
  else
    # No existing CLAUDE.md - suggest one at common prefix
    TARGET="$COMMON_PREFIX/CLAUDE.md"
    REASONING="Common prefix is $COMMON_PREFIX/, no existing CLAUDE.md found, suggesting $TARGET"
  fi
fi

# Output result
if [[ "$JSON_OUTPUT" == true ]]; then
  # Check if jq is available for proper JSON escaping
  if command -v jq &> /dev/null; then
    jq -n \
      --arg target "$TARGET" \
      --arg reasoning "$REASONING" \
      '{target: $target, reasoning: $reasoning}'
  else
    # Fallback: simple JSON output (escaping quotes in strings)
    escaped_target="${TARGET//\"/\\\"}"
    escaped_reasoning="${REASONING//\"/\\\"}"
    echo "{\"target\": \"$escaped_target\", \"reasoning\": \"$escaped_reasoning\"}"
  fi
else
  echo "$TARGET"
fi
