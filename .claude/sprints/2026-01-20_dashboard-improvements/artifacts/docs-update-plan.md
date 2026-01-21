# Documentation Update Plan: 2026-01-20_dashboard-improvements

## Code Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `compiler/src/types.ts` | Modified | Added `ClaudeModel` type, model fields to interfaces, operator request types |
| `compiler/src/compile.ts` | Modified | Model selection resolution, workflow reference expansion |
| `compiler/src/expand-foreach.ts` | Modified | Single-phase workflow reference support |
| `compiler/src/resolve-workflows.ts` | Modified | Workflow loading with cycle detection |
| `compiler/src/validate.ts` | Modified | Validation for model field and workflow references |
| `compiler/src/status-server/activity-types.ts` | Modified | Added `assistant` event type for chat-like display |
| `compiler/src/status-server/transcription-watcher.ts` | Modified | Text content parsing, debounced accumulation |
| `compiler/src/status-server/page.ts` | Modified | Chat-like UI, elapsed time, stale detection, dropdown fix |
| `compiler/src/status-server/transforms.ts` | Modified | Elapsed time calculations, staleness detection |
| `compiler/src/status-server/status-types.ts` | Modified | Added `totalSteps` to `SprintHeader` interface |
| `compiler/src/status-server/server.ts` | Modified | Resume endpoint, operator queue endpoints |
| `compiler/src/status-server/operator-queue-page.ts` | **NEW** | Operator queue view UI |
| `compiler/src/status-server/operator-queue-transforms.ts` | **NEW** | Operator queue data transforms |
| `runtime/src/loop.ts` | Modified | Model passing, heartbeat timestamps, signal handlers |
| `runtime/src/claude-runner.ts` | Modified | Model flag, operator request parsing |
| `runtime/src/operator.ts` | **NEW** | Operator request system |
| `runtime/src/backlog.ts` | **NEW** | BACKLOG.yaml management |
| `runtime/src/progress-injector.ts` | **NEW** | Dynamic step injection |

## Documentation Impact

### User Guide Updates (USER-GUIDE.md)

| Section | Action | Reason |
|---------|--------|--------|
| Activity Logging & Hooks (lines 67-148) | **REMOVE** | Hook system removed; transcription-based activity tracking replaces it |
| New: Live Activity Feed | **ADD** | Chat-like display with assistant messages + tool calls |
| New: Operator Queue View | **ADD** | Operator queue management UI in dashboard |
| Best Practices - General | **UPDATE** | Add guidance on model selection and operator system |

### Getting Started Updates

| Section | Action | Reason |
|---------|--------|--------|
| quick-start.md | Update | Mention new dashboard features (elapsed time, progress) |
| first-sprint.md | Update | Reference model selection option |

### Reference Updates

#### sprint-yaml-schema.md

| Item | Action | Details |
|------|--------|---------|
| Step fields table | **ADD** | `model?: 'sonnet' \| 'opus' \| 'haiku'` field |
| Top-level fields table | **ADD** | `model?: ClaudeModel` field for sprint-level default |
| TypeScript interface | **UPDATE** | Add model field to `SprintStep` and `SprintDefinition` |
| Example with model | **ADD** | Show model override pattern |

#### workflow-yaml-schema.md

| Item | Action | Details |
|------|--------|---------|
| Phase fields | **ADD** | `model?: 'sonnet' \| 'opus' \| 'haiku'` field |
| Single-phase workflow reference | **ADD** | Document `workflow:` without `for-each:` for inline expansion |
| Cycle detection | **ADD** | Note max depth (5 levels) and cycle prevention |
| Top-level fields | **ADD** | `model?: ClaudeModel` for workflow default |
| Examples | **ADD** | Single-phase workflow reference example |

#### progress-yaml-schema.md

| Item | Action | Details |
|------|--------|---------|
| CompiledPhase fields | **ADD** | `model?: ClaudeModel`, `injected?: boolean` |
| CompiledStep fields | **ADD** | `model?: ClaudeModel` |
| New: operator-queue section | **ADD** | Document `operator-queue` array structure |
| New: injected phases | **ADD** | Document `injected` flag and `injected-at` timestamp |
| `last-activity` field | **ADD** | Document heartbeat timestamp |

