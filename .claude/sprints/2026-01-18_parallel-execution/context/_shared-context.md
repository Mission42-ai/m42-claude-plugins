# Shared Sprint Context

## Project Architecture

The m42-sprint plugin is a Claude Code extension that enables autonomous sprint execution through a "Ralph Loop" pattern - a dumb bash loop that invokes Claude with fresh context for each task, using YAML-based state tracking.

### Core Components

```
plugins/m42-sprint/
├── compiler/           # TypeScript compiler for SPRINT.yaml → PROGRESS.yaml
│   └── src/
│       ├── types.ts           # Type definitions (WorkflowPhase, CompiledProgress, etc.)
│       ├── compile.ts         # Main compilation orchestration
│       ├── expand-foreach.ts  # For-each phase expansion
│       ├── validate.ts        # Schema validation
│       └── resolve-workflows.ts  # Workflow resolution and loading
├── scripts/            # Bash scripts for runtime execution
│   ├── sprint-loop.sh         # Main execution loop
│   ├── build-sprint-prompt.sh # Prompt generation for each iteration
│   └── preflight-check.sh     # Pre-execution validation
├── commands/           # Slash command definitions
│   ├── run-sprint.md
│   ├── sprint-status.md
│   └── ...
└── skills/             # Reference documentation and guides
    ├── creating-workflows/
    └── orchestrating-sprints/
```

### Data Flow

```
SPRINT.yaml     →     Compiler     →     PROGRESS.yaml     →     Sprint Loop
(user input)    (TypeScript)        (runtime state)          (bash)
                      ↓
             .claude/workflows/*.yaml
             (workflow definitions)
```

## Key Patterns

- **Pointer-based navigation**: `current.phase`, `current.step`, `current.sub-phase` tracks execution position
- **Hierarchical phases**: TopPhase → Step → SubPhase (for for-each phases)
- **Status state machine**: `pending` → `in-progress` → `completed|blocked|skipped|failed`
- **Template substitution**: `{{step.prompt}}`, `{{step.id}}`, `{{sprint.id}}` in prompts
- **Fresh context per task**: Each iteration spawns new Claude process with just the current task

## Conventions

### Naming

- **Type interfaces**: PascalCase (e.g., `CompiledPhase`, `WorkflowPhase`)
- **YAML properties**: kebab-case (e.g., `sprint-id`, `for-each`, `parallel-tasks`)
- **File names**: kebab-case for scripts/workflows
- **Phase IDs**: kebab-case (e.g., `update-docs`, `wait-for-parallel`)

### File Structure

- TypeScript source in `compiler/src/`
- Compiled JS output in `compiler/dist/`
- Shell scripts in `scripts/`
- YAML schemas use optional properties with `?` suffix in documentation

### Testing

- No formal test framework currently
- Verification through manual sprint execution
- Integration testing via test sprint definitions

### Error Handling

- Compiler errors collected in `CompilerError[]` array
- Sprint loop uses exit codes (0=success/paused, 1=blocked, 2=needs-human)
- Error classification: network, rate-limit, timeout, validation, logic
- Retry logic with exponential backoff for transient errors

## Commands

- Build compiler: `cd plugins/m42-sprint/compiler && npm run build`
- Run compiler: `node plugins/m42-sprint/compiler/dist/cli.js <sprint-dir>`
- TypeCheck: `cd plugins/m42-sprint/compiler && npm run typecheck`
- No lint configured for this plugin

## Dependencies

### Internal Modules

- `types.ts`: Core type definitions used by all compiler modules
- `expand-foreach.ts`: Step expansion and template substitution
- `validate.ts`: Schema validation functions
- `resolve-workflows.ts`: Workflow file loading and cycle detection

### External Packages

- `js-yaml`: YAML parsing (with `YAMLException` for error handling)
- `commander`: CLI argument parsing
- `yq`: YAML manipulation in bash scripts (runtime dependency)

## Types and Interfaces

### Key Types for This Sprint

```typescript
// Workflow phase definition - will add parallel and wait-for-parallel
export interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  // NEW: parallel?: boolean;
  // NEW: 'wait-for-parallel'?: boolean;
}

// Compiled sub-phase - will add parallel and parallel-task-id
export interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  // NEW: parallel?: boolean;
  // NEW: 'parallel-task-id'?: string;
}

// Top-level compiled phase - will add wait-for-parallel
export interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;
  steps?: CompiledStep[];
  // NEW: 'wait-for-parallel'?: boolean;
}

// Runtime progress - will add parallel-tasks array
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  // NEW: 'parallel-tasks'?: ParallelTask[];
}

// NEW: Track background parallel tasks
export interface ParallelTask {
  id: string;
  'step-id': string;
  'phase-id': string;
  status: 'spawned' | 'running' | 'completed' | 'failed';
  pid?: number;
  'log-file'?: string;
  'spawned-at': string;
  'completed-at'?: string;
  'exit-code'?: number;
  error?: string;
}
```

## Key Line References

For precise edits, reference these line numbers in the source files:

| File | Lines | Content |
|------|-------|---------|
| `types.ts` | 68-77 | `WorkflowPhase` interface |
| `types.ts` | 101-119 | `CompiledPhase` interface |
| `types.ts` | 148-168 | `CompiledTopPhase` interface |
| `types.ts` | 202-211 | `CompiledProgress` interface |
| `expand-foreach.ts` | 84-130 | `expandStep()` function |
| `expand-foreach.ts` | 117-121 | CompiledPhase object creation |
| `compile.ts` | 209 | CompiledProgress object creation |
| `validate.ts` | 174-235 | `validateWorkflowPhase()` function |
