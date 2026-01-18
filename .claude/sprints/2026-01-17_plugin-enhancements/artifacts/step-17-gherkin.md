# Gherkin Scenarios: step-17

## Step Task
Phase 5 - Step 3: Add Performance Metrics Section

Add collapsible section showing phase timing statistics.

Requirements:
- Add collapsible "Performance Metrics" section below sprint progress
- Display per-phase timing:
  - Phase name, start time, end time, duration
  - Bar chart visualization of relative durations
- Show sprint totals:
  - Total execution time
  - Average phase duration
  - Longest/shortest phase
- Fetch data from existing timing.jsonl or /api/timing endpoint
- Auto-refresh metrics as phases complete

Verification:
- Run a sprint with multiple phases
- Expand metrics section, verify timing data displays
- Verify bar chart shows relative durations

Files to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts
- plugins/m42-sprint/compiler/src/status-server/server.ts (add /api/timing if needed)


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Performance Metrics Section HTML Structure Exists
```gherkin
Scenario: Performance metrics section exists in HTML output
  Given the page.ts file generates HTML for the status dashboard
  When I check for the performance metrics section in the generated HTML
  Then a collapsible section with id "performance-metrics" or class containing "metrics" exists

Verification: `grep -qE '(id="performance-metrics"|class="[^"]*metrics[^"]*")' plugins/m42-sprint/compiler/src/status-server/page.ts && grep -qE 'Performance.*Metrics|Timing.*Statistics' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Metrics Section Has Collapse/Expand Functionality
```gherkin
Scenario: Metrics section is collapsible
  Given the performance metrics section exists in page.ts
  When I check for collapse/expand toggle functionality
  Then there is a button or clickable element to toggle visibility

Verification: `grep -qE 'metrics.*collapse|collapse.*metrics|toggle.*metrics|metrics.*toggle' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Per-Phase Timing Display Elements Exist
```gherkin
Scenario: Per-phase timing data can be displayed
  Given the performance metrics section exists
  When I check for phase timing display elements
  Then elements for phase name, duration, and timing are present

Verification: `grep -qE 'phase.*duration|duration.*phase|timing.*phase|phase.*timing' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Bar Chart Visualization for Phase Durations
```gherkin
Scenario: Visual bar chart shows relative phase durations
  Given the performance metrics section displays timing data
  When I check for bar chart or visual progress elements
  Then CSS and HTML for bar-based visualization exists

Verification: `grep -qE 'metrics.*bar|bar.*width|duration.*bar|timing.*bar|progress.*bar.*metrics' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Sprint Totals Display (Total Time, Averages)
```gherkin
Scenario: Sprint totals are calculated and displayed
  Given the performance metrics section exists
  When I check for sprint-wide statistics
  Then total time, average duration, and longest/shortest phase elements exist

Verification: `grep -qE '(total.*time|total.*duration|average.*phase|longest.*phase|shortest.*phase|total.*execution)' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: TypeScript Compiles Without Errors
```gherkin
Scenario: TypeScript compiles successfully
  Given all page.ts and server.ts changes are complete
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0
```

---

## Implementation Notes

### Existing Infrastructure
- `/api/timing` endpoint already exists in server.ts (line 361-362)
- Returns: `estimatedRemainingMs`, `estimatedRemaining`, `estimateConfidence`, `estimatedCompletionTime`, `phaseEstimates`, `historicalStats`
- `timing.jsonl` file stores phase timing records with: `phaseId`, `workflow`, `startTime`, `endTime`, `durationMs`, `sprintId`
- TimingTracker class provides `getAllStats()` method returning `PhaseTimingStats[]`

### UI Patterns to Follow
- Use collapsible section pattern similar to live-activity-section (line 131-148 in page.ts)
- GitHub dark theme colors: background `#0d1117`, text `#c9d1d9`
- Status colors: green `#238636`, blue `#58a6ff`
- CSS class naming: kebab-case (e.g., `.performance-metrics`, `.timing-bar`)
- Section structure: header row with title + controls, content area

### Data Flow
1. Fetch from `/api/timing` on page load and on SSE status updates
2. Parse `historicalStats` array for per-phase statistics
3. Calculate totals from phase timing data
4. Render bar chart using CSS width percentages relative to longest duration
