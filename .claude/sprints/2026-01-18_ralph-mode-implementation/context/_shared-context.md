# Shared Sprint Context

## Project Architecture

The m42-sprint plugin is part of the m42-claude-plugins monorepo, providing autonomous sprint execution capabilities for Claude Code. The plugin consists of three main components:

1. **Compiler** (`plugins/m42-sprint/compiler/`) - TypeScript-based YAML compiler that transforms SPRINT.yaml + workflow definitions into PROGRESS.yaml
2. **Scripts** (`plugins/m42-sprint/scripts/`) - Bash scripts for sprint execution loop and prompt building
3. **Skills/Commands** (`plugins/m42-sprint/skills/`, `commands/`) - Claude Code skills and slash commands

```
plugins/m42-sprint/
├── compiler/
│   ├── src/
│   │   ├── index.ts          # CLI entry point
│   │   ├── compile.ts        # Main compilation logic
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── validate.ts       # Validation rules
│   │   ├── expand-foreach.ts # For-each phase expansion
│   │   └── resolve-workflows.ts # Workflow resolution
│   ├── dist/                 # Compiled output
│   └── package.json
├── scripts/
│   ├── sprint-loop.sh        # Main execution loop
│   ├── build-sprint-prompt.sh # Prompt generation for phases
│   ├── build-parallel-prompt.sh # Parallel task prompts
│   └── preflight-check.sh    # Pre-execution validation
├── skills/
│   ├── orchestrating-sprints/
│   └── creating-workflows/
└── commands/
    ├── start-sprint.md
    ├── resume-sprint.md
    └── ...
```

## Key Patterns

### Workflow-Based Execution
- SPRINT.yaml references a workflow from `.claude/workflows/`
- Workflows define phases (simple prompts or for-each iterations)
- Compiler merges workflow + sprint into compiled PROGRESS.yaml

### Hierarchical Phase Structure
- Top-level phases (preflight, development, final-qa, etc.)
- For-each phases expand into steps (one per SPRINT.yaml step)
- Steps contain sub-phases (from referenced step workflow)

### Current Pointer Navigation
- PROGRESS.yaml has a `current` object with `phase`, `step`, `sub-phase` indices
- Sprint loop reads current position, builds prompt, executes Claude
- Claude advances the pointer after completing each phase

### Status State Machine
- Sprint: `not-started` → `in-progress` → `completed` | `blocked` | `paused` | `needs-human`
- Phase: `pending` → `in-progress` → `completed` | `blocked` | `skipped`

## Conventions

### Naming
- YAML files use kebab-case (`sprint-default.yaml`, `feature-standard.yaml`)
- TypeScript interfaces use PascalCase (`SprintDefinition`, `CompiledProgress`)
- Script functions use snake_case (`run_standard_loop`, `spawn_parallel_task`)
- Phase/step IDs use kebab-case (`preflight`, `step-0`, `final-qa`)

### File Structure
- Workflows in `.claude/workflows/`
- Sprint definitions in `.claude/sprints/<sprint-id>/`
- Compiled progress as `PROGRESS.yaml` in sprint directory
- Context files in `context/` subdirectory
- Artifacts in `artifacts/` subdirectory
- Transcripts in `transcripts/` subdirectory

### Testing
- No formal test framework currently in use for bash scripts
- TypeScript uses `npm run build && node dist/validate.test.js`
- Validation via shellcheck for bash scripts

### Error Handling
- TypeScript: Return `CompilerResult` with errors array
- Bash: Exit codes (0=success, 1=blocked, 2=needs-human)
- Error classification: network, rate-limit, timeout, validation, logic

## Commands

- Build: `cd plugins/m42-sprint/compiler && npm run build`
- Test: `cd plugins/m42-sprint/compiler && npm run test`
- Lint: `shellcheck plugins/m42-sprint/scripts/*.sh`
- TypeCheck: `cd plugins/m42-sprint/compiler && npm run build` (tsc)

## Dependencies

### Internal Modules
- `types.ts`: All TypeScript interfaces for sprint/workflow/progress
- `validate.ts`: Validation functions for each schema type
- `resolve-workflows.ts`: Workflow loading and cycle detection
- `expand-foreach.ts`: For-each phase expansion logic

### External Packages
- `js-yaml`: YAML parsing and serialization
- `commander`: CLI argument parsing
- `yq`: YAML manipulation in bash scripts (external binary)

## Types and Interfaces

### Key Compiler Types (from `types.ts`)

```typescript
// Input: SPRINT.yaml
interface SprintDefinition {
  workflow: string;
  steps: SprintStep[];
  'sprint-id'?: string;
  config?: { 'max-tasks'?: number; 'time-box'?: string; 'auto-commit'?: boolean };
  retry?: RetryConfig;
}

// Input: workflow.yaml
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
  parallel?: boolean;
  'wait-for-parallel'?: boolean;
}

// Output: PROGRESS.yaml
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  'parallel-tasks'?: ParallelTask[];
}
```

### Status Enums

```typescript
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
```

## Sprint Loop Execution Flow

1. `sprint-loop.sh` reads PROGRESS.yaml
2. Calls `build-sprint-prompt.sh` with sprint directory and iteration
3. Prompt builder reads current pointer, generates phase-specific prompt
4. Claude executes, advances pointer via yq commands
5. Loop detects status changes, continues or exits

## Key Files for Ralph Mode Implementation

| File | Changes Needed |
|------|----------------|
| `compiler/src/types.ts` | Add Ralph mode interfaces |
| `compiler/src/compile.ts` | Ralph mode detection, PROGRESS generation |
| `scripts/sprint-loop.sh` | `run_ralph_loop()` function |
| `scripts/build-ralph-prompt.sh` | NEW: Ralph prompt builder |
| `.claude/workflows/ralph.yaml` | NEW: Ralph workflow definition |
