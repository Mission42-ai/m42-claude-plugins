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
| `/api/sprint/:id/resume` | POST | Resume a stale or interrupted sprint |
| `/api/sprint/:id/operator-queue` | GET | Get operator queue for a sprint |
| `/api/sprint/:id/operator-queue/:reqId/decide` | POST | Submit manual decision for operator request |
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
          "workflow": "sprint-default",
          "status": "in-progress"
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
      "workflow": "sprint-default",
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
| `activity-event` | Activity from sprint execution (tool calls, assistant messages) |
| `agent-event` | Agent lifecycle and tool usage events |
| `operator-decision` | Operator queue decision made |
| `sprint-complete` | Sprint reached terminal state |
| `keep-alive` | Connection keep-alive (every 15s) |

**Example Events**:

Status update:
```
event: status-update
data: {"type":"status-update","data":{...},"timestamp":"2026-01-18T10:00:00Z"}
```

Activity event (tool call):
```
event: activity-event
data: {"type":"activity-event","data":{"ts":"2026-01-18T10:00:00Z","type":"tool","tool":"Read","file":"src/index.ts"},"timestamp":"2026-01-18T10:00:00Z"}
```

Activity event (assistant message):
```
event: activity-event
data: {"type":"activity-event","data":{"ts":"2026-01-18T10:00:01Z","type":"assistant","text":"Let me analyze the codebase..."},"timestamp":"2026-01-18T10:00:01Z"}
```

Agent event (spawn):
```
event: agent-event
data: {"type":"agent-event","data":{"event":{"ts":"2026-01-18T10:00:00Z","sessionId":"abc123","type":"spawn","stepId":"step-1"},"agentState":{"sessionId":"abc123","name":"Klaus","stepId":"step-1","emotion":"thinking","spawnedAt":"2026-01-18T10:00:00Z","lastActivityAt":"2026-01-18T10:00:00Z","subagentCount":0,"isActive":true}},"timestamp":"2026-01-18T10:00:00Z"}
```

Agent event (tool activity):
```
event: agent-event
data: {"type":"agent-event","data":{"event":{"ts":"2026-01-18T10:00:05Z","sessionId":"abc123","type":"tool_start","tool":"Read","file":"src/index.ts"},"agentState":{"sessionId":"abc123","name":"Klaus","stepId":"step-1","emotion":"reading","currentTool":"Read","currentFile":"src/index.ts","spawnedAt":"2026-01-18T10:00:00Z","lastActivityAt":"2026-01-18T10:00:05Z","subagentCount":0,"isActive":true}},"timestamp":"2026-01-18T10:00:05Z"}
```

Operator decision:
```
event: operator-decision
data: {"type":"operator-decision","data":{"request":{"id":"req-123",...},"decision":"approve"},"timestamp":"2026-01-18T10:00:00Z"}
```

---

## Agent Monitoring API

The agent monitoring system tracks Claude agent activity during sprint execution, providing real-time visibility into agent lifecycle events, tool usage, and parallel execution.

### Event File Format

Agent events are stored in `.agent-events.jsonl` in the sprint directory. Each line is a JSON object representing a single event.

**File Location**: `<sprint-dir>/.agent-events.jsonl`

**Example Content**:
```jsonl
{"ts":"2026-01-18T10:00:00.000Z","sessionId":"abc123","type":"spawn","stepId":"step-1"}
{"ts":"2026-01-18T10:00:05.123Z","sessionId":"abc123","type":"tool_start","tool":"Read","file":"src/index.ts"}
{"ts":"2026-01-18T10:00:05.456Z","sessionId":"abc123","type":"tool_end","tool":"Read","success":true}
{"ts":"2026-01-18T10:00:30.000Z","sessionId":"abc123","type":"complete","status":"success"}
```

---

### Agent Event Types

All events share these base fields:

| Field | Type | Description |
|-------|------|-------------|
| `ts` | string | ISO-8601 timestamp |
| `sessionId` | string | Claude session ID (unique per agent instance) |

#### spawn

Emitted when a Claude agent process starts for a step.

