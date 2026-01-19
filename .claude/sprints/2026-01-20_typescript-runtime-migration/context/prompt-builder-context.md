# Step Context: prompt-builder

## Task
GIVEN build-sprint-prompt.sh (354 lines) and build-parallel-prompt.sh (82 lines)
WHEN migrating to TypeScript
THEN create unified prompt builder with template support

## Scope
Create NEW file: plugins/m42-sprint/runtime/src/prompt-builder.ts

## Acceptance Criteria

### Main Function
- [ ] `buildPrompt(progress, sprintDir, customPrompts?)` → string
- [ ] Handles regular phases, for-each steps, and sub-phases

### Template Variables
- [ ] {{sprint-id}}, {{sprint.name}}
- [ ] {{iteration}}
- [ ] {{phase.id}}, {{phase.index}}, {{phase.total}}
- [ ] {{step.id}}, {{step.prompt}}, {{step.index}}, {{step.total}}
- [ ] {{sub-phase.id}}, {{sub-phase.index}}, {{sub-phase.total}}
- [ ] {{retry-count}}, {{error}}

### Prompt Sections
- [ ] Header: sprint info, iteration count
- [ ] Position: phase/step/sub-phase indicator
- [ ] Retry Warning: if retryCount > 0
- [ ] Context: load and concatenate context/*.md files
- [ ] Task: the actual prompt from phase/step
- [ ] Instructions: general guidelines
- [ ] Result Reporting: JSON format instructions

### Custom Prompts Override
- [ ] Read prompts.header from SPRINT.yaml
- [ ] Read prompts.position, prompts.instructions, etc.
- [ ] Fall back to defaults if not specified

### Parallel Support
- [ ] `buildParallelPrompt(...)` for parallel phases
- [ ] Include parallel task ID in prompt

### Tests
- [ ] Test: all template variables substituted
- [ ] Test: custom prompts override defaults
- [ ] Test: context files loaded correctly
- [ ] Test: output matches build-sprint-prompt.sh output

## Files to Create
- plugins/m42-sprint/runtime/src/prompt-builder.ts
- plugins/m42-sprint/runtime/src/prompt-builder.test.ts (already created in RED phase)

## Reference
Read: plugins/m42-sprint/scripts/build-sprint-prompt.sh
Read: plugins/m42-sprint/scripts/build-parallel-prompt.sh


## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **Define types/interfaces** (PromptContext, CustomPrompts)
2. **Implement substituteVariables** - template variable replacement
3. **Define DEFAULT_PROMPTS** - all default prompt templates from bash
4. **Implement loadContextFiles** - load context/_shared.md etc.
5. **Implement buildPrompt** - main function for generating prompts
   - Handle simple phases
   - Handle for-each phases with steps/sub-phases
   - Include retry warning when applicable
   - Assemble all sections in correct order
6. **Implement buildParallelPrompt** - simplified prompt for background tasks
7. **Export all public functions and types**

## Related Code Patterns

### Pattern from: transition.ts (type definitions)
```typescript
// Type definitions are copied locally for ESM compatibility
// Use same pattern of local type definitions

export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

export interface CurrentPointer {
  phase: number;
  step: number | null;
  'sub-phase': number | null;
}
```

### Pattern from: yaml-ops.ts (file system operations)
```typescript
// Use fs for file operations, similar pattern
import * as fs from 'fs';
import * as path from 'path';

// Check existence before reading
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
}
```

### Pattern from: build-sprint-prompt.sh (template substitution)
```bash
# Variables substituted via sed
echo "$template" \
  | sed "s|{{sprint-id}}|${SPRINT_ID:-}|g" \
  | sed "s|{{iteration}}|${ITERATION:-1}|g" \
  | sed "s|{{phase.id}}|${PHASE_ID:-}|g"
```

TypeScript equivalent:
```typescript
function substituteVariables(template: string, context: PromptContext): string {
  return template
    .replace(/\{\{sprint-id\}\}/g, context.sprintId)
    .replace(/\{\{iteration\}\}/g, String(context.iteration))
    .replace(/\{\{phase\.id\}\}/g, context.phase.id);
}
```

### Pattern from: build-sprint-prompt.sh (default prompts)
```bash
DEFAULT_HEADER='# Sprint Workflow Execution
Sprint: {{sprint-id}} | Iteration: {{iteration}}'

DEFAULT_POSITION='## Current Position
- Phase: **{{phase.id}}** ({{phase.index}}/{{phase.total}})
- Step: **{{step.id}}** ({{step.index}}/{{step.total}})
- Sub-Phase: **{{sub-phase.id}}** ({{sub-phase.index}}/{{sub-phase.total}})'
```

### Pattern from: build-parallel-prompt.sh (parallel task format)
```bash
cat <<EOF
# Parallel Task Execution
Task ID: $TASK_ID

## Context
Step: $STEP_PROMPT

## Your Task: $SUB_PHASE_ID
$SUB_PHASE_PROMPT
EOF
```

## Required Imports

### Internal
- No internal imports needed (self-contained module)

### External
- `fs` from Node built-in: file system operations
- `path` from Node built-in: path joining

## Types/Interfaces to Use

### PromptContext (new type to define)
```typescript
/**
 * Context for template variable substitution
 */
