# Gherkin Scenarios: step-3

## Step Task
Create documentation for large transcript handling.

Create: plugins/m42-signs/docs/how-to/handle-large-transcripts.md

Document:
- Automatic preprocessing activation
- Manual preprocessing workflow
- When to use --parallel flag
- Size thresholds table
- Artifacts generated

Follow AI-ready documentation principles (frontmatter, keywords, structure).

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Documentation file exists
```gherkin
Scenario: Documentation file exists at expected path
  Given the m42-signs plugin docs/how-to directory exists
  When checking for handle-large-transcripts.md
  Then the file should exist at plugins/m42-signs/docs/how-to/handle-large-transcripts.md

Verification: `test -f plugins/m42-signs/docs/how-to/handle-large-transcripts.md && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Documentation has valid frontmatter structure
```gherkin
Scenario: Documentation has YAML frontmatter with required fields
  Given handle-large-transcripts.md exists
  When parsing the frontmatter
  Then it should start with '---' delimiter
  And contain 'title:' field
  And contain 'description:' field
  And contain 'keywords:' field
  And end with '---' delimiter

Verification: `head -15 plugins/m42-signs/docs/how-to/handle-large-transcripts.md | grep -E "^---$" | wc -l | grep -q "^2$" && head -15 plugins/m42-signs/docs/how-to/handle-large-transcripts.md | grep -q "title:" && head -15 plugins/m42-signs/docs/how-to/handle-large-transcripts.md | grep -q "description:" && head -15 plugins/m42-signs/docs/how-to/handle-large-transcripts.md | grep -q "keywords:" && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Documentation covers automatic preprocessing activation
```gherkin
Scenario: Document explains when preprocessing activates automatically
  Given handle-large-transcripts.md exists
  When reading the content
  Then it should contain a section about automatic activation
  And mention the line count threshold (100 lines)
  And mention the file size threshold (500KB)

Verification: `grep -iq "automatic" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && grep -q "100" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && grep -qi "500" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Documentation covers manual preprocessing workflow
```gherkin
Scenario: Document explains manual preprocessing steps
  Given handle-large-transcripts.md exists
  When reading the content
  Then it should document the --preprocess-only flag
  And show example usage for manual preprocessing
  And list the preprocessing scripts

Verification: `grep -q "\-\-preprocess-only" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && grep -q "transcript-summary" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && grep -q "extract-reasoning" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Documentation explains when to use --parallel flag
```gherkin
Scenario: Document explains parallel processing option
  Given handle-large-transcripts.md exists
  When reading the content
  Then it should document the --parallel flag
  And explain when parallel processing is beneficial
  And mention chunk analysis

Verification: `grep -q "\-\-parallel" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && grep -qi "chunk" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Documentation includes size thresholds table
```gherkin
Scenario: Document has a table showing size thresholds
  Given handle-large-transcripts.md exists
  When reading the content
  Then it should contain a markdown table with threshold information
  And include both line count and file size thresholds
  And indicate the mode (preprocessing vs direct)

Verification: `grep -E "^\|.*\|.*\|" plugins/m42-signs/docs/how-to/handle-large-transcripts.md | grep -qi "threshold\|lines\|size\|bytes\|KB" && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Documentation lists artifacts generated
```gherkin
Scenario: Document lists preprocessing artifacts
  Given handle-large-transcripts.md exists
  When reading the content
  Then it should list the artifacts generated during preprocessing
  And mention reasoning output file
  And mention summary output

Verification: `grep -qi "artifact" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && grep -q "reasoning" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && grep -q "summary" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Documentation has proper section structure
```gherkin
Scenario: Document follows AI-ready structure with proper headings
  Given handle-large-transcripts.md exists
  When reading the content
  Then it should have multiple H2 (##) section headers
  And include a Quick Start section
  And include Related Guides section linking to other docs

Verification: `grep -c "^## " plugins/m42-signs/docs/how-to/handle-large-transcripts.md | grep -qE "^[4-9]|^[1-9][0-9]" && grep -qi "quick start" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && grep -qi "related" plugins/m42-signs/docs/how-to/handle-large-transcripts.md && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Unit Test Coverage

Since this step creates documentation (not code), there are no unit tests in the traditional sense. The gherkin verification commands above serve as the tests.

| Test Type | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| Bash verification commands | 8 | 1, 2, 3, 4, 5, 6, 7, 8 |

## RED Phase Verification

Tests are expected to FAIL at this point because the documentation file doesn't exist yet:

```bash
# All scenarios should fail (documentation not yet created)
test -f plugins/m42-signs/docs/how-to/handle-large-transcripts.md && echo "EXISTS" || echo "NOT_EXISTS"
# Expected: NOT_EXISTS (RED phase - file doesn't exist)
```

### Verification Script

Run all scenarios to confirm RED state:

```bash
#!/bin/bash
# Run from repo root
set -e

echo "=== Step 3 RED Phase Verification ==="
echo ""

# Scenario 1: File exists
echo -n "Scenario 1 (File exists): "
if test -f plugins/m42-signs/docs/how-to/handle-large-transcripts.md; then
  echo "PASS (unexpected in RED)"
else
  echo "FAIL (expected in RED)"
fi

echo ""
echo "All scenarios should FAIL in RED phase."
echo "Proceed to GREEN phase to create the documentation."
```

## Documentation Requirements Summary

The `handle-large-transcripts.md` file must include:

1. **Frontmatter** (YAML)
   - title: descriptive title
   - description: 1-2 sentence summary
   - keywords: array of relevant terms

2. **Content Sections**
   - Quick Start
   - Automatic Preprocessing (when it activates)
   - Size Thresholds Table
   - Manual Preprocessing Workflow
   - Parallel Processing (--parallel flag)
   - Artifacts Generated
   - Related Guides

3. **Style**
   - Follow existing how-to documentation patterns
   - Use markdown tables for structured data
   - Include code examples
   - Cross-link to related documentation
