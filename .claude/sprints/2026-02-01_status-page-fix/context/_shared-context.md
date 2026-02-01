# Sprint Context: Status Page Fixes

## Project Info

- **Plugin**: m42-sprint (sprint orchestration and status tracking)
- **Test framework**: Custom Node.js-based test runner (not vitest/jest)
- **Test location**: `runtime/src/*.test.ts`, `compiler/src/*.test.ts`, `e2e/*.test.ts`
- **Build command**: `npm run build` (runs `tsc`)
- **Test command (runtime)**: `npm test` (builds + runs all test files)
- **Test command (compiler)**: `npm test` (builds + runs validate.test.js)
- **Lint command**: `npm run typecheck` (tsc --noEmit)

## Key Directories

```
plugins/m42-sprint/
├── commands/          # Skill command definitions (.md files)
├── compiler/          # TypeScript workflow compiler + status server
│   └── src/status-server/  # HTTP server, dashboard, watchers
├── runtime/           # TypeScript execution runtime
│   └── src/           # CLI, loop, executor, worktree handling
├── skills/            # Skill definitions for Claude Code
└── e2e/               # End-to-end tests
```

## Patterns to Follow

### 1. Fresh Context Pattern
Each sprint step runs in isolated Node.js process via `node dist/cli.js run`. Context clears between iterations.

### 2. PROGRESS.yaml State Machine
- Phases tracked with detailed status (pending, in-progress, completed, failed)
- Pointer tracking current phase/step/sub-phase
- Atomic writes via `writeProgressAtomic()` + backup before execution

### 3. Worktree Handling in CLI (runtime/src/cli.ts)
The `setupWorktreeIfNeeded()` function (lines 354-454):
1. Loads SPRINT.yaml and workflow definition
2. Calls `shouldCreateWorktree()` to decide if worktree needed
3. Resolves paths via `resolveWorktreePath()` with variable substitution
4. Checks if worktree exists, creates if needed via `createWorktree()`
5. Copies sprint files to worktree `.claude/sprints/{sprintId}`
6. Returns target sprint directory (original or worktree)

### 4. Status Server Architecture (compiler/src/status-server/)
- **StatusServer** class extends EventEmitter
- **Watchers**: ProgressWatcher, ActivityWatcher, TranscriptionWatcher, AgentWatcher
- **SSE Events**: status-update, activity-event, agent-update
- **Signal Files**: `.pause-requested`, `.resume-requested`, `.stop-requested`
- **Endpoints**: `/`, `/api/status`, `/api/activity`, `/events`, `/dashboard`

### 5. Verbosity Levels in TranscriptionWatcher
- `minimal`: Important milestones (TodoWrite, AskUserQuestion)
- `basic`: File operations users care about
- `detailed`: Everything else

### 6. Test Pattern
```typescript
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    process.exitCode = 1;
  }
}
```

## Sprint Steps Overview

### Step 1: fix-run-sprint-command
**Goal**: Remove outdated worktree setup from command skill, let runtime CLI handle it.
**Files**: `plugins/m42-sprint/commands/run-sprint.md`
**Key insight**: The runtime CLI already has `setupWorktreeIfNeeded()` - command skill shouldn't duplicate this logic.

### Step 2: fix-parallel-status-tracking
**Goal**: Fix status page not showing in-progress states during parallel execution.
**Files**: `plugins/m42-sprint/runtime/src/loop.ts` (lines 1372-1379)
**Key insight**: Mark steps as in-progress BEFORE calling writeProgressAtomic, not after.
**Context**: See `context/bug-analysis.md` for detailed solution.

### Step 3: add-parallel-visual-indicators
**Goal**: Add visual indicators for parallel execution and subprocess activity.
**Files**: `plugins/m42-sprint/compiler/src/status-server/page.ts`
**Key insight**: When multiple steps are `in-progress` simultaneously, show grouping/badge.

### Step 4: fix-activity-panel-verbosity
**Goal**: Fix live activity panel hiding relevant information at "basic" verbosity.
**Files**: `page.ts`, `transcription-watcher.ts`
**Key issues**:
1. **CRITICAL**: Text blocks not extracted in non-streaming mode (line 289-301)
2. TaskUpdate shows no detail
3. Read/Glob/Grep shown at basic level (noise)
**Context**: See `context/live-activity-analysis.md` for detailed solution.

### Step 5: refactor-status-server-ports
**Goal**: Enable parallel sprint execution with dedicated ports per sprint.
**Files**: `server.ts`, `page.ts`, `index.ts`, `sprint-watch.md`
**Key changes**:
1. Auto-port allocation starting from 3100
2. Write `.status-port` file for discovery
3. Remove central dashboard, make each server sprint-specific
4. Update `/sprint-watch` to read port from file

## Dependencies Between Steps

```
fix-run-sprint-command          (independent)
fix-parallel-status-tracking    (independent)
add-parallel-visual-indicators  (depends on fix-parallel-status-tracking)
fix-activity-panel-verbosity    (independent)
refactor-status-server-ports    (independent, but affects verification of others)
```

## Testing Approach

For runtime changes:
```bash
cd plugins/m42-sprint/runtime
npm run build
npm test
```

For compiler/status-server changes:
```bash
cd plugins/m42-sprint/compiler
npm run build
npm test
```

For E2E verification:
```bash
cd plugins/m42-sprint/e2e
npm run build
npm test
```

## Key Files Quick Reference

| Purpose | File |
|---------|------|
| Command skill to fix | `commands/run-sprint.md` |
| CLI worktree handling | `runtime/src/cli.ts` (lines 354-454) |
| Parallel execution loop | `runtime/src/loop.ts` (lines 1372-1379) |
| Status page HTML | `compiler/src/status-server/page.ts` |
| Activity parsing | `compiler/src/status-server/transcription-watcher.ts` |
| HTTP server | `compiler/src/status-server/server.ts` |
| Sprint watch skill | `skills/sprint-watch.md` |
