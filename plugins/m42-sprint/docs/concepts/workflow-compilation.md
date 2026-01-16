# Workflow Compilation

The **compilation pipeline** transforms your simple SPRINT.yaml into the rich, executable PROGRESS.yaml. This document explains each step of that transformation.

---

## The Compilation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPILATION PIPELINE                                  │
│                                                                             │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌────────┐│
│  │   LOAD    │──►│  RESOLVE  │──►│  EXPAND   │──►│SUBSTITUTE │──►│GENERATE││
│  │           │   │           │   │           │   │           │   │        ││
│  │SPRINT.yaml│   │ Workflows │   │ for-each  │   │ Template  │   │PROGRESS││
│  │  + refs   │   │  + refs   │   │  loops    │   │ variables │   │ .yaml  ││
│  └───────────┘   └───────────┘   └───────────┘   └───────────┘   └────────┘│
│                                                                             │
│  compile.ts      resolve-        expand-         expand-        compile.ts │
│                  workflows.ts    foreach.ts      foreach.ts                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Load SPRINT.yaml

The compiler reads your SPRINT.yaml and parses it into a structured representation.

**Input:** SPRINT.yaml file

```yaml
# SPRINT.yaml
workflow: flat-foreach-qa
sprint-id: 2026-01-16_auth-feature

steps:
  - prompt: "Implement user authentication"
  - prompt: "Add session management"
    workflow: bugfix-workflow   # Per-step override
```

**Output:** SprintDefinition object

```typescript
{
  workflow: "flat-foreach-qa",
  "sprint-id": "2026-01-16_auth-feature",
  steps: [
    { prompt: "Implement user authentication" },
    { prompt: "Add session management", workflow: "bugfix-workflow" }
  ]
}
```

**Module:** `compile.ts` lines 77-98

```typescript
// Load and parse SPRINT.yaml
const content = fs.readFileSync(sprintYamlPath, 'utf8');
sprintDef = yaml.load(content) as SprintDefinition;

// Validate structure
const sprintErrors = validateSprintDefinition(sprintDef);
```

---

## Step 2: Resolve Workflows

The compiler loads the main workflow and recursively resolves all referenced workflows.

**Input:** Workflow name from SPRINT.yaml

**Process:**

1. Load the main workflow from `.claude/workflows/`
2. Find all `workflow:` references in phases
3. Load referenced workflows recursively
4. Detect circular references (error)

```
flat-foreach-qa.yaml
    │
    └── phases[1].workflow: execute-with-qa
        │
        └── execute-with-qa.yaml
            │
            └── (no nested refs - leaf workflow)
```

**Module:** `resolve-workflows.ts`

```typescript
// Load a workflow by name
export function loadWorkflow(
  name: string,
  workflowsDir: string,
  errors?: CompilerError[]
): LoadedWorkflow | null {
  // Check cache first
  const cacheKey = `${workflowsDir}:${name}`;
  if (workflowCache.has(cacheKey)) {
    return workflowCache.get(cacheKey)!;
  }

  // Try to find the workflow file
  const possiblePaths = [
    path.join(workflowsDir, `${name}.yaml`),
    path.join(workflowsDir, `${name}.yml`),
    path.join(workflowsDir, name)
  ];
  // ...
}

// Recursively resolve all workflow references
export function resolveWorkflowRefs(
  workflow: WorkflowDefinition,
  workflowsDir: string,
  visited: Set<string>,   // For cycle detection
  errors: CompilerError[]
): Map<string, LoadedWorkflow>
```

---

## Step 3: Expand for-each Loops

Phases with `for-each: step` are expanded by iterating over each step from SPRINT.yaml.

**Input:** Workflow with for-each phase

```yaml
# flat-foreach-qa.yaml
phases:
  - id: prepare
    prompt: "Create sprint plan..."

  - id: execute-all
    for-each: step              # ← Iterates over steps
    workflow: execute-with-qa   # ← Each step uses this workflow
```

**Process:**

For each step in SPRINT.yaml:
1. Load the step's workflow (or use default)
2. Create a CompiledStep with the step's prompt
3. Expand the workflow's phases into sub-phases

**Output:** Nested step structure

```yaml
phases:
  - id: prepare
    status: pending
    prompt: "Create sprint plan..."

  - id: execute-all
    status: pending
    steps:                           # ← Steps array created
      - id: step-0
        prompt: "Implement user authentication"
        status: pending
        phases:                      # ← Sub-phases from workflow
          - id: implement
            status: pending
            prompt: "..."
          - id: qa
            status: pending
            prompt: "..."
      - id: step-1
        prompt: "Add session management"
        status: pending
        phases:
          - id: implement
            status: pending
            prompt: "..."
          - id: qa
            status: pending
            prompt: "..."
```

**Module:** `expand-foreach.ts`

