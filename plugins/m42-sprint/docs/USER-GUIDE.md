# M42 Sprint Plugin - User Guide

Complete guide to sprint orchestration for Claude Code.

---

## Overview

M42 Sprint enables autonomous sprint execution with fresh context per iteration. Define your goals or steps in SPRINT.yaml, and the system compiles and executes them through workflow phases.

For detailed architecture and concepts, see [Architecture Overview](concepts/overview.md).

---

## Getting Started

| Guide | What You'll Learn |
|-------|-------------------|
| [Quick Start](getting-started/quick-start.md) | Create and run your first sprint in 5 minutes |
| [First Sprint Tutorial](getting-started/first-sprint.md) | Complete walkthrough with explanations |
| [Workflow Compilation](concepts/workflow-compilation.md) | How SPRINT.yaml becomes PROGRESS.yaml |

---

## Commands & Reference

| Document | Contents |
|----------|----------|
| [Commands Reference](reference/commands.md) | All 10 commands with usage and examples |
| [API Reference](reference/api.md) | Status server REST API endpoints |
| [SPRINT.yaml Schema](reference/sprint-yaml-schema.md) | Sprint definition format |
| [PROGRESS.yaml Schema](reference/progress-yaml-schema.md) | Compiled execution plan format |
| [Workflow YAML Schema](reference/workflow-yaml-schema.md) | Workflow template format |

---

## Writing Sprints & Workflows

| Guide | When to Use |
|-------|-------------|
| [Writing Sprints](guides/writing-sprints.md) | Creating effective SPRINT.yaml files |
| [Writing Workflows](guides/writing-workflows.md) | Building reusable workflow templates |

---

## Parallel Development with Worktrees

Run multiple sprints simultaneously using git worktrees. Each sprint gets its own branch, working directory, and Claude session—completely isolated from your main work.

### Quick Start

```bash
# Start a sprint with dedicated worktree
/init-sprint feature-auth --worktree

# Navigate to worktree and run
cd ../2026-01-20_feature-auth-worktree
/run-sprint .claude/sprints/2026-01-20_feature-auth

# Monitor all parallel sprints
/sprint-status --all-worktrees

# Clean up after completion
/cleanup-sprint .claude/sprints/2026-01-20_feature-auth
```

### SPRINT.yaml Configuration

Enable worktree mode in your sprint definition:

```yaml
name: User Authentication
workflow: sprint-default

worktree:
  enabled: true
  branch: sprint/{sprint-id}        # Default branch pattern
  path: ../{sprint-id}-worktree     # Default worktree location
  cleanup: on-complete              # Auto-cleanup when done

goal: |
  Implement user authentication with JWT tokens.
```

### Key Commands

| Command | Description |
|---------|-------------|
| `/init-sprint <name> --worktree` | Create sprint with dedicated worktree |
| `/sprint-status --all-worktrees` | View all parallel sprints |
| `/cleanup-sprint <path>` | Remove worktree and optionally branch |

### Automatic Context Injection

When running in worktree mode, spawned agents automatically receive execution context including their working directory, branch name, and main repository path. This ensures agents understand their isolated environment and use appropriate relative paths without any additional configuration.

For complete configuration options, troubleshooting, and advanced workflows, see [Parallel Development with Git Worktrees](guides/worktree-sprints.md).

---

## Troubleshooting

See [Common Issues](troubleshooting/common-issues.md) for solutions to:
- Compilation failures
- Workflow not found errors
- Stuck phases
- Permission prompts

**Quick diagnostics:**
```bash
/sprint-status          # Check current state
cat PROGRESS.yaml       # Inspect execution plan
ls .claude/workflows/   # Verify workflow exists
```

---

## Live Activity Feed

The dashboard includes a real-time activity feed showing what Claude is doing during sprint execution.

### Chat-Like Display

The activity feed shows two types of content:

1. **Assistant Messages**: Claude's thinking and explanations displayed as chat bubbles
2. **Tool Calls**: Operations like Read, Edit, Bash displayed with relevant details

This provides visibility into Claude's reasoning process alongside the actual actions being taken.

### Activity Sources

Activity is captured directly from Claude's transcript files (`transcriptions/` directory), parsing:
- Tool invocations with names and parameters
- Text content from Claude's responses
- Timestamps for elapsed time calculation

