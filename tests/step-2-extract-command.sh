#!/bin/bash
# Test script for extract.md command enhancements
# Location: tests/step-2-extract-command.sh

set -euo pipefail

COMMAND_PATH="plugins/m42-signs/commands/extract.md"
SCORE=0
TOTAL=8

echo "=== Testing extract.md Command Enhancements ==="
echo ""

# Scenario 1: Size detection in preflight checks
echo -n "Scenario 1: Size detection in preflight checks... "
if grep -A10 "## Preflight Checks" "$COMMAND_PATH" 2>/dev/null | grep -q "wc -l" && \
   grep -A15 "## Preflight Checks" "$COMMAND_PATH" | grep -q "stat"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 2: Large transcript detection threshold documented
echo -n "Scenario 2: Large transcript thresholds documented... "
if grep -q "100.*line\|100 line" "$COMMAND_PATH" 2>/dev/null && \
   grep -q "500.*KB\|500KB" "$COMMAND_PATH" && \
   grep -qi "large transcript" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 3: --preprocess-only argument documented
echo -n "Scenario 3: --preprocess-only argument documented... "
if grep -q "\-\-preprocess-only" "$COMMAND_PATH" 2>/dev/null && \
   grep -A3 "\-\-preprocess-only" "$COMMAND_PATH" | grep -qi "artifact\|preprocess\|without.*LLM\|without.*analysis"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 4: --parallel argument documented
echo -n "Scenario 4: --parallel argument documented... "
if grep -q "\-\-parallel" "$COMMAND_PATH" 2>/dev/null && \
   grep -A3 "\-\-parallel" "$COMMAND_PATH" | grep -qi "parallel\|chunk"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 5: Large Transcript Handling section exists
echo -n "Scenario 5: Large Transcript Handling section exists... "
if grep -q "^## Large Transcript Handling" "$COMMAND_PATH" 2>/dev/null; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 6: Preprocessing script references included
echo -n "Scenario 6: Preprocessing script references... "
if grep -q "transcript-summary.sh" "$COMMAND_PATH" 2>/dev/null && \
   grep -q "find-learning-lines.sh" "$COMMAND_PATH" && \
   grep -q "extract-reasoning.sh" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 7: chunk-analyzer subagent integration documented
echo -n "Scenario 7: chunk-analyzer subagent integration... "
if grep -qi "chunk-analyzer" "$COMMAND_PATH" 2>/dev/null && \
   grep -qi "Task\|spawn" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 8: Chunking workflow documented
echo -n "Scenario 8: Chunking workflow documented... "
if grep -qi "split" "$COMMAND_PATH" 2>/dev/null && \
   grep -q "50" "$COMMAND_PATH" && \
   grep -qi "aggregate\|deduplicate\|combine" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

echo ""
echo "=== Results: $SCORE/$TOTAL ==="

if [ "$SCORE" -eq "$TOTAL" ]; then
    echo "All scenarios PASSED"
    exit 0
else
    echo "Some scenarios FAILED"
    exit 1
fi