```typescript
// Expand a for-each phase into concrete steps
export function expandForEach(
  phase: WorkflowPhase,
  steps: SprintStep[],
  workflowsDir: string,
  defaultWorkflow: LoadedWorkflow | null,
  context: TemplateContext,
  errors: CompilerError[]
): CompiledTopPhase {
  const compiledSteps: CompiledStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Determine which workflow to use for this step
    let stepWorkflow: WorkflowDefinition;

    if (step.workflow) {
      // Step has its own workflow override
      const loaded = loadWorkflow(step.workflow, workflowsDir, errors);
      stepWorkflow = loaded.definition;
    } else if (defaultWorkflow) {
      // Use the sprint's default workflow
      stepWorkflow = defaultWorkflow.definition;
    }
    // ...

    // Expand this step
    const compiledStep = expandStep(step, i, stepWorkflow, context);
    compiledSteps.push(compiledStep);
  }

  return {
    id: phase.id,
    status: 'pending',
    steps: compiledSteps
  };
}
```

---

## Step 4: Substitute Template Variables

Placeholders like `{{step.prompt}}` are replaced with actual values.

**Input:** Prompt with template variables

```yaml
prompt: |
  Execute the following task:

  {{step.prompt}}

  Step ID: {{step.id}}
  Sprint: {{sprint.id}}
```

**Process:** Pattern matching and replacement

```typescript
export function substituteTemplateVars(
  template: string,
  context: TemplateContext
): string {
  let result = template;

  // Replace step variables
  if (context.step) {
    result = result.replace(/\{\{step\.prompt\}\}/g, context.step.prompt);
    result = result.replace(/\{\{step\.id\}\}/g, context.step.id);
    result = result.replace(/\{\{step\.index\}\}/g, String(context.step.index));
  }

  // Replace phase variables
  if (context.phase) {
    result = result.replace(/\{\{phase\.id\}\}/g, context.phase.id);
  }

  // Replace sprint variables
  if (context.sprint) {
    result = result.replace(/\{\{sprint\.id\}\}/g, context.sprint.id);
  }

  return result;
}
```

**Output:** Resolved prompt

```yaml
prompt: |
  Execute the following task:

  Implement user authentication

  Step ID: step-0
  Sprint: 2026-01-16_auth-feature
```

### Available Template Variables

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `{{step.prompt}}` | string | Step description from SPRINT.yaml | "Implement user auth" |
| `{{step.id}}` | string | Step identifier | "step-0" |
| `{{step.index}}` | number | 0-based step index | 0, 1, 2... |
| `{{phase.id}}` | string | Current phase identifier | "implement" |
| `{{phase.index}}` | number | 0-based phase index | 0, 1, 2... |
| `{{sprint.id}}` | string | Sprint identifier | "2026-01-16_feature" |
| `{{sprint.name}}` | string | Sprint name (optional) | "Auth Feature" |

### Variable Availability

| Context | `step.*` | `phase.*` | `sprint.*` |
|---------|----------|-----------|------------|
| Simple phase | No | Yes | Yes |
| for-each phase | Yes | Yes | Yes |
| Nested workflow | Yes | Yes | Yes |

---

## Step 5: Generate PROGRESS.yaml

The compiler assembles the final structure with initial status values and statistics.

**Added during generation:**

1. **Status values:** All phases start as `pending`
2. **Current pointer:** Points to first executable item
3. **Statistics:** Phase and step counts

```yaml
# PROGRESS.yaml (generated)
sprint-id: 2026-01-16_auth-feature
status: not-started

phases:
  - id: prepare
    status: pending
    prompt: "Create sprint plan..."

  - id: execute-all
    status: pending
    steps:
      - id: step-0
        prompt: "Implement user authentication"
        status: pending
        phases:
          - id: implement
            status: pending
            prompt: "Execute the following task:\n\nImplement user authentication\n..."
          - id: qa
            status: pending
            prompt: "Quality Assurance verification...\n\nStep: step-0\n..."
      - id: step-1
        # ... similar structure

current:
  phase: 0
  step: null
  sub-phase: null

stats:
  started-at: null
  total-phases: 6      # prepare + 2 steps × 2 phases
  completed-phases: 0
  total-steps: 2
  completed-steps: 0
```

**Module:** `compile.ts` lines 203-215

```typescript
// Build compiled progress
const progress: CompiledProgress = {
  'sprint-id': sprintId,
  status: 'not-started',
  phases: compiledPhases,
  current,
  stats
};
```

---

## Complete Example: Before and After

### Input: SPRINT.yaml

```yaml
workflow: flat-foreach-qa
sprint-id: 2026-01-16_demo

steps:
  - prompt: "Create user model"
  - prompt: "Add authentication API"
```

### Intermediate: Workflow Resolution

```
flat-foreach-qa.yaml
├── phases[0]: prepare (simple phase with prompt)
└── phases[1]: execute-all (for-each: step)
    └── workflow: execute-with-qa
        ├── phases[0]: implement (template: {{step.prompt}})
        └── phases[1]: qa (template: Step: {{step.id}})
```

### Output: PROGRESS.yaml (simplified)