### Dashboard Features

The status page (`http://localhost:3100`) displays:
- **Progress Bar**: Visual completion percentage with step count
- **Elapsed Time**: How long the current phase/step has been running
- **Stale Detection**: Warning if a sprint appears stuck (no activity for 5+ minutes)
- **Sprint Switcher**: Dropdown to quickly navigate between sprints
- **Live Activity Panel**: Auto-scrolling feed of Claude's activity

### Stale Sprint Recovery

If a sprint becomes stale (e.g., Claude process crashed), the dashboard shows:
- A warning indicator with time since last activity
- A "Resume" button to restart the sprint from where it left off

Use the resume endpoint to restart:
```bash
curl -X POST http://localhost:3100/api/sprint/<sprint-id>/resume
```

---

## Workflow Visualization

The dashboard includes an n8n-style workflow visualization that shows your sprint's execution as a connected node graph. Each step appears as a node, connected by arrows showing the execution flow.

### Accessing the Visualization

The workflow visualization is part of the live status dashboard:

```bash
# Start the status server
/sprint-watch

# Or it starts automatically with
/run-sprint .claude/sprints/your-sprint
```

Open `http://localhost:3100` in your browser to see the visualization.

### Understanding the Node Graph

Each workflow node represents a step or sub-phase in your sprint:

**Node Status Colors:**

| Visual | Status | Meaning |
|--------|--------|---------|
| Gray border | `pending` | Step not yet started |
| Green glow + pulse | `in-progress` | Step currently executing |
| Green border | `completed` | Step finished successfully |
| Red border | `failed` | Step encountered an error |
| Yellow border | `blocked` | Step waiting on dependencies |
| Gray (dimmed) | `skipped` | Step was skipped |

**Connection Arrows:**

- Gray arrows show the execution path between nodes
- Green arrows indicate flow from completed steps

### Agent Avatars

When a Claude agent is actively working on a step, its node displays an animated avatar instead of a status icon.

**Avatar Emotions:**

| Emoji | Emotion | When Displayed |
|-------|---------|----------------|
| `🤔` | thinking | Agent is reasoning or planning |
| `🧐` | reading | Agent is reading files (Read, Glob, Grep) |
| `😉` | working | Agent is editing or running commands |
| `😊` | success | Agent completed successfully |
| `😵` | failed | Agent encountered an error |

**Activity Display:**

Below the avatar, the node shows:
- **Agent name** (e.g., "Klaus", "Luna", "Max")
- **Current activity** (e.g., "Edit: auth.ts", "Bash: npm test")

### Agent Names

Each Claude session gets a deterministic, friendly name derived from its session ID. The same session always gets the same name for consistency.

**Available Names:**
Klaus, Luna, Max, Mia, Felix, Emma, Leo, Sophie, Finn, Lara

This makes it easy to track which agent is working on which step, especially during parallel execution.

### Subagent Indicators

When an agent spawns subagents (using the Task tool), a badge appears on the node showing the count:

```
+2  (indicates 2 active subagents)
```

This helps you understand the parallelism happening within a single step.

### Example: Parallel Sprint Execution

When running a sprint with parallel steps:

```yaml
collections:
  step:
    - prompt: Create user model
      id: user-model
    - prompt: Create order model
      id: order-model
    - prompt: Link models
      id: link-models
      depends-on: [user-model, order-model]
```

The visualization shows:

```
[user-model]  ──┐
   Luna 🧐     │──→  [link-models]
               │        pending
[order-model] ─┘
   Klaus 😉
```

You can see Luna reading files while Klaus is working, and the link-models step waiting for both to complete.

### How It Works

The visualization is powered by a hook system that captures agent events:

1. **Agent spawn**: When a Claude process starts for a step
2. **Tool activity**: When agents use tools (Read, Edit, Bash, etc.)
3. **Completion**: When agents finish (success or failure)
4. **Subagents**: When Task tool spawns child agents

Events are written to `.agent-events.jsonl` in the sprint directory and streamed to the dashboard via Server-Sent Events (SSE).

### Tips for Best Experience

1. **Use meaningful step IDs**: They appear as node labels
2. **Keep step prompts concise**: The first line becomes the tooltip
3. **Monitor parallel sprints**: The visualization shows all active agents
4. **Watch for stale agents**: Avatar disappears if agent stops responding

