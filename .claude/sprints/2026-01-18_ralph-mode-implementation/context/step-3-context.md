# Step Context: step-3

## Task
Integriere Ralph Mode und erstelle Dokumentation.

## Files to Create/Update

### 1. NEW: plugins/m42-sprint/docs/concepts/ralph-mode.md

**Purpose:** Comprehensive Ralph Mode documentation for end users

**Content Requirements:**
- Overview: What is Ralph Mode (hybrid autonomous workflow)
- Architecture diagram (from implementation-plan.md)
- Hybrid concept explanation (Free Loop + Deterministic Hooks)
- SPRINT.yaml example for Ralph Mode
- Per-iteration hooks explanation
- Exit mechanism (RALPH_COMPLETE)
- Examples and use cases

**Pattern to Follow:** `plugins/m42-sprint/docs/concepts/ralph-loop.md`
- Same markdown structure with ASCII diagrams
- Table-based explanations
- Code examples in fenced blocks
- Links to related documentation

### 2. UPDATE: plugins/m42-sprint/skills/orchestrating-sprints/references/progress-schema.md

**Current State:** Documents standard phase-based PROGRESS.yaml schema (168 lines)

**Add Ralph Mode Fields (after line 167 "```"):**

```markdown
## Ralph Mode Fields

When `mode: ralph` is set in PROGRESS.yaml, these additional fields track autonomous execution state.

### mode

| Value | Description |
|-------|-------------|
| `standard` | Phase-based execution (default) |
| `ralph` | Goal-driven autonomous execution |

### goal

| Field | Type | Description |
|-------|------|-------------|
| `goal` | string | The high-level goal for Ralph mode execution |

### ralph (Configuration)

| Field | Type | Description |
|-------|------|-------------|
| `idle-threshold` | number | Iterations without progress before reflection (default: 3) |

### dynamic-steps

Steps dynamically created by Claude during execution.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique step identifier (e.g., "step-0") |
| `prompt` | string | Step task description |
| `status` | PhaseStatus | pending, in-progress, completed, etc. |
| `added-at` | ISO 8601 | Timestamp when step was created |
| `added-in-iteration` | number | Which iteration created this step |

### hook-tasks

Tracking entries for per-iteration hook execution.

| Field | Type | Description |
|-------|------|-------------|
| `iteration` | number | Which iteration this task belongs to |
| `hook-id` | string | Reference to per-iteration hook |
| `status` | ParallelTaskStatus | spawned, running, completed, failed |
| `pid` | number | Process ID if running |
| `transcript` | string | Path to transcript file |

### per-iteration-hooks

Merged hook definitions from workflow and SPRINT.yaml.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique hook identifier |
| `workflow` | string | Workflow reference (e.g., "m42-signs:learning-extraction") |
| `prompt` | string | Inline prompt (alternative to workflow) |
| `parallel` | boolean | If true, runs non-blocking in background |
| `enabled` | boolean | Whether this hook is active |

### ralph-exit

Exit tracking when RALPH_COMPLETE is detected.

| Field | Type | Description |
|-------|------|-------------|
| `detected-at` | ISO 8601 | When RALPH_COMPLETE was detected |
| `iteration` | number | Which iteration completed the goal |
| `final-summary` | string | Summary provided by Claude |

## Ralph Mode PROGRESS.yaml Example

```yaml
sprint-id: auth-system-2026-01
status: in-progress
mode: ralph
goal: |
  Build authentication system with JWT tokens.

ralph:
  idle-threshold: 3

per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: true

dynamic-steps:
  - id: step-0
    prompt: "Initialize auth module structure"
    status: completed
    added-at: "2026-01-18T10:00:00Z"
    added-in-iteration: 1
  - id: step-1
    prompt: "Implement JWT token generation"
    status: in-progress
    added-at: "2026-01-18T10:05:00Z"
    added-in-iteration: 1

hook-tasks:
  - iteration: 1
    hook-id: learning
    status: completed
    pid: null
    transcript: transcripts/iter-1-learning.jsonl

ralph-exit:
  detected-at: null
  iteration: null
  final-summary: null

current:
  phase: 0
  step: null
  sub-phase: null

stats:
  started-at: "2026-01-18T10:00:00Z"
  current-iteration: 2
```
```

### 3. UPDATE: plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md

**Current State:** Documents standard workflow schema (257 lines)

**Add Ralph Mode Section (before "## Valid Examples" at line 111):**

