# PROGRESS.yaml Schema Reference

Complete schema specification for PROGRESS.yaml, the generated runtime state file. PROGRESS.yaml is created by the compiler from your SPRINT.yaml and tracks execution progress through the sprint loop.

## Quick Reference

```yaml
# Top-level fields (all generated)
sprint-id: <string>       # Sprint identifier
status: <enum>            # Sprint execution status
phases: <list>            # Compiled phase hierarchy
current: <object>         # Execution pointer (phase/step/sub-phase)
stats: <object>           # Execution statistics
```

## How PROGRESS.yaml is Generated

```
┌─────────────────────────────────────────────────────────────┐
│                       SPRINT.yaml                           │
│  (You write: workflow reference + steps with prompts)       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript Compiler                       │
│  - Resolves workflow from .claude/workflows/                 │
│  - Expands for-each phases over steps                       │
│  - Substitutes template variables                           │
│  - Generates hierarchical phase structure                   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     PROGRESS.yaml                            │
│  (Generated: phases, current pointer, stats)                │
└─────────────────────────────────────────────────────────────┘
```

## Status Values

### Sprint Status

Overall sprint execution status.

| Value | Description |
|-------|-------------|
| `not-started` | Sprint initialized but execution hasn't begun |
| `in-progress` | Actively executing phases |
| `completed` | All phases finished successfully |
| `blocked` | Cannot proceed, requires resolution |
| `paused` | Manually paused by user (via `/pause-sprint`) |
| `needs-human` | Requires human intervention to continue |

### Phase Status

Status for individual phases, steps, and sub-phases.

| Value | Description |
|-------|-------------|
| `pending` | Not yet started, waiting in queue |
| `in-progress` | Currently executing |
| `completed` | Successfully finished |
| `blocked` | Cannot proceed, needs resolution |
| `skipped` | Intentionally skipped |
| `failed` | Execution failed with error |

## Phase Hierarchy

PROGRESS.yaml uses a three-level hierarchy to track execution:

```
PROGRESS.yaml
└── phases[]                    # Top-level phases (from workflow)
    ├── Simple Phase            # Has prompt, no steps
    │   └── prompt: "..."
    │
    └── For-Each Phase          # Has steps (expanded from SPRINT.yaml)
        └── steps[]             # One per SPRINT.yaml step
            └── phases[]        # Sub-phases (from step workflow)
                └── prompt: "..."
```

### ASCII Tree Visualization

```
PROGRESS.yaml
│
├── sprint-id: "my-sprint"
├── status: "in-progress"
│
├── phases:
│   │
│   ├── [0] Simple Phase ─────────────────────────────────┐
│   │       id: "setup"                                   │
│   │       status: "completed"                           │
│   │       prompt: "Create project structure"            │
│   │                                                     │
│   ├── [1] For-Each Phase ───────────────────────────────┤
│   │       id: "execute-all"                             │
│   │       status: "in-progress"                         │
│   │       │                                             │
│   │       └── steps:                                    │
│   │           │                                         │
│   │           ├── [0] Step ─────────────────────────────┤
│   │           │       id: "step-0"                      │
│   │           │       prompt: "Implement login"         │
│   │           │       status: "completed"               │
│   │           │       │                                 │
│   │           │       └── phases: (sub-phases)          │
│   │           │           ├── [0] implement ✓           │
│   │           │           └── [1] qa ✓                  │
│   │           │                                         │
│   │           ├── [1] Step ◀── CURRENT ─────────────────┤
│   │           │       id: "step-1"                      │
│   │           │       prompt: "Implement logout"        │
│   │           │       status: "in-progress"             │
│   │           │       │                                 │
│   │           │       └── phases:                       │
│   │           │           ├── [0] implement ◀── HERE    │
│   │           │           └── [1] qa (pending)          │
│   │           │                                         │
│   │           └── [2] Step ─────────────────────────────┤
│   │                   id: "step-2"                      │
│   │                   status: "pending"                 │
│   │                                                     │
│   └── [2] Simple Phase ─────────────────────────────────┘
│           id: "finalize"
│           status: "pending"
│           prompt: "Create PR and cleanup"
│
├── current:
│       phase: 1        # → phases[1] (execute-all)
│       step: 1         # → steps[1] (step-1)
│       sub-phase: 0    # → phases[0] (implement)
│
└── stats:
        started-at: "2026-01-15T09:00:00Z"
        total-phases: 3
        completed-phases: 1
```

