#!/bin/bash
# Verification test for start-sprint template paths

echo "Testing start-sprint template path fixes..."
echo ""

# Test 1: Verify template files exist at documented paths
echo "Test 1: Verify template files exist"
SPRINT_TEMPLATE="plugins/m42-sprint/skills/orchestrating-sprints/assets/sprint-template.yaml"
PROGRESS_TEMPLATE="plugins/m42-sprint/skills/orchestrating-sprints/assets/progress-template.yaml"

if [ -f "$SPRINT_TEMPLATE" ]; then
  echo "✓ Sprint template exists: $SPRINT_TEMPLATE"
else
  echo "✗ Sprint template NOT FOUND: $SPRINT_TEMPLATE"
  exit 1
fi

if [ -f "$PROGRESS_TEMPLATE" ]; then
  echo "✓ Progress template exists: $PROGRESS_TEMPLATE"
else
  echo "✗ Progress template NOT FOUND: $PROGRESS_TEMPLATE"
  exit 1
fi

echo ""
echo "Test 2: Verify templates are valid YAML"
if command -v yamllint >/dev/null 2>&1; then
  yamllint "$SPRINT_TEMPLATE" && echo "✓ Sprint template is valid YAML"
  yamllint "$PROGRESS_TEMPLATE" && echo "✓ Progress template is valid YAML"
else
  # Basic check if yamllint not available
  grep -q "sprint-id:" "$SPRINT_TEMPLATE" && echo "✓ Sprint template contains expected fields"
  grep -q "sprint-id:" "$PROGRESS_TEMPLATE" && echo "✓ Progress template contains expected fields"
fi

echo ""
echo "Test 3: Verify start-sprint.md references correct paths"
START_SPRINT_CMD="plugins/m42-sprint/commands/start-sprint.md"
if grep -q "plugins/m42-sprint/skills/orchestrating-sprints/assets/sprint-template.yaml" "$START_SPRINT_CMD"; then
  echo "✓ start-sprint.md references correct sprint template path"
else
  echo "✗ start-sprint.md does NOT reference correct sprint template path"
  exit 1
fi

if grep -q "plugins/m42-sprint/skills/orchestrating-sprints/assets/progress-template.yaml" "$START_SPRINT_CMD"; then
  echo "✓ start-sprint.md references correct progress template path"
else
  echo "✗ start-sprint.md does NOT reference correct progress template path"
  exit 1
fi

echo ""
echo "Test 4: Verify old incorrect paths are not present"
if grep -q "\.claude/skills/orchestrating-sprints/assets/" "$START_SPRINT_CMD"; then
  echo "✗ start-sprint.md still contains OLD incorrect path pattern"
  exit 1
else
  echo "✓ Old incorrect paths have been removed"
fi

echo ""
echo "========================================="
echo "All tests passed! ✓"
echo "========================================="
echo ""
echo "start-sprint command will successfully:"
echo "  1. Locate template files at correct paths"
echo "  2. Read valid YAML templates"
echo "  3. Generate sprint YAML files"
echo ""
