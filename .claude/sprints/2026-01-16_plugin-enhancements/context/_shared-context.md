# Shared Sprint Context

## Project Architecture

This project is **m42-claude-plugins**, a monorepo of Claude Code plugins. The primary focus of this sprint is the **m42-sprint** plugin located at `plugins/m42-sprint/`.

### Directory Structure
```
m42-claude-plugins/
├── .claude/
│   ├── workflows/         # Workflow definitions (YAML)
│   └── sprints/           # Sprint directories with SPRINT.yaml/PROGRESS.yaml
├── plugins/
│   ├── m42-sprint/        # Sprint execution plugin (THIS SPRINT'S FOCUS)
│   │   ├── commands/      # Slash commands (markdown)
│   │   ├── compiler/      # TypeScript compiler for SPRINT.yaml → PROGRESS.yaml
│   │   │   └── src/
│   │   │       ├── status-server/  # HTTP/SSE status server
│   │   │       └── *.ts            # Compiler modules
│   │   ├── docs/          # User documentation
│   │   ├── scripts/       # Bash scripts (sprint-loop.sh, etc.)
│   │   └── skills/        # Skills (markdown)
│   ├── m42-meta-toolkit/  # Meta-tools for creating skills/commands
│   ├── m42-planning/      # Epic/story planning tools
│   └── m42-task-execution/# Task execution framework
```

### Key Components for This Sprint

1. **Status Server** (`compiler/src/status-server/`)
   - `server.ts` - HTTP server with SSE endpoint
   - `page.ts` - HTML/CSS/JS generator for status page
   - `status-types.ts` - TypeScript interfaces
   - `watcher.ts` - File watcher for PROGRESS.yaml
   - `transforms.ts` - Data transformations for SSE events

2. **Sprint Loop** (`scripts/sprint-loop.sh`)
   - Bash script executing `claude -p` repeatedly
   - Reads/updates PROGRESS.yaml
   - Handles pause/resume/stop states

3. **Commands** (`commands/*.md`)
   - `run-sprint.md` - Start sprint execution
   - `pause-sprint.md`, `resume-sprint.md`, `stop-sprint.md` - Control commands

## Key Patterns

### Workflow Compilation Pattern
- `SPRINT.yaml` defines steps and references a workflow
- Compiler expands workflow phases into `PROGRESS.yaml`
- For-each phases expand over steps from SPRINT.yaml

### Status Server Pattern
- Single-page app embedded as template literal in `page.ts`
- SSE streaming via `/events` endpoint
- File watching with debounce on PROGRESS.yaml

### Command Pattern
- Commands are markdown files with YAML frontmatter
- Frontmatter defines: `allowed-tools`, `description`, `model`
- Command body is natural language instructions

### Skill Pattern
- Skills have SKILL.md main file
- Support `references/` and `assets/` subdirectories
- Frontmatter with `triggers` for auto-invocation

## Conventions

### Naming
- Files: kebab-case (`sprint-loop.sh`, `status-types.ts`)
- TypeScript interfaces: PascalCase (`StatusUpdate`, `CompiledProgress`)
- YAML keys: kebab-case (`sprint-id`, `for-each`)
- Commands: kebab-case with verb-noun (`run-sprint`, `add-step`)

### File Structure
- TypeScript: ES modules with `.js` extension in imports
- Commands: flat structure in `commands/` directory
- Skills: `skills/<skill-name>/SKILL.md` with optional `references/`, `assets/`

### Testing
- Simple test runner via `npm run test` in compiler
- Tests in `*.test.ts` files alongside source

### Error Handling
- Compiler uses `CompilerError` objects with code, message, path
- Server uses try/catch with console.error logging
- Bash scripts use `set -euo pipefail`

## Commands

- Build: `npm run build` (in `plugins/m42-sprint/compiler/`)
- Test: `npm run test` (in `plugins/m42-sprint/compiler/`)
- Lint: N/A (no linter configured)
- TypeCheck: `npm run build` (TypeScript compilation includes type checking)

## Dependencies

### Internal Modules
- `types.ts` - Core type definitions for sprint/workflow system
- `status-types.ts` - Status server specific types
- `resolve-workflows.ts` - Workflow loading and resolution
- `expand-foreach.ts` - For-each phase expansion
- `validate.ts` - Validation functions
- `transforms.ts` - SSE data transformations
- `watcher.ts` - File system watcher

### External Packages
- `js-yaml` (^4.1.0) - YAML parsing
- `commander` (^12.0.0) - CLI argument parsing
- `typescript` (^5.3.0) - Build tooling
- `@types/node` (^20.11.0) - Node.js type definitions

## Types and Interfaces

### Core Types (from `types.ts`)
```typescript
// Sprint input format
interface SprintDefinition {
  workflow: string;
  steps: SprintStep[];
  'sprint-id'?: string;
  name?: string;
}

// Compiled output format
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
}

type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
```

### Status Server Types (from `status-types.ts`)
```typescript
interface StatusUpdate {
  header: SprintHeader;
  phaseTree: PhaseTreeNode[];
  currentTask: CurrentTask | null;
}

interface LogEntry {
  id: string;
  type: LogEntryType;
  message: string;
  timestamp: string;
}

type SSEEventType = 'status-update' | 'log-entry' | 'keep-alive';
```

### Server Configuration
```typescript
interface ServerConfig {
  port: number;      // default: 3100
  host: string;      // default: localhost
  sprintDir: string; // Path to sprint directory
  keepAliveInterval?: number;
  debounceDelay?: number;
}
```

## Signal Files Pattern

The sprint loop uses signal files for control:
- `.pause-requested` - Request pause after current task
- `.resume-requested` - Resume paused sprint
- `.stop-requested` - Stop sprint execution

These should be created in the sprint directory by API endpoints.