```yaml
sprint-id: 2026-01-16_demo
status: not-started

phases:
  # Simple phase (no expansion needed)
  - id: prepare
    status: pending
    prompt: "Create a sprint architecture plan..."

  # For-each phase (expanded to steps)
  - id: execute-all
    status: pending
    steps:
      # Step 0: "Create user model"
      - id: step-0
        prompt: "Create user model"
        status: pending
        phases:
          - id: implement
            status: pending
            prompt: |
              Execute the following task:

              Create user model

              ## Before Starting
              1. Read context/sprint-plan.md...

          - id: qa
            status: pending
            prompt: |
              Quality Assurance verification...

              ## Context
              Step: step-0
              Task: Create user model

      # Step 1: "Add authentication API"
      - id: step-1
        prompt: "Add authentication API"
        status: pending
        phases:
          - id: implement
            status: pending
            prompt: |
              Execute the following task:

              Add authentication API
              ...

          - id: qa
            status: pending
            prompt: |
              Quality Assurance verification...

              ## Context
              Step: step-1
              Task: Add authentication API

current:
  phase: 0
  step: null
  sub-phase: null

stats:
  started-at: null
  total-phases: 5    # 1 prepare + 2 steps × 2 phases each
  completed-phases: 0
  total-steps: 2
  completed-steps: 0
```

---

## Compiler Module Overview

```
compiler/src/
│
├── compile.ts              Main orchestration
│   ├── compile()           Entry point - coordinates all steps
│   ├── formatYamlError()   Human-friendly YAML error messages
│   ├── calculateStats()    Compute phase/step counts
│   └── initializeCurrentPointer()
│
├── resolve-workflows.ts    Workflow loading & resolution
│   ├── loadWorkflow()      Load single workflow by name
│   ├── resolveWorkflowRefs() Recursive resolution with cycle detection
│   ├── listWorkflows()     List available workflows
│   └── workflowCache       In-memory cache for loaded workflows
│
├── expand-foreach.ts       For-each expansion & variable substitution
│   ├── expandForEach()     Expand for-each phase into steps
│   ├── expandStep()        Expand single step with its workflow
│   ├── compileSimplePhase() Compile non-for-each phase
│   ├── substituteTemplateVars()  Replace {{variables}}
│   └── findUnresolvedVars() Detect unsubstituted variables
│
├── validate.ts             Schema validation
│   ├── validateSprintDefinition()
│   ├── validateWorkflowDefinition()
│   ├── validateCompiledProgress()
│   └── checkUnresolvedVariables()
│
├── types.ts                TypeScript interfaces
│   ├── SprintDefinition    SPRINT.yaml structure
│   ├── WorkflowDefinition  Workflow template structure
│   ├── CompiledProgress    PROGRESS.yaml structure
│   ├── TemplateContext     Variable substitution context
│   └── CompilerConfig      Compiler options
│
└── error-classifier.ts     Error categorization for retry handling
```

---

## Validation & Errors

The compiler validates at multiple stages:

### SPRINT.yaml Validation
- Required fields: `workflow`, `steps`
- Steps must have `prompt` field
- Workflow reference must exist

### Workflow Validation
- Required fields: `name`, `phases`
- Each phase needs `id`
- `for-each` only allows value `step`
- No circular workflow references

### Post-Compilation Validation
- Unresolved template variables (strict mode = error, default = warning)
- Valid status values
- Consistent phase hierarchy

### Error Codes

| Code | Meaning |
|------|---------|
| `SPRINT_LOAD_ERROR` | Failed to read or parse SPRINT.yaml |
| `MAIN_WORKFLOW_NOT_FOUND` | Referenced workflow doesn't exist |
| `WORKFLOW_PARSE_ERROR` | Workflow YAML syntax error |
| `CYCLE_DETECTED` | Circular workflow reference |
| `STEP_WORKFLOW_NOT_FOUND` | Step's workflow override not found |
| `UNRESOLVED_VARIABLE` | Template variable not substituted |

---

## Key Concepts Summary

| Concept | Purpose |
|---------|---------|
| **Three-Tier Model** | Separate what (SPRINT) from how (Workflow) from where (PROGRESS) |
| **for-each expansion** | Transform N steps into N×M phases via workflow template |
| **Template variables** | Inject runtime values into static workflow prompts |
| **Workflow resolution** | Load and compose nested workflow templates |
| **Validation** | Catch errors early before execution starts |

---

## Related Documentation

- [Architecture Overview](overview.md) - How compilation fits in the system
- [Ralph Loop Pattern](ralph-loop.md) - How PROGRESS.yaml drives execution
- [SPRINT.yaml Schema](../reference/sprint-yaml-schema.md) - Input format spec
- [Workflow Schema](../reference/workflow-yaml-schema.md) - Template format spec
- [PROGRESS.yaml Schema](../reference/progress-yaml-schema.md) - Output format spec

---

[← Back to Concepts](overview.md) | [← Back to Documentation Index](../index.md)
