# Sprint Plan: 2026-01-20_typescript-runtime-migration

## Goal

Migrate the m42-sprint plugin runtime from ~2,900 lines of bash scripts to TypeScript, applying XState-inspired patterns for type-safe state transitions. This creates a single-language codebase with improved testability, better error handling, and full IDE support while maintaining backward compatibility with existing YAML formats.

## TDD Approach

Each step follows: **RED** (write failing tests) → **GREEN** (implement to pass) → **REFACTOR** (clean up) → **QA** (verify gherkin scenarios)

## Success Criteria

- [ ] All gherkin scenarios pass (100% score)
- [ ] All unit tests pass (100% coverage on core modules)
- [ ] `npm run build` passes for both compiler and runtime
- [ ] `npm run typecheck` passes with zero errors
- [ ] Integration tests (test-*.sh) continue to pass
- [ ] Documentation updated to reflect TypeScript runtime

## Step Breakdown

### Step 0: Type System Foundation
**ID**: `type-system`

**Scope**: Enhance `compiler/src/types.ts` with XState-inspired discriminated unions for type-safe state transitions. NO runtime changes.

**Tests to Write**:
- TypeScript compilation tests (typecheck passes)
- Type guard function tests (guards.hasMorePhases, etc.)

**Files**:
- Modify: `plugins/m42-sprint/compiler/src/types.ts`

**Docs Impact**: None (internal types)

**Key Deliverables**:
- Discriminated union: `SprintState` (6 variants)
- Event union: `SprintEvent` (11 event types)
- Action union: `SprintAction` (7 action types)
- `TransitionResult` interface
- `guards` object with 6 guard functions
- Backward compatibility: old `SprintStatus` marked `@deprecated`

---

### Step 1: Pure Transition Function
**ID**: `transition-function`

**Scope**: Create pure `transition()` function that maps (state, event) → (nextState, actions). Zero side effects.

**Tests to Write**:
- Test each state × event combination
- Test invalid transitions return unchanged state
- Test correct actions returned for each transition
- Test exhaustive switch coverage

**Files**:
- Create: `plugins/m42-sprint/runtime/src/transition.ts`
- Create: `plugins/m42-sprint/runtime/src/transition.test.ts`

**Docs Impact**: None (internal implementation)

**Key Deliverables**:
- `transition(state, event, context)` → `TransitionResult`
- `advancePointer(current, context)` helper
- `calculateBackoff(context)` helper
- `getCurrentPhase/Step/SubPhase(progress)` helpers

---

### Step 2: YAML Operations Module
**ID**: `yaml-ops`

**Scope**: Replace `yq` shell commands with TypeScript using `js-yaml`. Implement atomic writes with checksum validation.

**Tests to Write**:
- Test atomic write survives interruption
- Test checksum detects file modification
- Test backup/restore works correctly
- Test missing checksum file is OK (first run)

**Files**:
- Create: `plugins/m42-sprint/runtime/src/yaml-ops.ts`
- Create: `plugins/m42-sprint/runtime/src/yaml-ops.test.ts`

**Docs Impact**: None (internal implementation)

**Key Deliverables**:
- `writeProgressAtomic(filePath, progress)` → Promise<void>
- `readProgress(filePath)` → CompiledProgress
- `backupProgress(filePath)` → void
- `restoreProgress(filePath)` → boolean
- `cleanupBackup(filePath)` → void
- `calculateChecksum(content)` → string (SHA256)

---

### Step 3: Prompt Builder Module
**ID**: `prompt-builder`

**Scope**: Replace `build-sprint-prompt.sh` (354 lines) and `build-parallel-prompt.sh` (82 lines) with TypeScript.

**Tests to Write**:
- Test all template variables substituted correctly
- Test custom prompts override defaults
- Test context files loaded correctly
- Test output matches bash script output (parity)

**Files**:
- Create: `plugins/m42-sprint/runtime/src/prompt-builder.ts`
- Create: `plugins/m42-sprint/runtime/src/prompt-builder.test.ts`

**Docs Impact**: None (internal implementation)

**Key Deliverables**:
- `buildPrompt(progress, sprintDir, customPrompts?)` → string
- `buildParallelPrompt(...)` for parallel phases
- Template variable substitution: `{{sprint.id}}`, `{{iteration}}`, etc.
- Custom prompt overrides from SPRINT.yaml

---

### Step 4: Claude Runner Module
**ID**: `claude-runner`

**Scope**: Create TypeScript wrapper for Claude CLI invocation with proper error handling and result parsing.

**Tests to Write**:
- Test successful run returns output
- Test JSON extraction from markdown blocks
- Test exit code captured correctly
- Test error handling (mock failures)

**Files**:
- Create: `plugins/m42-sprint/runtime/src/claude-runner.ts`
- Create: `plugins/m42-sprint/runtime/src/claude-runner.test.ts`

**Docs Impact**: None (internal implementation)

**Key Deliverables**:
- `runClaude(options: ClaudeRunOptions)` → Promise<ClaudeResult>
- `ClaudeRunOptions` interface (prompt, outputFile, maxTurns, model, etc.)
- `ClaudeResult` interface (success, output, exitCode, jsonResult)
- Error category detection (rate-limit, network, timeout)

---

### Step 5: Action Executor
**ID**: `executor`

**Scope**: Map SprintAction types to implementations, bridging pure transition logic to side effects.

**Tests to Write**:
- Unit test for each action type
- Test SPAWN_CLAUDE with mock claude-runner
- Test WRITE_PROGRESS with mock fs
- Test executeActions runs in sequence

**Files**:
- Create: `plugins/m42-sprint/runtime/src/executor.ts`
- Create: `plugins/m42-sprint/runtime/src/executor.test.ts`

