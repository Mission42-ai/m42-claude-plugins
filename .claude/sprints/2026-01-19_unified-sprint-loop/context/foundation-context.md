# Step Context: foundation

## Task
GIVEN the current Sprint system without orchestration support
WHEN extending TypeScript types for unified loop and configurable prompts
THEN create the foundation for dynamic step injection and prompt customization

## Scope
TypeScript schema changes only - no bash scripts yet.

## Acceptance Criteria (8 Gherkin Scenarios)
1. `OrchestrationConfig` interface exported from types.ts
2. `ProposedStep` interface exported from types.ts
3. `StepQueueItem` interface exported from types.ts
4. `SprintPrompts` interface exported from types.ts
5. `WorkflowDefinition` extended with optional `orchestration` field
6. `SprintDefinition` extended with optional `prompts` field
7. TypeScript builds without errors
8. TypeScript type checking passes

---

## Related Code Patterns

### Pattern 1: Interface Definition Style (types.ts:21-33)
```typescript
/**
 * Description of what this interface represents
 * Additional context about usage
 */
export interface InterfaceName {
  /** Field-level JSDoc comment */
  fieldName: FieldType;
  /** Optional field */
  optionalField?: Type;
  /** Quoted key for hyphenated names */
  'hyphenated-key'?: Type;
}
```

### Pattern 2: Type Enum Style (types.ts:9-11)
```typescript
export type StatusType = 'value1' | 'value2' | 'value3';
```

### Pattern 3: Interface Extension Pattern (types.ts:128-150)
Existing interfaces are extended by adding optional fields at the end:
```typescript
export interface SprintDefinition {
  // ... existing required fields
  workflow: string;
  steps?: SprintStep[];
  // ... existing optional fields
  config?: { ... };
  /** New optional field added at end */
  newField?: NewType;
}
```

### Pattern 4: Compile Function Pattern (compile.ts:354-370)
```typescript
/**
 * Compile/process a specific configuration section
 *
 * @param source - Source definition
 * @param target - Target to merge into
 * @returns Processed configuration
 */
function compileSection(
  source: SourceType | undefined,
  target: TargetType
): ProcessedType {
  if (!source) return defaultValue;
  // ... processing logic
  return result;
}
```

### Pattern 5: Error Handling Pattern (compile.ts:77-95)
```typescript
try {
  // Operation
} catch (err) {
  errors.push({
    code: 'ERROR_CODE',
    message: `Human-readable message: ${formatError(err)}`,
    path: 'yaml.path'
  });
  return { success: false, errors, warnings };
}
```

---

## Required Imports

### Internal (types.ts)
No additional imports needed - types.ts is self-contained

### Internal (compile.ts)
```typescript
// Already imported in compile.ts (line 11-24):
import type {
  SprintDefinition,
  WorkflowDefinition,
  CompiledProgress,
  // ... existing imports
} from './types.js';

// NEW imports to add:
import type {
  OrchestrationConfig,
  SprintPrompts,
  StepQueueItem
} from './types.js';
```

### External
None needed - compile.ts already has all external dependencies (fs, path, js-yaml)

---

## Types/Interfaces to Implement

### 1. OrchestrationConfig (NEW)
```typescript
/**
 * Orchestration configuration for dynamic step injection
 * Enables Claude to propose new steps during execution
 */
export interface OrchestrationConfig {
  /** Enable dynamic step injection */
  enabled: boolean;
  /** Custom orchestration prompt (optional) */
  prompt?: string;
  /** Where to insert proposed steps */
  insertStrategy: 'after-current' | 'end-of-phase' | 'custom';
  /** If true, steps are inserted without orchestration iteration */
  autoApprove: boolean;
}
```

### 2. ProposedStep (NEW)
```typescript
/**
 * A step proposed by Claude via JSON result
 * Part of the proposedSteps array in agent output
 */
export interface ProposedStep {
  /** The task prompt for the proposed step */
  prompt: string;
  /** Why this step is needed */
  reasoning?: string;
  /** Urgency/importance of this step */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Suggested insertion point */
  insertAfter?: string;
}
```

### 3. StepQueueItem (NEW)
```typescript
/**
 * A queued step waiting for orchestration in PROGRESS.yaml
 * Created when agent proposes steps via proposedSteps JSON
 */
export interface StepQueueItem {
  /** Unique identifier for this queue item */
  id: string;
  /** The task prompt */
  prompt: string;
  /** Which step proposed this (step ID) */
  proposedBy: string;
  /** When proposed (ISO timestamp) */
  proposedAt: string;
  /** Why this step was proposed */
  reasoning?: string;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

### 4. SprintPrompts (NEW)
```typescript
/**
 * Customizable runtime prompt templates for sprint execution
 * Allows SPRINT.yaml to override default prompts from build-sprint-prompt.sh
 */
