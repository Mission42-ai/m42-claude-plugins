# Sprint Context

## Project Info
- **Test framework**: Custom test harness (no external framework)
- **Test location**: `*.test.ts` files alongside source (co-located)
- **Build command**: `npm run build` (runs `tsc`)
- **Test command**: `npm run build && node dist/<file>.test.js` (sequential)
- **Lint command**: `npm run lint` (if available), `npm run typecheck` for type checking

## Package Locations
- **Compiler**: `plugins/m42-sprint/compiler/` - Sprint compilation (SPRINT.yaml → PROGRESS.yaml)
- **Runtime**: `plugins/m42-sprint/runtime/` - Sprint execution engine
- **Commands**: `plugins/m42-sprint/commands/` - CLI command definitions (markdown)

## Patterns to Follow

### TypeScript Compilation Pattern
- Source files in `src/` directory
- Compiled output in `dist/` directory
- ES modules (`"type": "module"` in package.json)
- TypeScript 5.3.0

### Test Pattern
Custom test harness - each test file is self-contained:
```typescript
function test(name: string, fn: () => void | Promise<void>): void {
  testQueue.push({ name, fn });
  if (!testsStarted) {
    testsStarted = true;
    setImmediate(runTests);
  }
}

test('should do something', () => {
  // assertions
});
```

### Type Pattern - Discriminated Unions
Types use discriminated unions for type-safe state handling:
```typescript
export type SprintState =
  | { status: 'not-started' }
  | { status: 'in-progress'; currentPhase: string }
  | { status: 'completed' };
```

### Validation Pattern
`validate.ts` exports validation functions that return `{ valid: boolean, errors: string[] }`:
```typescript
export function validateSprintDefinition(yaml: unknown): ValidationResult {
  const errors: string[] = [];
  // validation logic
  return { valid: errors.length === 0, errors };
}
```

## Sprint Steps Overview

### Step 1: worktree-config-inheritance
**Problem**: Workflow worktree config (`worktree.enabled: true`) is ignored by `run-sprint`.

**Key Files**:
- `plugins/m42-sprint/commands/run-sprint.md` - Command that needs to load workflow config
- `plugins/m42-sprint/compiler/src/types.ts` - Add worktree extraction interfaces
- `plugins/m42-sprint/runtime/src/worktree.ts` - Existing worktree creation (21KB)

**Test Cases**:
1. `extractWorktreeConfig` - extracts worktree config from workflow
2. `shouldCreateWorktree` - returns true when workflow has worktree.enabled
3. Integration: workflow worktree config flows to sprint resolution

**Existing Code to Build On**:
- `WorktreeConfig` interface already exists in types.ts
- `createWorktree()` function exists in runtime/src/worktree.ts
- `WorkflowWorktreeDefaults` exists for workflow-level defaults

### Step 2: remove-activity-hook
**Problem**: `run-sprint` mutates `.claude/settings.json` with activity hooks, causing conflicts.

**Key Files to Modify**:
- `plugins/m42-sprint/commands/run-sprint.md` - Remove hook registration
- `plugins/m42-sprint/hooks/sprint-activity-hook.sh` - DELETE this file
- `plugins/m42-sprint/runtime/src/cli.ts` - Remove `--hook-config` option

**Files to Skip**:
- Status server can remain unchanged (already has PROGRESS.yaml watching)

### Step 3: human-breakpoints
**Problem**: No way to pause sprint execution for human review.

**Key Files**:
- `plugins/m42-sprint/compiler/src/types.ts` - Add `break?: boolean` to Phase interface
- `plugins/m42-sprint/compiler/src/validate.ts` - Validate break is boolean
- `plugins/m42-sprint/runtime/src/loop.ts` - Check phase.break after completion
- `plugins/m42-sprint/commands/resume-sprint.md` - Handle `paused-at-breakpoint` status

**New Status**: `paused-at-breakpoint` in SprintState discriminated union

### Step 4: quality-gates
**Problem**: No validation scripts at sprint checkpoints.

**Key Interfaces to Add** (types.ts):
```typescript
interface GateCheck {
  script: string;
  'on-fail': {
    prompt: string;
    'max-retries'?: number;  // default 3
  };
}
```

**Key Files**:
- `plugins/m42-sprint/compiler/src/types.ts` - Add GateCheck interface
- `plugins/m42-sprint/compiler/src/validate.ts` - Validate gate config
- `plugins/m42-sprint/runtime/src/loop.ts` - Execute gate scripts, handle retry loop

**PROGRESS.yaml additions**:
- `gate-attempts: number`
- `gate-status: 'retrying' | 'passed' | 'failed' | 'blocked'`

## Dependencies Between Steps

```
worktree-config-inheritance (independent)
         ↓
remove-activity-hook (independent, but logically after first)
         ↓
human-breakpoints (independent - new feature)
         ↓
quality-gates (independent - new feature, builds on same files as breakpoints)
```

All steps modify `types.ts` and `validate.ts`, so they should be done sequentially to avoid conflicts.

## Key Existing Interfaces (Reference)

### WorkflowPhase (types.ts:483-499)
```typescript
export interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: string;
  collection?: string;
  workflow?: string;
  parallel?: boolean;
  'wait-for-parallel'?: boolean;
  model?: string;
}
```

### WorktreeConfig (types.ts)
```typescript
export interface WorktreeConfig {
  enabled?: boolean;
  'branch-prefix'?: string;
  'path-prefix'?: string;
  cleanup?: 'never' | 'on-complete' | 'on-merge';
}
```

### SprintState (types.ts:35-64)
Discriminated union with states:
- `not-started`
- `in-progress`
- `paused`
- `blocked`
- `needs-human`
- `completed`

Add `paused-at-breakpoint` for Step 3.
