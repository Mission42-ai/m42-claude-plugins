# Writing Custom Workflows

This guide covers creating, testing, and deploying custom workflow definitions for the m42-sprint plugin.

## What is a Workflow?

A workflow defines **how** sprint steps are executed. It specifies the sequence of phases that each step (or the entire sprint) goes through.

```
┌─────────────────────────────────────────────────────────────┐
│                       SPRINT.yaml                           │
│  workflow: my-custom-workflow   ← References your workflow  │
│  steps:                                                     │
│    - "Implement feature X"                                  │
│    - "Add tests for X"                                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              my-custom-workflow.yaml                         │
│  Defines: plan → execute → verify phases                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      PROGRESS.yaml                           │
│  Generated: Expanded phases for each step                   │
└─────────────────────────────────────────────────────────────┘
```

## Workflow Basics

### File Location

Workflows live in `.claude/workflows/`:

```
.claude/workflows/
├── execute-step.yaml       # Minimal: execute only
├── bugfix-workflow.yaml    # 3-phase: diagnose → fix → verify
├── flat-foreach-qa.yaml    # With preparation phase
└── my-custom-workflow.yaml # Your custom workflow
```

### Minimal Workflow Structure

```yaml
# .claude/workflows/my-workflow.yaml
name: My Workflow
description: Optional description of purpose
phases:
  - id: execute
    prompt: |
      Execute the task:
      {{step.prompt}}
```

**Required fields:**
- `name` - Human-readable workflow name
- `phases` - List of phase definitions (at least one)

**Optional fields:**
- `description` - Explains when to use this workflow

## Phase Types

Workflows support two phase types: **simple phases** and **for-each phases**.

### Simple Phases

Execute a prompt directly:

```yaml
phases:
  - id: execute
    prompt: |
      Complete this task: {{step.prompt}}

      Requirements:
      - Follow existing code conventions
      - Make atomic commits
```

**Fields:**
- `id` - Unique identifier (kebab-case)
- `prompt` - Instructions for the AI agent

### For-Each Phases

Iterate over sprint steps, running another workflow for each:

```yaml
phases:
  - id: development
    for-each: step
    workflow: feature-standard
```

**Fields:**
- `id` - Unique identifier
- `for-each` - Currently only `step` is supported
- `workflow` - Name of workflow to run (without `.yaml` extension)

### Phase Type Rules

| Phase Type | Required Fields | Cannot Include |
|------------|-----------------|----------------|
| Simple | `id`, `prompt` | `for-each`, `workflow` |
| For-Each | `id`, `for-each`, `workflow` | `prompt` |

## Template Variables

Variables are placeholders that get replaced at compile time.

### Syntax

```yaml
prompt: |
  Task: {{step.prompt}}
  Phase: {{phase.id}}
  Sprint: {{sprint.id}}
```

### Available Variables

#### Step Variables (only in for-each contexts)

| Variable | Description | Example |
|----------|-------------|---------|
| `{{step.prompt}}` | Step description from SPRINT.yaml | "Implement auth" |
| `{{step.id}}` | Step identifier | "step-0" |
| `{{step.index}}` | 0-based index | 0, 1, 2... |

#### Phase Variables (all phases)

| Variable | Description | Example |
|----------|-------------|---------|
| `{{phase.id}}` | Current phase identifier | "execute" |
| `{{phase.index}}` | 0-based phase index | 0, 1, 2... |

#### Sprint Variables (all phases)

| Variable | Description | Example |
|----------|-------------|---------|
| `{{sprint.id}}` | Sprint identifier | "2024-01-15_auth" |
| `{{sprint.name}}` | Sprint name (if provided) | "Authentication" |

### Variable Availability Matrix

| Variable | Simple Phase | For-Each Phase | Nested Workflow |
|----------|--------------|----------------|-----------------|
| `{{step.*}}` | No | Yes | Yes |
| `{{phase.*}}` | Yes | Yes | Yes |
| `{{sprint.*}}` | Yes | Yes | Yes |

### Common Variable Patterns

**File naming with step ID:**
```yaml
prompt: |
  Write analysis to: context/{{step.id}}-analysis.md
  Write tests to: tests/{{step.id}}.test.ts
```

**Git operations:**
```yaml
prompt: |
  Create branch: git checkout -b sprint/{{sprint.id}}
  Commit message: "{{phase.id}}: {{step.prompt}}"
```

**Progress tracking:**
```yaml
prompt: |
  Processing step {{step.index}}: {{step.id}}
  Task: {{step.prompt}}
```

## Workflow Patterns

### Pattern 1: Minimal Execute

Single-phase workflow for straightforward tasks.

```yaml
name: Minimal Execute
phases:
  - id: execute
    prompt: |
      Execute the following task:
      {{step.prompt}}
```