## Current Pointer

The `current` object tracks exactly where execution is in the hierarchy.

| Field | Type | Description |
|-------|------|-------------|
| `phase` | number | Index into `phases[]` array (0-based) |
| `step` | number \| null | Index into `steps[]` array (null for simple phases) |
| `sub-phase` | number \| null | Index into step's `phases[]` array |

### Pointer Navigation Examples

**Simple phase (no steps):**
```yaml
current:
  phase: 0          # phases[0]
  step: null        # No steps
  sub-phase: null   # No sub-phases
```

**For-each phase with steps:**
```yaml
current:
  phase: 1          # phases[1]
  step: 2           # phases[1].steps[2]
  sub-phase: 0      # phases[1].steps[2].phases[0]
```

### Resolving Current Position

To find what's currently executing:

```bash
# Check current sprint status
/sprint-status

# Or view raw PROGRESS.yaml
cat PROGRESS.yaml | grep -A5 'current:'
```

The TypeScript runtime uses a pointer-based system to track position:
- `current.phase`: Index into top-level `phases[]` (0-based)
- `current.step`: Index into `steps[]` within a for-each phase (null for simple phases)
- `current.sub-phase`: Index into step's `phases[]` (null for simple steps)

## Field Reference

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `sprint-id` | string | Sprint identifier (from SPRINT.yaml or directory name) |
| `status` | SprintStatus | Overall sprint execution status |
| `phases` | CompiledTopPhase[] | Compiled phase hierarchy |
| `current` | CurrentPointer | Execution position pointer |
| `stats` | SprintStats | Execution statistics |
| `operator-queue` | QueuedRequest[] | Operator requests pending decision |
| `last-activity` | ISO 8601 | Heartbeat timestamp for stale detection |

### CompiledTopPhase (Top-Level Phase)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Phase identifier |
| `status` | PhaseStatus | Yes | Phase execution status |
| `prompt` | string | Simple only | Execution prompt (simple phases) |
| `steps` | CompiledStep[] | For-each only | Expanded steps (for-each phases) |
| `model` | ClaudeModel | No | Resolved model for execution |
| `started-at` | ISO 8601 | No | When phase started |
| `completed-at` | ISO 8601 | No | When phase completed |
| `elapsed` | string | No | Human-readable duration |
| `summary` | string | No | Execution summary |
| `error` | string | No | Error message if failed |
| `retry-count` | number | No | Number of retry attempts |

### CompiledStep

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Step identifier (e.g., "step-0") |
| `prompt` | string | Yes | Original prompt from SPRINT.yaml |
| `status` | PhaseStatus | Yes | Step execution status |
| `phases` | CompiledPhase[] | Yes | Sub-phases from workflow |
| `model` | ClaudeModel | No | Step-level model override |
| `started-at` | ISO 8601 | No | When step started |
| `completed-at` | ISO 8601 | No | When step completed |
| `elapsed` | string | No | Human-readable duration |
| `error` | string | No | Error message if failed |
| `retry-count` | number | No | Number of retry attempts |

### CompiledPhase (Sub-Phase)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Phase identifier |
| `status` | PhaseStatus | Yes | Phase execution status |
| `prompt` | string | Yes | Interpolated execution prompt |
| `model` | ClaudeModel | No | Resolved model for execution |
| `injected` | boolean | No | True if phase was dynamically injected |
| `injected-at` | ISO 8601 | No | When phase was injected (if injected) |
| `started-at` | ISO 8601 | No | When phase started |
| `completed-at` | ISO 8601 | No | When phase completed |
| `elapsed` | string | No | Human-readable duration |
| `summary` | string | No | Execution summary |
| `error` | string | No | Error message if failed |
| `retry-count` | number | No | Number of retry attempts |
| `next-retry-at` | ISO 8601 | No | Scheduled retry time |

### SprintStats

