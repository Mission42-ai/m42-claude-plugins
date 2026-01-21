# Step Context: step-7

## Task
Design and implement the Operator Queue View in the dashboard.

## Overview
A dedicated view per sprint showing:
- **Pending requests**: Waiting for operator decision
- **Decided requests**: Approved, rejected, or deferred with reasoning
- **Backlog items**: Items sent for human review (not auto-implemented)

This is THE central place to see what the operator is doing and why.

## Implementation Plan
Based on gherkin scenarios, implement in this order:

### Phase 1: Transform Layer (`operator-queue-transforms.ts`)
1. Create `toOperatorQueueData()` - separates pending from history, includes backlog
2. Create `calculateQueueStats()` - counts by status
3. Create `sortByPriority()` - orders pending: critical > high > medium > low
4. Create `applyManualDecision()` - updates request status for manual overrides
5. Export `formatRelativeTime()` (re-export from transforms.ts or implement)

### Phase 2: Page Components (`operator-queue-page.ts`)
1. Create `generateOperatorQueuePage()` - main page generator
2. Create `renderPendingRequestsSection()` with `renderPendingRequestCard()`
3. Create `renderDecisionHistorySection()` with filter controls
4. Create `renderBacklogSection()` with action buttons
5. Create helper components:
   - `renderPriorityBadge()` - priority with color coding
   - `renderReasoningBlock()` - collapsible reasoning
   - `renderActionButtons()` - approve/reject/defer buttons
   - `renderOperatorNavBadge()` - navigation badge with count
   - `renderQueueStats()` - summary stats bar

### Phase 3: Server Integration (`server.ts`)
1. Add route: `/sprint/:id/operator` - serves operator queue page
2. Add API: `GET /api/sprint/:id/operator-queue` - returns OperatorQueueData as JSON
3. Add API: `POST /api/sprint/:id/operator-queue/:reqId/decide` - manual decision
4. Add SSE events: `operator-request`, `operator-decision`

### Phase 4: Polish
1. Empty states for all sections
2. Real-time updates via SSE
3. Filter controls for history

## Related Code Patterns

### Pattern from: `dashboard-page.ts` (page generation)
```typescript
export function generateDashboardPage(
  sprints: SprintSummary[],
  metrics: AggregateMetrics,
  activeSprint: string | null
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprint Dashboard</title>
  <style>
${getDashboardStyles()}
  </style>
</head>
<body>
  <div class="container">
    ${generateHeader(activeSprint)}
    ${generateFiltersSection()}
    ${generateMetricsSection(metrics, activeSprint)}
    ${generateSprintTable(sprints)}
  </div>
  <script>
${getDashboardScript()}
  </script>
</body>
</html>`;
}
```

### Pattern from: `server.ts` (route handling)
```typescript
// Parse URL and route
const sprintDetailMatch = url.match(/^\/sprint\/([^/?]+)/);