**Use when:**
- Tasks are self-contained
- No planning or verification needed
- Quick one-off operations

### Pattern 2: Plan-Execute

Two-phase workflow with deliberate planning.

```yaml
name: Plan Execute
phases:
  - id: plan
    prompt: |
      Analyze and plan:
      {{step.prompt}}

      Create implementation plan in context/{{step.id}}-plan.md

  - id: execute
    prompt: |
      Execute based on plan:
      1. Read context/{{step.id}}-plan.md
      2. Implement the solution
      3. Commit changes
```

**Use when:**
- Tasks benefit from upfront analysis
- Implementation spans multiple files
- Decisions need documentation

### Pattern 3: Plan-Execute-Verify

Three-phase workflow with verification.

```yaml
name: Plan Execute Verify
phases:
  - id: plan
    prompt: |
      Plan implementation for:
      {{step.prompt}}
      Output: context/{{step.id}}-plan.md

  - id: execute
    prompt: |
      Implement following context/{{step.id}}-plan.md
      Commit logical units separately.

  - id: verify
    prompt: |
      Verify implementation:
      1. Run related tests
      2. Check for regressions
      3. Validate against requirements
```

**Use when:**
- Quality assurance is important
- Changes may affect existing functionality
- Automated tests exist

### Pattern 4: Full Feature Lifecycle

Four-phase workflow for complete feature implementation.

```yaml
name: Full Feature
phases:
  - id: plan
    prompt: |
      ## Task
      {{step.prompt}}

      ## Instructions
      1. Analyze requirements
      2. Identify affected files
      3. Document approach
      Output: context/{{step.id}}-plan.md

  - id: implement
    prompt: |
      Implement based on context/{{step.id}}-plan.md
      - Follow code conventions
      - Make atomic commits
      - Handle edge cases

  - id: test
    prompt: |
      Write and run tests:
      1. Unit tests for new functions
      2. Integration tests if needed
      3. Run existing test suite

  - id: document
    prompt: |
      Update documentation:
      1. API docs if interfaces changed
      2. README if user-facing
      3. Code comments for complex logic
```

**Use when:**
- Implementing substantial features
- Documentation is expected
- Full test coverage required

### Pattern 5: Sprint with For-Each

Top-level sprint workflow with step iteration.

```yaml
name: Full Sprint
phases:
  - id: prepare
    prompt: |
      Initialize sprint:
      1. Create branch: sprint/{{sprint.id}}
      2. Gather initial context
      3. Document setup in context/_shared.md

  - id: development
    for-each: step
    workflow: feature-standard

  - id: qa
    prompt: |
      Sprint quality assurance:
      1. Run full test suite
      2. Execute linter and type checks
      3. Review all changes

  - id: deploy
    prompt: |
      Finalize sprint:
      1. Push all changes
      2. Create PR: gh pr create
      3. Add reviewers and labels
```

**Use when:**
- Running full development sprints
- Multiple steps need processing
- Standard CI/CD pipeline

### Pattern 6: Bug Fix Workflow

Focused workflow for diagnosing and fixing bugs.

```yaml
name: Bug Fix
phases:
  - id: diagnose
    prompt: |
      ## Bug
      {{step.prompt}}

      ## Instructions
      1. Reproduce the bug
      2. Analyze logs and errors
      3. Identify root cause
      Output: context/{{step.id}}-diagnosis.md

  - id: fix
    prompt: |
      Fix based on context/{{step.id}}-diagnosis.md
      - Minimal change required
      - No scope creep
      - Atomic commit

  - id: verify
    prompt: |
      Verify fix:
      1. Confirm bug is resolved
      2. Run regression tests
      3. Add test case if appropriate
```

**Use when:**
- Fixing reported bugs
- Minimal change needed
- Root cause analysis required

### Pattern 7: Flat For-Each

Minimal workflow for step iteration without nesting.

```yaml
name: Flat For-Each
phases:
  - id: execute-all
    for-each: step
    workflow: execute-step
```

With the referenced step workflow:

```yaml
# execute-step.yaml
name: Execute Step
phases:
  - id: execute
    prompt: |
      Execute: {{step.prompt}}
```

**Use when:**
- Steps are independent
- No shared setup/teardown
- Simple sequential execution

### Pattern Selection Guide

```
How complex is the task?
│
├─ Very simple (single action)
│  └─ Pattern 1: Minimal Execute
│
├─ Needs planning
│  │
│  ├─ No verification needed
│  │  └─ Pattern 2: Plan-Execute
│  │
│  └─ Needs verification
│     │
│     ├─ No documentation needed
│     │  └─ Pattern 3: Plan-Execute-Verify
│     │
│     └─ Documentation needed
│        └─ Pattern 4: Full Feature
│
├─ Multiple steps (sprint)
│  └─ Pattern 5: Full Sprint
│
├─ Bug fix
│  └─ Pattern 6: Bug Fix
│
└─ Simple iteration
   └─ Pattern 7: Flat For-Each
```

