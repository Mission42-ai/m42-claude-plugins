#!/bin/bash
# Test script for chunk-analyzer subagent
# RED Phase: Tests should FAIL because implementation doesn't exist yet
#
# This script verifies:
# - Agents directory exists
# - chunk-analyzer.md file exists with proper structure
# - Frontmatter contains required fields
# - Body contains required content for learning extraction

set -euo pipefail

SUBAGENT_PATH="plugins/m42-signs/agents/chunk-analyzer.md"
SCORE=0
TOTAL=6

echo "=== Testing chunk-analyzer Subagent ==="
echo ""

# Scenario 1: Agents directory exists
echo -n "Scenario 1: Agents directory exists... "
if test -d plugins/m42-signs/agents; then
    echo "PASS"
    ((SCORE++))
else
    echo "FAIL"
fi

# Scenario 2: Subagent file exists
echo -n "Scenario 2: Subagent file exists... "
if test -f "$SUBAGENT_PATH"; then
    echo "PASS"
    ((SCORE++))
else
    echo "FAIL"
fi

# Scenario 3: Valid YAML frontmatter (starts and ends with ---)
echo -n "Scenario 3: Valid YAML frontmatter... "
if head -1 "$SUBAGENT_PATH" 2>/dev/null | grep -q "^---$" && \
   head -20 "$SUBAGENT_PATH" | tail -n +2 | grep -q "^---$"; then
    echo "PASS"
    ((SCORE++))
else
    echo "FAIL"
fi

# Scenario 4: Required frontmatter fields present
echo -n "Scenario 4: Required frontmatter fields... "
if grep -q "^name: chunk-analyzer" "$SUBAGENT_PATH" 2>/dev/null && \
   grep -q "^description:" "$SUBAGENT_PATH" && \
   grep -q "^tools:" "$SUBAGENT_PATH" && \
   grep -q "^model:" "$SUBAGENT_PATH" && \
   grep -q "^color:" "$SUBAGENT_PATH"; then
    echo "PASS"
    ((SCORE++))
else
    echo "FAIL"
fi

# Scenario 5: Correct tool permissions (Read and Bash)
echo -n "Scenario 5: Correct tool permissions... "
if grep "^tools:" "$SUBAGENT_PATH" 2>/dev/null | grep -q "Read" && \
   grep "^tools:" "$SUBAGENT_PATH" | grep -q "Bash"; then
    echo "PASS"
    ((SCORE++))
else
    echo "FAIL"
fi

# Scenario 6: Required body content (yaml, learning, chunk keywords)
echo -n "Scenario 6: Required body content... "
if grep -qi "yaml" "$SUBAGENT_PATH" 2>/dev/null && \
   grep -qi "learning" "$SUBAGENT_PATH" && \
   grep -qi "chunk" "$SUBAGENT_PATH"; then
    echo "PASS"
    ((SCORE++))
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
