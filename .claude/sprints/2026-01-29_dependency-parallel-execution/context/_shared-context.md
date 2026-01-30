# Sprint Context: Dependency-Aware Parallel Execution

## Project Info

- **Test framework**: Custom synchronous/async test runners (no jest/vitest)
- **Test location**: `*.test.ts` files adjacent to source (e.g., `validate.test.ts`, `transition.test.ts`)
- **Build command**: `npm run build` (runs `tsc`)
- **Test command**:
  - Compiler: `npm run test` (in `plugins/m42-sprint/compiler/`)
  - Runtime: `npm run test` (in `plugins/m42-sprint/runtime/`)
- **Lint command**: `npm run lint` (root level)
- **Typecheck command**: `npm run typecheck` (runs `tsc --noEmit`)

## Key File Locations

### Compiler Package (`plugins/m42-sprint/compiler/src/`)
| File | Purpose | Lines |
|------|---------|-------|
| `types.ts` | All type definitions | ~800 |
| `validate.ts` | Validation logic | ~1100 |
| `compile.ts` | Main compilation | ~600 |
| `expand-foreach.ts` | For-each expansion | ~380 |
| `resolve-workflows.ts` | Workflow resolution | ~200 |
| `status-server/transforms.ts` | Dashboard transforms | ~150 |
| `status-server/status-types.ts` | Dashboard types | ~100 |

### Runtime Package (`plugins/m42-sprint/runtime/src/`)
| File | Purpose | Lines |
|------|---------|-------|
| `transition.ts` | State machine (types recopied) | ~600 |
| `loop.ts` | Main execution loop | ~1200 |
| `executor.ts` | Action execution | ~230 |
| `progress-injector.ts` | Dynamic step injection | ~250 |
| `operator.ts` | Operator request handling | ~400 |
| `yaml-ops.ts` | Progress file I/O | ~150 |

## Patterns to Follow

### Type Definitions
Types use discriminated unions and index signatures:
```typescript
export interface CollectionItem {
  prompt: string;
  workflow?: string;
  id?: string;
  model?: ClaudeModel;
  [key: string]: unknown; // Allows custom properties like depends-on
}
```

### Validation Pattern
Validators return `CompilerError[]` arrays:
```typescript
export function validateSomething(item: unknown, path: string): CompilerError[] {
  const errors: CompilerError[] = [];
  // validation logic
  if (invalid) {
    errors.push({ code: 'ERROR_CODE', message: 'description', path });
  }
  return errors;
}
```

### Test Pattern (synchronous)
```typescript
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    process.exitCode = 1;
  }
}
```

### Event System (discriminated unions)
```typescript
export type SprintEvent =
  | { type: 'TICK' }
  | { type: 'STEP_COMPLETE'; stepId: string }
  | { type: 'PROPOSE_STEPS'; steps: ProposedStep[] };
```

### File I/O Pattern
- YAML parsing with `js-yaml`
- Atomic writes with backup/restore
- Checksum validation on read

## Sprint Steps Overview

### Phase 1: Types (`phase-1-types`)
Add `depends-on` support to type system:
- Add `depends-on?: string[]` to `CollectionItem`
- Add `depends-on?: string[]` to `StepQueueItem`
- Add `DependencyNode` interface
- Add `ParallelExecutionConfig` interface
- Implement `validateDependencies()` function

### Phase 2: Compiler (`phase-2-compiler`)
Extend compiler for dependency graph:
- Copy `depends-on` in `expandForEach()`
- Build `dependency-graph` in `PROGRESS.yaml`
- Run validation during compilation

### Phase 3: Scheduler (`phase-3-scheduler`)
Create DAG-based step scheduler:
- New file: `runtime/src/scheduler.ts`
- `StepScheduler` class with graph operations
- `getReadySteps()`, `startStep()`, `completeStep()`, `failStep()`
- Dependency resolution logic

### Phase 4: Injection (`phase-4-injection`)
Extend existing injection system:
- Update `PROPOSE_STEPS` event handling
- Update `ProgressInjector.injectStep()`
- Support dependencies in operator approvals

### Phase 5: Loop Integration (`phase-5-loop`)
Integrate scheduler into main loop:
- Detect parallel execution mode
- Create `StepScheduler` instance
- Implement parallel loop with `Promise.all/race`
- Handle failure policies

### Phase 6: Dashboard (`phase-6-dashboard`)
Add DAG visualization:
- Transform graph for UI
- Show blocked-by information
- Highlight parallel execution progress

## Key Interfaces to Modify/Add

### CollectionItem (add depends-on)
```typescript
export interface CollectionItem {
  prompt: string;
  workflow?: string;
  id?: string;
  model?: ClaudeModel;
  'depends-on'?: string[];  // NEW
  [key: string]: unknown;
}
```

### CompiledStep (add depends-on)
```typescript
export interface CompiledStep {
  id: string;
  prompt: string;
  status: PhaseStatus;
  phases: CompiledPhase[];
  'depends-on'?: string[];  // NEW
  // ...existing fields
}
```

### DependencyNode (new)
```typescript
export interface DependencyNode {
  id: string;
  'depends-on': string[];
  'blocked-by': string[];  // Runtime: remaining unmet deps
  status: 'pending' | 'ready' | 'in-progress' | 'completed' | 'failed' | 'skipped';
}
```

### ParallelExecutionConfig (new)
```typescript
export interface ParallelExecutionConfig {
  enabled: boolean;
  'max-concurrent': number;
  'failure-policy': 'skip-dependents' | 'continue' | 'fail-fast';
}
```

## Dependencies Between Sprint Phases

```
phase-1-types (foundation)
    ↓
phase-2-compiler (depends on types)
    ↓
phase-3-scheduler (can start after types)
    ↓
phase-4-injection (depends on scheduler)
    ↓
phase-5-loop (depends on compiler + scheduler + injection)
    ↓
phase-6-dashboard (depends on loop integration)
```

## Important Notes

1. **ESM Compatibility**: Runtime copies types from compiler to avoid cross-package imports
2. **No External Test Framework**: Use the existing custom test runner pattern
3. **Atomic Operations**: All PROGRESS.yaml writes must be atomic with backup
4. **Discriminated Unions**: Follow existing pattern for new event/action types
5. **Sequential Execution**: This sprint runs sequentially since we're implementing parallel execution itself!
