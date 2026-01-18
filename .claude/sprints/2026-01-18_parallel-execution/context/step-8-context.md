# Step Context: step-8

## Task
Update skills/creating-workflows/references/workflow-schema.md:

Document new properties:
1. `parallel?: boolean` on WorkflowPhase
   - Description: Run this phase in background, don't block next step
   - Use case: Documentation updates, learning loops
   - Note: Only works in step workflows, not on for-each phases

2. `wait-for-parallel?: boolean` on top-level WorkflowPhase
   - Description: Wait for all parallel tasks to complete before continuing
   - Use case: Sync points before QA or deployment phases

Add usage examples from the plan.

## Related Code Patterns

### Similar Implementation: workflow-schema.md existing structure
The current file has a clear pattern for documenting phase fields:
```markdown
## Phase Fields Reference

| Field | Type | Required | Context | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | All phases | Unique phase identifier |
```

### TypeScript Interface Pattern
Current interface documentation pattern:
```typescript
interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
}
```

### Valid Examples Pattern
Each example has a header and YAML code block:
```markdown
### Minimal Workflow

```yaml
name: Minimal
phases:
  - id: execute
    prompt: "Execute the task"
```

## Source Content from Implementation Plan

### Schema Extensions (from context/implementation-plan.md section 2-3)
```typescript
interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;           // NEW: Run in background, don't block next step
  'wait-for-parallel'?: boolean; // NEW: Wait for all parallel tasks to complete
}
```

### Usage Example (from implementation-plan.md section 3)
```yaml
# .claude/workflows/feature-with-learning-loop.yaml
name: Feature with Learning Loop
phases:
  - id: development
    for-each: step
    workflow: feature-with-docs   # This workflow has parallel sub-phases

  - id: sync
    prompt: "Verify all documentation updates completed..."
    wait-for-parallel: true       # Block until all parallel tasks done

  - id: qa
    prompt: "Run final QA checks..."
```

```yaml
# .claude/workflows/feature-with-docs.yaml (step workflow)
name: Feature Implementation with Docs
phases:
  - id: plan
    prompt: "Plan implementation for: {{step.prompt}}"

  - id: implement
    prompt: "Implement: {{step.prompt}}"

  - id: test
    prompt: "Test the implementation..."

  - id: update-docs
    prompt: "Update documentation for {{step.prompt}}..."
    parallel: true    # Spawns in background, next step starts immediately
```

## Required Imports
### Internal
- N/A - This is documentation, not code

### External
- N/A - This is documentation, not code

## Types/Interfaces to Use
```typescript
// From compiler/src/types.ts (already implemented)
interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;           // Already defined in types.ts:68-81
  'wait-for-parallel'?: boolean; // Already defined in types.ts:68-81
}
```

## Integration Points
- Calls: N/A (documentation file)
- Called by: Users creating workflow definitions
- Tests: N/A (documentation validation is manual)

## Implementation Notes

### What to Add to workflow-schema.md

1. **Phase Fields Reference table**: Add two new rows:
   - `parallel` | `boolean` | No | Step workflow phases | Run in background, don't block next step
   - `wait-for-parallel` | `boolean` | No | Top-level phases | Wait for all parallel tasks before continuing

2. **TypeScript Interface**: Update to include:
   ```typescript
   parallel?: boolean;
   'wait-for-parallel'?: boolean;
   ```

3. **Validation Rules**: Add new section or rules for:
   - `parallel` must be boolean if present
   - `wait-for-parallel` must be boolean if present
   - `parallel: true` only works in step workflows (not on for-each phases)
   - `wait-for-parallel: true` only makes sense on top-level simple phases

4. **New Examples Section**: Add "Parallel Execution" examples:
   - Sprint workflow with `wait-for-parallel` sync point
   - Step workflow with `parallel: true` sub-phase

5. **Update Schema Evolution section**: Remove "Parallel execution" from future since now implemented

### Verification Scenarios to Pass
1. `grep -q "parallel.*boolean"` in the file
2. `grep -q "wait-for-parallel.*boolean"` in the file
3. TypeScript interface shows `parallel?: boolean`
4. TypeScript interface shows `'wait-for-parallel'?: boolean`
5. YAML example with `parallel: true` and nearby `prompt:`
6. YAML example with `wait-for-parallel: true` and nearby `id:`