---

## Operator Queue

The operator system allows Claude to discover issues during execution and queue them for review. This enables dynamic work injection without derailing the current task.

### How It Works

1. **Discovery**: During phase execution, Claude may discover bugs, tech debt, or improvements
2. **Request**: Claude creates an operator request with priority, type, and context
3. **Queue**: Requests are added to the operator queue in PROGRESS.yaml
4. **Decision**: Requests are auto-triaged or manually reviewed
5. **Action**: Approved requests get injected as new steps; rejected/deferred/backlogged items are tracked

### Viewing the Queue

Access the operator queue view:
- **Web UI**: Navigate to `/sprint/<sprint-id>/operator`
- **API**: `GET /api/sprint/<sprint-id>/operator-queue`

The queue view shows:
- Pending requests awaiting decision
- Recent decisions (approved, rejected, deferred)
- Backlog items for human review

### Manual Decisions

Submit manual decisions via the dashboard or API:
```bash
curl -X POST http://localhost:3100/api/sprint/<sprint-id>/operator-queue/<request-id>/decide \
  -H "Content-Type: application/json" \
  -d '{"decision": "approve", "reasoning": "Critical bug fix needed"}'
```

Decision options:
- `approve`: Inject as new step(s) in the current sprint
- `reject`: Decline the request with reason
- `defer`: Delay until end-of-phase, end-of-sprint, or next-sprint
- `backlog`: Add to BACKLOG.yaml for human review

### BACKLOG.yaml

Items sent to backlog are stored in `BACKLOG.yaml` for later review:
```yaml
items:
  - id: req-abc123
    title: "Refactor authentication module"
    description: "..."
    category: tech-debt
    suggested-priority: medium
    operator-notes: "Valid improvement but out of scope"
    source:
      request-id: req-abc123
      discovered-in: "development > step-2 > implement"
      discovered-at: "2026-01-20T10:30:00Z"
    status: pending-review
```

---

## Model Selection

Control which Claude model executes each phase with the `model` field.

### Available Models

| Model | Use Case |
|-------|----------|
| `sonnet` | Default - balanced speed and capability |
| `opus` | Complex reasoning, architecture decisions |
| `haiku` | Fast, simple tasks, validation |

### Resolution Order

Model selection follows a precedence hierarchy (highest to lowest priority):

1. **Step-level**: `model` field in SPRINT.yaml step
2. **Workflow phase-level**: `model` field in workflow phase
3. **Sprint-level**: Top-level `model` in SPRINT.yaml
4. **Workflow-level**: Top-level `model` in workflow definition
5. **Default**: No override (uses CLI default, typically sonnet)

### Examples

**Sprint-level default:**
```yaml
workflow: sprint-default
model: opus  # All phases use opus unless overridden

collections:
  step:
    - prompt: Design the architecture
    - prompt: Implement the solution
```

**Item-level override:**
```yaml
workflow: sprint-default
model: sonnet

collections:
  step:
    - prompt: Design the architecture
      model: opus  # This item uses opus
    - prompt: Implement the solution  # Uses sonnet (sprint default)
```

---

## Step Dependencies and Parallel Execution

Control step execution order with dependencies and enable concurrent execution of independent steps.

### Declaring Dependencies

Use `depends-on` to specify that a step must wait for other steps to complete:

```yaml
workflow: sprint-default

collections:
  step:
    - prompt: Set up database schema
      id: db-schema

    - prompt: Create user model
      id: user-model
      depends-on: [db-schema]

    - prompt: Create order model
      id: order-model
      depends-on: [db-schema]

    - prompt: Implement user-order relationship
      id: user-order-relation
      depends-on: [user-model, order-model]
```

**Key points:**

- `depends-on` takes an array of step IDs
- Steps without dependencies start immediately
- A step starts only after all its dependencies complete
- Use explicit `id` fields for steps that will be referenced

### How Parallel Execution Works

When a for-each phase runs, the scheduler:

1. Builds a dependency graph from all steps
2. Identifies "ready" steps (no pending dependencies)
3. Executes ready steps concurrently
4. As steps complete, unblocks their dependents
5. Repeats until all steps finish

**Example execution timeline:**

