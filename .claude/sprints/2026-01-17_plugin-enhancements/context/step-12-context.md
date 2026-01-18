# Step Context: step-12

## Task
Phase 4 - Step 4: Add URL Routing to Status Server

Implement routing to serve dashboard and individual sprint views.

Requirements:
- Add URL routing in server.ts:
  - `/` or `/dashboard` - Serve dashboard page
  - `/sprint/:id` - Serve sprint detail page (existing page.ts)
  - `/api/sprints` - Return sprint list JSON
  - `/api/metrics` - Return aggregate metrics JSON
- Parse URL path to determine which page to serve
- Pass sprint ID to existing page generation when on detail view
- Update existing SSE endpoint to include sprint ID context
- Handle 404 for unknown sprint IDs

Verification:
- Navigate to `/`, verify dashboard loads
- Navigate to `/sprint/<id>`, verify detail page loads
- Call `/api/sprints`, verify JSON response

File to modify:
- plugins/m42-sprint/compiler/src/status-server/server.ts

## Related Code Patterns

### Current Request Handler: server.ts:261-367
```typescript
private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = req.url || '/';
  // ... CORS setup, method checks ...

  // Current switch statement for routing
  switch (url) {
    case '/':
      this.handlePageRequest(res);
      break;
    case '/events':
      this.handleSSERequest(req, res);
      break;
    // ... other API endpoints
    default:
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
  }
}
```

### Dashboard Page Generator: dashboard-page.ts:16-42
```typescript
export function generateDashboardPage(
  sprints: SprintSummary[],
  metrics: AggregateMetrics,
  activeSprint: string | null
): string {
  // Returns complete HTML with embedded CSS/JS
}
```

### Sprint Scanner: sprint-scanner.ts:56-93
```typescript
export class SprintScanner {
  constructor(sprintsDir: string) {
    this.sprintsDir = sprintsDir;
  }

  scan(): SprintSummary[] {
    // Returns array sorted by date (newest first)
  }

  getById(sprintId: string): SprintSummary | null {
    // Returns single sprint or null
  }
}
```

### Metrics Aggregator: metrics-aggregator.ts:76-138
```typescript
export class MetricsAggregator {
  constructor(summaries: SprintSummary[]) {
    this.summaries = summaries;
  }

  aggregate(): AggregateMetrics {
    // Returns aggregated stats
  }
}
```

### Existing Page Handler: server.ts:372-378
```typescript
private handlePageRequest(res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(getPageHtml());
}
```

## Required Imports
### Internal
- `SprintScanner` from `./sprint-scanner.js`: For scanning sprints directory
- `MetricsAggregator` from `./metrics-aggregator.js`: For calculating aggregate metrics
- `generateDashboardPage` from `./dashboard-page.js`: For rendering dashboard HTML

### External
- No new external packages needed (js-yaml already imported)

## Types/Interfaces to Use
```typescript
// From sprint-scanner.ts
interface SprintSummary {
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
interface AggregateMetrics {
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
```

## Integration Points
- Called by: HTTP clients (browsers, curl)
- Calls:
  - `SprintScanner.scan()` - list sprints
  - `SprintScanner.getById()` - get single sprint
  - `MetricsAggregator.aggregate()` - calculate metrics
  - `generateDashboardPage()` - render dashboard
  - `getPageHtml()` - render sprint detail (existing)
- Tests: No existing test files for server.ts (manual verification)

## Implementation Notes
1. **Sprints Directory Path**: Need to derive `sprintsDir` from `this.config.sprintDir`. The current sprint is at `.claude/sprints/{sprint-id}/`, so sprints dir is parent: `path.dirname(this.config.sprintDir)`

2. **Route Matching Pattern**: Use regex matching for dynamic routes like `/sprint/:id`. Pattern: `/^\/sprint\/([^/]+)$/`

3. **Active Sprint Detection**: Current sprint ID can be extracted from `this.progressFilePath` parent directory name or from loaded progress

4. **API Pagination**: Dashboard requests `/api/sprints?page=N&limit=M`. Need to parse query params from URL.

5. **Route Handler Organization**: Add new route cases before the default case in switch statement, or refactor to use if-else with regex matching for dynamic routes.

6. **Error Handling Pattern**: Follow existing patterns:
   ```typescript
   res.writeHead(404, { 'Content-Type': 'application/json' });
   res.end(JSON.stringify({ error: 'Sprint not found', sprintId }));
   ```

7. **Current Sprint ID**: Extract from path using `path.basename(this.config.sprintDir)`
