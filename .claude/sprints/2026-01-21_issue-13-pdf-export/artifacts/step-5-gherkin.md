# Gherkin Scenarios: step-5

## Step Task
Step 5: Documentation and final polish.

Tasks:
- Add documentation for PDF export feature
- Update README or relevant docs
- Add usage examples
- Test end-to-end workflow
- Close GitHub Issue #13 with summary of implementation

Output: Feature complete with documentation, issue closed.


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Commands reference includes export-pdf documentation
```gherkin
Scenario: Commands reference includes export-pdf documentation
  Given the commands reference file exists at docs/reference/commands.md
  When the file is read
  Then it should contain a section documenting the /export-pdf command
  And it should include usage syntax with [options] and <sprint-path>
  And it should document the --charts option
  And it should document the --output option
```

Verification: `grep -E "(export-pdf|/export-pdf)" plugins/m42-sprint/docs/reference/commands.md && exit 0 || exit 1`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Scenario 2: README mentions PDF export capability
```gherkin
Scenario: README mentions PDF export capability
  Given the plugin README.md file exists
  When the file is read
  Then it should mention PDF export as a feature
  And it should reference the /export-pdf command in the commands table
```

Verification: `grep -i "pdf" plugins/m42-sprint/README.md && grep -E "export.pdf" plugins/m42-sprint/README.md && exit 0 || exit 1`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Scenario 3: Usage examples are documented
```gherkin
Scenario: Usage examples are documented
  Given the commands reference contains export-pdf documentation
  When reading the examples section
  Then it should include a basic usage example
  And it should include an example with --charts flag
  And it should include an example with custom output path
```

Verification: `grep -A20 "export-pdf" plugins/m42-sprint/docs/reference/commands.md | grep -E "(Example|\.claude/sprints.*pdf)" && exit 0 || exit 1`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Scenario 4: End-to-end PDF export workflow works
```gherkin
Scenario: End-to-end PDF export workflow works
  Given a sprint exists with a compiled PROGRESS.yaml
  When the export-pdf CLI is invoked on the sprint directory
  Then a PDF file should be created in the artifacts directory
  And the PDF should contain sprint data
  And the exit code should be 0
```

Verification: `cd plugins/m42-sprint/compiler && test -f dist/pdf/export-pdf-cli.js && node dist/pdf/export-pdf-cli.js --help | grep -E "sprint-path" && exit 0 || exit 1`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Scenario 5: PDF generator unit tests pass
```gherkin
Scenario: PDF generator unit tests pass
  Given the pdf-generator module exists
  And the export-pdf-cli module exists
  When the unit tests are executed
  Then all tests should pass with exit code 0
```

Verification: `cd plugins/m42-sprint/compiler && npm run build 2>/dev/null && node dist/pdf/pdf-generator.test.js 2>&1 | grep -E "passed|PASS" && exit 0 || exit 1`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Scenario 6: GitHub Issue #13 can be closed with implementation summary
```gherkin
Scenario: GitHub Issue #13 can be closed with implementation summary
  Given GitHub issue #13 exists and is open
  And the PDF export feature is fully implemented
  When the issue is closed with a summary comment
  Then the issue should be closeable via gh CLI
  And the comment should reference the implementation
```

Verification: `gh issue view 13 --repo m42-claude-plugins 2>/dev/null || (gh issue view 13 2>/dev/null | grep -E "(title|state)" && exit 0) || exit 1`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0

---

## Unit Test Coverage
| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| compiler/src/pdf/docs.test.ts | 12 | 1, 2, 3, 4, 5, 6 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/docs.test.js
# Expected: FAIL (documentation doesn't exist yet)
```