| Field | Type | Description |
|-------|------|-------------|
| `started-at` | ISO 8601 \| null | Sprint start timestamp |
| `completed-at` | ISO 8601 \| null | Sprint completion timestamp |
| `total-phases` | number | Total top-level phase count |
| `completed-phases` | number | Completed top-level phases |
| `total-steps` | number | Total steps (for-each phases only) |
| `completed-steps` | number | Completed steps |
| `elapsed` | string | Total elapsed time |
| `current-iteration` | number | Current loop iteration (1-based) |
| `max-iterations` | number | Maximum iterations configured |

## Example PROGRESS.yaml

### Simple Sprint (No For-Each)

```yaml
sprint-id: quick-fix-2026-01
status: in-progress

phases:
  - id: analyze
    status: completed
    prompt: "Analyze the bug report and identify root cause"
    started-at: "2026-01-15T09:00:00Z"
    completed-at: "2026-01-15T09:05:00Z"
    elapsed: "00:05:00"

  - id: fix
    status: in-progress
    prompt: "Implement the fix with minimal changes"
    started-at: "2026-01-15T09:05:00Z"

  - id: verify
    status: pending
    prompt: "Verify fix and add regression test"

current:
  phase: 1
  step: null
  sub-phase: null

stats:
  started-at: "2026-01-15T09:00:00Z"
  completed-at: null
  total-phases: 3
  completed-phases: 1
  elapsed: "00:05:00"
```

### Complex Sprint (With For-Each)

```yaml
sprint-id: feature-auth-2026-01
status: in-progress

phases:
  # Simple phase - runs once
  - id: setup-branch
    status: completed
    prompt: "Create feature branch and set up project structure"
    started-at: "2026-01-15T09:00:00Z"
    completed-at: "2026-01-15T09:02:00Z"
    elapsed: "00:02:00"

  # For-each phase - expands over SPRINT.yaml steps
  - id: implement-endpoints
    status: in-progress
    steps:
      - id: step-0
        prompt: "Implement login endpoint with JWT"
        status: completed
        started-at: "2026-01-15T09:02:00Z"
        completed-at: "2026-01-15T09:15:00Z"
        elapsed: "00:13:00"
        phases:
          - id: implement
            status: completed
            prompt: "Implement login endpoint with JWT"
            started-at: "2026-01-15T09:02:00Z"
            completed-at: "2026-01-15T09:10:00Z"
          - id: qa
            status: completed
            prompt: "Verify implementation and run tests"
            started-at: "2026-01-15T09:10:00Z"
            completed-at: "2026-01-15T09:15:00Z"

      - id: step-1
        prompt: "Implement logout endpoint"
        status: in-progress
        started-at: "2026-01-15T09:15:00Z"
        phases:
          - id: implement
            status: in-progress
            prompt: "Implement logout endpoint"
            started-at: "2026-01-15T09:15:00Z"
          - id: qa
            status: pending
            prompt: "Verify implementation and run tests"

      - id: step-2
        prompt: "Implement token refresh endpoint"
        status: pending
        phases:
          - id: implement
            status: pending
            prompt: "Implement token refresh endpoint"
          - id: qa
            status: pending
            prompt: "Verify implementation and run tests"

  # Simple phase - runs once at end
  - id: final-review
    status: pending
    prompt: "Run full test suite and create PR"

current:
  phase: 1
  step: 1
  sub-phase: 0

stats:
  started-at: "2026-01-15T09:00:00Z"
  completed-at: null
  total-phases: 3
  completed-phases: 1
  total-steps: 3
  completed-steps: 1
  current-iteration: 5
  max-iterations: 30
```

## Operator Queue

The operator queue tracks discovered issues pending review.

### QueuedRequest Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique request identifier (nanoid) |
| `title` | string | Short description |
| `description` | string | Full description |
| `priority` | string | `'critical'` \| `'high'` \| `'medium'` \| `'low'` |
| `type` | string | `'bug'` \| `'improvement'` \| `'refactor'` \| `'test'` \| `'docs'` \| `'security'` |
| `status` | string | `'pending'` \| `'approved'` \| `'rejected'` \| `'deferred'` \| `'backlog'` |
| `created-at` | ISO 8601 | When request was created |
| `discovered-in` | string | Phase path where issue was found |
| `decided-at` | ISO 8601 | When decision was made (optional) |
| `decision` | object | Decision details (optional) |
| `rejection-reason` | string | Why rejected (if rejected) |
| `deferred-until` | string | When to revisit (if deferred) |

