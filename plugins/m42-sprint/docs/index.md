# M42 Sprint Documentation

Find the right docs for where you are in your journey.

---

## New Here?

Start with these guides to get up and running quickly.

| Guide | Time | What You'll Learn |
|-------|------|-------------------|
| [Quick Start](getting-started/quick-start.md) | 5 min | Create and run your first sprint |
| [First Sprint Tutorial](getting-started/first-sprint.md) | 15 min | Complete walkthrough with explanations |
| [User Guide](USER-GUIDE.md) | 10 min | Complete guide with activity logging & best practices |

---

## Understanding the Architecture

Learn how M42 Sprint works under the hood.

| Concept | Description |
|---------|-------------|
| [Architecture Overview](concepts/overview.md) | Three-Tier Model, component map, why this design |
| [Patterns](concepts/patterns.md) | Consistent quality execution patterns |
| [Workflow Compilation](concepts/workflow-compilation.md) | How SPRINT.yaml becomes PROGRESS.yaml |

**The key insight:** Each phase runs with fresh Claude context. No slowdown. No context pollution.

---

## Building Sprints & Workflows

Hands-on guides for creating your own sprints and workflows.

| Guide | When to Use |
|-------|-------------|
| [Writing Sprints](guides/writing-sprints.md) | Creating effective SPRINT.yaml files |
| [Writing Workflows](guides/writing-workflows.md) | Building reusable workflow templates |
| [Worktree Sprints](guides/worktree-sprints.md) | Parallel development with git worktrees |

---

## Reference

Technical specifications and command documentation.

| Document | Contents |
|----------|----------|
| [Commands Reference](reference/commands.md) | All 10 commands with usage and examples |
| [API Reference](reference/api.md) | Status server REST API endpoints |
| [SPRINT.yaml Schema](reference/sprint-yaml-schema.md) | Sprint definition format |
| [PROGRESS.yaml Schema](reference/progress-yaml-schema.md) | Compiled execution plan format |
| [Workflow YAML Schema](reference/workflow-yaml-schema.md) | Workflow template format |

---

## Troubleshooting

When things don't work as expected.

| Resource | Covers |
|----------|--------|
| [Common Issues](troubleshooting/common-issues.md) | Compilation errors, stuck phases, permission prompts |

**Quick diagnostics:**
```bash
/sprint-status          # Check current state
cat PROGRESS.yaml       # Inspect execution plan
ls .claude/workflows/   # Verify workflow exists
```

---

## Learning Paths

### Path 1: Just Ship It (15 minutes)
1. [Quick Start](getting-started/quick-start.md) - Get running
2. [User Guide](USER-GUIDE.md) - Activity logging & best practices
3. [Commands Reference](reference/commands.md) - Know your tools

### Path 2: Understand the System (45 minutes)
1. [Quick Start](getting-started/quick-start.md) - Get running
2. [Architecture Overview](concepts/overview.md) - See the big picture
3. [First Sprint Tutorial](getting-started/first-sprint.md) - Apply knowledge

### Path 3: Master Workflows (1+ hours)
1. Complete Path 2
2. [Workflow Compilation](concepts/workflow-compilation.md) - Deep dive
3. [Writing Workflows](guides/writing-workflows.md) - Create your own
4. [Workflow YAML Schema](reference/workflow-yaml-schema.md) - Full specification

### Path 4: Parallel Development (30 minutes)
1. [Quick Start](getting-started/quick-start.md) - Get running
2. [Worktree Sprints](guides/worktree-sprints.md) - Parallel execution
3. [Commands Reference](reference/commands.md) - Know your tools

---

## Document Map

```
docs/
├── index.md                    ← You are here
├── USER-GUIDE.md               ← Complete user guide
│
├── getting-started/            ← Tutorials
│   ├── quick-start.md          (5 min)
│   └── first-sprint.md         (15 min)
│
├── concepts/                   ← Understanding
│   ├── overview.md             (Architecture)
│   ├── patterns.md             (Quality Execution)
│   └── workflow-compilation.md (Compilation)
│
├── reference/                  ← Specifications
│   ├── commands.md             (All commands)
│   ├── api.md                  (Status Server API)
│   ├── sprint-yaml-schema.md   (SPRINT.yaml)
│   ├── progress-yaml-schema.md (PROGRESS.yaml)
│   └── workflow-yaml-schema.md (Workflows)
│
├── guides/                     ← How-To
│   ├── writing-sprints.md      (Sprint creation)
│   ├── writing-workflows.md    (Workflow creation)
│   └── worktree-sprints.md     (Parallel development)
│
└── troubleshooting/
    └── common-issues.md        (Problem solving)
```

---

[← Back to README](../README.md)