#### api.md

| Item | Action | Details |
|------|--------|---------|
| New: `/api/sprint/:id/resume` | **ADD** | Resume stale sprint endpoint |
| New: `/api/sprint/:id/operator-queue` | **ADD** | Get operator queue |
| New: `/api/sprint/:id/operator-queue/:requestId/decide` | **ADD** | Submit manual decision |
| SSE Events table | **UPDATE** | Add `operator-request` and `operator-decision` events |
| New: Activity Event Format | **ADD** | Document `type: 'assistant'` with `text` field |

#### commands.md

| Item | Action | Details |
|------|--------|---------|
| Model selection | **ADD** | Document `--model` flag for relevant commands |

### Troubleshooting Updates (common-issues.md)

| Item | Action | Details |
|------|--------|---------|
| Stale Sprint Recovery | **ADD** | New section explaining stale detection and resume |
| Hook-related entries | **REMOVE** | No longer applicable |
| Model Not Applied | **ADD** | Troubleshooting model override precedence |

## New Documentation Needed

- [ ] **concepts/operator-system.md**: Create new doc explaining:
  - What operator requests are
  - Request lifecycle (pending → approved/rejected/deferred/backlog)
  - Operator queue view in dashboard
  - BACKLOG.yaml structure
  - Manual vs automatic decisions
  - Integration with progress injection

## Files to Update

| File | Updates Needed |
|------|----------------|
| `docs/USER-GUIDE.md` | Remove hooks section (lines 67-148), add operator queue usage |
| `docs/reference/api.md` | Add resume endpoint, operator queue endpoints, SSE events |
| `docs/reference/sprint-yaml-schema.md` | Add `model` field documentation |
| `docs/reference/workflow-yaml-schema.md` | Add `model` field, single-phase workflow ref |
| `docs/reference/progress-yaml-schema.md` | Add operator-queue, injected flag, model field |
| `docs/troubleshooting/common-issues.md` | Add stale sprint recovery, remove hook issues |
| `README.md` | Update feature list with new capabilities |

## Files to Create

| File | Purpose |
|------|---------|
| `docs/concepts/operator-system.md` | Explain operator request system |

## Priority Order

1. **P0 - Critical**: USER-GUIDE.md (remove outdated hooks section - causes confusion)
2. **P1 - High**: api.md (new endpoints need docs for API consumers)
3. **P1 - High**: sprint-yaml-schema.md (model field is new user-facing feature)
4. **P1 - High**: workflow-yaml-schema.md (single-phase workflow ref is new pattern)
5. **P2 - Medium**: progress-yaml-schema.md (affects developers building tooling)
6. **P2 - Medium**: concepts/operator-system.md (new feature needs explanation)
7. **P3 - Low**: troubleshooting/common-issues.md (stale recovery is self-explanatory in UI)
8. **P3 - Low**: README.md (marketing update, not blocking)

## Model Selection Resolution Order

Document the resolution order (highest to lowest priority):
1. Step-level `model` field in SPRINT.yaml
2. Workflow phase-level `model` field
3. Sprint-level `model` field in SPRINT.yaml
4. Workflow-level `model` field
5. Default (no override - uses CLI default)

## Verification Plan

- [ ] All code examples tested (compile/run successfully)
- [ ] All new API endpoints documented with request/response examples
- [ ] All YAML schema examples validate successfully
- [ ] Cross-reference links verified (no broken links)
- [ ] Removed hook documentation doesn't leave orphan references
- [ ] New TypeScript interfaces match actual implementation
- [ ] Model selection precedence is accurate

## Notes

- The hook system removal is complete in code; docs must reflect this
- Chat-like activity display is a significant UI improvement worth highlighting
- Operator system is complex; needs dedicated concept doc
- Stale detection provides automatic recovery guidance in UI
- Model selection cascades from step → phase → sprint → workflow
