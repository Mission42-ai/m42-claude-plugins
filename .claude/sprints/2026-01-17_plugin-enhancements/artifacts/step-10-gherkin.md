# Gherkin Scenarios: step-10

## Step Task
Phase 4 - Step 2: Create MetricsAggregator Module

Create module to aggregate statistics across multiple sprints.

Requirements:
- Create metrics-aggregator.ts with MetricsAggregator class
- Accept array of SprintSummary objects
- Calculate aggregate metrics:
  - Total sprints (completed, failed, in-progress)
  - Average sprint duration
  - Average steps per sprint
  - Success rate percentage
  - Most common workflows used
  - Sprints per day/week trend
- Export AggregateMetrics type and MetricsAggregator class

Verification:
- Pass sprint summaries to aggregator
- Verify all metrics are calculated correctly
- Verify edge cases (empty array, single sprint)

New file to create:
- plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Source file exists
```gherkin
Scenario: Source file exists
  Given the project structure is set up
  When I check for the MetricsAggregator module file
  Then plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts exists

Verification: `test -f plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 2: TypeScript compiles without errors
```gherkin
Scenario: TypeScript compiles without errors
  Given metrics-aggregator.ts exists
  When I run the TypeScript compiler on the status-server directory
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 3: MetricsAggregator class is exported
```gherkin
Scenario: MetricsAggregator class is exported
  Given metrics-aggregator.ts exists
  When I check for the MetricsAggregator class export
  Then the class is publicly available

Verification: `grep -q "export class MetricsAggregator" plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 4: AggregateMetrics type is exported
```gherkin
Scenario: AggregateMetrics type is exported
  Given metrics-aggregator.ts exists
  When I check for the AggregateMetrics type export
  Then the type is publicly available

Verification: `grep -qE "export (interface|type) AggregateMetrics" plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 5: Total sprints metrics are calculated
```gherkin
Scenario: Total sprints metrics are calculated
  Given metrics-aggregator.ts exports AggregateMetrics
  When I check for sprint count properties
  Then properties for completed, failed, and in-progress counts exist

Verification: `grep -E "(totalSprints|completedSprints|failedSprints|inProgressSprints)" plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts | wc -l | xargs test 4 -le`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 6: Average metrics are calculated
```gherkin
Scenario: Average metrics are calculated
  Given metrics-aggregator.ts exports AggregateMetrics
  When I check for average calculation properties
  Then average duration and average steps per sprint properties exist

Verification: `grep -E "(averageDuration|averageStepsPerSprint)" plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts | wc -l | xargs test 2 -le`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 7: Success rate and workflow metrics exist
```gherkin
Scenario: Success rate and workflow metrics exist
  Given metrics-aggregator.ts exports AggregateMetrics
  When I check for success rate and workflow properties
  Then successRate and workflow-related properties exist

Verification: `grep -E "(successRate|workflows|Workflow)" plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts | wc -l | xargs test 2 -le`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 8: Imports SprintSummary from sprint-scanner
```gherkin
Scenario: Imports SprintSummary from sprint-scanner
  Given metrics-aggregator.ts exists
  When I check for SprintSummary import
  Then it imports from sprint-scanner.js

Verification: `grep -qE "import.*SprintSummary.*from.*sprint-scanner" plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```