```
Step: db-schema       ████████
Step: user-model              ████████
Step: order-model             ████████
Step: user-order-relation             ████████

Time →
```

In this example, `user-model` and `order-model` run in parallel once `db-schema` completes.

### Failure Handling Modes

Configure how the system handles failed dependencies with `onDependencyFailure`:

| Mode | Behavior |
|------|----------|
| `skip-dependents` (default) | Skip steps that depend on failed steps |
| `fail-phase` | Fail the entire phase immediately |
| `continue` | Continue executing independent steps |

**Example with failure handling:**

```yaml
workflow: sprint-default

parallel-execution:
  enabled: true
  onDependencyFailure: skip-dependents

collections:
  step:
    - prompt: Create auth module
      id: auth

    - prompt: Create user endpoints
      id: user-endpoints
      depends-on: [auth]  # Skipped if auth fails

    - prompt: Create docs
      id: docs            # Runs regardless of auth status
```

### Example: API Development with Dependencies

A complete example showing practical dependency usage:

```yaml
name: API Feature Development
workflow: sprint-default

parallel-execution:
  enabled: true
  maxConcurrency: 3
  onDependencyFailure: skip-dependents

collections:
  step:
    # Foundation - runs first
    - prompt: Design API schema and types
      id: api-schema

    # Data layer - can run in parallel after schema
    - prompt: Create database migrations
      id: migrations
      depends-on: [api-schema]

    - prompt: Implement data models
      id: models
      depends-on: [api-schema]

    # API layer - depends on data layer
    - prompt: Implement REST endpoints
      id: endpoints
      depends-on: [models, migrations]

    - prompt: Add input validation
      id: validation
      depends-on: [models]

    # Testing - depends on implementation
    - prompt: Write integration tests
      id: tests
      depends-on: [endpoints, validation]

    # Documentation - can run after schema
    - prompt: Generate API documentation
      id: docs
      depends-on: [api-schema]
```

**Execution order:**
1. `api-schema` runs first
2. `migrations`, `models`, and `docs` run in parallel
3. `endpoints` and `validation` run after their dependencies
4. `tests` runs last

### Configuration Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `parallel-execution.enabled` | boolean | `true` | Enable parallel step execution |
| `parallel-execution.maxConcurrency` | number | unlimited | Maximum concurrent steps |
| `parallel-execution.onDependencyFailure` | string | `skip-dependents` | Failure handling strategy |

### Best Practices

1. **Use meaningful IDs**: Choose descriptive IDs that reflect what the step does
2. **Minimize dependency chains**: Long chains reduce parallelism benefits
3. **Group related work**: Steps that share dependencies often belong together
4. **Consider failure impact**: Use `fail-phase` for critical dependencies
5. **Test dependency graphs**: Use `--dry-run` to verify the compiled execution plan

### Viewing the Dependency Graph

The compiled PROGRESS.yaml includes a `dependency-graph` section showing the resolved dependencies:

```yaml
dependency-graph:
  - phase-id: development
    nodes:
      - id: step-0
        depends-on: []
        blocked-by: []
      - id: step-1
        depends-on: [step-0]
        blocked-by: [step-0]
```

Use `/sprint-status` to see which steps are ready, running, or blocked.

---

## Best Practices

1. **Keep sprints focused**: 3-7 steps per sprint
2. **Write clear step prompts**: Include requirements and acceptance criteria
3. **Use appropriate workflows**: Match workflow to work type
4. **Preview before running**: Use `--dry-run` to verify compilation
5. **Recompile after changes**: Use `--recompile` after adding steps
6. **Use workflow overrides**: Mix workflows within a sprint when needed
7. **Monitor with `/sprint-watch`**: Real-time dashboard is better than polling
8. **Trust the loop**: Default unlimited iterations - loop exits on completion or error status
9. **Use worktrees for parallel work**: Run multiple sprints simultaneously with `--worktree` flag
10. **Use model selection wisely**: Use opus for architecture/design, sonnet for implementation, haiku for validation
11. **Review operator queue**: Check `/sprint/<id>/operator` for discovered issues during execution
12. **Handle stale sprints**: If dashboard shows stale warning, use the Resume button to restart

---

## Getting Help

- `/help` - Show plugin commands and usage
- [Documentation Index](index.md) - Full documentation map
- GitHub Issues: Report bugs and request features
