# Gherkin Scenarios: step-5

## Step Task
Phase 2 - Step 3: Integrate Browser Auto-Open in Status Server Startup

Make browser auto-open the default behavior when starting status server.

Requirements:
- Import openBrowser from browser.ts in index.ts
- Call waitForReady() before proceeding (blocking startup)
- Auto-open browser after server is ready (use openBrowser utility)
- Add `--no-browser` flag support to disable auto-open
- Pass browser preference through function parameters
- Log status server URL to console regardless of browser open

Verification:
- Start sprint, verify browser opens automatically within 3 seconds
- Start with --no-browser flag, verify browser does NOT open
- Verify sprint loop only starts after server is ready

Files to modify:
- plugins/m42-sprint/compiler/src/status-server/index.ts
- plugins/m42-sprint/commands/run-sprint.md (add --no-browser flag documentation)


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: openBrowser import exists in index.ts
```gherkin
Scenario: openBrowser utility is imported from browser.ts
  Given the status-server index.ts file exists
  When I check for the openBrowser import
  Then openBrowser is imported from ./browser.js

Verification: `grep -E "import.*openBrowser.*from.*['\"]\\./browser\\.js['\"]" plugins/m42-sprint/compiler/src/status-server/index.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: waitForReady is called after server.start()
```gherkin
Scenario: waitForReady blocks until server is ready
  Given the status-server index.ts file exists
  When I check for waitForReady usage
  Then waitForReady() is called on the server instance

Verification: `grep -E "await.*server\\.waitForReady\\(\\)|server\\.waitForReady\\(\\)" plugins/m42-sprint/compiler/src/status-server/index.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: openBrowser is called with server URL
```gherkin
Scenario: Browser is opened after server is ready
  Given openBrowser is imported in index.ts
  When I check for openBrowser invocation
  Then openBrowser is called with the server URL

Verification: `grep -E "openBrowser\\(.*url|openBrowser\\(.*getUrl\\(\\)" plugins/m42-sprint/compiler/src/status-server/index.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: --no-browser flag option is defined
```gherkin
Scenario: CLI defines --no-browser option
  Given the status-server index.ts file exists
  When I check for --no-browser option definition
  Then the option is defined with correct format

Verification: `grep -E "\\.option.*--no-browser|option\\(['\"].*-.*--no-browser" plugins/m42-sprint/compiler/src/status-server/index.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Browser open is conditional on flag
```gherkin
Scenario: openBrowser respects --no-browser flag
  Given --no-browser option is defined
  When I check for conditional browser opening logic
  Then openBrowser is only called when noBrowser is not set

Verification: `grep -E "if.*!.*noBrowser|!options\\.noBrowser|noBrowser.*===.*false|!.*options\\['no-browser'\\]" plugins/m42-sprint/compiler/src/status-server/index.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Server URL is logged to console
```gherkin
Scenario: Server URL is always logged regardless of browser flag
  Given the status-server index.ts file exists
  When I check for URL console output
  Then console.log includes the server URL

Verification: `grep -E "console\\.log.*URL.*url|console\\.log.*url|URL:.*\\$\\{url\\}|URL:.*server\\.getUrl" plugins/m42-sprint/compiler/src/status-server/index.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: TypeScript compiles without errors
```gherkin
Scenario: TypeScript compiles the modified index.ts
  Given the implementation changes are complete
  When I run TypeScript type checking
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0
```
