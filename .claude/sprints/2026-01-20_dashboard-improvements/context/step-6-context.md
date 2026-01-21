# Step Context: step-6

## Task
Implement dynamic step injection into running sprints.

## Overview
Allow adding steps to PROGRESS.yaml at runtime:
- Add single steps to a specific position
- Compile a workflow to add multiple steps
- Choose insertion point (after current, end of phase, specific position)

This is required for the operator and suggested-steps features.

## Implementation Plan
Based on gherkin scenarios, implement in this order:
1. Create `progress-injector.ts` with `ProgressInjector` class
2. Implement `injectStep()` for single step injection
3. Implement position resolution (`resolvePosition()`) for all position types
4. Implement `updateStats()` to recalculate phase counts
5. Implement `injectWorkflow()` for workflow-based injection
6. Add injected phase metadata (`injected: true`, `injected-at` timestamp)
7. Integrate with yaml-ops for atomic file operations

---

## Related Code Patterns

### Pattern from: runtime/src/yaml-ops.ts - Atomic YAML Write
```typescript
export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void> {
  const content = yaml.dump(progress, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  const tempPath = getTempPath(filePath);
  const checksumPath = getChecksumPath(filePath);

  try {
    // Write to temp file first
    await fs.promises.writeFile(tempPath, content, 'utf8');
    // Atomic rename (atomic on POSIX)
    await fs.promises.rename(tempPath, filePath);
    // Calculate and write checksum
    const checksum = calculateChecksum(content);
    await fs.promises.writeFile(checksumPath, checksum, 'utf8');
  } finally {
    // Clean up temp file if it still exists
    try {
      await fs.promises.access(tempPath);
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
```

### Pattern from: runtime/src/operator.ts - InsertPosition Type (Local)
```typescript
export interface InsertPosition {
  type: 'after-current' | 'end-of-phase';
}
```
Note: progress-injector will define a richer InsertPosition type with additional options.

### Pattern from: compiler/src/compile.ts - Stats Calculation
```typescript
function calculateStats(phases: CompiledTopPhase[]): SprintStats {
  let totalPhases = 0;
  let totalSteps = 0;

  for (const phase of phases) {
    totalPhases++;
    if (phase.steps) {
      totalSteps += phase.steps.length;
      // Count sub-phases within steps
      for (const step of phase.steps) {
        totalPhases += step.phases.length;
      }
    }
  }

  return {
    'started-at': null,
    'total-phases': totalPhases,
    'completed-phases': 0,
    'total-steps': totalSteps > 0 ? totalSteps : undefined,
    'completed-steps': totalSteps > 0 ? 0 : undefined
  };
}
```

### Pattern from: compiler/src/resolve-workflows.ts - Workflow Loading
```typescript
export function loadWorkflow(
  name: string,
  workflowsDir: string,
  errors?: CompilerError[]
): LoadedWorkflow | null {
  // Try to find the workflow file
  const possiblePaths = [
    path.join(workflowsDir, `${name}.yaml`),
    path.join(workflowsDir, `${name}.yml`),
    path.join(workflowsDir, name) // In case full filename is provided
  ];

  let workflowPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      workflowPath = p;
      break;
    }
  }

  if (!workflowPath) {
    return null;
  }

  // Load and parse the workflow
  const content = fs.readFileSync(workflowPath, 'utf8');
  const definition = yaml.load(content) as WorkflowDefinition;
  return { definition, path: workflowPath };
}
```

### Pattern from: runtime/src/progress-injector.test.ts - Test Utilities
```typescript
function test(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve()
    .then(() => fn())
    .then(() => console.log(`✓ ${name}`))
    .catch((error) => {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function assertThrows(fn: () => Promise<void>, messageContains: string): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected function to throw, but it didn't`);
  } catch (error) {
    if (error instanceof Error && !error.message.includes(messageContains)) {
      throw new Error(`Expected error to contain "${messageContains}", got: ${error.message}`);
    }
  }
}
```

---

## Required Imports

### Internal (from runtime package)
- `yaml-ops.js`: `readProgress`, `writeProgressAtomic`, `backupProgress`, `cleanupBackup`, `calculateChecksum`
- No need to import from compiler package at runtime (avoid circular deps)

### External
- `fs` (Node.js built-in): File system operations
- `path` (Node.js built-in): Path manipulation
- `js-yaml`: YAML parsing for workflow files (`yaml.load`)

---

## Types/Interfaces to Define

```typescript
// Position types for step injection
export type InsertPosition =
  | { type: 'after-current' }                    // After currently executing step
  | { type: 'after-step'; stepId: string }      // After specific step
  | { type: 'end-of-phase'; phaseId: string }   // At end of specific phase
  | { type: 'end-of-workflow' }                 // At very end
  | { type: 'before-step'; stepId: string };    // Before specific step

// Single step injection request
export interface StepInjection {
  step: {
    id: string;
    prompt: string;
    model?: string;
  };
  position: InsertPosition;
}

// Workflow injection request
export interface WorkflowInjection {
  workflow: string;           // Workflow name to compile
  context?: {                 // Context for the workflow
    step?: { prompt: string; id: string };
    variables?: Record<string, any>;
  };
  position: InsertPosition;
  idPrefix: string;           // Prefix for generated phase IDs
}

// Injected phase marker (extends CompiledTopPhase)
export interface InjectedPhase {
  id: string;
  status: 'pending';
  prompt: string;
  injected: true;
  'injected-at': string;
  model?: string;
}
```

---

## Types/Interfaces to Use (from existing code)

### From compiler/src/types.ts
```typescript
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type ClaudeModel = 'sonnet' | 'opus' | 'haiku';

export interface CurrentPointer {
  phase: number;
  step: number | null;
  'sub-phase': number | null;
}

