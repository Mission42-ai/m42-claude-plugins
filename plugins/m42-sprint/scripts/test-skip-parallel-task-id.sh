#!/bin/bash

# Test: build-sprint-prompt.sh exits cleanly (code 0) for sub-phases with parallel-task-id
# Gherkin Scenario 5

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

# Create test PROGRESS.yaml with sub-phase that has parallel-task-id
# Note: status is pending but parallel-task-id is set (edge case)
cat > "$TEST_DIR/PROGRESS.yaml" <<'EOF'
sprint-id: test-sprint
status: in-progress
current:
  phase: 0
  step: 0
  sub-phase: 0
phases:
  - id: development
    status: in-progress
    steps:
      - id: step-0
        status: in-progress
        prompt: "Test step"
        phases:
          - id: sub-0
            status: pending
            prompt: "Parallel task with ID"
            parallel: true
            parallel-task-id: test-task-456
stats:
  total-phases: 1
  completed-phases: 0
  started-at: "2026-01-18T00:00:00Z"
EOF

# Run build-sprint-prompt.sh - should exit 0 with no output
OUTPUT=$("$SCRIPT_DIR/build-sprint-prompt.sh" "$TEST_DIR" 2>&1) || EXIT_CODE=$?
EXIT_CODE=${EXIT_CODE:-0}

if [[ "$EXIT_CODE" -eq 0 ]] && [[ -z "$OUTPUT" ]]; then
  echo "PASS: Script exits 0 with no output for sub-phase with parallel-task-id"
  exit 0
else
  echo "FAIL: Expected exit 0 with no output, got exit $EXIT_CODE"
  if [[ -n "$OUTPUT" ]]; then
    echo "Output was:"
    echo "$OUTPUT"
  fi
  exit 1
fi