```typescript
{
  type: 'spawn';
  ts: string;
  sessionId: string;
  stepId: string;  // Step ID this agent is working on
}
```

**Example**:
```json
{"ts":"2026-01-18T10:00:00.000Z","sessionId":"abc123","type":"spawn","stepId":"implement-auth"}
```

#### tool_start

Emitted when an agent begins using a tool.

```typescript
{
  type: 'tool_start';
  ts: string;
  sessionId: string;
  tool: string;        // Tool name (Read, Edit, Bash, etc.)
  file?: string;       // File path (for file operations)
  command?: string;    // Command (for Bash, truncated to 100 chars)
  toolUseId?: string;  // Tool use ID for correlation with tool_end
}
```

**Example**:
```json
{"ts":"2026-01-18T10:00:05.123Z","sessionId":"abc123","type":"tool_start","tool":"Read","file":"src/auth.ts","toolUseId":"tu_789"}
```

#### tool_end

Emitted when an agent finishes using a tool.

```typescript
{
  type: 'tool_end';
  ts: string;
  sessionId: string;
  tool: string;        // Tool name
  toolUseId?: string;  // Correlates with tool_start
  success?: boolean;   // Whether the tool call succeeded
}
```

**Example**:
```json
{"ts":"2026-01-18T10:00:05.456Z","sessionId":"abc123","type":"tool_end","tool":"Read","toolUseId":"tu_789","success":true}
```

#### complete

Emitted when a Claude agent process finishes.

```typescript
{
  type: 'complete';
  ts: string;
  sessionId: string;
  status: 'success' | 'failed' | 'cancelled';
  error?: string;  // Error message if failed
}
```

**Example**:
```json
{"ts":"2026-01-18T10:00:30.000Z","sessionId":"abc123","type":"complete","status":"success"}
```

#### subagent_spawn

Emitted when an agent spawns a subagent via the Task tool.

```typescript
{
  type: 'subagent_spawn';
  ts: string;
  sessionId: string;
  agentId: string;    // Subagent ID
  agentType?: string; // Subagent type
}
```

**Example**:
```json
{"ts":"2026-01-18T10:00:10.000Z","sessionId":"abc123","type":"subagent_spawn","agentId":"sub_456","agentType":"code-review"}
```

#### subagent_complete

Emitted when a subagent finishes.

```typescript
{
  type: 'subagent_complete';
  ts: string;
  sessionId: string;
  agentId: string;  // Subagent ID
}
```

**Example**:
```json
{"ts":"2026-01-18T10:00:20.000Z","sessionId":"abc123","type":"subagent_complete","agentId":"sub_456"}
```

---

### Agent State

The `AgentState` interface represents the computed state of an agent derived from events.

```typescript
interface AgentState {
  sessionId: string;       // Claude session ID
  name: string;            // Derived agent name (Klaus, Luna, etc.)
  stepId: string;          // Step ID this agent is working on
  emotion: AgentEmotion;   // Current emotion/status
  currentTool?: string;    // Current tool being used (if any)
  currentFile?: string;    // Current file being worked on (if any)
  spawnedAt: string;       // When the agent spawned
  lastActivityAt: string;  // When the last activity occurred
  subagentCount: number;   // Active subagent count
  isActive: boolean;       // Whether the agent is still active
}
```

**Agent Emotions**:

| Emotion | Emoji | Triggers |
|---------|-------|----------|
| `working` | `working` | Using Edit, Write, Bash, or other write tools |
| `thinking` | `thinking` | Between tool calls, processing |
| `reading` | `reading` | Using Read, Glob, Grep, WebFetch, WebSearch |
| `success` | `success` | Completed successfully |
| `failed` | `failed` | Completed with failure |

**Agent Names**:

Agent names are derived deterministically from session IDs using a hash function. The available names are:
- Klaus, Luna, Max, Mia, Felix, Emma, Leo, Sophie, Finn, Lara

---

### AgentWatcher Class

The `AgentWatcher` class watches `.agent-events.jsonl` and maintains live agent state.

#### Import

```typescript
import { AgentWatcher } from '@m42/sprint/status-server/agent-watcher';
```

