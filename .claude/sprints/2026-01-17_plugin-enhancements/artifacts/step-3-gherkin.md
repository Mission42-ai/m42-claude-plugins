# Gherkin Scenarios: step-3

## Step Task
Phase 2 - Step 1: Create Cross-Platform Browser Opener Utility

Create a new utility module for opening browsers across different platforms.

Requirements:
- Create browser.ts with `openBrowser(url: string): Promise<void>` function
- Detect platform: darwin (macOS), win32 (Windows), linux
- Use appropriate command: `open` (macOS), `start` (Windows), `xdg-open` (Linux)
- Handle errors gracefully (browser not found, etc.)
- Export function for use in index.ts
- Add fallback message to console if browser fails to open

New file to create:
- plugins/m42-sprint/compiler/src/status-server/browser.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Browser utility file exists
```gherkin
Scenario: Browser utility file exists
  Given the status-server directory exists
  When I check for the browser utility module
  Then plugins/m42-sprint/compiler/src/status-server/browser.ts exists
```

Verification: `test -f plugins/m42-sprint/compiler/src/status-server/browser.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: openBrowser function is exported
```gherkin
Scenario: openBrowser function is exported
  Given browser.ts exists
  When I check for the openBrowser export
  Then the function is publicly available for import
```

Verification: `grep -q "export.*function openBrowser\|export.*const openBrowser\|export { openBrowser\|export async function openBrowser" plugins/m42-sprint/compiler/src/status-server/browser.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Function accepts URL parameter with correct signature
```gherkin
Scenario: Function accepts URL parameter with correct signature
  Given browser.ts exists with openBrowser function
  When I check the function signature
  Then it accepts a url string parameter and returns Promise<void>
```

Verification: `grep -E "openBrowser\s*\(\s*url\s*:\s*string\s*\)\s*:\s*Promise<void>" plugins/m42-sprint/compiler/src/status-server/browser.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Platform detection for all three platforms
```gherkin
Scenario: Platform detection for all three platforms
  Given browser.ts implements cross-platform support
  When I check for platform-specific commands
  Then darwin (open), win32 (start), and linux (xdg-open) are handled
```

Verification: `grep -q "darwin" plugins/m42-sprint/compiler/src/status-server/browser.ts && grep -q "win32" plugins/m42-sprint/compiler/src/status-server/browser.ts && grep -q "linux" plugins/m42-sprint/compiler/src/status-server/browser.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Error handling with console fallback
```gherkin
Scenario: Error handling with console fallback
  Given browser.ts handles browser open failures
  When I check for error handling and fallback messaging
  Then try-catch and console output for fallback exist
```

Verification: `grep -q "catch" plugins/m42-sprint/compiler/src/status-server/browser.ts && grep -q "console" plugins/m42-sprint/compiler/src/status-server/browser.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: TypeScript compiles without errors
```gherkin
Scenario: TypeScript compiles without errors
  Given browser.ts is complete
  When I run the TypeScript compiler
  Then no compilation errors occur
```

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0
