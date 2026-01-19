# Shared Sprint Context: Unified Sprint Loop

## Project Architecture

The m42-sprint plugin provides sprint-based workflow execution for Claude Code with:
- **Compiler** (TypeScript): Compiles SPRINT.yaml → PROGRESS.yaml
- **Runtime** (Bash): Executes iterations through sprint-loop.sh
- **Workflows** (YAML): Define phase sequences (gherkin-verified-execution, etc.)

```
plugins/m42-sprint/
├── compiler/          # TypeScript compiler
│   └── src/
│       ├── types.ts       # Core type definitions
│       ├── compile.ts     # Main compilation logic
│       ├── validate.ts    # Validation functions
│       └── expand-foreach.ts
├── scripts/           # Bash runtime
│   ├── sprint-loop.sh     # Main execution loop (~2100 lines)
│   ├── build-sprint-prompt.sh    # Standard mode prompts
│   └── build-ralph-prompt.sh     # Ralph mode prompts (TO DELETE)
├── skills/            # Skill definitions
└── commands/          # Command definitions
```

## Key Patterns

### 1. YAML Schema Pattern
- **SPRINT.yaml**: User configuration (steps, workflow reference, config)
- **PROGRESS.yaml**: Runtime state (compiled phases, status, current pointer)
- **Workflow YAML**: Reusable phase templates in `.claude/workflows/`

### 2. Fresh Context Execution
Each sprint iteration spawns a new Claude session:
```bash
claude -p "$PROMPT" --dangerously-skip-permissions ...
```
State persists ONLY via PROGRESS.yaml modifications.

### 3. JSON Result Protocol
Agents report results via JSON in their output:
```json
{"status": "completed|failed|needs-human", "summary": "..."}
```
Sprint-loop.sh parses this JSON to update PROGRESS.yaml.

### 4. Atomic YAML Updates
Uses `yaml_atomic_update()` function to ensure transactional updates to PROGRESS.yaml.

### 5. For-Each Expansion
Workflows can iterate over steps:
```yaml
phases:
  - id: development
    for-each: step
    workflow: gherkin-step-workflow
```
Compiler expands this into concrete phases for each step.

## Conventions

### Naming
- Step IDs: lowercase with hyphens (e.g., `foundation`, `ralph-cleanup`)
- Phase IDs: lowercase with hyphens (e.g., `preflight`, `final-qa`)
- TypeScript: PascalCase for interfaces, camelCase for functions

### File Structure
- Context files: `context/*.md`
- Artifacts: `artifacts/*.md`
- TypeScript source: `compiler/src/*.ts`
- Bash scripts: `scripts/*.sh`

### Testing
- TypeScript: `npm test` in compiler directory
- Bash: Manual execution with `--max-iterations 1`

### Error Handling
- TypeScript: Return `CompilerError[]` arrays
- Bash: Exit codes (0=success, 1=blocked, 2=human-needed)
- JSON: `"status": "failed"` with `"error"` field

## Commands

```bash
# TypeScript Compiler
cd plugins/m42-sprint/compiler
npm run build      # Compile TypeScript to JavaScript
npm run typecheck  # Check types without emitting
npm run test       # Run validation tests

# Sprint Execution
./plugins/m42-sprint/scripts/sprint-loop.sh <sprint-dir> --max-iterations N

# Compile SPRINT.yaml to PROGRESS.yaml
node plugins/m42-sprint/compiler/dist/index.js compile <sprint-dir>
```

## Dependencies

### Internal Modules
- `types.ts`: All interfaces (SprintDefinition, WorkflowDefinition, CompiledProgress, etc.)
- `compile.ts`: Main compile() function, compileRalphMode() (to be removed)
- `validate.ts`: Validation functions for schemas
- `expand-foreach.ts`: For-each phase expansion logic

### External Packages (Compiler)
- `js-yaml`: YAML parsing
- `commander`: CLI argument parsing

### System Dependencies (Runtime)
- `yq`: YAML manipulation in bash
- `jq`: JSON parsing in bash
- `claude`: Claude Code CLI

## Types and Interfaces

### Core Types (from types.ts)
```typescript
// Status enums
type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

// Sprint Definition (SPRINT.yaml)
interface SprintDefinition {
  workflow: string;
  steps?: SprintStep[];
  'sprint-id'?: string;
  name?: string;
  config?: { ... };
  // Ralph-specific (to be removed):
  goal?: string;
  'per-iteration-hooks'?: Record<string, { enabled: boolean }>;
}

// Workflow Definition (*.yaml in workflows/)
interface WorkflowDefinition {
  name: string;
  description?: string;
  phases?: WorkflowPhase[];
  mode?: 'standard' | 'ralph';  // 'ralph' to be removed
  // Ralph-specific fields (to be removed)
}

// Compiled Progress (PROGRESS.yaml runtime state)
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases?: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  // Ralph-specific (to be removed):
  mode?: 'standard' | 'ralph';
  goal?: string;
  'dynamic-steps'?: DynamicStep[];
}
```

### New Types (to be added in this sprint)
```typescript
// Orchestration Configuration
interface OrchestrationConfig {
  enabled: boolean;
  prompt?: string;
  insertStrategy: 'after-current' | 'end-of-phase' | 'custom';
  autoApprove: boolean;
}

// Proposed Step (from agent JSON output)
interface ProposedStep {
  prompt: string;
  reasoning?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  insertAfter?: string;
}

// Step Queue Item (in PROGRESS.yaml)
interface StepQueueItem {
  id: string;
  prompt: string;
  proposedBy: string;
  proposedAt: string;
  reasoning?: string;
  priority: string;
}

// Configurable Prompts (in SPRINT.yaml)
interface SprintPrompts {
  header?: string;
  position?: string;
  'retry-warning'?: string;
  instructions?: string;
  'result-reporting'?: string;
}
```

## Files to Modify/Delete

### Step 1: Foundation
- **Modify**: `plugins/m42-sprint/compiler/src/types.ts`
- **Modify**: `plugins/m42-sprint/compiler/src/compile.ts`

### Step 2: Ralph Cleanup
- **Modify**: `plugins/m42-sprint/scripts/sprint-loop.sh`
- **Delete**: `plugins/m42-sprint/scripts/build-ralph-prompt.sh`
- **Delete**: `.claude/workflows/ralph.yaml` (if exists)
- **Delete**: `.claude/workflows/ralph-with-bookends.yaml`

### Step 3: Configurable Prompts
- **Modify**: `plugins/m42-sprint/scripts/build-sprint-prompt.sh`
- **Create**: `plugins/m42-sprint/templates/gherkin-step-workflow.yaml`
- **Create**: `plugins/m42-sprint/templates/minimal-workflow.yaml`
- **Create**: `plugins/m42-sprint/templates/orchestrated-workflow.yaml`

### Step 4: Unified Loop + Orchestration
- **Modify**: `plugins/m42-sprint/scripts/sprint-loop.sh`
