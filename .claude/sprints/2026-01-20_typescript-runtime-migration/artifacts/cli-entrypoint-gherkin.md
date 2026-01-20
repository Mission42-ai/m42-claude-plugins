# Gherkin Scenarios: cli-entrypoint

## Step Task
GIVEN the TypeScript runtime modules
WHEN creating the CLI entry point
THEN provide commands matching current bash interface

## Scope
- Create CLI entry point
- Set up runtime package.json
- Configure build and test scripts

## Acceptance Criteria

### Package Setup
- [x] Create plugins/m42-sprint/runtime/package.json (already exists)
- [x] Dependencies: js-yaml, commander
- [x] DevDependencies: typescript, vitest, @types/*
- [x] Scripts: build, test, typecheck

### CLI Entry Point
- [ ] Create plugins/m42-sprint/runtime/src/cli.ts
- [ ] `sprint run <dir>` - run sprint loop
- [ ] `--max-iterations <n>` option
- [ ] `--delay <ms>` option
- [ ] `-v, --verbose` option
- [ ] Exit code 0 on success, 1 on failure

### Build Setup
- [x] tsconfig.json for runtime (already exists)
- [x] Output to dist/
- [ ] Shebang for CLI: #!/usr/bin/env node

### Integration
- [ ] Update root package.json with workspace reference
- [ ] npm run build works from root
- [ ] npm run test works from root

## Files to Create
- plugins/m42-sprint/runtime/src/cli.ts
- plugins/m42-sprint/runtime/src/index.ts (exports)

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: CLI Parses Run Command with Directory

```gherkin
Scenario: CLI parses run command with directory argument
  Given the CLI entry point is invoked
  When the user runs "sprint run /path/to/sprint"
  Then the sprint directory should be parsed as "/path/to/sprint"
  And the run command handler should be invoked

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && node dist/cli.test.js 2>&1 | grep -q "should parse run command with directory" && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: CLI Accepts Max Iterations Option

```gherkin
Scenario: CLI accepts --max-iterations option
  Given the CLI entry point is invoked
  When the user runs "sprint run /path --max-iterations 10"
  Then the maxIterations option should be parsed as 10
  And the loop should be configured with maxIterations=10

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && node dist/cli.test.js 2>&1 | grep -q "should accept --max-iterations" && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: CLI Accepts Delay Option

```gherkin
Scenario: CLI accepts --delay option
  Given the CLI entry point is invoked
  When the user runs "sprint run /path --delay 5000"
  Then the delay option should be parsed as 5000
  And the loop should be configured with delay=5000

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && node dist/cli.test.js 2>&1 | grep -q "should accept --delay" && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: CLI Accepts Verbose Flag

```gherkin
Scenario: CLI accepts -v/--verbose flag
  Given the CLI entry point is invoked
  When the user runs "sprint run /path -v"
  Then the verbose option should be true
  And the loop should enable verbose logging

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && node dist/cli.test.js 2>&1 | grep -q "should accept -v/--verbose" && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: CLI Exits with Code 0 on Success

```gherkin
Scenario: CLI exits with code 0 on successful completion
  Given a sprint with valid PROGRESS.yaml
  When the sprint loop completes successfully
  Then the CLI should exit with code 0

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && node dist/cli.test.js 2>&1 | grep -q "should exit with code 0 on success" && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: CLI Exits with Code 1 on Failure

```gherkin
Scenario: CLI exits with code 1 on failure
  Given a sprint execution that fails
  When the loop terminates with an error
  Then the CLI should exit with code 1

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && node dist/cli.test.js 2>&1 | grep -q "should exit with code 1 on failure" && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: CLI Shows Help with --help

```gherkin
Scenario: CLI shows help when invoked with --help
  Given the CLI entry point is invoked
  When the user runs "sprint --help"
  Then help text should be displayed
  And the help should include "run" command documentation

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && node dist/cli.test.js 2>&1 | grep -q "should show help" && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: CLI Exports Public API via index.ts

```gherkin
Scenario: Index module exports public API
  Given the index.ts module exists
  When importing from the package
  Then runLoop should be exported
  And LoopOptions should be exported
  And LoopResult should be exported

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && node dist/cli.test.js 2>&1 | grep -q "should export public API" && echo "PASS" || echo "FAIL"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| src/cli.test.ts | 12 | 1, 2, 3, 4, 5, 6, 7, 8 |

## RED Phase Verification

Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/runtime && npm run build
# Expected: FAIL - cli.ts does not exist
```

After adding cli.ts stub:
```bash
cd plugins/m42-sprint/runtime && npm run test
# Expected: FAIL - cli.test.js will fail because implementation is incomplete
```