#### Constructor

```typescript
constructor(sprintDir: string, options?: AgentWatcherOptions)
```

**Parameters**:
- `sprintDir` - Path to the sprint directory
- `options` - Optional configuration

**AgentWatcherOptions**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debounceDelay` | number | 100 | Debounce delay in milliseconds |
| `staleTimeout` | number | 60000 | Stale agent timeout in milliseconds |

**Example**:
```typescript
const watcher = new AgentWatcher('/path/to/sprint', {
  debounceDelay: 50,
  staleTimeout: 120000,
});
```

#### Methods

##### start()

```typescript
start(): void
```

Start watching the agent events file. Safe to call multiple times (no-op if already watching).

##### close()

```typescript
close(): void
```

Stop watching and clean up resources.

##### getState()

```typescript
getState(): AgentMonitorState
```

Get the current aggregate agent state.

**Returns**:
```typescript
interface AgentMonitorState {
  agents: Map<string, AgentState>;     // sessionId -> AgentState
  stepToAgent: Map<string, string>;    // stepId -> sessionId
  lastUpdate: string;                  // ISO-8601 timestamp
}
```

##### getActiveAgents()

```typescript
getActiveAgents(): AgentState[]
```

Get all currently active agents as an array.

##### getAgentForStep(stepId)

```typescript
getAgentForStep(stepId: string): AgentState | null
```

Get the agent working on a specific step.

**Parameters**:
- `stepId` - Step ID to look up

**Returns**: `AgentState` if an active agent is working on the step, `null` otherwise.

##### getFilePath()

```typescript
getFilePath(): string
```

Get the path to the agent events file being watched.

##### isWatching()

```typescript
isWatching(): boolean
```

Check if the watcher is currently active.

#### Events

The `AgentWatcher` extends `EventEmitter` and emits the following events:

| Event | Arguments | Description |
|-------|-----------|-------------|
| `agent-event` | `(event: AgentEvent, state: AgentState \| null)` | New agent event received |
| `error` | `(error: Error)` | Error occurred during watching |
| `ready` | (none) | Watcher is ready |
| `close` | (none) | Watcher has been closed |

**Example**:
```typescript
watcher.on('agent-event', (event, agentState) => {
  console.log(`Agent ${agentState?.name}: ${event.type}`);
  if (event.type === 'tool_start') {
    console.log(`  Tool: ${event.tool}`);
  }
});

watcher.on('ready', () => {
  console.log('Watcher ready');
});

