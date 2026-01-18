#!/bin/bash

# Test: build-sprint-prompt.sh exits cleanly (code 0) for spawned sub-phases
# Gherkin Scenario 4

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

# Create test PROGRESS.yaml with spawned sub-phase
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
            status: spawned
            prompt: "Spawned task"
            parallel: true
            parallel-task-id: test-task-123
stats:
  total-phases: 1
  completed-phases: 0
  started-at: "2026-01-18T00:00:00Z"
EOF

# Run build-sprint-prompt.sh - should exit 0 with no output
OUTPUT=$("$SCRIPT_DIR/build-sprint-prompt.sh" "$TEST_DIR" 2>&1) || EXIT_CODE=$?
EXIT_CODE=${EXIT_CODE:-0}

if [[ "$EXIT_CODE" -eq 0 ]] && [[ -z "$OUTPUT" ]]; then
  echo "PASS: Script exits 0 with no output for spawned sub-phase"
  exit 0
else
  echo "FAIL: Expected exit 0 with no output, got exit $EXIT_CODE"
  if [[ -n "$OUTPUT" ]]; then
    echo "Output was:"
    echo "$OUTPUT"
  fi
  exit 1
fi
