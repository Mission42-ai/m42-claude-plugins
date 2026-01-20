# Sprint Plan: 2026-01-20_dashboard-improvements

## Goal

Transform the m42-sprint dashboard from a basic activity viewer into a comprehensive sprint management interface. This includes chat-like live activity display, enhanced timing/progress indicators, stale sprint detection, model selection configuration, composable workflows, and a complete operator request system for dynamic work injection.

---

## TDD Approach

Each step follows the **RED → GREEN → REFACTOR → QA** cycle:

1. **RED**: Write failing tests that define expected behavior
2. **GREEN**: Implement minimum code to pass tests
3. **REFACTOR**: Clean up implementation while keeping tests green
4. **QA**: Run full test suite, build, and verify functionality

---

## Success Criteria

- [ ] All gherkin scenarios pass (100% score)
- [ ] All unit tests pass (`npm run test` in compiler and runtime)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated for new features
- [ ] Hook system removed without breaking existing functionality

---

## Step Breakdown

### Step 0: Chat-Like Live Activity UI (P0 - Highest Priority)

**Scope**: Implement chat-style display showing assistant messages alongside tool calls in the live activity feed.

**Tests to Write**:
- `activity-types.test.ts`: Test `isActivityEvent()` with new `assistant` type
- `transcription-watcher.test.ts`: Test parsing `content_block_start` with `type: "text"`
- `transcription-watcher.test.ts`: Test text delta accumulation with 500ms debouncing
- `page.test.ts`: Test `renderLiveActivity()` renders chat bubbles for assistant text
- `page.test.ts`: Test tool calls render with grey/secondary styling

**Files to Create/Modify**:
- MODIFY: `compiler/src/status-server/activity-types.ts`
  - Add `'assistant'` to event type union
  - Add `text?: string` and `isThinking?: boolean` fields
- MODIFY: `compiler/src/status-server/transcription-watcher.ts`
  - Parse `content_block_start` with `type: "text"`
  - Parse `content_block_delta` with `text_delta`
  - Implement 500ms debounced text accumulation
  - Emit `ActivityEvent` with `type: 'assistant'`
- MODIFY: `compiler/src/status-server/page.ts`
  - Render assistant messages as chat bubbles (full content)
  - Render tool calls with grey styling and icons
  - Add CSS for chat-like appearance

**Docs Impact**: Update `docs/reference/api.md` with new SSE event format

---

### Step 1: Elapsed Time & Progress Display (P2/P3/P4)

**Scope**: Add elapsed time calculations for steps and prominent progress indicators in the header.

**Tests to Write**:
- `transforms.test.ts`: Test `calculateElapsed()` produces correct duration strings
- `transforms.test.ts`: Test `buildStepNode()` calculates elapsed from timestamps
- `transforms.test.ts`: Test total step counting across phases
- `page.test.ts`: Test header renders `⏱ HH:MM:SS` timer
- `page.test.ts`: Test "Step X of Y" displays correctly

**Files to Create/Modify**:
- MODIFY: `compiler/src/status-server/transforms.ts`
  - Calculate elapsed in `buildSubPhaseNode()`, `buildStepNode()`, `buildTopPhaseNode()`
  - Add step counting logic
  - Add `totalSteps` to `SprintHeader` type
- MODIFY: `compiler/src/status-server/status-types.ts`
  - Add `totalSteps: number` to `SprintHeader` interface
- MODIFY: `compiler/src/status-server/page.ts`
  - Add sprint-timer div in header with large font
  - Add "Step X of Y" indicator
  - Style timer with blue accent color

**Docs Impact**: Update USER-GUIDE.md to mention new UI elements

---

### Step 2: Sprint Dropdown & Stale Detection (P1)

**Scope**: Fix sprint switching via dropdown and implement stale sprint detection with recovery.

**Tests to Write**:
- `page.test.ts`: Test dropdown change triggers full page navigation
- `loop.test.ts`: Test `last-activity` timestamp written each iteration
- `loop.test.ts`: Test SIGTERM handler marks sprint as `interrupted`
- `transforms.test.ts`: Test staleness detection (>15 min since last activity)
- `server.test.ts`: Test `/api/sprint/:id/resume` endpoint

**Files to Create/Modify**:
- MODIFY: `compiler/src/status-server/page.ts`
  - Fix dropdown to navigate with full page reload
  - Add loading indicator during navigation
  - Add "Stale" badge styling
  - Add "Resume Sprint" button
- MODIFY: `compiler/src/status-server/server.ts`
  - Add `/api/sprint/:id/resume` endpoint
- MODIFY: `compiler/src/status-server/transforms.ts`
  - Add staleness detection logic
  - Add `isStale` flag to status