switch (urlObj.pathname) {
  case '/':
  case '/dashboard':
    this.handleDashboardPageRequest(res);
    break;
  case '/events':
    this.handleSSERequest(req, res);
    break;
  case '/api/status':
    this.handleAPIRequest(res);
    break;
  default:
    if (sprintDetailMatch) {
      const sprintId = decodeURIComponent(sprintDetailMatch[1]);
      this.handleSprintDetailPageRequest(res, sprintId);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
}
```

### Pattern from: `server.ts` (SSE broadcasting)
```typescript
private broadcast<T>(type: string, data: T): void {
  for (const client of this.clients.values()) {
    this.sendEvent(client, type, data);
  }
}

private sendEvent<T>(client: SSEClient, type: string, data: T): void {
  const event: AnySSEEvent = {
    type: type as AnySSEEvent['type'],
    data: data as any,
    timestamp: new Date().toISOString(),
  };
  const message = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
  try {
    client.response.write(message);
  } catch (error) {
    this.clients.delete(client.id);
  }
}
```

### Pattern from: `transforms.ts` (time formatting)
```typescript
export function formatRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
```

### Pattern from: `dashboard-page.ts` (CSS variables)
```typescript
function getDashboardStyles(): string {
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

### Pattern from: `dashboard-page.ts` (status badges)
```typescript
function getStatusClass(status: string): string {
  switch (status) {
    case 'completed': return 'completed';
    case 'in-progress': return 'in-progress';
    case 'blocked': return 'blocked';
    case 'paused': return 'paused';
    case 'needs-human': return 'needs-human';
    case 'not-started': return 'pending';
    default: return 'pending';
  }
}
```

### Pattern from: Test files (test utilities)
```typescript
function test(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve()
    .then(() => fn())
    .then(() => console.log(`✓ ${name}`))
    .catch((error) => {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
```

## Required Imports

### Internal
- `runtime/src/operator.ts`: `QueuedRequest`, `OperatorRequest`, `OperatorDecision`, `OperatorRequestContext`, `InjectionConfig`, `InsertPosition`
- `runtime/src/backlog.ts`: `BacklogItem`, `BacklogFile`, `BacklogItemSource`, `readBacklog`
- `compiler/src/types.ts`: `CompiledProgress`
- `compiler/src/status-server/transforms.ts`: `formatRelativeTime` (can re-export)
- `compiler/src/status-server/status-types.ts`: `SSEEvent`, `AnySSEEvent`

### External
- `js-yaml`: For reading PROGRESS.yaml and BACKLOG.yaml
- `fs`, `path`: File system operations

## Types/Interfaces to Use

### From `runtime/src/operator.ts`
```typescript
interface OperatorRequest {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'bug' | 'improvement' | 'refactor' | 'test' | 'docs' | 'security';
  context?: OperatorRequestContext;
}

interface QueuedRequest extends OperatorRequest {
  status: 'pending' | 'approved' | 'rejected' | 'deferred' | 'backlog';
  'created-at': string;
  'discovered-in': string;
  'decided-at'?: string;
  'rejection-reason'?: string;
  'deferred-until'?: 'end-of-phase' | 'end-of-sprint' | 'next-sprint';
  decision?: OperatorDecision;
}

interface OperatorDecision {
  requestId: string;
  decision: 'approve' | 'reject' | 'defer' | 'backlog';
  reasoning: string;
  injection?: InjectionConfig;
  deferredUntil?: 'end-of-phase' | 'end-of-sprint' | 'next-sprint';
  backlogEntry?: BacklogEntryConfig;
  rejectionReason?: string;
}
```

### From `runtime/src/backlog.ts`
```typescript
interface BacklogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  'suggested-priority': 'high' | 'medium' | 'low';
  'operator-notes': string;
  source: BacklogItemSource;
  'created-at': string;
  status: 'pending-review' | 'acknowledged' | 'converted-to-issue';
}

interface BacklogFile {
  items: BacklogItem[];
}
```

### New Types (to create in status-server)
```typescript
// In operator-queue-transforms.ts or new types file
interface OperatorQueueStats {
  pending: number;
  approved: number;
  rejected: number;
  deferred: number;
  backlog: number;
}

interface OperatorQueueData {
  pending: QueuedRequest[];
  history: QueuedRequest[];
  backlog: BacklogItem[];
  stats: OperatorQueueStats;
}

// For SSE events - add to status-types.ts
type OperatorRequestEvent = SSEEvent<'operator-request', QueuedRequest>;
type OperatorDecisionEvent = SSEEvent<'operator-decision', { request: QueuedRequest; decision: OperatorDecision }>;
```

## Integration Points

### Called by
- `server.ts` routes: `/sprint/:id/operator`, `/api/sprint/:id/operator-queue`
- SSE broadcast system for real-time updates
- Manual decision API endpoint

### Calls
- `readBacklog()` from `runtime/src/backlog.ts`
- YAML parsing for PROGRESS.yaml operator-queue data
- `formatRelativeTime()` from transforms.ts

### SSE Event Flow
1. When operator processes requests → broadcast `operator-decision` event
2. When new request added to queue → broadcast `operator-request` event
3. Client receives events via EventSource → updates UI without refresh

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `compiler/src/status-server/operator-queue-transforms.ts` | Create | Data transformation functions |
| `compiler/src/status-server/operator-queue-page.ts` | Create | HTML page generation |
| `compiler/src/status-server/server.ts` | Modify | Add routes and API endpoints |
| `compiler/src/status-server/status-types.ts` | Modify | Add SSE event types |
| `compiler/src/status-server/operator-queue-transforms.test.ts` | Exists | Tests already written (RED phase) |
| `compiler/src/status-server/operator-queue-page.test.ts` | Exists | Tests already written (RED phase) |

## Component Hierarchy

```
OperatorQueuePage
├── OperatorQueueStats (summary bar)
├── PendingRequestsSection
│   └── OperatorRequestCard (repeated)
│       ├── PriorityBadge
│       ├── RequestDetails
│       ├── DescriptionBlock (collapsible)
│       └── ActionButtons (Approve/Reject/Defer)
├── DecisionHistorySection
│   ├── FilterControls (All/Approved/Rejected/Deferred)
│   └── OperatorDecisionCard (repeated)
│       ├── StatusIcon
│       ├── DecisionDetails
│       └── OperatorReasoningBlock (collapsible)
└── BacklogSection
    ├── BacklogHeader (explanation text)
    └── BacklogItemCard (repeated)
        ├── CategoryBadge
        ├── ItemDetails
        ├── OperatorNotesBlock (collapsible)
        └── ActionButtons (Create Issue/Acknowledge/Delete)
```

## Priority Color Mapping

| Priority | CSS Class | Color Variable | Visual |
|----------|-----------|----------------|--------|
| critical | `priority-critical` | `--accent-red` (#f85149) | 🔴 |
| high | `priority-high` | `--accent-yellow` (#d29922) | 🟡 |
| medium | `priority-medium` | `--accent-blue` (#58a6ff) | 🔵 |
| low | `priority-low` | `--text-muted` (#6e7681) | ⚪ |

## Status Icon Mapping

| Status | Icon | Color |
|--------|------|-------|
| approved | ✅ | green |
| rejected | ❌ | red |
| deferred | ⏸️ | yellow |
| pending | 🔔 | blue |
| backlog | 📌 | gray |

## Verification Commands

```bash
# Run tests (should pass after implementation)
cd plugins/m42-sprint/compiler && npm run build && npm run test

# Verify page renders
curl -s http://localhost:3100/sprint/test-sprint/operator | grep -q 'Pending Requests'

# Verify API endpoint
curl -s http://localhost:3100/api/sprint/test-sprint/operator-queue | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); process.exit(d.pending !== undefined ? 0 : 1)"
```

## Test Files (Already Written - RED Phase)

1. `operator-queue-page.test.ts` - 15 test cases covering:
   - Module import verification
   - Page generation with all sections
   - Pending request card rendering
   - Decision history rendering
   - Backlog section rendering
   - Navigation badge
   - Queue stats
   - Priority badges
   - Action buttons
   - Empty states
   - SSE event handling

2. `operator-queue-transforms.test.ts` - 8 test cases covering:
   - `toOperatorQueueData()` separation logic
   - Stats calculation
   - Priority sorting
   - History sorting by decided-at
   - `applyManualDecision()` for all decision types
   - `formatRelativeTime()` for various durations

## Expected Exports

### `operator-queue-transforms.ts`
```typescript
export function toOperatorQueueData(progress: CompiledProgress, backlog: BacklogFile): OperatorQueueData;
export function calculateQueueStats(queue: QueuedRequest[], backlog: BacklogItem[]): OperatorQueueStats;
export function formatRelativeTime(isoTimestamp: string): string;
export function applyManualDecision(request: QueuedRequest, decision: ManualDecision): QueuedRequest;
export function sortByPriority(requests: QueuedRequest[]): QueuedRequest[];
```

### `operator-queue-page.ts`
```typescript
export function generateOperatorQueuePage(queueData: OperatorQueueData, sprintId: string): string;
export function renderPendingRequestsSection(requests: QueuedRequest[]): string;
export function renderPendingRequestCard(request: QueuedRequest): string;
export function renderDecisionHistorySection(history: QueuedRequest[]): string;
export function renderBacklogSection(backlog: BacklogItem[]): string;
export function renderReasoningBlock(reasoning: string): string;
export function renderOperatorNavBadge(pendingCount: number): string;
export function renderQueueStats(stats: OperatorQueueStats): string;
export function renderPriorityBadge(priority: string): string;
export function renderActionButtons(requestId: string): string;
```