### Example Operator Queue

```yaml
operator-queue:
  - id: req-abc123
    title: "Fix null pointer in auth module"
    description: "The login function crashes when email is undefined"
    priority: high
    type: bug
    status: pending
    created-at: "2026-01-20T10:30:00Z"
    discovered-in: "development > step-2 > implement"
    context:
      relatedFiles:
        - src/auth/login.ts
      codeSnippet: "user.email.toLowerCase()"

  - id: req-xyz789
    title: "Add input validation"
    description: "..."
    priority: medium
    type: improvement
    status: approved
    created-at: "2026-01-20T10:25:00Z"
    discovered-in: "development > step-1 > implement"
    decided-at: "2026-01-20T10:26:00Z"
    decision:
      decision: approve
      reasoning: "Critical for security"
      injection:
        position:
          type: after-current
        prompt: "Add input validation..."
        idPrefix: "fix-req-xyz789"
```

## Injected Phases

Phases created via operator approval or dynamic step injection are marked with `injected: true`:

```yaml
phases:
  - id: fix-req-xyz789-0
    status: pending
    prompt: "Add input validation..."
    model: sonnet
    injected: true
    injected-at: "2026-01-20T10:26:00Z"
```

---

## Human Intervention

When a phase requires human intervention:

```yaml
status: needs-human

phases:
  - id: implement
    status: blocked
    error: "Build failed: missing dependency"
    human-needed:
      reason: "Cannot resolve dependency conflict"
      details: "Package foo@2.0 conflicts with bar@1.5"
```

The sprint loop pauses and waits for human resolution before continuing.

## TypeScript Interface

For developers building tools around PROGRESS.yaml:

```typescript
type SprintStatus = 'not-started' | 'in-progress' | 'completed'
                  | 'blocked' | 'paused' | 'needs-human' | 'interrupted';

type PhaseStatus = 'pending' | 'in-progress' | 'completed'
                 | 'blocked' | 'skipped' | 'failed';

type ClaudeModel = 'sonnet' | 'opus' | 'haiku';

interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  model?: ClaudeModel;
  injected?: boolean;
  'injected-at'?: string;
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
  error?: string;
  'retry-count'?: number;
  'next-retry-at'?: string;
}

interface CompiledStep {
  id: string;
  prompt: string;
  status: PhaseStatus;
  phases: CompiledPhase[];
  model?: ClaudeModel;
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  error?: string;
  'retry-count'?: number;
}

interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;           // Simple phases only
  steps?: CompiledStep[];    // For-each phases only
  model?: ClaudeModel;
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
  error?: string;
  'retry-count'?: number;
}

interface CurrentPointer {
  phase: number;
  step: number | null;
  'sub-phase': number | null;
}

interface SprintStats {
  'started-at': string | null;
  'completed-at'?: string | null;
  'total-phases': number;
  'completed-phases': number;
  'total-steps'?: number;
  'completed-steps'?: number;
  elapsed?: string;
  'current-iteration'?: number;
  'max-iterations'?: number;
}

interface QueuedRequest {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'bug' | 'improvement' | 'refactor' | 'test' | 'docs' | 'security';
  status: 'pending' | 'approved' | 'rejected' | 'deferred' | 'backlog';
  'created-at': string;
  'discovered-in': string;
  'decided-at'?: string;
  decision?: OperatorDecision;
  'rejection-reason'?: string;
  'deferred-until'?: 'end-of-phase' | 'end-of-sprint' | 'next-sprint';
}

interface OperatorDecision {
  decision: 'approve' | 'reject' | 'defer' | 'backlog';
  reasoning: string;
  injection?: InjectionConfig;
  deferredUntil?: string;
  rejectionReason?: string;
}

interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases?: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  'operator-queue'?: QueuedRequest[];
  'last-activity'?: string;
}
```

**Source of Truth:** `compiler/src/types.ts`

## See Also

- [SPRINT.yaml Schema](./sprint-yaml-schema.md) - Input sprint definition
- [Workflow YAML Schema](./workflow-yaml-schema.md) - Workflow definitions
- [Commands Reference](./commands.md) - Sprint management commands
- [Ralph Loop Concept](../concepts/ralph-loop.md) - How the sprint loop executes