```markdown
## Ralph Mode Workflow

When `mode: ralph` is set, the workflow operates in goal-driven mode instead of phase-based execution.

### Ralph Mode Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | `'standard' \| 'ralph'` | No | Workflow execution mode (default: standard) |
| `goal-prompt` | string | Ralph mode | Template for initial goal analysis |
| `reflection-prompt` | string | Ralph mode | Template for reflection when no pending steps |
| `per-iteration-hooks` | list[PerIterationHook] | No | Hooks to run each iteration |

### Per-Iteration Hook Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique hook identifier |
| `workflow` | string | Conditional | Workflow reference (e.g., "m42-signs:learning-extraction") |
| `prompt` | string | Conditional | Inline prompt (alternative to workflow) |
| `parallel` | boolean | Yes | If true, runs non-blocking in background |
| `enabled` | boolean | Yes | Default enabled state (can be overridden in SPRINT.yaml) |

Note: Either `workflow` or `prompt` must be provided, not both.

### Ralph Mode TypeScript Interface

```typescript
interface WorkflowDefinition {
  name: string;
  description?: string;
  phases?: WorkflowPhase[];       // Optional for Ralph mode
  mode?: 'standard' | 'ralph';
  'goal-prompt'?: string;
  'reflection-prompt'?: string;
  'per-iteration-hooks'?: PerIterationHook[];
}

interface PerIterationHook {
  id: string;
  workflow?: string;
  prompt?: string;
  parallel: boolean;
  enabled: boolean;
}
```

### Ralph Mode Workflow Example

```yaml
# .claude/workflows/ralph.yaml
name: Ralph Mode Workflow
description: Autonomous goal-driven execution with per-iteration hooks
mode: ralph

goal-prompt: |
  Analyze the goal and create initial implementation steps.
  Break down complex goals into concrete, actionable tasks.

reflection-prompt: |
  No pending steps remain. Evaluate:
  1. Is the goal fully achieved?
  2. Are there edge cases or tests missing?
  3. Is documentation complete?

  If complete: RALPH_COMPLETE: [summary]
  If not: add more steps

per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: false

  - id: documentation
    prompt: |
      Review changes from this iteration and update relevant documentation.
    parallel: true
    enabled: false
```
```

### 4. UPDATE: plugins/m42-sprint/skills/orchestrating-sprints/SKILL.md

**Current State:** Core Concepts table at line 13-18

**Add to Core Concepts table (after "Ralph Loop" row):**
```markdown
| Ralph Mode | Autonomous goal-driven workflow with per-iteration hooks |
```

**Add reference after line 98:**
```markdown
- `docs/concepts/ralph-mode.md` - Ralph Mode autonomous workflow documentation
```

### 5. UPDATE: plugins/m42-sprint/skills/creating-workflows/SKILL.md

**Current State:** "What is a Workflow?" table at line 10-15

**Add to table:**
```markdown
| Ralph Mode | Autonomous workflow with goal-prompt and per-iteration hooks |
```

**Add new section after "Workflow Patterns" (line 77):**
```markdown
### Ralph Mode Workflows

For autonomous, goal-driven execution instead of fixed phases:

```yaml
# .claude/workflows/ralph.yaml
name: Ralph Mode
mode: ralph
goal-prompt: "Analyze the goal..."
reflection-prompt: "Evaluate completion..."
per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: false
```

See `references/workflow-schema.md` for complete Ralph mode configuration.
```

## Related Code Patterns

### Documentation Style: plugins/m42-sprint/docs/concepts/ralph-loop.md

```markdown
# Title with Clear Purpose

Intro paragraph explaining the concept.

---

## Section with ASCII Diagram

```text
┌─────────────────┐
│  ASCII Diagram  │
└─────────────────┘
```

### Subsection with Table

| Column 1 | Column 2 |
|----------|----------|
| Data     | Data     |
```

### Schema Documentation Style: progress-schema.md

```markdown
## Field Name

| Field | Type | Description |
|-------|------|-------------|
| `field-name` | type | What it does |

### Example

```yaml
field-name: value
```
```

## Required Imports

### Internal
- No TypeScript imports needed (documentation only)

### External
- No external packages needed

## Types/Interfaces to Document

From `compiler/src/types.ts` (already implemented):

```typescript
// Ralph Mode Types
interface PerIterationHook {
  id: string;
  workflow?: string;
  prompt?: string;
  parallel: boolean;
  enabled: boolean;
}

interface DynamicStep {
  id: string;
  prompt: string;
  status: PhaseStatus;
  'added-at': string;
  'added-in-iteration': number;
}

interface HookTask {
  iteration: number;
  'hook-id': string;
  status: ParallelTaskStatus;
  pid?: number;
  transcript?: string;
}

interface RalphConfig {
  'idle-threshold'?: number;
}

interface RalphExitInfo {
  'detected-at'?: string;
  iteration?: number;
  'final-summary'?: string;
}

// Extended WorkflowDefinition
interface WorkflowDefinition {
  name: string;
  description?: string;
  phases?: WorkflowPhase[];  // Optional for Ralph mode
  mode?: 'standard' | 'ralph';
  'goal-prompt'?: string;
  'reflection-prompt'?: string;
  'per-iteration-hooks'?: PerIterationHook[];
}
```

