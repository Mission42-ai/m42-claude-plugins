#!/bin/bash

# Test: build-sprint-prompt.sh generates a prompt for normal pending sub-phases
# Gherkin Scenario 6

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

# Create test PROGRESS.yaml with normal pending sub-phase (no parallel flags)
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
        prompt: "Test step prompt"
        phases:
          - id: sub-0
            status: pending
            prompt: "Normal sub-phase task"
stats:
  total-phases: 1
  completed-phases: 0
  started-at: "2026-01-18T00:00:00Z"
EOF

# Run build-sprint-prompt.sh - should output a prompt
OUTPUT=$("$SCRIPT_DIR/build-sprint-prompt.sh" "$TEST_DIR" 2>&1) || EXIT_CODE=$?
EXIT_CODE=${EXIT_CODE:-0}

if [[ "$EXIT_CODE" -eq 0 ]] && [[ -n "$OUTPUT" ]]; then
  # Verify prompt contains expected content
  if echo "$OUTPUT" | grep -q "Sprint Workflow Execution" && \
     echo "$OUTPUT" | grep -q "Your Task: sub-0" && \
     echo "$OUTPUT" | grep -q "Normal sub-phase task"; then
    echo "PASS: Script generates proper prompt for normal pending sub-phase"
    exit 0
  else
    echo "FAIL: Prompt output missing expected content"
    echo "Output was:"
    echo "$OUTPUT"
    exit 1
  fi
else
  echo "FAIL: Expected exit 0 with prompt output, got exit $EXIT_CODE with output length ${#OUTPUT}"
  exit 1
fi
