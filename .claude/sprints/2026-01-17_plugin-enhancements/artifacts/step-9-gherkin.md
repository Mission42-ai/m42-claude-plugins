# Gherkin Scenarios: step-9

## Step Task
Phase 4 - Step 1: Create SprintScanner Module

Create module to enumerate and parse all sprints in .claude/sprints/ directory.

Requirements:
- Create sprint-scanner.ts with SprintScanner class
- Scan .claude/sprints/ directory for sprint folders
- Parse PROGRESS.yaml from each sprint to extract:
  - Sprint ID, name, status
  - Start time, end time, duration
  - Step count, completed count
  - Workflow used
- Sort sprints by date (newest first)
- Limit to last 50 sprints for performance
- Handle missing/corrupted PROGRESS.yaml gracefully
- Export SprintSummary type and SprintScanner class

New file to create:
- plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Sprint scanner file exists
```gherkin
Scenario: Sprint scanner file exists
  Given the status-server directory exists
  When I check for the sprint scanner module
  Then plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts exists
```

Verification: `test -f plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: SprintScanner class is exported
```gherkin
Scenario: SprintScanner class is exported
  Given sprint-scanner.ts exists
  When I check for the SprintScanner export
  Then the class is publicly available for import
```

Verification: `grep -q "export.*class SprintScanner\|export { SprintScanner" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: SprintSummary type is exported
```gherkin
Scenario: SprintSummary type is exported
  Given sprint-scanner.ts exists
  When I check for the SprintSummary type export
  Then the type is publicly available for import
```

Verification: `grep -q "export.*interface SprintSummary\|export.*type SprintSummary\|export { SprintSummary" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: SprintSummary contains required fields
```gherkin
Scenario: SprintSummary contains required fields
  Given sprint-scanner.ts defines SprintSummary
  When I check the interface definition
  Then it contains sprintId, status, startedAt, stepCount, and completedCount fields
```

Verification: `grep -q "sprintId" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts && grep -q "status" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts && grep -q "startedAt" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts && grep -q "stepCount\|totalSteps" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts && grep -q "completedCount\|completedSteps" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Scan method exists and returns array
```gherkin
Scenario: Scan method exists and returns array
  Given SprintScanner class exists
  When I check for the scan method
  Then a scan method exists that returns SprintSummary array
```

Verification: `grep -E "scan\s*\(.*\)\s*:\s*(Promise<)?SprintSummary\[\]|async\s+scan\s*\(" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: YAML parsing with js-yaml
```gherkin
Scenario: YAML parsing with js-yaml
  Given sprint-scanner.ts parses PROGRESS.yaml files
  When I check for YAML parsing
  Then js-yaml or yaml import is present for parsing
```

Verification: `grep -q "js-yaml\|from 'yaml'\|require('yaml')" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Error handling for corrupted files
```gherkin
Scenario: Error handling for corrupted files
  Given sprint-scanner.ts parses multiple sprint directories
  When I check for error handling patterns
  Then try-catch blocks exist for graceful error handling
```

Verification: `grep -q "try" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts && grep -q "catch" plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: TypeScript compiles without errors
```gherkin
Scenario: TypeScript compiles without errors
  Given sprint-scanner.ts is complete
  When I run the TypeScript compiler
  Then no compilation errors occur
```

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0
