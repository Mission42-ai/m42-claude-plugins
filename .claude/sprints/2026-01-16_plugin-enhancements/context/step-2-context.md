# Step Context: step-2

## Task
Track B - Step 1: Create creating-workflows Skill Structure

Create a new skill for workflow definition guidance.

Requirements:
- Create skills/creating-workflows/ directory structure
- Create main skill file: skills/creating-workflows/creating-workflows.md
- Create references/ subdirectory with:
  - workflow-schema.md (Full YAML schema reference)
  - template-variables.md (All available template variables)
  - phase-types.md (Simple vs for-each phase explanations)
  - workflow-patterns.md (Common workflow patterns)
- Create assets/ subdirectory with:
  - feature-workflow.yaml (Example feature workflow)
  - bugfix-workflow.yaml (Example bugfix workflow)
  - validation-checklist.md (Pre-deployment checklist)
- Main skill file should trigger on: "create workflow", "new workflow", "workflow definition", "define phases"
- Include comprehensive documentation for workflow authoring
- Reference existing workflows in .claude/workflows/ as examples

New files to create:
- skills/creating-workflows/creating-workflows.md
- skills/creating-workflows/references/*.md
- skills/creating-workflows/assets/*.{yaml,md}

## Related Code Patterns

### Similar Implementation: plugins/m42-sprint/skills/orchestrating-sprints/SKILL.md
```yaml
---
name: orchestrating-sprints
description: Manages development sprints with workflow-based compilation and fresh-context execution. Supports hierarchical phases (prepare → development → QA → deploy) with for-each step expansion. This skill should be used when starting sprints, managing workflows, or tracking sprint progress. Triggers on "start sprint", "create sprint", "run sprint", "sprint status", "add step", "compile sprint".
---
```
Key patterns:
- YAML frontmatter with `name` and `description` (description includes trigger keywords)
- Table-based quick reference for concepts
- Workflow Architecture section with ASCII diagram
- Commands table linking to commands
- References section pointing to `references/*.md`
- Assets section listing templates
- Troubleshooting table at end

### Similar Implementation: plugins/m42-meta-toolkit/skills/creating-skills/SKILL.md
Key patterns:
- Step-by-step process for skill creation (Step 1-7)
- Examples in context (illustrative)
- Code blocks showing valid/invalid patterns
- Clear decision criteria tables
- LLM-first design principles
- Reference file frontmatter requirements

### Similar Implementation: plugins/m42-sprint/skills/orchestrating-sprints/references/workflow-definitions.md
```yaml
---
title: Workflow Definitions
description: Workflow YAML schema including phase types, template variables, and for-each expansion.
keywords: workflow, phases, for-each, template, variables, expansion
skill: orchestrating-sprints
---
```
Key patterns:
- YAML frontmatter with title, description, keywords, skill
- Tables for field specifications (Field | Type | Required | Description)
- Code blocks showing YAML examples
- Conditional rules clearly stated
- Template variable table

## Required Imports
### Internal
This is a documentation-only skill with no TypeScript code. References existing:
- `plugins/m42-sprint/compiler/src/types.ts`: TypeScript interfaces for schema reference
- `.claude/workflows/*.yaml`: Existing workflow examples for patterns
- `plugins/m42-sprint/skills/orchestrating-sprints/`: Sister skill with related content

### External
- No external packages needed (pure documentation)

## Types/Interfaces to Use
```typescript
// From plugins/m42-sprint/compiler/src/types.ts

// Workflow Definition
interface WorkflowDefinition {
  name: string;
  description?: string;
  phases: WorkflowPhase[];
}

interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
}

// Template Context (for template variables documentation)
interface TemplateContext {
  step?: {
    prompt: string;
    id: string;
    index: number;
  };
  phase?: {
    id: string;
    index: number;
  };
  sprint?: {
    id: string;
    name?: string;
  };
}

// Sprint Definition (for understanding workflow usage)
interface SprintDefinition {
  workflow: string;
  steps: SprintStep[];
  'sprint-id'?: string;
  name?: string;
}

interface SprintStep {
  prompt: string;
  workflow?: string;
  id?: string;
}
```

## Integration Points
- **Called by**: Claude when user requests workflow creation/definition
- **Calls**: References existing workflows in `.claude/workflows/` as examples
- **Related skill**: `orchestrating-sprints` (uses workflows, this skill helps create them)
- **Tests**: No automated tests (documentation skill)

## Existing Workflow Files for Reference
```
.claude/workflows/
├── sprint-default.yaml          # Standard sprint with prepare/development/qa/deploy
├── feature-standard.yaml        # Feature implementation: planning/implement/test/document
├── bugfix-workflow.yaml         # Bug fixing: diagnose/fix/verify
├── gherkin-verified-execution.yaml  # Full sprint with gherkin QA
├── gherkin-step-workflow.yaml   # Step-level workflow for gherkin verification
├── execute-step.yaml            # Simple step execution
├── execute-with-qa.yaml         # Step execution with QA
├── flat-foreach.yaml            # Flat for-each pattern
└── flat-foreach-qa.yaml         # Flat for-each with QA
```

## Implementation Notes
1. **Skill location**: `plugins/m42-sprint/skills/creating-workflows/` (same plugin as orchestrating-sprints)
2. **Main file naming**: Use `creating-workflows.md` (not SKILL.md) per requirement
3. **Frontmatter format**: Must include `name` and `description` with trigger keywords
4. **Reference frontmatter**: Each reference file needs `title`, `description`, `keywords`, `skill` fields
5. **LLM-first design**: Keep documentation concise, use tables over prose
6. **Decision trees**: Use for phase type selection (simple vs for-each)
7. **Workflow examples in assets/**: Provide complete, working YAML files users can copy
8. **Cross-reference**: Link to orchestrating-sprints for runtime behavior

## Directory Structure to Create
```
plugins/m42-sprint/skills/creating-workflows/
├── creating-workflows.md        # Main skill file
├── references/
│   ├── workflow-schema.md       # Full YAML schema reference
│   ├── template-variables.md    # All available template variables
│   ├── phase-types.md           # Simple vs for-each phases
│   └── workflow-patterns.md     # Common workflow patterns
└── assets/
    ├── feature-workflow.yaml    # Example feature workflow
    ├── bugfix-workflow.yaml     # Example bugfix workflow
    └── validation-checklist.md  # Pre-deployment checklist
```

## Content Sources
1. **workflow-schema.md**: Extract from `types.ts` (WorkflowDefinition, WorkflowPhase interfaces)
2. **template-variables.md**: Extract from `types.ts` (TemplateContext interface) and existing workflow-definitions.md
3. **phase-types.md**: Consolidate from workflow-definitions.md, add decision tree
4. **workflow-patterns.md**: Analyze existing workflows, extract patterns
5. **feature-workflow.yaml**: Adapt from feature-standard.yaml
6. **bugfix-workflow.yaml**: Adapt from bugfix-workflow.yaml (simplify/translate)
7. **validation-checklist.md**: Create based on common workflow validation needs
