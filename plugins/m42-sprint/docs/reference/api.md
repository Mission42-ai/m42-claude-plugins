# Status Server API Reference

The M42-Sprint status server provides a REST API for monitoring sprint progress, controlling execution, and discovering sprints across git worktrees.

## Base URL

```
http://localhost:3100
```

Default port is 3100. Configure via `/run-sprint` or status server options.

---

## Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Current sprint status with worktree context |
| `/api/sprints` | GET | List sprints with pagination and filtering |
| `/api/worktrees` | GET | List all git worktrees with their sprints |
| `/api/metrics` | GET | Aggregate metrics across all sprints |
| `/api/timing` | GET | Timing estimates and historical statistics |
| `/api/controls` | GET | Available control actions for current state |
| `/api/pause` | POST | Request sprint pause |
| `/api/resume` | POST | Request sprint resume |
| `/api/stop` | POST | Request sprint stop |
| `/api/skip/:phaseId` | POST | Skip a phase |
| `/api/retry/:phaseId` | POST | Retry a failed phase |
| `/api/force-retry/:phaseId` | POST | Force retry bypassing backoff |
| `/api/logs/:phaseId` | GET | Get log content for a phase |
| `/api/logs/download/:phaseId` | GET | Download log file |
| `/api/logs/download-all` | GET | Download all logs as gzip archive |

---

## Worktree-Aware Endpoints

These endpoints support parallel sprint execution across multiple git worktrees.

### GET /api/worktrees

List all git worktrees in the repository with their active sprints.

**Purpose**: Enable dashboard to display sprints from all worktrees, supporting parallel development workflows where different features run in isolated worktrees.