**Docs Impact**: None (internal implementation)

**Key Deliverables**:
- `executeAction(action, context)` → Promise<SprintEvent | null>
- `executeActions(actions, context)` → Promise<SprintEvent[]>
- `ExecutorContext` interface
- Exhaustive switch with `never` check

---

### Step 6: Main Loop
**ID**: `main-loop`

**Scope**: Replace `sprint-loop.sh` (2,464 lines) with TypeScript main loop using transition + executor.

**Tests to Write**:
- Integration test: full loop with mock Claude
- Test pause signal stops loop
- Test max iterations enforced
- Test crash recovery works
- Test behavior matches sprint-loop.sh

**Files**:
- Create: `plugins/m42-sprint/runtime/src/loop.ts`
- Create: `plugins/m42-sprint/runtime/src/loop.test.ts`

**Docs Impact**: None (internal implementation)

**Key Deliverables**:
- `runLoop(sprintDir, options)` → Promise<SprintState>
- `LoopOptions` interface (maxIterations, delay, verbose)
- Transaction recovery on startup
- Pause signal detection (PAUSE file)
- Logging infrastructure

---

### Step 7: CLI Entry Point & Package Setup
**ID**: `cli-entrypoint`

**Scope**: Create CLI entry point and set up runtime package structure.

**Tests to Write**:
- Test CLI argument parsing
- Test exit codes (0 success, 1 failure)
- Test --verbose flag

**Files**:
- Create: `plugins/m42-sprint/runtime/package.json`
- Create: `plugins/m42-sprint/runtime/tsconfig.json`
- Create: `plugins/m42-sprint/runtime/src/cli.ts`
- Create: `plugins/m42-sprint/runtime/src/index.ts`

**Docs Impact**: Update installation instructions

**Key Deliverables**:
- `sprint run <dir>` command
- `--max-iterations <n>` option
- `--delay <ms>` option
- `-v, --verbose` option
- Shebang for CLI: `#!/usr/bin/env node`

---

### Step 8: Command Integration & Bash Removal
**ID**: `remove-bash`

**Scope**: Update slash commands to use TypeScript runtime, remove replaced bash scripts.

**Tests to Write**:
- Verify grep -r "sprint-loop.sh" → no results
- Verify grep -r "build-sprint-prompt" → no results
- Verify /run-sprint executes successfully
- Verify all integration tests pass

**Files to Delete**:
- `plugins/m42-sprint/scripts/sprint-loop.sh`
- `plugins/m42-sprint/scripts/build-sprint-prompt.sh`
- `plugins/m42-sprint/scripts/build-parallel-prompt.sh`
- `plugins/m42-sprint/scripts/preflight-check.sh`

**Files to Modify**:
- `plugins/m42-sprint/commands/run-sprint.md`
- `plugins/m42-sprint/README.md`

**Files to KEEP**:
- `plugins/m42-sprint/scripts/test-*.sh` (integration tests)

**Docs Impact**:
- Update README.md (remove yq requirement, add Node.js)
- Update commands reference
- Document new TypeScript architecture

**Key Deliverables**:
- Commands use TypeScript runtime
- Bash scripts removed
- Documentation updated
- All tests pass

---

## Documentation Update Plan

| Document | Status | Updates Needed |
|----------|--------|----------------|
| README.md | exists | Remove yq requirement, document TypeScript runtime |
| docs/USER-GUIDE.md | exists | Update with TypeScript runtime usage |
| docs/reference/commands.md | exists | Update /run-sprint command details |
| docs/reference/api.md | exists | No changes expected |
| docs/getting-started/quick-start.md | exists | Update installation section |
| docs/troubleshooting/common-issues.md | exists | Add TypeScript-specific issues |

## Risk Mitigation

1. **Backward Compatibility**: YAML formats unchanged; existing sprints work
2. **Incremental Delivery**: Each step is independently verifiable
3. **Integration Tests Kept**: test-*.sh scripts validate behavior parity
4. **Type Safety**: Discriminated unions prevent invalid state transitions
5. **Atomic Operations**: Crash recovery via backup/restore pattern

## Dependencies Between Steps

```
Step 0 (types) ─────────────────────────────────────────────────┐
      │                                                         │
      ▼                                                         │
Step 1 (transition) ────────────────┐                          │
                                    │                          │
Step 2 (yaml-ops) ──────────────────┤                          │
                                    │                          │
Step 3 (prompt-builder) ────────────┤                          │
                                    │                          │
Step 4 (claude-runner) ─────────────┤                          │
                                    │                          │
                                    ▼                          │
                            Step 5 (executor) ◄────────────────┤
                                    │                          │
                                    ▼                          │
                            Step 6 (loop) ◄────────────────────┘
                                    │
                                    ▼
                            Step 7 (cli)
                                    │
                                    ▼
                            Step 8 (cleanup)
```

## Estimated LOC Changes

| Component | Bash Lines Removed | TypeScript Lines Added |
|-----------|-------------------|----------------------|
| sprint-loop.sh | ~2,464 | 0 |
| build-sprint-prompt.sh | ~354 | 0 |
| build-parallel-prompt.sh | ~82 | 0 |
| preflight-check.sh | ~100 | 0 |
| types.ts | 0 | +150 (additions) |
| transition.ts | 0 | ~300 |
| yaml-ops.ts | 0 | ~100 |
| prompt-builder.ts | 0 | ~200 |
| claude-runner.ts | 0 | ~150 |
| executor.ts | 0 | ~200 |
| loop.ts | 0 | ~300 |
| cli.ts | 0 | ~80 |
| Tests | 0 | ~500 |
| **Total** | **~3,000 removed** | **~1,980 added** |

Net reduction: ~1,020 lines while gaining type safety and testability.
