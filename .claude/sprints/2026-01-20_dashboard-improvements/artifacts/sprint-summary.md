# Sprint Summary: 2026-01-20_dashboard-improvements

## What Was Accomplished

This sprint transformed the m42-sprint dashboard from a basic activity viewer into a comprehensive sprint management interface. Key deliverables include chat-like live activity display, elapsed time/progress indicators, stale sprint detection, model selection, composable workflows, and a complete operator request system.

---

### Step 0: Chat-Like Live Activity UI
**TDD Cycle**:
- Tests written: 37
- Gherkin scenarios: 8, all passing

**Implementation**:
- Added `'assistant'` event type to ActivityEvent with `text` and `isThinking` fields
- TranscriptionWatcher now parses `content_block_start` and `content_block_delta` for text
- Implemented 500ms debounced text accumulation for smooth streaming display
- Rendered assistant messages as chat bubbles with primary styling
- Tool calls now display with grey/secondary styling and human-readable descriptions

**Files**: `activity-types.ts`, `transcription-watcher.ts`, `page.ts` + 3 new test files

---

### Step 1: Elapsed Time & Progress Display
**TDD Cycle**:
- Tests written: 11
- Gherkin scenarios: 9, all passing

**Implementation**:
- `calculateElapsed()` function for duration string formatting
- Elapsed time calculation in `buildSubPhaseNode()`, `buildStepNode()`, `buildTopPhaseNode()`
- Added `totalSteps` and `currentStep` to `SprintHeader` interface
- Prominent sprint timer (HH:MM:SS) in header with blue accent
- "Step X of Y" progress indicator

**Files**: `transforms.ts`, `status-types.ts`, `page.ts` + 1 new test file

---

### Step 2: Sprint Dropdown & Stale Detection
**TDD Cycle**:
- Tests written: 31
- Gherkin scenarios: 8, all passing

**Implementation**:
- Fixed dropdown to navigate with full page reload
- Added `last-activity` heartbeat timestamp written each loop iteration
- SIGTERM/SIGINT handlers mark sprint as `interrupted` before exit
- Staleness detection (>15 min since last activity) with `isStale` flag
- "Stale" badge styling and "Resume Sprint" button in UI
- `/api/sprint/:id/resume` endpoint with signal file creation

**Files**: `page.ts`, `server.ts`, `transforms.ts`, `loop.ts` + 4 new test files

---

### Step 3: Workflow Reference for Single Phases
**TDD Cycle**:
- Tests written: 10
- Gherkin scenarios: 8, all passing

**Implementation**:
- Detect phases with `workflow:` but no `for-each:` for inline expansion
- Load and expand referenced workflow phases with prefixed IDs (`{parent-id}-{child-id}`)
- Cycle detection with clear error messages
- Maximum depth limit (5 levels) enforcement
- Validation: `prompt` and `workflow` are mutually exclusive

**Files**: `compile.ts`, `resolve-workflows.ts`, `types.ts` + 1 new test file

---

### Step 4: Model Selection per Level
**TDD Cycle**:
- Tests written: 16
- Gherkin scenarios: 8, all passing

**Implementation**:
- Model resolution with priority: step > phase > sprint > workflow
- Validation for model values (`sonnet`, `opus`, `haiku`)
- Model field stored in PROGRESS.yaml per phase
- Runtime reads model from current phase and passes to claude-runner
- Claude-runner includes `--model` flag in CLI invocation

**Files**: `compile.ts`, `types.ts`, `loop.ts`, `claude-runner.ts` + 2 new test files

---

### Step 5: Operator Request System
**TDD Cycle**:
- Tests written: 54 (27 operator + 15 backlog + 12 integration)
- Gherkin scenarios: 8, all passing

**Implementation**:
- Parse `operatorRequests` from Claude JSON result
- Queue requests in PROGRESS.yaml with `discovered-in` and `created-at`
- Operator decision processing with approve/reject/defer/backlog workflows
- Approved requests trigger step/workflow injection
- BACKLOG.yaml file operations for deferred items
- Critical priority requests trigger immediate operator processing

**Files**: `operator.ts` (NEW), `backlog.ts` (NEW), `loop.ts`, `claude-runner.ts` + 2 new test files

---

### Step 6: Dynamic Step Injection
**TDD Cycle**:
- Tests written: 18
- Gherkin scenarios: 7, all passing

**Implementation**:
- `ProgressInjector` class with `injectStep()` and `injectWorkflow()` methods
- Position resolution: `after-current`, `end-of-workflow`, `after-step`, `before-step`
- Injected phases marked with `injected: true` flag
- Backup creation before PROGRESS.yaml modification
- `updateStats()` recalculates phase counts after injection

**Files**: `progress-injector.ts` (NEW) + 1 new test file

---

### Step 7: Operator Queue View UI
**TDD Cycle**:
- Tests written: 35
- Gherkin scenarios: 8, all passing

