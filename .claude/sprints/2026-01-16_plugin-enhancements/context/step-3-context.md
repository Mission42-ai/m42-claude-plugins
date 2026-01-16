# Step Context: step-3

## Task
Track B - Step 2: Create creating-sprints Skill Structure

Create a new skill for sprint definition guidance.

Requirements:
- Create skills/creating-sprints/ directory structure
- Create main skill file: skills/creating-sprints/creating-sprints.md
- Create references/ subdirectory with:
  - sprint-schema.md (SPRINT.yaml structure reference)
  - step-writing-guide.md (How to write effective step prompts)
  - workflow-selection.md (Guide for choosing appropriate workflows)
- Create assets/ subdirectory with:
  - sprint-template.yaml (Annotated example sprint definition)
- Main skill file should trigger on: "create sprint", "new sprint", "sprint definition", "define steps"
- Include best practices for step prompts (clear, actionable, scoped)
- Guidance on sprint sizing (3-8 steps, single responsibility)
- Integration instructions with existing workflows

New files to create:
- skills/creating-sprints/creating-sprints.md
- skills/creating-sprints/references/*.md
- skills/creating-sprints/assets/sprint-template.yaml

## Related Code Patterns

### Similar Implementation: plugins/m42-sprint/skills/creating-workflows/creating-workflows.md
```yaml
---
name: creating-workflows
description: Guide for creating sprint workflow definitions. This skill should be used when users want to create a new workflow, modify existing workflows, understand workflow schema, or define phase sequences. Triggers on "create workflow", "new workflow", "workflow definition", "define phases".
---
```
Key pattern: Frontmatter with `name` and `description` (including trigger keywords). Main content uses:
- Quick reference tables for concepts
- Decision trees for selecting options
- `## References` section listing reference files
- `## Assets` section listing asset files
- `## Troubleshooting` table for common issues
- `## Related` section for related skills

### Similar Implementation: plugins/m42-sprint/skills/orchestrating-sprints/SKILL.md
```yaml
---
name: orchestrating-sprints
description: Manages development sprints with workflow-based compilation...
---
```
Key pattern: Comprehensive skill with references/, assets/ subdirectories. Uses:
- `## Core Concepts` table
- `## Commands` table
- `## References` and `## Assets` sections
- ASCII diagrams for architecture visualization

### Reference File Pattern: plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md
```yaml
---
title: Workflow Schema Reference
description: Complete YAML schema for workflow definitions including all fields, types, and validation rules.
keywords: workflow, schema, yaml, phases, validation, types
skill: creating-workflows
---
```
Key pattern: Frontmatter with `title`, `description`, `keywords`, and `skill` fields. Content organized as:
- Field reference tables
- TypeScript interface definitions
- Valid/Invalid examples
- Validation rules

## Required Imports
### Internal
- None (skill is markdown documentation)

### External
- None (skill is markdown documentation)

## Types/Interfaces to Use
```typescript
// From compiler/src/types.ts - SprintDefinition
interface SprintDefinition {
  workflow: string;
  steps: SprintStep[];
  'sprint-id'?: string;
  name?: string;
  created?: string;
  owner?: string;
  config?: {
    'max-tasks'?: number;
    'time-box'?: string;
    'auto-commit'?: boolean;
  };
}

// From compiler/src/types.ts - SprintStep
interface SprintStep {
  prompt: string;
  workflow?: string;
  id?: string;
}
```

## Integration Points
- Called by: Users asking to "create sprint", "new sprint", "sprint definition", "define steps"
- Calls: References to creating-workflows skill and orchestrating-sprints skill
- Tests: Verification via gherkin scenarios in artifacts/step-3-gherkin.md

## Implementation Notes
- Follow LLM-first documentation principles (dense, structured, no bloat)
- Use decision trees and comparison tables over prose
- Main skill file naming: `creating-sprints.md` (matches creating-workflows pattern)
- Skill directory: `plugins/m42-sprint/skills/creating-sprints/`
- All reference files must have YAML frontmatter with title, description, keywords, skill
- Asset file `sprint-template.yaml` should be annotated with comments explaining each field
- Cross-reference with orchestrating-sprints for execution guidance
- Cross-reference with creating-workflows for workflow authoring guidance

## Gherkin Verification Criteria
1. Main skill file exists at `plugins/m42-sprint/skills/creating-sprints/creating-sprints.md`
2. Sprint schema reference at `references/sprint-schema.md`
3. Step writing guide at `references/step-writing-guide.md`
4. Workflow selection guide at `references/workflow-selection.md`
5. Sprint template asset at `assets/sprint-template.yaml`
6. Trigger phrases present: "create sprint", "new sprint", "sprint definition", "define steps"
7. Sprint sizing guidance: 3-8 steps, single responsibility/focused/purpose
8. Step writing guide contains: clear/clarity, actionable/action, scope/scoped/bounded

## Available Workflows for Selection Guide
| Workflow | Purpose | Best For |
|----------|---------|----------|
| sprint-default | Full sprint lifecycle | Multi-step feature work |
| feature-standard | Single feature development | Step-level implementation |
| bugfix-workflow | Quick bug fixes | Small, focused fixes |
| execute-step | Simple execution | Single-task steps |
| gherkin-verified-execution | Verified development | Complex autonomous sprints |
| execute-with-qa | Execution with QA | Steps needing verification |
| flat-foreach | Simple iteration | Basic step iteration |
| flat-foreach-qa | Iteration with QA | Verified step iteration |