## Nested Workflows

For-each phases reference other workflows, creating nesting:

```yaml
# sprint-workflow.yaml (top-level)
name: Sprint with QA
phases:
  - id: prepare
    prompt: "Initialize sprint environment"

  - id: develop
    for-each: step          # Iterate over each sprint step
    workflow: step-with-qa  # Run this workflow for each step

# step-with-qa.yaml (nested, runs for each step)
name: Step with QA
phases:
  - id: implement
    prompt: "Implement: {{step.prompt}}"
  - id: qa
    prompt: "Verify implementation"
```

**Compilation result:**

```
Sprint Phases:
├── prepare (simple)
├── develop (for-each)
│   ├── step-0
│   │   ├── implement
│   │   └── qa
│   ├── step-1
│   │   ├── implement
│   │   └── qa
│   └── step-2
│       ├── implement
│       └── qa
```

### Nesting Depth

Workflows can nest multiple levels:

```yaml
# Level 1: Sprint workflow
phases:
  - id: dev
    for-each: step
    workflow: feature-workflow  # Level 2

# Level 2: Feature workflow
phases:
  - id: plan
    prompt: "..."
  - id: impl
    for-each: step
    workflow: task-workflow  # Level 3

# Level 3: Task workflow
phases:
  - id: execute
    prompt: "..."
```

**Recommendation:** Keep nesting to 2-3 levels for maintainability.

## Testing Workflows

### Validate YAML Syntax

```bash
# Quick syntax check
yq . .claude/workflows/my-workflow.yaml > /dev/null && echo "Valid YAML"

# Pretty-print to inspect
yq -C . .claude/workflows/my-workflow.yaml
```

### Test Compilation

Create a test sprint and compile:

```bash
# Create minimal test sprint
mkdir -p .claude/sprints/test-workflow
cat > .claude/sprints/test-workflow/SPRINT.yaml << 'EOF'
workflow: my-custom-workflow
steps:
  - "Test step one"
  - "Test step two"
EOF

# Compile (from project root)
npm run compile -- .claude/sprints/test-workflow
# or
npx tsx plugins/m42-sprint/compiler/src/cli.ts .claude/sprints/test-workflow

# Inspect result
yq -C . .claude/sprints/test-workflow/PROGRESS.yaml
```

### Verify Phase Structure

Check that phases expanded correctly:

```bash
# List all phase IDs
yq '.phases[].id' .claude/sprints/test-workflow/PROGRESS.yaml

# Count phases per step
yq '.phases[] | select(.steps) | .steps | length' .claude/sprints/test-workflow/PROGRESS.yaml
```

### Dry Run

Test without actually executing:

```bash
# Use sprint-next to see what would run
/sprint-next .claude/sprints/test-workflow

# Or manually inspect current pointer
yq '.current' .claude/sprints/test-workflow/PROGRESS.yaml
```

## Validation Rules

The compiler validates workflows against these rules:

### Workflow Level

| Rule | Description |
|------|-------------|
| Name required | `name` field must be present and non-empty |
| Phases required | `phases` array must have at least one element |
| Valid YAML | File must parse as valid YAML |

### Phase Level

| Rule | Description |
|------|-------------|
| Unique IDs | Each phase must have a unique `id` |
| ID format | IDs should be kebab-case (lowercase, hyphens) |
| Type consistency | Simple phases need `prompt`, for-each needs `workflow` |
| No mixing | Cannot have both `prompt` and `for-each` in same phase |

### Reference Resolution

| Rule | Description |
|------|-------------|
| Workflow exists | Referenced workflows must exist in `.claude/workflows/` |
| No extension | References should not include `.yaml` extension |
| No cycles | Circular workflow references are invalid |

### Error Examples

```yaml
# INVALID: Missing name
phases:
  - id: task
    prompt: "Do something"
# Error: Workflow must have a name

# INVALID: Mixed phase types
phases:
  - id: hybrid
    prompt: "Do something"
    for-each: step
    workflow: some-workflow
# Error: Phase cannot have both prompt and for-each

# INVALID: Missing workflow reference
phases:
  - id: development
    for-each: step
# Error: For-each phase requires workflow field
```

## Migration Guide

### From Simple Scripts

If you have shell scripts that run tasks:

```bash
# Old approach: script.sh
for task in tasks/*; do
  process_task "$task"
done
```

**Migrate to workflow:**

```yaml
name: Task Processor
phases:
  - id: process
    for-each: step
    workflow: process-task

# process-task.yaml
name: Process Task
phases:
  - id: execute
    prompt: |
      Process this task: {{step.prompt}}
```

### From Inline Steps

If your sprint had all logic in step prompts:

