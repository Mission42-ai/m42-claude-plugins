# Gherkin Scenarios: step-11

## Step Task
Track D - Step 4: Implement Progress Estimation

Add time estimation and progress tracking for sprints and phases.

Requirements:
- Track historical phase durations in <sprint-dir>/timing.jsonl
- Record format: {"phaseId":"string","workflow":"string","startTime":"ISO","endTime":"ISO","durationMs":number}
- Create timing database aggregating data from all past sprints
- Store in .claude/sprints/.timing-history.jsonl
- Calculate rolling averages per workflow/phase type
- Display in status page:
  - "Estimated time remaining" in sprint header
  - Per-phase ETA based on similar past phases
  - Visual timeline showing projected completion
  - Actual vs estimated comparison for completed phases
- Handle first-run case (no historical data) gracefully
- Update estimates in real-time as phases complete
- Show confidence level based on sample size

Files to modify:
- scripts/sprint-loop.sh (record phase timing)
- compiler/src/status-server/server.ts (timing aggregation endpoints)
- compiler/src/status-server/page.ts (estimation UI)

New files:
- compiler/src/status-server/timing-tracker.ts (timing logic)


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Timing tracker TypeScript module exists
  Given the status-server directory exists
  When I check for the timing tracker module
  Then the file timing-tracker.ts exists with timing logic exports

Verification: `test -f /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/timing-tracker.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Timing tracker exports required functions
  Given the timing-tracker.ts file exists
  When I check for core timing functions
  Then functions for loading history, calculating averages, and estimating remaining time are exported

Verification: `grep -E 'export.*(loadTimingHistory|calculateAverages|estimateRemainingTime|getPhaseEstimate|TimingTracker)' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/timing-tracker.ts | wc -l | xargs test 1 -le`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Sprint loop records phase timing to JSONL
  Given the sprint-loop.sh script exists
  When I check for timing recording logic
  Then the script writes phase timing records to timing.jsonl with the required format

Verification: `grep -q 'timing\.jsonl' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/scripts/sprint-loop.sh && grep -E 'phaseId|startTime|endTime|durationMs' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/scripts/sprint-loop.sh | wc -l | xargs test 1 -le`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Server has timing API endpoint
  Given the server.ts file exists
  When I check for timing-related API endpoints
  Then endpoints for retrieving timing data and estimates are present

Verification: `grep -E '/api/timing|/api/estimate|timing.*endpoint|handleTiming' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/server.ts | wc -l | xargs test 1 -le`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Status page displays estimated time remaining in header
  Given the page.ts file exists
  When I check for time estimation UI in the sprint header
  Then an element showing estimated time remaining is present

Verification: `grep -E 'estimated.*remaining|time-remaining|eta-display|estimate-display|remainingTime' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts | wc -l | xargs test 1 -le`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Status page shows confidence level for estimates
  Given the page.ts file exists
  When I check for confidence level display
  Then UI elements showing estimate confidence based on sample size are present

Verification: `grep -E 'confidence|sample.*size|sampleSize|estimateConfidence|low.*confidence|high.*confidence|medium.*confidence' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts | wc -l | xargs test 1 -le`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Timing tracker handles first-run case gracefully
  Given the timing-tracker.ts file exists
  When I check for first-run handling
  Then code handles missing or empty timing history without errors

Verification: `grep -E 'no.*history|empty.*history|first.*run|!.*exists|default.*estimate|fallback|noHistoryData' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/timing-tracker.ts | wc -l | xargs test 1 -le`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: TypeScript compiles without errors
  Given timing features have been implemented
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build 2>&1 | tail -1 | grep -v "error"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
