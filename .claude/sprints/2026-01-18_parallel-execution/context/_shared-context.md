# Shared Sprint Context

## Project Architecture

The m42-sprint plugin is a Claude Code plugin for automated sprint workflow execution. It consists of:

1. **Compiler (TypeScript)**: Compiles SPRINT.yaml + workflow definitions into PROGRESS.yaml
   - Location: `plugins/m42-sprint/compiler/src/`
   - Entry point: `index.ts`
   - Core modules: types.ts, compile.ts, expand-foreach.ts, validate.ts

2. **Scripts (Bash)**: Runtime execution of compiled workflows
   - Location: `plugins/m42-sprint/scripts/`
   - Main loop: `sprint-loop.sh`
   - Prompt builder: `build-sprint-prompt.sh`

3. **Workflows (YAML)**: Reusable workflow templates
   - Location: `.claude/workflows/`
   - Main workflow for this project: `gherkin-step-workflow.yaml`

4. **Sprint Data**: Per-sprint runtime data
   - Location: `.claude/sprints/<sprint-id>/`
   - Contains: PROGRESS.yaml, context/, artifacts/, logs/, transcripts/

## Key Patterns

- **Type-first Design**: All data structures defined in `types.ts`, used throughout
- **Phase Expansion**: WorkflowPhase -> CompiledTopPhase/CompiledStep/CompiledPhase hierarchy
- **Template Variables**: `{{step.prompt}}`, `{{step.id}}`, `{{sprint.id}}` substituted during compilation
- **yq for YAML manipulation**: Runtime uses `yq` CLI tool for PROGRESS.yaml updates
- **Exit code semantics**: Scripts use specific exit codes (0=success/complete, 1=blocked, 2=needs-human)

## Conventions

- **Naming**:
  - TypeScript: PascalCase for types/interfaces, camelCase for functions
  - Bash: SCREAMING_SNAKE_CASE for constants, snake_case for variables
  - YAML keys: kebab-case (e.g., `sprint-id`, `for-each`, `sub-phase`)

- **File structure**:
  - Compiler source in `compiler/src/`
  - Compiled output in `compiler/dist/`
  - Scripts in `scripts/`
  - Tests co-located with source (`.test.ts`)

- **Testing**:
  - TypeScript: Simple test file `validate.test.ts`, run via `npm test`
  - Bash: Manual testing via sprint execution

- **Error handling**:
  - TypeScript: Return `CompilerError[]` arrays, never throw
  - Bash: `set -euo pipefail`, explicit exit codes

## Commands

- **Build**: `cd plugins/m42-sprint/compiler && npm run build`
- **Test**: `cd plugins/m42-sprint/compiler && npm test`
- **TypeCheck**: `cd plugins/m42-sprint/compiler && npx tsc --noEmit`
- **Clean**: `cd plugins/m42-sprint/compiler && npm run clean`

## Dependencies

### Internal Modules
- `types.ts`: All TypeScript interfaces (SprintDefinition, WorkflowPhase, CompiledProgress, etc.)
- `expand-foreach.ts`: Template substitution and step expansion
- `compile.ts`: Main compilation orchestration
- `validate.ts`: Schema validation for YAML files
- `resolve-workflows.ts`: Workflow file loading and reference resolution

### External Packages
- `js-yaml`: YAML parsing and serialization
- `commander`: CLI argument parsing
- `yq` (CLI): YAML manipulation in bash scripts

## Types and Interfaces

### Core Types (from types.ts)

```typescript
// Workflow phase definition (input)
interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  // NEW: parallel execution properties to add
  parallel?: boolean;
  'wait-for-parallel'?: boolean;
}

// Compiled phase (leaf node in hierarchy)
interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  // timing, error, retry fields...
  // NEW: parallel execution properties to add
  parallel?: boolean;
  'parallel-task-id'?: string;
}

// Compiled top-level phase
interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;
  steps?: CompiledStep[];
  // NEW: wait-for-parallel property to add
  'wait-for-parallel'?: boolean;
}

// Compiled progress (runtime format)
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  // NEW: parallel-tasks array to add
  'parallel-tasks'?: ParallelTask[];
}

// NEW: Parallel task tracking
interface ParallelTask {
  id: string;
  'step-id': string;
  'phase-id': string;
  status: 'spawned' | 'running' | 'completed' | 'failed';
  pid?: number;
  'log-file'?: string;
  'spawned-at'?: string;
  'completed-at'?: string;
  'exit-code'?: number;
  error?: string;
}
```

### Status Types
```typescript
type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
```

## Sprint Files Reference

- **PROGRESS.yaml**: Compiled runtime state with current pointer and phase statuses
- **context/_shared-context.md**: This file - project-wide patterns
- **context/sprint-plan.md**: Sprint goals, step breakdown, dependencies
- **context/step-N-context.md**: Per-step implementation context
- **artifacts/step-N-gherkin.md**: Per-step verification scenarios
- **artifacts/step-N-qa-report.md**: Per-step QA results
- **logs/**: Execution logs per phase
- **transcripts/**: JSON conversation transcripts per phase