export interface PromptContext {
  sprintId: string;
  iteration: number;
  phase: {
    id: string;
    index: number;  // 0-based
    total: number;
  };
  step: {
    id: string;
    prompt: string;
    index: number;  // 0-based
    total: number;
  } | null;
  subPhase: {
    id: string;
    index: number;  // 0-based
    total: number;
  } | null;
  retryCount: number;
  error: string | null;
}
```

### CustomPrompts (from compiler types.ts - SprintPrompts)
```typescript
/**
 * Custom prompt templates from SPRINT.yaml
 */
export interface CustomPrompts {
  header?: string;
  position?: string;
  'retry-warning'?: string;
  instructions?: string;
  'result-reporting'?: string;
}
```

### CompiledProgress (minimal subset needed)
```typescript
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  current: CurrentPointer;
  stats: SprintStats;
  phases?: CompiledTopPhase[];
}

interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;  // For simple phases
  steps?: CompiledStep[];  // For for-each phases
  'retry-count'?: number;
  error?: string;
}

interface CompiledStep {
  id: string;
  prompt: string;
  status: PhaseStatus;
  phases: CompiledPhase[];  // Sub-phases
}

interface CompiledPhase {
  id: string;
  prompt: string;
  status: PhaseStatus;
  'retry-count'?: number;
  error?: string;
}
```

## Integration Points

### Called by
- `loop.ts` (future): Main execution loop will call `buildPrompt()` to generate prompts
- `executor.ts` (future): Will call `buildParallelPrompt()` for background tasks

### Calls
- Node `fs`: For reading context files
- Node `path`: For joining paths

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| plugins/m42-sprint/runtime/src/prompt-builder.ts | Create | Main prompt builder implementation |
| plugins/m42-sprint/runtime/src/prompt-builder.test.ts | Exists | Tests already written in RED phase |

## Default Prompt Templates

From `build-sprint-prompt.sh`, the following default templates need to be implemented:

### Header
```
# Sprint Workflow Execution
Sprint: {{sprint-id}} | Iteration: {{iteration}}
```

### Position (full - for for-each phases)
```
## Current Position
- Phase: **{{phase.id}}** ({{phase.index}}/{{phase.total}})
- Step: **{{step.id}}** ({{step.index}}/{{step.total}})
- Sub-Phase: **{{sub-phase.id}}** ({{sub-phase.index}}/{{sub-phase.total}})
```

### Position (simple - for simple phases)
```
## Current Position
- Phase: **{{phase.id}}** ({{phase.index}}/{{phase.total}})
```

### Retry Warning
```
## Warning: RETRY ATTEMPT {{retry-count}}
This task previously failed. Please review the error and try a different approach.

Previous error: {{error}}
```

### Instructions
```
## Instructions

1. Execute this sub-phase task
2. Commit your changes when the task is done
3. **EXIT immediately** - do NOT continue to next task
```

### Result Reporting
```
## Result Reporting (IMPORTANT)

Do NOT modify PROGRESS.yaml directly. The sprint loop handles all state updates.
Report your result as JSON in your final output:

**On Success:**
\`\`\`json
{"status": "completed", "summary": "Brief description of what was accomplished"}
\`\`\`

**On Failure:**
\`\`\`json
{"status": "failed", "summary": "What was attempted", "error": "What went wrong"}
\`\`\`

**If Human Needed:**
\`\`\`json
{"status": "needs-human", "summary": "What was done so far", "humanNeeded": {"reason": "Why human is needed", "details": "Additional context"}}
\`\`\`
```

## Context File Loading

The bash script loads context files from `$SPRINT_DIR/context/`:
- `_shared.md` is loaded and appended to the end of the prompt
- Should gracefully handle missing context directory

## Key Implementation Notes

1. **Index conversion**: Bash uses 0-based indices internally but displays 1-based. TypeScript should do the same.

2. **Prompt assembly order** (from bash):
   - Header
   - Position
   - Retry warning (if applicable)
   - Step Context (for for-each phases)
   - Task section
   - Instructions
   - Files section
   - Previous step output (if available)
   - Result reporting
   - Shared context

3. **Simple vs for-each phases**:
   - Simple: Has `prompt` field, no `steps`
   - For-each: Has `steps` array, each step has `phases` (sub-phases)

4. **Early returns**: Bash script exits early for completed/blocked/spawned phases. TypeScript should return empty string for these cases.

5. **Template safety**: The bash script doesn't escape special characters. TypeScript should preserve them as-is (no escaping needed for prompt generation).

## Test File Status

The test file `prompt-builder.test.ts` was created in the RED phase with 40+ tests covering:
- `substituteVariables` function (8 tests)
- `buildPrompt` for simple phases (4 tests)
- `buildPrompt` for for-each phases (4 tests)
- Custom prompts override (4 tests)
- Retry warning (3 tests)
- Context file loading (4 tests)
- `buildParallelPrompt` (6 tests)
- Result reporting section (4 tests)
- `DEFAULT_PROMPTS` validation (5 tests)
- Edge cases (4 tests)

All tests are expected to FAIL until the implementation is complete.