- MODIFY: `runtime/src/loop.ts`
  - Write `last-activity` timestamp each iteration
  - Add `process.on('SIGTERM')` and `process.on('SIGINT')` handlers
  - Mark sprint as `interrupted` before exit

**Docs Impact**: Update troubleshooting guide with stale sprint recovery

---

### Step 3: Workflow Reference for Single Phases

**Scope**: Enable referencing another workflow for a single phase (not just for-each).

**Tests to Write**:
- `compile.test.ts`: Test phase with `workflow:` but no `for-each:` expands inline
- `compile.test.ts`: Test phase IDs are prefixed: `{parent-id}-{child-id}`
- `compile.test.ts`: Test recursive reference detection (cycle prevention)
- `compile.test.ts`: Test max depth limit (5 levels)
- `compile.test.ts`: Test error if both `prompt` and `workflow` specified

**Files to Create/Modify**:
- MODIFY: `compiler/src/compile.ts`
  - Detect phases with `workflow:` but no `for-each:`
  - Load and expand referenced workflow phases inline
  - Prefix IDs to avoid collisions
  - Track workflow stack for cycle detection
- MODIFY: `compiler/src/types.ts`
  - Update Phase type to make `prompt` and `workflow` mutually exclusive
- MODIFY/CREATE: `compiler/src/workflow-loader.ts`
  - Add recursive loading with cycle detection

**Docs Impact**: Update `docs/reference/workflow-yaml-schema.md` with new pattern

---

### Step 4: Model Selection per Level

**Scope**: Implement configurable model selection with cascading override (step > phase > sprint > workflow).

**Tests to Write**:
- `compile.test.ts`: Test model resolution: step > phase > sprint > workflow
- `compile.test.ts`: Test PROGRESS.yaml contains resolved model per phase
- `claude-runner.test.ts`: Test `--model` flag included when model specified
- `loop.test.ts`: Test model passed to claude-runner from PROGRESS.yaml

**Files to Create/Modify**:
- MODIFY: `compiler/src/compile.ts`
  - Parse `model` field from SPRINT.yaml (sprint level)
  - Parse `model` field from each step
  - Parse `model` field from workflow YAML
  - Store resolved model in PROGRESS.yaml
- MODIFY: `compiler/src/types.ts`
  - Add `model?: 'sonnet' | 'opus' | 'haiku'` to relevant interfaces
- MODIFY: `runtime/src/loop.ts`
  - Read `model` from current phase in PROGRESS.yaml
  - Pass to claude-runner
- MODIFY: `runtime/src/claude-runner.ts`
  - Add `model` to `ClaudeRunOptions`
  - Include `--model` flag in CLI invocation

**Docs Impact**: Update `docs/reference/sprint-yaml-schema.md` and `docs/reference/workflow-yaml-schema.md`

---

### Step 5: Operator Request System

**Scope**: Implement operator request system for discovered issues with approval/reject/defer/backlog workflow.

**Tests to Write**:
- `claude-runner.test.ts`: Test `operatorRequests` parsed from JSON result
- `operator.test.ts`: Test request queuing in PROGRESS.yaml
- `operator.test.ts`: Test operator decision processing with reasoning
- `operator.test.ts`: Test approved requests trigger injection
- `backlog.test.ts`: Test backlog items written to BACKLOG.yaml

**Files to Create/Modify**:
- MODIFY: `runtime/src/claude-runner.ts`
  - Update schema to include `operatorRequests`
  - Parse requests from JSON response
- MODIFY: `runtime/src/loop.ts`
  - Queue requests after phase completion
  - Trigger operator for critical priority
- CREATE: `runtime/src/operator.ts`
  - Batch process pending requests
  - Load operator skill/prompt
  - Parse decisions with reasoning
  - Execute injections
- CREATE: `runtime/src/backlog.ts`
  - Manage BACKLOG.yaml file
  - Add/update backlog items
- CREATE: `skills/sprint-operator/skill.md`
  - Default operator skill prompt
- MODIFY: `compiler/src/types.ts`
  - Add `OperatorRequest`, `OperatorDecision` types
  - Add operator config to workflow schema

**Docs Impact**: Create new `docs/concepts/operator-system.md`

---

### Step 6: Dynamic Step Injection

**Scope**: Implement API to inject steps/workflows into running sprints at specific positions.

**Tests to Write**:
- `progress-injector.test.ts`: Test single step injection at `after-current`
- `progress-injector.test.ts`: Test workflow injection with ID prefixing
- `progress-injector.test.ts`: Test all position types resolve correctly
- `loop.test.ts`: Test injected steps execute normally
- `cli.test.ts`: Test `inject-step` command (optional)

