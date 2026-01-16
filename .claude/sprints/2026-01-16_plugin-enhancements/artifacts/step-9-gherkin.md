# Gherkin Scenarios: step-9

## Step Task
Track D - Step 2: Implement Phase Log Viewer

Add expandable log viewer for each phase showing Claude's actual output.

Requirements:
- Capture stdout/stderr from each `claude -p` invocation in sprint-loop.sh
- Store phase logs in <sprint-dir>/logs/<phase-id>.log
- Create logs/ directory in sprint directory structure
- Modify sprint-loop.sh to tee output to log files while displaying
- Add expandable "View Log" section in each phase card
- Implement syntax highlighting for code blocks in output
- Add search/filter functionality within logs
- Add "Download Log" button for individual phase logs
- Add "Download All Logs" button (zip archive) in sprint header
- Handle large log files efficiently (lazy loading, virtualized scrolling)
- Preserve ANSI color codes and convert to HTML for display

Files to modify:
- scripts/sprint-loop.sh (add logging to files)
- compiler/src/status-server/server.ts (add log serving endpoints)
- compiler/src/status-server/page.ts (add log viewer UI)

New endpoints:
- GET /api/logs/:phaseId - Get log content for a phase
- GET /api/logs/download/:phaseId - Download individual log
- GET /api/logs/download-all - Download all logs as zip


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Logs Directory Creation
```gherkin
Scenario: Sprint loop creates logs directory
  Given the sprint directory exists
  When I check the sprint-loop.sh script
  Then it should create a logs/ directory before logging

Verification: `grep -q 'mkdir.*logs' plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Log File Output Implementation
```gherkin
Scenario: Sprint loop tees output to log files
  Given sprint-loop.sh exists
  When I check for log file writing logic
  Then it should capture claude CLI output to phase-specific log files

Verification: `grep -E '(tee|>>|>).*\.log' plugins/m42-sprint/scripts/sprint-loop.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Log Content API Endpoint
```gherkin
Scenario: Server has GET /api/logs/:phaseId endpoint
  Given compiler/src/status-server/server.ts exists
  When I check for the log content endpoint
  Then it should handle GET requests for phase logs

Verification: `grep -E '/api/logs/[^d]' plugins/m42-sprint/compiler/src/status-server/server.ts | grep -v download`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Single Log Download Endpoint
```gherkin
Scenario: Server has GET /api/logs/download/:phaseId endpoint
  Given compiler/src/status-server/server.ts exists
  When I check for the individual log download endpoint
  Then it should handle GET requests for downloading a single log file

Verification: `grep -q '/api/logs/download/' plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: All Logs Download Endpoint
```gherkin
Scenario: Server has GET /api/logs/download-all endpoint
  Given compiler/src/status-server/server.ts exists
  When I check for the bulk download endpoint
  Then it should handle GET requests for downloading all logs as a zip archive

Verification: `grep -q '/api/logs/download-all' plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Log Viewer UI Components
```gherkin
Scenario: Status page has expandable log viewer UI
  Given compiler/src/status-server/page.ts exists
  When I check for log viewer UI elements
  Then it should include expandable view log sections

Verification: `grep -qE '(view-log|log-viewer|View Log|expandable.*log)' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: ANSI to HTML Conversion
```gherkin
Scenario: Log viewer converts ANSI codes to HTML
  Given the log viewer implementation exists
  When I check for ANSI color code handling
  Then it should include logic to convert ANSI escape sequences to HTML

Verification: `grep -qE '(ansi|ANSI|\\x1b|\\033|escape.*color|color.*code)' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: TypeScript Compilation
```gherkin
Scenario: Status server compiles without errors
  Given all server changes are complete
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npm run build 2>&1 | tail -1 | grep -v -i error; test ${PIPESTATUS[0]} -eq 0`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```