**Response**:
```json
{
  "worktrees": [
    {
      "name": "main",
      "branch": "main",
      "commit": "abc1234",
      "isMain": true,
      "root": "/home/user/project",
      "sprints": [
        {
          "sprintId": "2026-01-15_feature-a",
          "status": "in-progress",
          "startedAt": "2026-01-15T10:00:00Z",
          "workflow": "ralph",
          "mode": "ralph"
        }
      ],
      "activeSprint": {
        "sprintId": "2026-01-15_feature-a",
        "status": "in-progress"
      }
    },
    {
      "name": "feature-x-worktree",
      "branch": "feature/user-auth",
      "commit": "def5678",
      "isMain": false,
      "root": "/home/user/project-worktrees/feature-x-worktree",
      "sprints": [
        {
          "sprintId": "2026-01-15_user-auth",
          "status": "in-progress"
        }
      ],
      "activeSprint": {
        "sprintId": "2026-01-15_user-auth",
        "status": "in-progress"
      }
    }
  ],
  "total": 2,
  "serverWorktree": {
    "name": "main",
    "branch": "main",
    "isMain": true
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `worktrees` | array | All worktrees in the repository |
| `worktrees[].name` | string | Worktree identifier ("main" or directory name) |
| `worktrees[].branch` | string | Current git branch in this worktree |
| `worktrees[].commit` | string | Abbreviated commit SHA |
| `worktrees[].isMain` | boolean | True if this is the main worktree (has .git directory) |
| `worktrees[].root` | string | Absolute path to worktree root |
| `worktrees[].sprints` | array | All sprints in this worktree (newest first) |
| `worktrees[].activeSprint` | object\|null | Currently running sprint, if any |
| `total` | number | Total number of worktrees |
| `serverWorktree` | object | Which worktree this status server is monitoring |

**Use Cases**:
- Multi-worktree dashboard showing all parallel sprints
- Identifying which worktree a sprint belongs to
- Discovering active sprints across the repository

---

### GET /api/sprints

List sprints with optional pagination and worktree information.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 20 | Items per page |
| `includeWorktree` | boolean | false | Include worktree info for each sprint |

**Request**:
```
GET /api/sprints?includeWorktree=true&page=1&limit=10
```

**Response**:
```json
{
  "sprints": [
    {
      "sprintId": "2026-01-18_m42-sprint-refactor",
      "status": "in-progress",
      "workflow": "ralph",
      "mode": "ralph",
      "startedAt": "2026-01-18T10:00:00Z",
      "worktree": {
        "name": "sprint/2026-01-18_m42-sprint-refactor",
        "branch": "sprint/2026-01-18_m42-sprint-refactor",
        "isMain": false
      }
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 10,
  "hasMore": true,
  "serverWorktree": {
    "name": "main",
    "branch": "main",
    "isMain": true
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `sprints` | array | List of sprint summaries |
| `sprints[].worktree` | object | Worktree info (only if `includeWorktree=true`) |
| `total` | number | Total number of sprints across all pages |
| `page` | number | Current page number |
| `limit` | number | Items per page |
| `hasMore` | boolean | Whether more pages are available |
| `serverWorktree` | object | The status server's worktree context |

---

### GET /api/status

Get current sprint status with worktree context.

**Response**:
```json
{
  "sprintId": "2026-01-18_m42-sprint-refactor",
  "status": "in-progress",
  "progress": {
    "completed": 5,
    "total": 12,
    "percentage": 41
  },
  "current": {
    "phase": 1,
    "step": 2,
    "subPhase": 1
  },
  "worktree": {
    "name": "sprint/2026-01-18_m42-sprint-refactor",
    "branch": "sprint/2026-01-18_m42-sprint-refactor",
    "commit": "d07098a",
    "isMain": false,
    "root": "/home/user/project-worktrees/sprint/2026-01-18_m42-sprint-refactor"
  }
}
```

The `worktree` field provides context about which worktree this sprint is running in, enabling parallel execution awareness.

---

## Sprint Control Endpoints

### GET /api/controls

Returns available actions based on current sprint state.

**Response**:
```json
{
  "sprintStatus": "in-progress",
  "availableActions": ["pause", "stop"]
}
```

**Available Actions by Status**:

| Sprint Status | Available Actions |
|---------------|-------------------|
| `in-progress` | `pause`, `stop` |
| `paused` | `resume`, `stop` |
| `blocked` | `stop` |
| `needs-human` | `stop` |
| `completed` | (none) |

---

### POST /api/pause

Request sprint to pause after current task completes.

**Response** (success):
```json
{
  "success": true,
  "action": "pause",
  "message": "Pause requested - sprint will pause after current task"
}
```

**Response** (invalid state):
```json
{
  "success": false,
  "action": "pause",
  "error": "Cannot pause - sprint status is \"paused\""
}
```

---

### POST /api/resume

Request paused sprint to resume.

**Response** (success):
```json
{
  "success": true,
  "action": "resume",
  "message": "Resume requested - sprint will resume execution"
}
```

---

### POST /api/stop

Request sprint to stop after current task completes.

**Response** (success):
```json
{
  "success": true,
  "action": "stop",
  "message": "Stop requested - sprint will stop after current task"
}
```

---

## Phase Control Endpoints

### POST /api/skip/:phaseId

Skip a phase (blocked, in-progress, or pending phases only).

**URL Parameters**:
- `phaseId`: Phase path (URL-encoded), e.g., `development%20%3E%20step-0%20%3E%20plan`

**Phase ID Format**: `phase > step > subPhase` (space-separated with `>`)

**Response** (success):
```json
{
  "success": true,
  "action": "skip",
  "phaseId": "development > step-0 > plan",
  "message": "Phase \"development > step-0 > plan\" has been skipped"
}
```

**Notes**:
- Skipping a container (phase with steps) also skips all children
- Sets status to `skipped` and advances current pointer

---

### POST /api/retry/:phaseId

Queue a failed or blocked phase for retry.

**Response** (success):
```json
{
  "success": true,
  "action": "retry",
  "phaseId": "development > step-0 > implement",
  "message": "Phase \"development > step-0 > implement\" has been queued for retry"
}
```

**Notes**:
- Only failed or blocked phases can be retried
- Increments retry count
- Clears error fields and timing

---

### POST /api/force-retry/:phaseId

Force immediate retry, bypassing exponential backoff wait.

**Response** (success):
```json
{
  "success": true,
  "action": "force-retry",
  "phaseId": "development > step-0 > implement",
  "message": "Force retry initiated for \"development > step-0 > implement\" - bypassing backoff"
}
```

**Notes**:
- Only valid when phase is in backoff wait (`next-retry-at` set)
- Use regular `/api/retry/:phaseId` for phases not in backoff

---

## Metrics and Timing

### GET /api/metrics

Aggregate metrics across all sprints.

**Response**:
```json
{
  "totalSprints": 15,
  "completedSprints": 12,
  "inProgressSprints": 2,
  "failedSprints": 1,
  "averageDurationMs": 3600000,
  "totalPhases": 180,
  "completedPhases": 156
}
```

---

### GET /api/timing

Timing estimates for current sprint.

**Response**:
```json
{
  "estimatedRemainingMs": 1800000,
  "estimatedRemaining": "30 minutes",
  "estimateConfidence": "medium",
  "estimatedCompletionTime": "2026-01-18T12:30:00Z",
  "phaseEstimates": {
    "development > step-2 > implement": {
      "estimatedMs": 600000,
      "confidence": "high"
    }
  },
  "historicalStats": [
    {
      "phaseType": "implement",
      "averageMs": 300000,
      "sampleCount": 45
    }
  ]
}
```

---

## Log Endpoints

### GET /api/logs/:phaseId

Get log content for a specific phase.

**Response**: Plain text log content

**Content-Type**: `text/plain`

---

### GET /api/logs/download/:phaseId

Download log file as attachment.

**Response**: File download

**Content-Disposition**: `attachment; filename="phase-id.log"`

---

### GET /api/logs/download-all

Download all logs as gzipped JSON archive.

**Response**: Gzipped JSON containing all log files

**Content-Type**: `application/gzip`

**Archive Format**:
```json
{
  "development-step-0-plan.log": "Log content...",
  "development-step-0-implement.log": "Log content..."
}
```

---

## Server-Sent Events (SSE)

### GET /events

SSE endpoint for real-time updates.

**Event Types**:

| Event | Description |
|-------|-------------|
| `status-update` | Sprint status changed |
| `log-entry` | New log entry |
| `activity-event` | Activity from sprint execution |
| `keep-alive` | Connection keep-alive (every 15s) |

**Example Event**:
```
event: status-update
data: {"type":"status-update","data":{...},"timestamp":"2026-01-18T10:00:00Z"}
```

---

## Page Routes

| Route | Description |
|-------|-------------|
| `/` or `/dashboard` | Sprint dashboard with all sprints |
| `/sprint/:id` | Sprint detail view |

---

## Error Responses

All endpoints return errors in consistent format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

**HTTP Status Codes**:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (invalid parameters or state) |
| 404 | Resource not found |
| 405 | Method not allowed |
| 500 | Internal server error |

---

## CORS

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

---

## Usage Examples

### List all worktrees and their sprints

```bash
curl http://localhost:3100/api/worktrees | jq
```

### Get sprints with worktree info

```bash
curl "http://localhost:3100/api/sprints?includeWorktree=true" | jq
```

### Pause a sprint via API

```bash
curl -X POST http://localhost:3100/api/pause
```

### Skip a blocked phase

```bash
curl -X POST "http://localhost:3100/api/skip/development%20%3E%20step-0%20%3E%20plan"
```

### Watch for updates via SSE

```bash
curl -N http://localhost:3100/events
```

---

## See Also

- [Commands Reference](commands.md) - CLI commands
- [Ralph Mode](../concepts/ralph-mode.md) - Autonomous execution
- [Sprint YAML Schema](sprint-yaml-schema.md) - Sprint configuration
- [Progress YAML Schema](progress-yaml-schema.md) - Progress tracking