export interface SprintStats {
  'started-at': string | null;
  'completed-at'?: string | null;
  'total-phases': number;
  'completed-phases': number;
  'total-steps'?: number;
  'completed-steps'?: number;
  elapsed?: string;
}

export interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;
  steps?: CompiledStep[];
  model?: ClaudeModel;
  // ... other optional fields
}
```

### From runtime/src/yaml-ops.ts (local types)
```typescript
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  current: CurrentPointer;
  stats: SprintStats;
  phases?: unknown[];
  [key: string]: unknown;
}
```

---

## Integration Points

### Called by:
- `runtime/src/loop.ts` - Main execution loop will call injector after operator decisions
- `runtime/src/operator.ts` - After processing operator requests with 'approve' decisions
- Future: CLI command for manual injection

### Calls:
- `yaml-ops.js` - For reading/writing PROGRESS.yaml atomically
- `js-yaml` - For loading workflow YAML files

### Flow:
1. Operator/loop detects need for injection
2. Creates `ProgressInjector` with progress path
3. Calls `injectStep()` or `injectWorkflow()`
4. Injector reads PROGRESS.yaml, modifies, writes atomically
5. Loop continues execution (picks up new phases)

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `runtime/src/progress-injector.ts` | Create | Main injection logic class |
| `runtime/src/progress-injector.test.ts` | Already exists | Tests already written (RED phase) |

### Files to Potentially Modify Later (not in this step):
| File | Action | Purpose |
|------|--------|---------|
| `runtime/src/loop.ts` | Modify | Integrate injector for operator decisions |
| `runtime/src/cli.ts` | Modify | Add inject-step command |
| `compiler/src/status-server/page.ts` | Modify | Show injected badge on dashboard |
| `compiler/src/status-server/transforms.ts` | Modify | Include injection info in display |

---

## Error Handling Patterns

### File Not Found
```typescript
// Let fs.readFileSync throw ENOENT naturally
// Test expects: error.message.includes('ENOENT')
```

### Step Not Found
```typescript
private findStepIndex(progress: CompiledProgress, stepId: string): number {
  const phases = progress.phases ?? [];
  const index = phases.findIndex(p => p.id === stepId);
  if (index === -1) {
    throw new Error(`Step not found: ${stepId}`);
  }
  return index;
}
```

### Workflow Not Found
```typescript
async injectWorkflow(injection: WorkflowInjection): Promise<void> {
  const workflowPath = this.findWorkflowPath(injection.workflow);
  if (!workflowPath) {
    throw new Error(`Workflow not found: ${injection.workflow}`);
  }
  // ...
}
```

---

## Key Implementation Details

### 1. Position Resolution Logic
```typescript
private resolvePosition(progress: CompiledProgress, pos: InsertPosition): number {
  switch (pos.type) {
    case 'after-current':
      return progress.current.phase + 1;
    case 'after-step':
      return this.findStepIndex(progress, pos.stepId) + 1;
    case 'before-step':
      return this.findStepIndex(progress, pos.stepId);
    case 'end-of-workflow':
      return (progress.phases ?? []).length;
    // Note: 'end-of-phase' is only used for nested steps, not top-level
    default:
      throw new Error(`Unknown position type: ${(pos as any).type}`);
  }
}
```

### 2. Stats Recalculation (simpler than compiler since we only inject top-level phases)
```typescript
private updateStats(progress: CompiledProgress): void {
  const phases = progress.phases ?? [];
  let totalPhases = 0;
  let completedPhases = 0;

  for (const phase of phases) {
    if ((phase as any).steps) {
      // For-each phase: count all sub-phases
      for (const step of (phase as any).steps) {
        totalPhases += step.phases.length;
        for (const subPhase of step.phases) {
          if (subPhase.status === 'completed') completedPhases++;
        }
      }
    } else {
      // Simple phase
      totalPhases++;
      if ((phase as any).status === 'completed') completedPhases++;
    }
  }

  progress.stats['total-phases'] = totalPhases;
  progress.stats['completed-phases'] = completedPhases;
}
```

### 3. Workflow Loading (simplified, no compilation)
For workflow injection, we load the workflow YAML and extract phases directly (no full compilation needed since we're injecting at runtime, not re-compiling).

```typescript
private async loadWorkflowPhases(workflowName: string): Promise<{ id: string; prompt: string; model?: string }[]> {
  const workflowPath = this.findWorkflowPath(workflowName);
  if (!workflowPath) {
    throw new Error(`Workflow not found: ${workflowName}`);
  }

  const content = fs.readFileSync(workflowPath, 'utf8');
  const workflow = yaml.load(content) as { phases?: { id: string; prompt?: string; model?: string }[] };

  return (workflow.phases ?? [])
    .filter(p => p.prompt) // Only phases with prompts
    .map(p => ({ id: p.id, prompt: p.prompt!, model: p.model }));
}
```

---

## Verification Commands

```bash
# Build runtime
cd plugins/m42-sprint/runtime && npm run build

# Run tests (should pass after implementation)
node dist/progress-injector.test.js

# Verify specific scenarios
node dist/progress-injector.test.js 2>&1 | grep "✓"

# Expected output after GREEN phase:
# ✓ ProgressInjector: can be instantiated with progress path
# ✓ injectStep: inserts at after-current position
# ✓ injectStep: inserts at end-of-workflow position
# ✓ injectStep: inserts at after-step position
# ✓ injectStep: inserts at before-step position
# ✓ resolvePosition: throws for non-existent step
# ✓ resolvePosition: handles empty phases array
# ✓ injectWorkflow: injects compiled workflow phases
# ✓ injectWorkflow: throws for non-existent workflow
# ✓ updateStats: recalculates stats after injection
# ... (17 total tests)
```
