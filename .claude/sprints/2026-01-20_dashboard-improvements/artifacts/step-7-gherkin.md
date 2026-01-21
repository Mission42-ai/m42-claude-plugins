# Gherkin Scenarios: step-7

## Step Task
Design and implement the Operator Queue View in the dashboard.

## Overview
A dedicated view per sprint showing:
- **Pending requests**: Waiting for operator decision
- **Decided requests**: Approved, rejected, or deferred with reasoning
- **Backlog items**: Items sent for human review (not auto-implemented)

This is THE central place to see what the operator is doing and why.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Navigate to operator queue view
```gherkin
Scenario: Navigate to operator queue view from sprint detail page
  Given a running sprint with operator-queue data in PROGRESS.yaml
  When the user navigates to /sprint/:id/operator
  Then the operator queue page should render
  And the page should show three sections: Pending, History, and Backlog

Verification: `curl -s http://localhost:3100/sprint/test-sprint/operator | grep -q 'Pending Requests' && curl -s http://localhost:3100/sprint/test-sprint/operator | grep -q 'Decision History' && curl -s http://localhost:3100/sprint/test-sprint/operator | grep -q 'Backlog'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 2: Display pending operator requests
```gherkin
Scenario: Display pending operator requests with full details
  Given a sprint with pending operator requests in the queue
  When the operator queue page renders the pending section
  Then each pending request should show:
    | Field | Description |
    | priority badge | CRITICAL/HIGH/MEDIUM/LOW with color |
    | title | Request title |
    | discovered-in | Phase where issue was found |
    | created-at | Relative time (e.g., "2 min ago") |
    | files | Related files if present |
    | description | Expandable description block |
    | suggested workflow | If provided |
    | action buttons | Approve, Reject, Defer |

Verification: `node --experimental-strip-types plugins/m42-sprint/compiler/src/status-server/operator-queue-page.test.ts 2>&1 | grep -q '✓ renders pending request with all fields'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 3: Display decision history with reasoning
```gherkin
Scenario: Display decision history with operator reasoning
  Given a sprint with decided operator requests
  When the operator queue page renders the history section
  Then approved requests should show:
    | Field | Description |
    | status icon | Green checkmark for approved |
    | title | Request title |
    | decided-at | Relative time |
    | injected-after | Phase ID where step was injected |
    | reasoning | Collapsible operator reasoning block |
  And rejected requests should show:
    | status icon | Red X for rejected |
    | rejection-reason | Why it was rejected |
    | reasoning | Operator reasoning |
  And deferred requests should show:
    | status icon | Pause icon for deferred |
    | deferred-until | When to revisit |
    | reasoning | Operator reasoning |

Verification: `node --experimental-strip-types plugins/m42-sprint/compiler/src/status-server/operator-queue-page.test.ts 2>&1 | grep -q '✓ renders decision history with all statuses'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 4: Display backlog section for human review
```gherkin
Scenario: Display backlog items for human review
  Given a sprint with items in BACKLOG.yaml
  When the operator queue page renders the backlog section
  Then each backlog item should show:
    | Field | Description |
    | category | tech-debt, feature, investigation, etc. |
    | title | Item title |
    | suggested-priority | HIGH/MEDIUM/LOW |
    | operator-notes | Collapsible notes block |
    | status | pending-review, acknowledged, converted-to-issue |
    | action buttons | Create Issue, Acknowledge, Delete |
  And a header explaining items won't be auto-implemented

Verification: `node --experimental-strip-types plugins/m42-sprint/compiler/src/status-server/operator-queue-page.test.ts 2>&1 | grep -q '✓ renders backlog section with items'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 5: API endpoint returns operator queue data
```gherkin
Scenario: GET /api/sprint/:id/operator-queue returns queue data
  Given a sprint with operator-queue in PROGRESS.yaml
  When GET /api/sprint/:id/operator-queue is called
  Then the response should be JSON with:
    | Field | Type |
    | pending | Array of QueuedRequest with status='pending' |
    | history | Array of QueuedRequest with decided status |
    | backlog | Array of BacklogItem |
    | stats | { pending: number, approved: number, rejected: number, deferred: number, backlog: number } |

Verification: `curl -s http://localhost:3100/api/sprint/test-sprint/operator-queue | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); process.exit(d.pending !== undefined && d.history !== undefined && d.backlog !== undefined ? 0 : 1)"`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 6: Manual decision via API endpoint
```gherkin
Scenario: POST manual decision bypasses operator
  Given a pending request with id "req_abc123"
  When POST /api/sprint/:id/operator-queue/:reqId/decide is called with:
    ```json
    {
      "decision": "approve",
      "reasoning": "Manual override - urgent fix needed"
    }
    ```
  Then the request status should be updated to "approved"
  And the decision should be stored with source: "manual"
  And if approved, injection should be triggered

Verification: `node --experimental-strip-types plugins/m42-sprint/compiler/src/status-server/operator-queue-page.test.ts 2>&1 | grep -q '✓ manual decision updates request status'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 7: SSE events for queue changes
```gherkin
Scenario: Real-time updates via SSE
  Given an SSE connection to /events
  When a new operator request is added to the queue
  Then an 'operator-request' SSE event should be broadcast
  And when a decision is made
  Then an 'operator-decision' SSE event should be broadcast
  And the UI should update without page refresh

Verification: `node --experimental-strip-types plugins/m42-sprint/compiler/src/status-server/operator-queue-page.test.ts 2>&1 | grep -q '✓ SSE events broadcast for queue changes'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Scenario 8: Navigation badge shows pending count
```gherkin
Scenario: Navigation shows pending request count
  Given a sprint with 3 pending operator requests
  When the sprint detail page navigation renders
  Then the Operator tab should show badge: "Operator (3)"
  And when requests are processed, badge should update in real-time

Verification: `node --experimental-strip-types plugins/m42-sprint/compiler/src/status-server/operator-queue-page.test.ts 2>&1 | grep -q '✓ navigation badge shows pending count'`
Pass: Exit code = 0 -> Score 1
Fail: Exit code != 0 -> Score 0
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| `compiler/src/status-server/operator-queue-page.test.ts` | 15 | 1, 2, 3, 4, 8 |
| `compiler/src/status-server/operator-queue-transforms.test.ts` | 8 | 5 |
| `compiler/src/status-server/server.test.ts` (additions) | 6 | 5, 6, 7 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/compiler && npm run build && npm run test
# Expected: FAIL (no implementation yet)

# Specifically:
node --experimental-strip-types src/status-server/operator-queue-page.test.ts
# Expected: Module not found or test failures
```

## Types Required (from existing operator.ts in runtime)

The following types already exist in `runtime/src/operator.ts`:
- `OperatorRequest` - Request submitted by Claude
- `QueuedRequest` - Request with queue metadata
- `OperatorDecision` - Decision made by operator
- `OperatorResponse` - Complete operator response

The following types exist in `runtime/src/backlog.ts`:
- `BacklogItem` - Item in BACKLOG.yaml
- `BacklogFile` - BACKLOG.yaml structure

## New Types Needed for UI

```typescript
// Status server types for operator queue display
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

// SSE event types
type OperatorRequestEvent = SSEEvent<'operator-request', QueuedRequest>;
type OperatorDecisionEvent = SSEEvent<'operator-decision', { request: QueuedRequest; decision: OperatorDecision }>;
```

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