watcher.start();
```

---

### Agent Monitor Hook

The agent monitor hook is a shell script that captures Claude Code lifecycle events and writes them to `.agent-events.jsonl`.

#### File Location

```
plugins/m42-sprint/hooks/agent-monitor-hook.sh
```

#### Environment Variables

The hook requires these environment variables to be set by the sprint runner:

| Variable | Required | Description |
|----------|----------|-------------|
| `SPRINT_DIR` | Yes | Path to the sprint directory |
| `CURRENT_STEP_ID` | No | Current step ID being executed (defaults to "unknown") |

#### Hook Events Captured

| Hook Event | Agent Event Type | Description |
|------------|------------------|-------------|
| `SessionStart` | `spawn` | Agent process started |
| `PreToolUse` | `tool_start` | Tool execution beginning |
| `PostToolUse` | `tool_end` | Tool execution completed (success) |
| `PostToolUseFailure` | `tool_end` | Tool execution completed (failure) |
| `Stop` | `complete` | Agent stopped |
| `SessionEnd` | `complete` | Agent session ended |
| `SubagentStart` | `subagent_spawn` | Subagent spawned via Task tool |
| `SubagentStop` | `subagent_complete` | Subagent finished |

#### Input Format

The hook receives JSON input via stdin in Claude Code hook format:

```json
{
  "hook_event_name": "PreToolUse",
  "session_id": "abc123",
  "tool_name": "Read",
  "tool_use_id": "tu_789",
  "tool_input": {
    "file_path": "src/index.ts"
  }
}
```

#### Usage

The hook is automatically invoked by Claude Code when configured. To enable it, add to your Claude Code hooks configuration:

```json
{
  "hooks": {
    "PreToolUse": ["bash", "/path/to/agent-monitor-hook.sh"],
    "PostToolUse": ["bash", "/path/to/agent-monitor-hook.sh"],
    "SessionStart": ["bash", "/path/to/agent-monitor-hook.sh"],
    "SessionEnd": ["bash", "/path/to/agent-monitor-hook.sh"]
  }
}
```

---

### Helper Functions

#### getAgentName(sessionId)

```typescript
function getAgentName(sessionId: string): string
```

Get a deterministic agent name from a session ID.

**Example**:
```typescript
const name = getAgentName('abc123'); // Returns e.g., "Klaus"
```

#### getAgentEmoji(emotion)

```typescript
function getAgentEmoji(emotion: AgentEmotion): string
```

Get the emoji for an agent emotion.

**Example**:
```typescript
const emoji = getAgentEmoji('thinking'); // Returns "thinking"
```

#### getEmotionFromTool(tool)

```typescript
function getEmotionFromTool(tool: string | undefined): AgentEmotion
```

Derive an emotion from the current tool being used.

**Returns**:
- `'reading'` for Read, Glob, Grep, WebFetch, WebSearch
- `'working'` for other tools
- `'thinking'` if no tool is active

#### isAgentEvent(obj)

```typescript
function isAgentEvent(obj: unknown): obj is AgentEvent
```

Type guard to validate if an object is a valid `AgentEvent`.

#### createAgentState(event)

```typescript
function createAgentState(event: AgentSpawnEvent): AgentState
```

Create an initial `AgentState` from a spawn event.

---

### SSE Agent Update Payload

When agent events are broadcast via SSE, they include the triggering event and current agent state:

```typescript
interface AgentUpdatePayload {
  event: AgentEvent;           // The event that triggered this update
  agentState?: AgentState;     // Current state of the affected agent
  allAgents?: AgentState[];    // All active agents (for full refresh)
}
```

---

## Stale Sprint Recovery

### POST /api/sprint/:id/resume

Resume a stale or interrupted sprint. A sprint is considered stale if no activity has been recorded for 5+ minutes while in "in-progress" status.

**URL Parameters**:
- `id`: Sprint ID

**Response** (success):
```json
{
  "success": true,
  "action": "resume",
  "sprintId": "2026-01-20_feature-auth",
  "message": "Resume requested - sprint will be restarted"
}
```

**Response** (invalid state):
```json
{
  "success": false,
  "action": "resume",
  "error": "Cannot resume - sprint status is \"completed\" and is not stale"
}
```

**Notes**:
- Only stale or interrupted sprints can be resumed via this endpoint
- Creates a `.resume-requested` signal file for the sprint runner to pick up

---

## Operator Queue Endpoints

### GET /api/sprint/:id/operator-queue

Get the operator queue for a sprint, including pending requests, recent decisions, and backlog items.

**URL Parameters**:
- `id`: Sprint ID

**Response**:
```json
{
  "pending": [
    {
      "id": "req-abc123",
      "title": "Fix null pointer in auth module",
      "description": "Discovered during login implementation...",
      "priority": "high",
      "type": "bug",
      "status": "pending",
      "created-at": "2026-01-20T10:30:00Z",
      "discovered-in": "development > step-2 > implement"
    }
  ],
  "decided": [
    {
      "id": "req-xyz789",
      "title": "Add input validation",
      "status": "approved",
      "decided-at": "2026-01-20T10:25:00Z",
      "decision": {
        "decision": "approve",
        "reasoning": "Critical for security"
      }
    }
  ],
  "backlog": [
    {
      "id": "req-def456",
      "title": "Refactor database layer",
      "status": "pending-review",
      "category": "tech-debt",
      "suggested-priority": "low"
    }
  ],
  "stats": {
    "pendingCount": 1,
    "approvedCount": 3,
    "rejectedCount": 1,
    "deferredCount": 2,
    "backlogCount": 1
  }
}
```

---

### POST /api/sprint/:id/operator-queue/:reqId/decide

Submit a manual decision for a pending operator request.

**URL Parameters**:
- `id`: Sprint ID
- `reqId`: Request ID

**Request Body**:
```json
{
  "decision": "approve",
  "reasoning": "Critical bug that blocks user flow",
  "deferredUntil": "end-of-phase"
}
```

**Decision Values**:

| Decision | Description |
|----------|-------------|
| `approve` | Inject as new step(s) in current sprint |
| `reject` | Decline with reason |
| `defer` | Delay until `deferredUntil` time |

**`deferredUntil` Values** (required for defer):

| Value | Description |
|-------|-------------|
| `end-of-phase` | Review at end of current phase |
| `end-of-sprint` | Review at sprint completion |
| `next-sprint` | Defer to future sprint |

**Response** (success):
```json
{
  "success": true,
  "requestId": "req-abc123",
  "decision": "approve",
  "message": "Request approved"
}
```

**Response** (already decided):
```json
{
  "success": false,
  "error": "Request already decided: approved"
}
```

---

## Page Routes

| Route | Description |
|-------|-------------|
| `/` or `/dashboard` | Sprint dashboard with all sprints |
| `/sprint/:id` | Sprint detail view |
| `/sprint/:id/operator` | Operator queue view |

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

### Monitor agent activity via SSE

```bash
# Filter for agent events only
curl -N http://localhost:3100/events 2>/dev/null | grep "^data:" | jq -r '.data | select(.event.type != null)'
```

---

---

## StepScheduler API (Runtime Module)

The `StepScheduler` class provides DAG-based step scheduling for parallel execution. It manages step execution order based on dependency graphs from PROGRESS.yaml.

### Import

```typescript
import { StepScheduler } from '@m42/sprint/runtime/scheduler';
```

### Constructor

```typescript
constructor(
  progress: CompiledProgress,
  config?: Partial<ParallelExecutionConfig>
)
```

Create a new scheduler from PROGRESS.yaml data.

**Parameters:**
- `progress` - The compiled progress with dependency graphs
- `config` - Optional parallel execution configuration

**Example:**
```typescript
const scheduler = new StepScheduler(progress, {
  onDependencyFailure: 'skip-dependents',
  maxConcurrency: 3,
});
```

---

### Methods

#### getReadySteps()

```typescript
getReadySteps(): ReadyStep[]
```

Get all steps that are ready to execute (all dependencies satisfied).

**Returns:** Array of ready steps with metadata:
```typescript
interface ReadyStep {
  id: string;       // Step ID
  phaseId: string;  // Phase ID
  stepIndex: number; // Step index within the phase
}
```

**Example:**
```typescript
const ready = scheduler.getReadySteps();
for (const step of ready) {
  console.log(`Ready: ${step.id} in phase ${step.phaseId}`);
}
```

---

#### startStep(stepId, workerId?)

```typescript
startStep(stepId: string, workerId?: string): boolean
```

Mark a step as started (in-progress).

**Parameters:**
- `stepId` - ID of the step to start
- `workerId` - Optional worker identifier

**Returns:** `true` if successful, `false` if step not found or not ready

---

#### completeStep(stepId)

```typescript
completeStep(stepId: string): boolean
```

Mark a step as completed. This will:
1. Update the step's status to 'completed'
2. Remove this step from blockedBy of all dependents
3. Mark newly unblocked dependents as 'ready'

**Parameters:**
- `stepId` - ID of the step that completed

**Returns:** `true` if successful, `false` if step not found or not running

---

#### failStep(stepId, error?)

```typescript
failStep(stepId: string, error?: string): boolean
```

Mark a step as failed. Based on the failure policy:
- `skip-dependents`: Mark all transitive dependents as skipped
- `fail-phase`: Handled at loop level, not scheduler level
- `continue`: Do nothing, let other steps continue

**Parameters:**
- `stepId` - ID of the step that failed
- `error` - Optional error message

**Returns:** `true` if successful, `false` if step not found or not running

---

#### injectStep(step, phaseId, dependsOn?)

```typescript
injectStep(
  step: { id: string; prompt: string },
  phaseId: string,
  dependsOn?: string[]
): InjectResult
```

Inject a new step into the graph dynamically.

**Parameters:**
- `step` - The step to inject (id and prompt)
- `phaseId` - Phase to add the step to
- `dependsOn` - IDs of steps this depends on (optional)

**Returns:**
```typescript
interface InjectResult {
  success: boolean;
  error?: string;
}
```

**Example:**
```typescript
const result = scheduler.injectStep(
  { id: 'fix-auth-bug', prompt: 'Fix authentication bug' },
  'implement-features',
  ['auth-module'] // depends on auth-module step
);
```

---

#### isComplete()

```typescript
isComplete(): boolean
```

Check if all steps are complete (or skipped/failed).

**Returns:** `true` if no steps are pending, ready, or running

---

#### hasFailed()

```typescript
hasFailed(): boolean
```

Check if any step has failed.

**Returns:** `true` if any step has failed status

---

#### getStatusSummary()

```typescript
getStatusSummary(): Record<SchedulerStepStatus, number>
```

Get status summary of all steps.

**Returns:** Object with counts by status:
```typescript
{
  pending: number;
  ready: number;
  running: number;
  completed: number;
  failed: number;
  skipped: number;
}
```

---

#### exportDependencyGraphs()

```typescript
exportDependencyGraphs(): CompiledDependencyGraph[]
```

Update the blocked-by lists and export in PROGRESS.yaml format.

**Returns:** Array of dependency graphs with updated blocked-by fields

---

### Types

#### SchedulerStepStatus

```typescript
type SchedulerStepStatus =
  | 'pending'    // Not yet started, waiting for dependencies
  | 'ready'      // All dependencies satisfied, can be started
  | 'running'    // Currently executing
  | 'completed'  // Successfully finished
  | 'failed'     // Execution failed
  | 'skipped';   // Skipped due to failed dependency
