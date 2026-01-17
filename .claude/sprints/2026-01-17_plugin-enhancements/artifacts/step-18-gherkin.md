# Gherkin Scenarios: step-18

## Step Task
Final Step: Build Verification and Cleanup

Verify all changes compile and pass quality checks.

Requirements:
- Run TypeScript compilation: `npm run build` in compiler directory
- Run type checking: `npm run typecheck` in compiler directory
- Fix any compilation errors
- Fix any type errors
- Ensure no unused imports or variables
- Verify no console.log statements left in production code (except intentional logging)

Verification:
- `npm run build` exits with code 0
- `npm run typecheck` exits with code 0
- No warnings in build output

Directory:
- plugins/m42-sprint/compiler/

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: TypeScript Build Succeeds
```gherkin
Scenario: TypeScript build completes without errors
  Given the compiler directory contains TypeScript source files
  When I run npm build in the compiler directory
  Then the build completes successfully with exit code 0

Verification: `cd plugins/m42-sprint/compiler && npm run build`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: TypeScript Type Check Passes
```gherkin
Scenario: TypeScript type checking passes without errors
  Given the compiler directory contains TypeScript source files
  When I run the TypeScript compiler in noEmit mode
  Then no type errors are reported

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Build Output Directory Exists
```gherkin
Scenario: Compiled JavaScript files are generated
  Given the TypeScript build has completed
  When I check for the dist directory
  Then the main entry point exists at dist/index.js

Verification: `test -f plugins/m42-sprint/compiler/dist/index.js`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Status Server Entry Point Exists
```gherkin
Scenario: Status server entry point is compiled
  Given the TypeScript build has completed
  When I check for the status server entry point
  Then dist/status-server/index.js exists

Verification: `test -f plugins/m42-sprint/compiler/dist/status-server/index.js`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: No Debug Console Logs in Production
```gherkin
Scenario: No debug console.log statements in source files
  Given all TypeScript source files exist
  When I search for console.log statements
  Then only intentional logging patterns are found (prefixed with component names)

Verification: `! grep -r "console\.log(" plugins/m42-sprint/compiler/src/ --include="*.ts" | grep -v "\[.*\]" | grep -v "// intentional" | grep -v "console.log.*error\|warn\|info" | grep -q .`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: All New Modules Have Compiled Output
```gherkin
Scenario: All status server modules are compiled
  Given the TypeScript build has completed
  When I check for compiled status server modules
  Then all key modules exist in dist/status-server/

Verification: `test -f plugins/m42-sprint/compiler/dist/status-server/server.js && test -f plugins/m42-sprint/compiler/dist/status-server/page.js && test -f plugins/m42-sprint/compiler/dist/status-server/watcher.js`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```
