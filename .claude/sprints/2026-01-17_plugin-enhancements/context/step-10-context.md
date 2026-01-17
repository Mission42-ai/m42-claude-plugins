# Step Context: step-10

## Task
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

## Related Code Patterns

### Similar Implementation: timing-tracker.ts
```typescript
// Class-based module with statistics calculation pattern
export class TimingTracker {
  private readonly sprintDir: string;
  private timingStats: Map<string, PhaseTimingStats> = new Map();

  constructor(sprintDir: string) {
    this.sprintDir = sprintDir;
  }

  // Aggregation method
  calculateAverages(records: PhaseTimingRecord[]): void {
    // Group by key
    const groups = new Map<string, PhaseTimingRecord[]>();
    for (const record of records) {
      const key = `${record.workflow}:${record.phaseId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    // Calculate stats for each group
    for (const [key, groupRecords] of groups) {
      const durations = groupRecords.map(r => r.durationMs);
      const stats: PhaseTimingStats = {
        sampleSize: durations.length,
        avgDurationMs: this.calculateMean(durations),
        minDurationMs: Math.min(...durations),
        maxDurationMs: Math.max(...durations),
      };
      this.timingStats.set(key, stats);
    }
  }

  // Utility methods for statistics
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
}
```

### Similar Implementation: sprint-scanner.ts
```typescript
// Type definitions pattern
export interface SprintSummary {
  sprintId: string;
  status: SprintStatus;
  startedAt: string | null;
  completedAt?: string | null;
  elapsed?: string;
  totalSteps: number;
  completedSteps: number;
  totalPhases: number;
  completedPhases: number;
  workflow?: string;
  path: string;
}

// Class-based scanner pattern
export class SprintScanner {
  private readonly sprintsDir: string;

  constructor(sprintsDir: string) {
    this.sprintsDir = sprintsDir;
  }

  scan(): SprintSummary[] {
    // Process and return results
  }
}

// Convenience function pattern
export function scanSprints(sprintsDir: string): SprintSummary[] {
  const scanner = new SprintScanner(sprintsDir);
  return scanner.scan();
}
```

## Required Imports
### Internal
- `sprint-scanner.js`: `SprintSummary` (the input type for aggregation)
- `status-types.js`: `SprintStatus` (for type checking status values)

### External
- None required (pure calculation module)

## Types/Interfaces to Use
```typescript
// From sprint-scanner.ts
interface SprintSummary {
  sprintId: string;
  status: SprintStatus;  // 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human'
  startedAt: string | null;
  completedAt?: string | null;
  elapsed?: string;
  totalSteps: number;
  completedSteps: number;
  totalPhases: number;
  completedPhases: number;
  workflow?: string;
  path: string;
}
```

## Integration Points
- Called by: `page.ts` (dashboard metrics section), `server.ts` (API endpoint for metrics)
- Calls: None (pure calculation, receives SprintSummary array)
- Tests: No existing test files in status-server/; may add unit tests later

## Implementation Notes
- **Follow timing-tracker.ts patterns**: Similar aggregation class with statistics calculation methods
- **Export both type and class**: `export interface AggregateMetrics` and `export class MetricsAggregator`
- **Handle edge cases**: Empty array returns zero/null metrics, single sprint still calculates
- **Status counts**: Use SprintStatus type to categorize - 'completed' for success, status !== 'completed' && status !== 'in-progress' for failed
- **Duration calculation**: Parse `startedAt` and `completedAt` timestamps, calculate difference in ms
- **Workflow frequency**: Use Map to count workflow occurrences, sort by count
- **Trend calculation**: Group sprints by date (day/week) and count, provide array for charting
- **Use .js extension**: For imports (NodeNext module resolution)
- **Naming convention**: kebab-case file, PascalCase class/interface, camelCase methods
