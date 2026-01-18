# Step Context: step-11

## Task
Phase 4 - Step 3: Create Dashboard Page HTML

Create the dashboard page showing sprint history and metrics.

Requirements:
- Create dashboard-page.ts with generateDashboardPage() function
- Header with "Sprint Dashboard" title and link to docs
- Metrics summary cards at top:
  - Total sprints, Success rate, Avg duration, Active sprint
- Sprint list table with columns:
  - Sprint ID (link to detail view)
  - Status (with colored badge)
  - Started, Duration, Steps (completed/total)
- Pagination or "Load more" for >20 sprints
- Style consistent with existing page.ts GitHub dark theme
- Include navigation link to current sprint (if active)

Verification:
- Generate dashboard HTML with sample data
- Verify all sections render correctly
- Verify links work correctly

New file to create:
- plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts

## Related Code Patterns

### Similar Implementation: page.ts Structure
```typescript
// plugins/m42-sprint/compiler/src/status-server/page.ts
/**
 * HTML page generator for the Sprint Status Server
 * All CSS and JavaScript is embedded as template literals
 */

/**
 * Generate the complete HTML page for the status dashboard
 * @returns Complete HTML document as a string
 */
export function getPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprint Status</title>
  <style>
${getStyles()}
  </style>
</head>
<body>
  <!-- content -->
  <script>
${getScript()}
  </script>
</body>
</html>`;
}

function getStyles(): string {
  return `
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --bg-highlight: #30363d;
      --border-color: #30363d;
      --text-primary: #c9d1d9;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --accent-blue: #58a6ff;
      --accent-green: #3fb950;
      --accent-yellow: #d29922;
      --accent-red: #f85149;
      --accent-purple: #a371f7;
      --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    }
    /* ... */
  `;
}
```

### Status Badge CSS Pattern
```css
/* From page.ts - use same styling for dashboard */
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.pending { background-color: var(--bg-tertiary); color: var(--text-secondary); }
.status-badge.in-progress { background-color: rgba(88, 166, 255, 0.15); color: var(--accent-blue); }
.status-badge.completed { background-color: rgba(63, 185, 80, 0.15); color: var(--accent-green); }
.status-badge.failed { background-color: rgba(248, 81, 73, 0.15); color: var(--accent-red); }
.status-badge.blocked { background-color: rgba(210, 153, 34, 0.15); color: var(--accent-yellow); }
```

### Card Display Pattern
```css
/* Inspired by estimate-display from page.ts */
.metric-card {
  padding: 4px 10px;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 12px;
}
```

## Required Imports
### Internal
- `sprint-scanner.js`: `SprintSummary` (interface for individual sprint data)
- `metrics-aggregator.js`: `AggregateMetrics` (interface for dashboard metrics)

### External
- None required (pure HTML generation from data)

## Types/Interfaces to Use
```typescript
// From sprint-scanner.ts
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

// From metrics-aggregator.ts
export interface AggregateMetrics {
  totalSprints: number;
  completedSprints: number;
  failedSprints: number;
  inProgressSprints: number;
  successRate: number;
  averageDuration: number;
  averageDurationFormatted: string;
  averageStepsPerSprint: number;
  workflowStats: WorkflowStats[];
  mostCommonWorkflow: string | null;
  dailyTrend: TrendDataPoint[];
  weeklyTrend: TrendDataPoint[];
}

// From status-types.ts
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
```

## Integration Points
- Called by: `server.ts` or new dashboard endpoint handler
- Calls: Receives pre-computed `SprintSummary[]` and `AggregateMetrics` as function parameters
- Tests: May create test file `dashboard-page.test.ts`

## Function Signature
```typescript
/**
 * Generate the complete HTML page for the sprint dashboard
 * @param sprints Array of sprint summaries
 * @param metrics Aggregated metrics across all sprints
 * @param activeSprint Currently active sprint ID (if any)
 * @returns Complete HTML document as a string
 */
export function generateDashboardPage(
  sprints: SprintSummary[],
  metrics: AggregateMetrics,
  activeSprint: string | null
): string
```

## Documentation Link
- Link to docs: `/plugins/m42-sprint/docs/index.md` or appropriate docs URL
- Likely use relative path like `./docs/` for local file serving

## Implementation Notes
- Follow single-file HTML generation pattern from page.ts
- Use CSS variables for theming consistency (--bg-primary, --text-primary, etc.)
- No external dependencies - all CSS/JS embedded as template literals
- Status badge classes match page.ts pattern for consistency
- Handle pagination client-side with JavaScript or use "Load more" pattern
- Sprint ID links should use format like `/sprint/{sprintId}` or query param `?sprint={sprintId}`
- "Active sprint" badge in metrics should highlight if inProgressSprints > 0
- Table should be responsive (horizontal scroll on mobile)
