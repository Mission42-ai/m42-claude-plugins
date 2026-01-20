# Gherkin Scenarios: remove-bash

## Step Task
GIVEN the working TypeScript runtime
WHEN integrating with commands and cleaning up
THEN remove replaced bash scripts and update all references

## Scope
- Update slash commands to use TypeScript runtime
- Remove replaced bash scripts
- Update documentation

## Acceptance Criteria

### Command Updates
- [ ] Update /run-sprint command to call TypeScript runtime
- [ ] Update /sprint-status to use TypeScript if applicable
- [ ] Verify /pause-sprint, /resume-sprint, /stop-sprint work

### Bash Script Removal
- [ ] Delete: plugins/m42-sprint/scripts/sprint-loop.sh
- [ ] Delete: plugins/m42-sprint/scripts/build-sprint-prompt.sh
- [ ] Delete: plugins/m42-sprint/scripts/build-parallel-prompt.sh
- [ ] Delete: plugins/m42-sprint/scripts/preflight-check.sh
- [ ] KEEP: plugins/m42-sprint/scripts/test-*.sh (integration tests)

### Documentation Updates
- [ ] Update plugins/m42-sprint/README.md
- [ ] Update any docs referencing bash scripts
- [ ] Document new TypeScript architecture

### Verification
- [ ] grep -r "sprint-loop.sh" → no results in active code
- [ ] grep -r "build-sprint-prompt" → no results in active code
- [ ] /run-sprint executes successfully
- [ ] Full sprint execution works end-to-end
- [ ] All existing integration tests pass

## Files to Delete
- plugins/m42-sprint/scripts/sprint-loop.sh
- plugins/m42-sprint/scripts/build-sprint-prompt.sh
- plugins/m42-sprint/scripts/build-parallel-prompt.sh
- plugins/m42-sprint/scripts/preflight-check.sh

## Files to Modify
- plugins/m42-sprint/commands/run-sprint.md
- plugins/m42-sprint/README.md

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Bash scripts deleted
Given the TypeScript runtime is complete
When checking for replaced bash scripts
Then sprint-loop.sh should not exist
And build-sprint-prompt.sh should not exist
And build-parallel-prompt.sh should not exist
And preflight-check.sh should not exist

Verification: `test ! -f plugins/m42-sprint/scripts/sprint-loop.sh && test ! -f plugins/m42-sprint/scripts/build-sprint-prompt.sh && test ! -f plugins/m42-sprint/scripts/build-parallel-prompt.sh && test ! -f plugins/m42-sprint/scripts/preflight-check.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Integration test scripts preserved
Given bash scripts have been cleaned up
When checking for test scripts
Then test-sprint-features.sh should exist
And test-skip-spawned.sh should exist
And test-skip-parallel-task-id.sh should exist
And test-normal-subphase.sh should exist

Verification: `test -f plugins/m42-sprint/scripts/test-sprint-features.sh && test -f plugins/m42-sprint/scripts/test-skip-spawned.sh && test -f plugins/m42-sprint/scripts/test-skip-parallel-task-id.sh && test -f plugins/m42-sprint/scripts/test-normal-subphase.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: No sprint-loop.sh references in commands
Given bash scripts have been removed
When searching for sprint-loop.sh in command definitions
Then no references should be found in commands directory

Verification: `! grep -rq 'sprint-loop\.sh' plugins/m42-sprint/commands/`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: No build-sprint-prompt references in commands
Given bash scripts have been removed
When searching for build-sprint-prompt in command definitions
Then no references should be found in commands directory

Verification: `! grep -rq 'build-sprint-prompt' plugins/m42-sprint/commands/`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: run-sprint command uses TypeScript runtime
Given the TypeScript runtime is installed
When checking run-sprint.md allowed-tools
Then it should include the TypeScript CLI path (node dist/cli.js or sprint run)
And should not reference sprint-loop.sh

Verification: `grep -q 'node.*runtime.*cli\|sprint run' plugins/m42-sprint/commands/run-sprint.md && ! grep -q 'sprint-loop\.sh' plugins/m42-sprint/commands/run-sprint.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: README documents TypeScript runtime
Given documentation has been updated
When checking README.md
Then it should not require yq
And should document Node.js requirement
And should reference the TypeScript architecture

Verification: `! grep -q "brew install yq\|snap install yq" plugins/m42-sprint/README.md && grep -q "Node.js\|TypeScript" plugins/m42-sprint/README.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: TypeScript runtime is buildable and has CLI
Given the runtime directory exists
When building the TypeScript runtime
Then the build should succeed
And dist/cli.js should exist

Verification: `cd plugins/m42-sprint/runtime && npm run build && test -f dist/cli.js`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: All TypeScript runtime tests pass
Given the runtime is complete
When running all runtime tests
Then all tests should pass

Verification: `cd plugins/m42-sprint/runtime && npm run test`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| plugins/m42-sprint/runtime/src/integration.test.ts | 6 | 1, 2, 3, 4, 5, 6 |

## RED Phase Verification
Tests are expected to FAIL at this point because:
1. Bash scripts still exist (not yet deleted)
2. Command files still reference sprint-loop.sh
3. README still references yq

```bash
npm run test -- plugins/m42-sprint/runtime
# Expected: Some tests may FAIL (old references still exist)
```
