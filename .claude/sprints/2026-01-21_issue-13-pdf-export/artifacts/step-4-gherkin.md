# Gherkin Scenarios: step-4

## Step Task
Step 4: Create command/skill for PDF export.

Tasks:
- Add new command or extend existing command with --pdf flag
- Command should accept sprint path as argument
- Output PDF to sprint's artifacts/ directory
- Add proper error handling and user feedback
- Ensure command works from CLI

Output: Working /export-pdf command or --pdf flag on existing command.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Export PDF command accepts sprint path argument
```gherkin
Scenario: Export PDF command accepts sprint path argument
  Given a valid sprint directory exists at ".claude/sprints/2026-01-21_test-sprint/"
  And the sprint has a compiled PROGRESS.yaml file
  When the user invokes the export-pdf command with the sprint path
  Then the command should recognize the sprint path argument
  And the command should not report an error for missing arguments
```

Verification: `node dist/pdf/export-pdf-cli.js .claude/sprints/2026-01-21_test-sprint/ --help 2>&1 | grep -v "Missing" && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Export PDF command outputs to artifacts directory
```gherkin
Scenario: Export PDF command outputs to artifacts directory
  Given a valid sprint directory at ".claude/sprints/2026-01-21_test-sprint/"
  And the sprint has a compiled PROGRESS.yaml file
  When the user runs the export-pdf command
  Then a PDF file should be created in the sprint's "artifacts/" directory
  And the PDF filename should include the sprint-id
```

Verification: `ls .claude/sprints/*/artifacts/*.pdf 2>/dev/null && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Export PDF command shows error for missing PROGRESS.yaml
```gherkin
Scenario: Export PDF command shows error for missing PROGRESS.yaml
  Given a sprint directory exists without PROGRESS.yaml
  When the user runs the export-pdf command on that directory
  Then the command should exit with non-zero exit code
  And the error message should indicate PROGRESS.yaml is missing
```

Verification: `node dist/pdf/export-pdf-cli.js /tmp/empty-sprint 2>&1 | grep -i "progress" && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Export PDF command shows error for invalid sprint path
```gherkin
Scenario: Export PDF command shows error for invalid sprint path
  Given a path that does not exist "/nonexistent/sprint/path"
  When the user runs the export-pdf command with that path
  Then the command should exit with non-zero exit code
  And the error message should indicate the directory was not found
```

Verification: `node dist/pdf/export-pdf-cli.js /nonexistent/path 2>&1; test $? -ne 0 && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Export PDF command creates artifacts directory if missing
```gherkin
Scenario: Export PDF command creates artifacts directory if missing
  Given a sprint directory without an artifacts/ subdirectory
  And the sprint has a valid PROGRESS.yaml
  When the user runs the export-pdf command
  Then the artifacts/ directory should be created
  And the PDF file should be written to the new directory
```

Verification: `test -d .claude/sprints/*/artifacts && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Export PDF command includes charts when --charts flag is passed
```gherkin
Scenario: Export PDF command includes charts when --charts flag is passed
  Given a valid sprint with PROGRESS.yaml
  When the user runs the export-pdf command with --charts flag
  Then the generated PDF should include visual progress charts
  And the PDF file size should be larger than without charts
```

Verification: `node dist/pdf/export-pdf-cli.js --help 2>&1 | grep -i "chart" && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Export PDF command shows success message with output path
```gherkin
Scenario: Export PDF command shows success message with output path
  Given a valid sprint directory with PROGRESS.yaml
  When the user successfully runs the export-pdf command
  Then a success message should be displayed
  And the message should include the full path to the generated PDF
```

Verification: `node dist/pdf/export-pdf-cli.js .claude/sprints/*/ 2>&1 | grep -E "(Created|Generated|Output|\.pdf)" && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Export PDF command shows help with --help flag
```gherkin
Scenario: Export PDF command shows help with --help flag
  Given the export-pdf CLI is available
  When the user runs the command with --help flag
  Then usage information should be displayed
  And the output should describe the sprint-path argument
  And the output should describe available options
```

Verification: `node dist/pdf/export-pdf-cli.js --help 2>&1 | grep -E "(Usage|sprint|path)" && exit 0 || exit 1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Unit Test Coverage
| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| compiler/src/pdf/export-pdf-cli.test.ts | 22 | 1, 2, 3, 4, 5, 6, 7, 8 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/export-pdf-cli.test.js
# Expected: FAIL (export-pdf-cli.ts doesn't exist yet)
```
