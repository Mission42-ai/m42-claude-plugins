# Bug Fix Log

**Sprint**: dashboard-bugfixes
**Parent Sprint**: 2026-01-20_sprint-plugin-e2e-testing
**Started**: 2026-01-20T18:07:00Z
**Completed**: 2026-01-20
**Status**: ALL BUGS FIXED

## Summary

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| HIGH     | 4     | 4     | 0         |
| MEDIUM   | 3     | 3     | 0         |
| **Total**| **7** | **7** | **0**     |

## Progress

| Bug ID  | Severity | Status   | Test Added | Fix Commit |
|---------|----------|----------|------------|------------|
| BUG-001 | HIGH     | FIXED    | Yes        | a72f6a9    |
| BUG-002 | HIGH     | FIXED    | Yes        | a72f6a9    |
| BUG-003 | HIGH     | FIXED    | Yes        | a72f6a9    |
| BUG-004 | MEDIUM   | FIXED    | Yes        | a72f6a9    |
| BUG-005 | MEDIUM   | FIXED    | Yes        | (pending)  |
| BUG-006 | MEDIUM   | FIXED    | Yes        | (pending)  |
| BUG-007 | HIGH     | FIXED    | Yes        | (pending)  |

## All Bugs Resolved

### BUG-005: Completed Sprint Triggers Completion Sound
- **Severity**: MEDIUM
- **Root Cause**: No distinction between initial page load and actual status transition
- **Fix**: Added null check guard in `checkAndSendNotification()` (page.ts:3448)
- **Tests**: `notification-sound.test.ts` (6 cases)

### BUG-006: Total Sprint Duration Not Displayed
- **Severity**: MEDIUM
- **Root Cause**: Timer skipped terminal statuses, leaving elapsed element empty
- **Fix**: Set elapsed directly in `updateHeader()` for terminal states (page.ts:4240-4244)
- **Tests**: `total-duration.test.ts` (6 cases)

### BUG-007: Steps/Substeps Missing Duration and Clickable Logs
- **Severity**: HIGH
- **Root Cause**: No duration computation for in-progress nodes; no row click handlers
- **Fix**: Added `computeElapsedIfNeeded()` in transforms.ts; click handlers in page.ts
- **Tests**: `step-duration-clickable.test.ts` (9 cases)

## Already Fixed (from previous sprint)

### BUG-001: Sprint Steps Show No Progress Indicators
- **Root cause**: Runtime wasn't updating step/subphase statuses in PROGRESS.yaml
- **Fix**: Added status updates in `loop.ts` lines 485-584
- **Tests**: `loop.test.ts`, `transforms.test.ts`

### BUG-002: Worktree Filter Shows No Sprints
- **Root cause**: Dashboard used path extraction while API normalized to 'main'
- **Fix**: Use `sprint.worktree?.name` with fallback
- **Tests**: `worktree-filter.test.ts` (7 cases)

### BUG-003: Live Activity Always Shows "Waiting for activity"
- **Root cause**: Hook used `jq -n` producing multi-line JSON, JSONL parser expected single lines
- **Fix**: Changed all `jq -n` to `jq -cn` for compact output
- **Tests**: `activity.test.ts` (12 cases)

### BUG-004: Performance Metrics Cluttered and Uninformative
- **Root cause**: Metrics were unorganized and didn't use all available data
- **Fix**: Redesigned with 4 categories, visual hierarchy, all 12 metrics utilized
- **Tests**: `dashboard-page.test.ts` (9 cases)

## Build Verification

- [x] Compiler build passes: `npm run build` in `compiler/`
- [x] Runtime build passes: `npm run build` in `runtime/`