```

#### SchedulerNode

Internal node representation (accessible via `getNode()`):

```typescript
interface SchedulerNode {
  id: string;                    // Step ID
  phaseId: string;               // Phase this step belongs to
  dependsOn: string[];           // Original dependencies (immutable)
  blockedBy: string[];           // Currently blocking (mutable)
  dependents: string[];          // Steps that depend on this
  status: SchedulerStepStatus;   // Current status
  workerId?: string;             // Worker ID if running
  startedAt?: string;            // Start timestamp
  completedAt?: string;          // Completion timestamp
  error?: string;                // Error message if failed
}
```

#### SchedulerOptions

```typescript
interface SchedulerOptions {
  onDependencyFailure: 'skip-dependents' | 'fail-phase' | 'continue';
  maxConcurrent: number;  // 0 = unlimited
}
```

---

### Usage Example

```typescript
import { StepScheduler } from '@m42/sprint/runtime/scheduler';
import { readProgress } from '@m42/sprint/compiler';

// Load PROGRESS.yaml
const progress = await readProgress('./PROGRESS.yaml');

// Create scheduler
const scheduler = new StepScheduler(progress, {
  maxConcurrency: 2,
  onDependencyFailure: 'skip-dependents',
});

// Main execution loop
while (!scheduler.isComplete()) {
  const readySteps = scheduler.getReadySteps();

  for (const step of readySteps) {
    scheduler.startStep(step.id, 'worker-1');

    try {
      // Execute the step...
      await executeStep(step);
      scheduler.completeStep(step.id);
    } catch (error) {
      scheduler.failStep(step.id, error.message);
    }
  }

  // Update PROGRESS.yaml with new blocked-by state
  progress['dependency-graph'] = scheduler.exportDependencyGraphs();
  await writeProgress(progress);
}

console.log('Summary:', scheduler.getStatusSummary());
```

---

## See Also

- [Commands Reference](commands.md) - CLI commands
- [Architecture Overview](../concepts/overview.md) - System architecture
- [Sprint YAML Schema](sprint-yaml-schema.md) - Sprint configuration
- [Progress YAML Schema](progress-yaml-schema.md) - Progress tracking