export interface SprintPrompts {
  /** Header shown at top of each prompt */
  header?: string;
  /** Position indicator (phase/step/sub-phase) */
  position?: string;
  /** Warning shown on retry attempts */
  'retry-warning'?: string;
  /** Instructions section */
  instructions?: string;
  /** Result reporting format instructions */
  'result-reporting'?: string;
}
```

### 5. WorkflowDefinition Extension
```typescript
export interface WorkflowDefinition {
  // ... existing fields (name, description, phases, mode, etc.)

  /** Orchestration configuration for dynamic step injection */
  orchestration?: OrchestrationConfig;
}
```

### 6. SprintDefinition Extension
```typescript
export interface SprintDefinition {
  // ... existing fields (workflow, steps, config, goal, etc.)

  /** Custom prompt templates for runtime */
  prompts?: SprintPrompts;
}
```

### 7. CompiledProgress Extension
```typescript
export interface CompiledProgress {
  // ... existing fields

  /** Queue of proposed steps awaiting orchestration */
  'step-queue'?: StepQueueItem[];
}
```

---

## Integration Points

### Called By
- `compile()` function in compile.ts will call new compile functions
- `sprint-loop.sh` will read compiled prompts/orchestration from PROGRESS.yaml
- `build-sprint-prompt.sh` will use SprintPrompts for template substitution

### Calls
- New compile functions will read from SprintDefinition/WorkflowDefinition
- New functions will write to CompiledProgress

### Tests
- `validate.test.ts` - May need new tests for orchestration validation
- Manual compilation test via `npm run build` and `npm run typecheck`

---

## Implementation Notes

1. **Type Ordering**: Place new interfaces after related existing interfaces:
   - `OrchestrationConfig`, `ProposedStep`, `StepQueueItem` after Ralph Mode Types section
   - `SprintPrompts` after `SprintDefinition`

2. **JSDoc Convention**: Every interface and field needs JSDoc comments (see existing patterns)

3. **Hyphenated Keys**: Use quoted keys for YAML-friendly names:
   - `'retry-warning'?: string` (not `retryWarning`)
   - `'step-queue'?: StepQueueItem[]`

4. **Optional Fields**: New fields on existing interfaces MUST be optional to maintain backward compatibility

5. **Default Values**: compile.ts should provide defaults:
   - `orchestration.enabled` defaults to `false`
   - `orchestration.autoApprove` defaults to `false`
   - `orchestration.insertStrategy` defaults to `'after-current'`

6. **No Validation Changes**: Step 1 only adds types, validation comes later

7. **Export All New Interfaces**: All new interfaces must be exported for use in compile.ts

---

## Verification Commands

```bash
# Build TypeScript to JavaScript
cd plugins/m42-sprint/compiler && npm run build

# Type checking only (faster)
cd plugins/m42-sprint/compiler && npm run typecheck

# Run existing tests
cd plugins/m42-sprint/compiler && npm run test
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `plugins/m42-sprint/compiler/src/types.ts` | Add 4 new interfaces, extend 3 existing interfaces |
| `plugins/m42-sprint/compiler/src/compile.ts` | Add `compileOrchestration()` and `compilePrompts()` functions |

---

## Diff Preview: types.ts

**Add after Ralph Mode Types section (~line 91):**
```typescript
// ============================================================================
// Orchestration Types (Unified Loop)
// ============================================================================

export interface OrchestrationConfig { ... }
export interface ProposedStep { ... }
export interface StepQueueItem { ... }
```

**Extend SprintDefinition (~line 150):**
```typescript
  /** Custom prompt templates for runtime */
  prompts?: SprintPrompts;
```

**Add after SprintDefinition (~line 152):**
```typescript
export interface SprintPrompts { ... }
```

**Extend WorkflowDefinition (~line 192):**
```typescript
  /** Orchestration configuration for dynamic step injection */
  orchestration?: OrchestrationConfig;
```

**Extend CompiledProgress (~line 361):**
```typescript
  /** Queue of proposed steps awaiting orchestration */
  'step-queue'?: StepQueueItem[];
```

---

## Diff Preview: compile.ts

**Add import (line 11-25):**
```typescript
import type {
  // ... existing imports
  OrchestrationConfig,
  SprintPrompts,
  StepQueueItem
} from './types.js';
```

**Add helper function (~line 370):**
```typescript
/**
 * Compile orchestration configuration from workflow definition
 */
function compileOrchestration(
  workflow: WorkflowDefinition
): OrchestrationConfig | undefined {
  if (!workflow.orchestration) return undefined;

  return {
    enabled: workflow.orchestration.enabled ?? false,
    prompt: workflow.orchestration.prompt,
    insertStrategy: workflow.orchestration.insertStrategy ?? 'after-current',
    autoApprove: workflow.orchestration.autoApprove ?? false
  };
}

/**
 * Compile prompts configuration from sprint definition
 */
function compilePrompts(
  sprint: SprintDefinition
): SprintPrompts | undefined {
  if (!sprint.prompts) return undefined;
  return { ...sprint.prompts };
}
```

**Integration in compile() function:**
- Call `compileOrchestration()` after loading workflow
- Call `compilePrompts()` after loading sprint
- Add results to CompiledProgress if defined
