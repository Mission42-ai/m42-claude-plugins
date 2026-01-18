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

**Current State:** Documents standard phase-based PROGRESS.yaml schema

**Add Ralph Mode Fields:**

```yaml
# Ralph Mode specific fields (add new section after existing content)

## Ralph Mode Fields

When `mode: ralph` is set, additional fields are available:

### mode
| Field | Type | Description |
|-------|------|-------------|
| `mode` | `'standard' \| 'ralph'` | Workflow mode (default: standard) |
| `goal` | string | Goal for Ralph mode execution |

### ralph (Configuration)
| Field | Type | Description |
|-------|------|-------------|
| `idle-threshold` | number | Iterations without progress before reflection (default: 3) |

### dynamic-steps
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique step identifier |
| `prompt` | string | Step task description |
| `status` | PhaseStatus | Current execution status |
| `added-at` | ISO 8601 | When step was created |
| `added-in-iteration` | number | Which iteration created this step |

### hook-tasks
| Field | Type | Description |
|-------|------|-------------|
| `iteration` | number | Which iteration this task belongs to |
| `hook-id` | string | Reference to per-iteration hook |
| `status` | ParallelTaskStatus | spawned/running/completed/failed |
| `pid` | number | Process ID if running |
| `transcript` | string | Path to transcript file |

### ralph-exit
| Field | Type | Description |
|-------|------|-------------|
| `detected-at` | ISO 8601 | When RALPH_COMPLETE was detected |
| `iteration` | number | Which iteration completed |
| `final-summary` | string | Summary from Claude |
```

### 3. UPDATE: plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md

**Current State:** Documents standard workflow schema with phases, for-each, etc.

**Add Ralph Mode Fields (new section):**

```yaml
## Ralph Mode Workflow

When creating a Ralph mode workflow, use `mode: ralph` instead of `phases`.

### Ralph Mode Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | `'standard' \| 'ralph'` | No | Workflow mode (default: standard) |
| `goal-prompt` | string | Conditional | Prompt template for goal analysis (Ralph mode) |
| `reflection-prompt` | string | Conditional | Prompt template for reflection (Ralph mode) |
| `per-iteration-hooks` | list[PerIterationHook] | No | Hooks to run each iteration |

### Per-Iteration Hook Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique hook identifier |
| `workflow` | string | Conditional | Workflow reference (e.g., "m42-signs:learning-extraction") |
| `prompt` | string | Conditional | Inline prompt (alternative to workflow) |
| `parallel` | boolean | Yes | If true, runs non-blocking in background |
| `enabled` | boolean | Yes | Default enabled state |

### Ralph Mode Example

```yaml
name: Ralph Mode Workflow
description: Autonomous goal-driven execution
mode: ralph

goal-prompt: |
  Analyze the goal and create initial implementation steps.

reflection-prompt: |
  No pending steps remain. Evaluate if goal is achieved.

per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: false
```
```

### 4. UPDATE: plugins/m42-sprint/skills/orchestrating-sprints/SKILL.md

**Add mention of Ralph Mode:**

- In "Core Concepts" table, add row for Ralph Mode
- In "Commands" section, note that Ralph workflows auto-detect
- Add reference to `docs/concepts/ralph-mode.md`

### 5. UPDATE: plugins/m42-sprint/skills/creating-workflows/SKILL.md

**Add Ralph Mode section:**

- In "What is a Workflow?" table, add Ralph Mode row
- Add new section "Ralph Mode Workflows" with overview
- Update "Workflow Patterns" table to include Ralph Mode
- Add reference to schema documentation

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

From `compiler/src/types.ts`:

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

2. **Architecture diagram:** Copy directly from `context/implementation-plan.md`

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

# Scenario 7-8: Compiler build
cd plugins/m42-sprint/compiler && npm run build && npm run typecheck
```
