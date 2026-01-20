# Gherkin Scenarios: step-1

## Step Task
Create chunk-analyzer subagent for parallel transcript analysis.

Create: plugins/m42-signs/agents/chunk-analyzer.md

Subagent spec:
- name: chunk-analyzer
- description: Analyze preprocessed transcript chunk for learning extraction
- tools: Read, Bash
- model: sonnet
- color: cyan (research/analysis)

The subagent should analyze preprocessed reasoning chunks and extract
learnings in backlog YAML format.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Agents directory exists
```gherkin
Scenario: Agents directory is created for m42-signs plugin
  Given the m42-signs plugin exists at plugins/m42-signs/
  When the chunk-analyzer subagent is implemented
  Then the directory plugins/m42-signs/agents/ must exist
```

Verification: `test -d plugins/m42-signs/agents && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Subagent file exists
```gherkin
Scenario: chunk-analyzer.md file is created
  Given the agents directory exists
  When the chunk-analyzer subagent is implemented
  Then plugins/m42-signs/agents/chunk-analyzer.md must exist
```

Verification: `test -f plugins/m42-signs/agents/chunk-analyzer.md && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Valid YAML frontmatter exists
```gherkin
Scenario: Subagent has valid YAML frontmatter
  Given plugins/m42-signs/agents/chunk-analyzer.md exists
  When the frontmatter is parsed
  Then it must start with "---" and end with "---"
  And contain valid YAML between the delimiters
```

Verification: `head -20 plugins/m42-signs/agents/chunk-analyzer.md | grep -q "^---" && head -20 plugins/m42-signs/agents/chunk-analyzer.md | tail -n +2 | grep -q "^---" && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Required frontmatter fields present
```gherkin
Scenario: Frontmatter contains all required fields
  Given plugins/m42-signs/agents/chunk-analyzer.md has valid frontmatter
  When the frontmatter fields are checked
  Then it must contain "name: chunk-analyzer"
  And it must contain "description:" field
  And it must contain "tools:" field
  And it must contain "model:" field
  And it must contain "color:" field
```

Verification: `grep -q "^name: chunk-analyzer" plugins/m42-signs/agents/chunk-analyzer.md && grep -q "^description:" plugins/m42-signs/agents/chunk-analyzer.md && grep -q "^tools:" plugins/m42-signs/agents/chunk-analyzer.md && grep -q "^model:" plugins/m42-signs/agents/chunk-analyzer.md && grep -q "^color:" plugins/m42-signs/agents/chunk-analyzer.md && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Correct tool permissions
```gherkin
Scenario: Subagent has correct tool permissions
  Given plugins/m42-signs/agents/chunk-analyzer.md has valid frontmatter
  When the tools field is checked
  Then it must include "Read" for reading chunk files
  And it must include "Bash" for running validation
```

Verification: `grep "^tools:" plugins/m42-signs/agents/chunk-analyzer.md | grep -q "Read" && grep "^tools:" plugins/m42-signs/agents/chunk-analyzer.md | grep -q "Bash" && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Subagent body contains required instructions
```gherkin
Scenario: Subagent body documents the analysis workflow
  Given plugins/m42-signs/agents/chunk-analyzer.md exists
  When the body content is checked
  Then it must mention "YAML" or "yaml" (output format)
  And it must mention "learning" or "learnings" (extraction target)
  And it must mention "chunk" (input type)
```

Verification: `grep -qi "yaml" plugins/m42-signs/agents/chunk-analyzer.md && grep -qi "learning" plugins/m42-signs/agents/chunk-analyzer.md && grep -qi "chunk" plugins/m42-signs/agents/chunk-analyzer.md && echo "PASS" && exit 0 || echo "FAIL" && exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Unit Test Coverage

Since this is a markdown-based subagent definition (not TypeScript), unit tests are shell-based verification scripts.

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| `tests/step-1-chunk-analyzer.sh` | 6 | 1, 2, 3, 4, 5, 6 |

## Test Script

```bash
#!/bin/bash
# Test script for chunk-analyzer subagent
# Location: tests/step-1-chunk-analyzer.sh

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

# Scenario 3: Valid YAML frontmatter
echo -n "Scenario 3: Valid YAML frontmatter... "
if head -1 "$SUBAGENT_PATH" 2>/dev/null | grep -q "^---$" && \
   head -20 "$SUBAGENT_PATH" | tail -n +2 | grep -q "^---$"; then
    echo "PASS"
    ((SCORE++))
else
    echo "FAIL"
fi

# Scenario 4: Required frontmatter fields
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

# Scenario 5: Correct tool permissions
echo -n "Scenario 5: Correct tool permissions... "
if grep "^tools:" "$SUBAGENT_PATH" 2>/dev/null | grep -q "Read" && \
   grep "^tools:" "$SUBAGENT_PATH" | grep -q "Bash"; then
    echo "PASS"
    ((SCORE++))
else
    echo "FAIL"
fi

# Scenario 6: Required body content
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
```

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
./tests/step-1-chunk-analyzer.sh
# Expected: FAIL (no implementation yet)
```