**Files to Create/Modify**:
- CREATE: `runtime/src/progress-injector.ts`
  - `ProgressInjector` class with:
    - `injectStep(injection: StepInjection): Promise<void>`
    - `injectWorkflow(injection: WorkflowInjection): Promise<void>`
    - `resolvePosition(progress, position): number`
- MODIFY: `runtime/src/loop.ts`
  - Handle phases with `injected: true` flag
  - Log injection events
- MODIFY: `runtime/src/cli.ts` (optional)
  - Add `inject-step` command
- MODIFY: `compiler/src/status-server/page.ts`
  - Show injected badge for dynamically added steps

**Docs Impact**: Update `docs/reference/api.md` with injection endpoints

---

### Step 7: Operator Queue View UI

**Scope**: Design and implement dedicated operator queue view in dashboard.

**Tests to Write**:
- `operator-queue-page.test.ts`: Test pending requests section renders
- `operator-queue-page.test.ts`: Test decision history with reasoning blocks
- `operator-queue-page.test.ts`: Test backlog section renders
- `server.test.ts`: Test queue API endpoints
- `server.test.ts`: Test manual decision endpoint

**Files to Create/Modify**:
- CREATE: `compiler/src/status-server/operator-queue-page.ts`
  - `OperatorRequestCard` component
  - `OperatorReasoningBlock` component
  - `OperatorQueueList` component
  - `BacklogSection` component
- MODIFY: `compiler/src/status-server/server.ts`
  - Add `/api/sprint/:id/operator-queue` endpoints
  - Add SSE events for queue changes
- MODIFY: `compiler/src/status-server/page.ts`
  - Add navigation to operator queue view
  - Add badge with pending count
- MODIFY: `compiler/src/status-server/transforms.ts`
  - Transform operator queue data for display

**Docs Impact**: Update `docs/USER-GUIDE.md` with operator queue usage

---

### Step 8: Remove Hook System

**Scope**: Remove deprecated hook system entirely, rely on transcription-based activity.

**Tests to Write**:
- Integration test: Sprint runs without hook configuration
- Test: No errors about missing hook files
- Test: Activity tracking works via transcription watcher

**Files to Create/Modify**:
- DELETE: `hooks/` directory
- MODIFY: `runtime/src/cli.ts`
  - Remove `--hook-config` option
  - Remove hook setup code
- MODIFY: `runtime/src/loop.ts`
  - Remove any hook triggers
- MODIFY: Skills and commands
  - Remove references to hooks
- MODIFY: `docs/USER-GUIDE.md`
  - Remove Activity Logging & Hooks section (lines 67-100)

**Docs Impact**: Remove all hook documentation

---

### Step 9: Final Verification

**Scope**: End-to-end verification of all dashboard improvements.

**Tests to Run**:
1. Live Activity: Start sprint, verify chat-style with assistant + tools
2. Elapsed time: Steps show elapsed in sidebar
3. Sprint timer: Prominent HH:MM:SS in header
4. Step count: "Step X of Y" displays
5. Sprint switching: Dropdown works correctly
6. Stale detection: Kill process, verify badge + resume button
7. Model selection: Override at each level works
8. Workflow reference: Single-phase references expand
9. Operator requests: Submit, process, inject
10. Dynamic injection: All position types work
11. Operator queue view: All sections render
12. Hook removal: No hook errors, activity works

**Build Verification**:
```bash
cd plugins/m42-sprint/compiler && npm run build && npm run test
cd plugins/m42-sprint/runtime && npm run build && npm run test
```

---

## Documentation Update Plan

| Doc | Status | Updates Needed |
|-----|--------|----------------|
| USER-GUIDE.md | exists | Remove hooks section, add operator queue usage |
| reference/api.md | exists | Add operator queue endpoints, SSE events |
| reference/sprint-yaml-schema.md | exists | Add model field |
| reference/workflow-yaml-schema.md | exists | Add model field, single-phase workflow ref |
| reference/progress-yaml-schema.md | exists | Add operator-queue, injected flag |
| troubleshooting/common-issues.md | exists | Add stale sprint recovery |
| concepts/operator-system.md | new | Create new doc for operator system |
| README.md | exists | Update feature list |

---

## Risk Mitigation

1. **Hook Removal**: Ensure transcription watcher fully covers activity tracking before removing hooks
2. **Operator Complexity**: Start with basic approval flow, add backlog later
3. **Workflow Cycles**: Implement cycle detection early with clear error messages
4. **Breaking Changes**: Maintain backward compatibility for SPRINT.yaml without new fields