```yaml
# Old: Everything in one step prompt
steps:
  - prompt: |
      1. First analyze the code
      2. Then write a plan
      3. Then implement
      4. Then test
      5. Then document
```

**Migrate to workflow phases:**

```yaml
# New: Split into phases
name: Structured Development
phases:
  - id: analyze
    prompt: "Analyze the code for: {{step.prompt}}"
  - id: plan
    prompt: "Create implementation plan in context/{{step.id}}-plan.md"
  - id: implement
    prompt: "Implement based on context/{{step.id}}-plan.md"
  - id: test
    prompt: "Write and run tests"
  - id: document
    prompt: "Update documentation"
```

**Benefits:**
- Each phase gets fresh context (Ralph Loop)
- Progress tracking per phase
- Can resume from any phase if interrupted

### From Manual Execution

If you run Claude manually for each step:

```bash
# Old: Manual invocation
claude "Implement feature X"
claude "Test feature X"
claude "Document feature X"
```

**Migrate to automated workflow:**

```yaml
# SPRINT.yaml
workflow: feature-workflow
steps:
  - "Implement feature X"

# feature-workflow.yaml
name: Feature Workflow
phases:
  - id: implement
    prompt: "Implement: {{step.prompt}}"
  - id: test
    prompt: "Test the implementation"
  - id: document
    prompt: "Document the changes"
```

**Benefits:**
- Automated execution
- Progress persistence
- Consistent process

## Best Practices

### Prompt Writing

| Do | Don't |
|----|-------|
| Use clear action verbs | Write vague instructions |
| Reference context files | Duplicate information |
| Specify output locations | Leave outputs implicit |
| Include success criteria | Skip verification steps |

### Phase Design

| Do | Don't |
|----|-------|
| Keep phases focused | Combine unrelated tasks |
| Use descriptive IDs | Use generic names like "phase1" |
| Plan → Execute → Verify | Skip verification for complex changes |
| Document phase purpose | Leave implicit assumptions |

### Workflow Organization

| Do | Don't |
|----|-------|
| Name files descriptively | Use generic names |
| Keep nesting shallow | Create deep nesting |
| Reuse common workflows | Duplicate workflow logic |
| Version control workflows | Edit production workflows |

## Advanced Patterns

### Conditional Artifacts

Pass context between phases via files:

```yaml
phases:
  - id: analyze
    prompt: |
      Analyze: {{step.prompt}}

      If complex, create: context/{{step.id}}-complexity.md
      If simple, skip the file.

  - id: implement
    prompt: |
      Check if context/{{step.id}}-complexity.md exists.
      If yes, follow the complexity analysis.
      If no, proceed with simple implementation.
```

### Shared Context Pattern

Create shared context for all steps:

```yaml
phases:
  - id: preflight
    prompt: |
      Create shared context document:
      context/_shared-context.md

      Include:
      - Project architecture
      - Code conventions
      - Build commands

  - id: development
    for-each: step
    workflow: step-with-context

# step-with-context.yaml
phases:
  - id: implement
    prompt: |
      Read: context/_shared-context.md

      Then implement: {{step.prompt}}
```

### QA Gate Pattern

Add quality gates between phases:

```yaml
phases:
  - id: implement
    prompt: "Implement: {{step.prompt}}"

  - id: qa
    prompt: |
      Run quality checks:
      - npm run lint
      - npm run typecheck
      - npm test

      If ANY fail, set status to needs-human.
      If all pass, continue.

  - id: finalize
    prompt: "Commit and push changes"
```

## Troubleshooting

### Variable Not Substituted

**Symptom:** `{{step.prompt}}` appears literally in output

**Cause:** Using step variable in non-for-each context

**Solution:** Only use `{{step.*}}` in for-each phases or their nested workflows

### Workflow Not Found

**Symptom:** "Cannot resolve workflow: my-workflow"

**Cause:** File doesn't exist or has wrong extension

**Solution:**
```bash
# Check file exists
ls .claude/workflows/my-workflow.yaml

# Check reference doesn't include extension
# Wrong: workflow: my-workflow.yaml
# Right: workflow: my-workflow
```

### Circular Reference

**Symptom:** "Circular workflow reference detected"

**Cause:** Workflow A references B, which references A

**Solution:** Restructure to avoid cycles:
```yaml
# Instead of A → B → A
# Create: A → B → C (linear)
```

## See Also

- [Workflow YAML Schema](../reference/workflow-yaml-schema.md) - Complete field reference
- [Template Variables Reference](../reference/workflow-yaml-schema.md#template-variables) - Variable details
- [SPRINT.yaml Schema](../reference/sprint-yaml-schema.md) - Sprint file format
- [Writing Sprints Guide](./writing-sprints.md) - Sprint authoring guide
- [Workflow Compilation](../concepts/workflow-compilation.md) - How compilation works
