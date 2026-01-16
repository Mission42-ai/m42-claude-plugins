# Gherkin Scenarios: step-5

## Step Task
Track C - Step 2: Implement Activity Watcher in Status Server

Add activity log watching and SSE streaming to status server.

Requirements:
- Create compiler/src/status-server/activity-watcher.ts module
- Create compiler/src/status-server/activity-types.ts with TypeScript types
- Watch .sprint-activity.jsonl file for changes using fs.watch or chokidar
- Parse JSONL events and validate against activity types
- Stream activity events via SSE to status page clients
- Filter events based on verbosity level (stored in client preference)
- Handle log rotation and large files efficiently
- Add error recovery for corrupted log entries
- Export ActivityWatcher class for integration with server.ts

New files to create:
- compiler/src/status-server/activity-watcher.ts
- compiler/src/status-server/activity-types.ts

Files to modify:
- compiler/src/status-server/server.ts (integrate ActivityWatcher)

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Activity types file exists
  Given the project structure is set up
  When I check for the activity types module
  Then compiler/src/status-server/activity-types.ts exists

Verification: `test -f plugins/m42-sprint/compiler/src/status-server/activity-types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Activity watcher file exists
  Given the project structure is set up
  When I check for the activity watcher module
  Then compiler/src/status-server/activity-watcher.ts exists

Verification: `test -f plugins/m42-sprint/compiler/src/status-server/activity-watcher.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Activity types exports VerbosityLevel type
  Given compiler/src/status-server/activity-types.ts exists
  When I check for VerbosityLevel type export
  Then the verbosity level type is exported (minimal|basic|detailed|verbose)

Verification: `grep -qE "export.*(type|enum).*VerbosityLevel" plugins/m42-sprint/compiler/src/status-server/activity-types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Activity types exports ActivityEvent interface
  Given compiler/src/status-server/activity-types.ts exists
  When I check for ActivityEvent interface export
  Then the activity event interface is exported

Verification: `grep -qE "export.*interface.*ActivityEvent" plugins/m42-sprint/compiler/src/status-server/activity-types.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: ActivityWatcher class is exported
  Given compiler/src/status-server/activity-watcher.ts exists
  When I check for ActivityWatcher class export
  Then the ActivityWatcher class is publicly available

Verification: `grep -qE "export.*class.*ActivityWatcher" plugins/m42-sprint/compiler/src/status-server/activity-watcher.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: ActivityWatcher implements file watching
  Given compiler/src/status-server/activity-watcher.ts exists
  When I check for file watching implementation
  Then the watcher uses fs.watch or fs.watchFile

Verification: `grep -qE "fs\.(watch|watchFile)" plugins/m42-sprint/compiler/src/status-server/activity-watcher.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Server integrates ActivityWatcher
  Given compiler/src/status-server/server.ts exists
  When I check for ActivityWatcher integration
  Then the server imports and uses ActivityWatcher

Verification: `grep -qE "import.*ActivityWatcher|from.*activity-watcher" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: TypeScript compiles without errors
  Given all activity watcher files exist
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npm run build 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0
