#!/bin/bash
# Test script for extract.md command (operator pattern refactor)
# Location: tests/step-2-extract-command.sh

set -euo pipefail

COMMAND_PATH="plugins/m42-signs/commands/extract.md"
SCORE=0
TOTAL=10

echo "=== Testing extract.md Command (Operator Pattern) ==="
echo ""

# Scenario 1: File exists and has valid frontmatter
echo -n "Scenario 1: File exists with valid frontmatter... "
if [ -f "$COMMAND_PATH" ] && \
   head -1 "$COMMAND_PATH" | grep -q "^---$" && \
   grep -q "^allowed-tools:" "$COMMAND_PATH" && \
   grep -q "^description:" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 2: Allowed-tools includes Task for subagent orchestration
echo -n "Scenario 2: Allowed-tools includes Task... "
if grep "^allowed-tools:" "$COMMAND_PATH" 2>/dev/null | grep -q "Task"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 3: New arguments documented (--dry-run, --focus, --min-confidence)
echo -n "Scenario 3: New arguments documented... "
if grep -q "\-\-dry-run" "$COMMAND_PATH" 2>/dev/null && \
   grep -q "\-\-focus" "$COMMAND_PATH" && \
   grep -q "\-\-min-confidence" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 4: Operator pattern indicated (mentions subagent orchestration)
echo -n "Scenario 4: Operator pattern indicated... "
if grep -qi "operator pattern\|orchestrat" "$COMMAND_PATH" 2>/dev/null && \
   grep -qi "subagent" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 5: New subagent references (transcript-section-analyzer)
echo -n "Scenario 5: transcript-section-analyzer subagent... "
if grep -q "transcript-section-analyzer" "$COMMAND_PATH" 2>/dev/null; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 6: New subagent references (context-matcher)
echo -n "Scenario 6: context-matcher subagent... "
if grep -q "context-matcher" "$COMMAND_PATH" 2>/dev/null; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 7: New subagent references (quality-reviewer)
echo -n "Scenario 7: quality-reviewer subagent... "
if grep -q "quality-reviewer" "$COMMAND_PATH" 2>/dev/null; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 8: References to @learning-extraction skill
echo -n "Scenario 8: @learning-extraction skill reference... "
if grep -q "@learning-extraction" "$COMMAND_PATH" 2>/dev/null; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 9: Proper step structure (Section Division, Extract, Match, Quality, Output)
echo -n "Scenario 9: Proper step structure... "
if grep -q "Step 1.*Section Division\|Section Division" "$COMMAND_PATH" 2>/dev/null && \
   grep -q "Step 2.*Extract\|Extract Candidates" "$COMMAND_PATH" && \
   grep -q "Step 3.*Match\|Match Targets" "$COMMAND_PATH" && \
   grep -q "Step 4.*Quality\|Quality Review" "$COMMAND_PATH" && \
   grep -q "Step 5.*Output\|Output" "$COMMAND_PATH"; then
    echo "PASS"
    ((SCORE++)) || true
else
    echo "FAIL"
fi

# Scenario 10: Success criteria section exists
echo -n "Scenario 10: Success criteria section exists... "
if grep -q "^## Success Criteria" "$COMMAND_PATH" 2>/dev/null; then
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