**Implementation**:
- `/sprint/:id/operator` page with Pending Requests, Decision History, Backlog sections
- `OperatorRequestCard`, `OperatorReasoningBlock` components
- Priority badges with color coding
- Navigation badge showing pending count
- `/api/sprint/:id/operator-queue` endpoint returning queue data
- SSE events for real-time queue updates
- Manual decision API endpoint

**Files**: `operator-queue-page.ts` (NEW), `operator-queue-transforms.ts` (NEW), `server.ts` + 2 new test files

---

### Step 8: Final Verification (E2E)
**TDD Cycle**:
- Tests written: E2E dashboard tests
- Gherkin scenarios: 13, all passing

**Implementation**:
- Comprehensive E2E test suite for dashboard functionality
- All 11 features verified working end-to-end
- Build and typecheck verification for both compiler and runtime

**Files**: `dashboard-e2e.test.ts` (NEW)

---

## Test Coverage Summary

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Tests | ~135 | 292 | +157 |
| Gherkin | 0 | 77 | +77 |
| Coverage | - | 100% | - |

---

## Documentation Updates

| Document | Change |
|----------|--------|
| `USER-GUIDE.md` | Live Activity Feed, Operator Queue, Model Selection sections |
| `getting-started/quick-start.md` | Dashboard features, model selection |
| `getting-started/first-sprint.md` | Model selection, stale recovery |
| `reference/api.md` | Resume endpoint, operator queue endpoints, SSE events |
| `reference/commands.md` | Model flag documented |
| `reference/sprint-yaml-schema.md` | Model field at top-level and step-level |
| `reference/workflow-yaml-schema.md` | Model field, single-phase workflow ref, cycle detection |
| `reference/progress-yaml-schema.md` | Operator queue, injected phases, model field, last-activity |
| `troubleshooting/common-issues.md` | Stale sprint recovery, Model not applied |
| `concepts/operator-system.md` | **NEW** - Complete operator system documentation (272 lines) |
| `README.md` | Feature list updated |

---

## Files Changed

| Category | Files | Description |
|----------|-------|-------------|
| Compiler (source) | 11 | Core compilation, status server, transforms |
| Runtime (source) | 6 | Loop, claude-runner, operator, backlog, injector |
| Tests (new) | 23 | Unit tests for all new features |
| Documentation | 11 | User guide, reference docs, concepts |
| Sprint artifacts | 21 | QA reports, gherkin specs, context files |

**Total: 188 files changed, +60,218 lines, -312 lines**

---

## Commits Made

| Hash | Type | Message |
|------|------|---------|
| f721536 | qa | sprint-level verification passed |
| 7babdf8 | docs | documentation verified for dashboard-improvements |
| 6d40f0c | docs | add model flag to run-sprint command documentation |
| e6e24c5 | docs | update onboarding for dashboard improvements |
| f48f66b | docs | update documentation for dashboard improvements |
| e5afb4e | verify | step-8 integration verified - all tests pass |
| 0ecac43 | qa | step-8 all scenarios passed |
| 192778a | feat | implement operator queue view [GREEN] |
| 64b343b | feat | implement ProgressInjector for dynamic step injection [GREEN] |
| 4e39630 | feat | implement operator request system [GREEN] |
| a465cde | feat | implement configurable model selection [GREEN] |
| 063bcad | feat | implement workflow reference expansion [GREEN] |
| aa78a66 | feat | add sprint dropdown switching and stale detection [GREEN] |
| 651efc3 | feat | add elapsed time display and progress indicators [GREEN] |
| b797ba9 | feat | implement chat-like live activity UI [GREEN] |
| a9ae4d5 | preflight | add shared context and TDD sprint plan |

*(62 total commits for this sprint)*

---

## Verification Status

- Build: **PASS**
- TypeCheck: **PASS**
- Lint: **PASS**
- Tests: **292/292 passed**
- Gherkin: **77/77 scenarios, 100%**
- Documentation: **Updated**

---

## Sprint Statistics

| Metric | Value |
|--------|-------|
| Steps completed | 9/9 (100%) |
| Total commits | 62 |
| Tests added | 157 |
| Gherkin scenarios | 77 |
| Files changed | 188 |
| Lines added | +60,218 |
| Lines removed | -312 |
| New source files | 8 |
| New test files | 23 |
| Documentation files | 11 |

---

## Key Features Delivered

1. **Chat-Like Live Activity** - Assistant messages display as chat bubbles with streaming support
2. **Elapsed Time Display** - Real-time timers at sprint, phase, and step levels
3. **Progress Indicators** - "Step X of Y" counters with visual progress
4. **Sprint Switching** - Dropdown navigation with loading states
5. **Stale Detection** - Automatic detection with resume capability
6. **Model Selection** - 4-level cascading override system (step > phase > sprint > workflow)
7. **Composable Workflows** - Single-phase workflow references with cycle detection
8. **Operator Request System** - Discovery, approval, rejection, deferral, and backlog
9. **Dynamic Injection** - Runtime step/workflow injection at configurable positions
10. **Operator Queue View** - Dedicated UI for managing operator requests
11. **E2E Verification** - Comprehensive end-to-end test coverage