## Integration Points

- **Called by:** End users reading documentation
- **Calls:** No code execution
- **Tests:** Gherkin scenarios test file existence and content patterns

## Existing Documentation Structure

```
plugins/m42-sprint/docs/
├── index.md                    # Navigation hub
├── USER-GUIDE.md               # End-user guide
├── concepts/
│   ├── overview.md             # Architecture overview
│   ├── ralph-loop.md           # Execution pattern (existing)
│   ├── workflow-compilation.md # Compilation process
│   └── ralph-mode.md           # NEW: Ralph Mode documentation
├── getting-started/
├── guides/
├── reference/
└── troubleshooting/
```

## Implementation Notes

1. **ralph-mode.md vs ralph-loop.md distinction:**
   - `ralph-loop.md` explains the **execution pattern** (fresh context per iteration)
   - `ralph-mode.md` explains the **workflow mode** (autonomous goal-driven execution with hooks)

2. **Architecture diagram:** Copy directly from `context/implementation-plan.md`:
```
┌──────────────────────────────────────────────────────────────┐
│                      RALPH LOOP                               │
│                    (Endlosschleife)                           │
└──────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  FREI (Claude)  │ │ DETERMINISTISCH │ │ DETERMINISTISCH │
│                 │ │   (Hook 1)      │ │   (Hook 2)      │
│ - Analysiert    │ │                 │ │                 │
│ - Plant Steps   │ │ - Learning      │ │ - Documentation │
│ - Führt aus     │ │ - parallel: ✓   │ │ - parallel: ✓   │
│ - Reflektiert   │ │                 │ │                 │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         │              (non-blocking)      (non-blocking)
         │                   │                   │
         ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    PROGRESS.yaml                              │
│  - dynamic-steps[] (von Claude)                               │
│  - hook-tasks[] (deterministisch)                             │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    RALPH_COMPLETE?     │
              │                        │
              │  Ja → Exit             │
              │  Nein → Nächste Iter.  │
              └────────────────────────┘
```

3. **Example SPRINT.yaml:** Include minimal and full examples

4. **Gherkin verification patterns:**
   - `grep -qi 'overview\|what is ralph mode'` for overview section
   - `grep -qE '┌|├|─|▼|RALPH.*LOOP'` for architecture diagram
   - `grep -qE 'workflow:\s*ralph'` for SPRINT.yaml example

5. **Compiler rebuild:** Step requires `npm run build` and `npm run typecheck` in compiler directory to verify no regressions

## Verification Commands

```bash
# Scenario 1: File exists
test -f plugins/m42-sprint/docs/concepts/ralph-mode.md

# Scenario 2: Overview content
grep -qi 'overview\|what is ralph mode\|was ist ralph mode' plugins/m42-sprint/docs/concepts/ralph-mode.md

# Scenario 3: Architecture diagram
grep -qE '┌|├|─|▼|RALPH.*LOOP' plugins/m42-sprint/docs/concepts/ralph-mode.md

# Scenario 4: SPRINT.yaml example
grep -qE 'workflow:\s*ralph' plugins/m42-sprint/docs/concepts/ralph-mode.md

# Scenario 5: Progress schema Ralph fields
grep -q 'dynamic-steps' plugins/m42-sprint/skills/orchestrating-sprints/references/progress-schema.md && \
grep -q 'hook-tasks' plugins/m42-sprint/skills/orchestrating-sprints/references/progress-schema.md && \
grep -q 'ralph-exit\|ralph exit' plugins/m42-sprint/skills/orchestrating-sprints/references/progress-schema.md

# Scenario 6: Workflow schema Ralph fields
grep -qE 'mode.*ralph|mode:\s*ralph' plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md && \
grep -q 'goal-prompt' plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md && \
grep -q 'per-iteration-hooks' plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md

# Scenario 7: SKILL.md references
grep -qi 'ralph mode\|ralph-mode' plugins/m42-sprint/skills/orchestrating-sprints/SKILL.md
grep -qi 'ralph mode\|ralph-mode' plugins/m42-sprint/skills/creating-workflows/SKILL.md

# Scenario 8-9: Compiler build and typecheck
cd plugins/m42-sprint/compiler && npm run build && npm run typecheck
```
