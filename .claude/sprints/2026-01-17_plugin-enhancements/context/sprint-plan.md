# Sprint Plan: 2026-01-17_plugin-enhancements

## Goal

Enhance the m42-sprint plugin with improved reliability, better developer experience, and a new sprint dashboard feature. This sprint addresses bug fixes (elapsed timer, notifications, max iterations default), core reliability improvements (EventEmitter pattern, browser auto-open), UX enhancements (keyboard shortcuts, error messages, log viewer), and introduces a comprehensive sprint dashboard for viewing historical sprint data.

## Success Criteria

- [ ] Elapsed timer stops when sprint reaches terminal state (completed/failed/stopped)
- [ ] Desktop notifications work reliably with test button and fallback handling
- [ ] Default max-iterations updated to 60 across all documentation
- [ ] Browser auto-opens when status server starts (with --no-browser flag option)
- [ ] Status server uses EventEmitter with proper ready signal
- [ ] Keyboard shortcuts implemented for common actions (P, L, N, D, Esc, ?)
- [ ] Error messages show category and recovery suggestions
- [ ] Log viewer has line numbers, search, and jump-to-error
- [ ] Sprint dashboard shows history and metrics at /dashboard
- [ ] Mobile-responsive CSS for status page
- [ ] Performance metrics section with timing visualization
- [ ] All TypeScript compiles without errors

## Step Breakdown

### Step 0: Fix Elapsed Timer Running Indefinitely
**Scope**: Modify `updateElapsedTimes()` in page.ts to check sprint status before updating
**Files**: `plugins/m42-sprint/compiler/src/status-server/page.ts` (line ~2989)
**Dependencies**: None
**Risk**: Low - isolated JavaScript function change

### Step 1: Update Default Max Iterations (30 → 60)
**Scope**: Documentation-only change across multiple files
**Files**:
- `plugins/m42-sprint/commands/run-sprint.md`
- `plugins/m42-sprint/docs/reference/commands.md`
- `plugins/m42-sprint/docs/USER-GUIDE.md`
**Dependencies**: None
**Risk**: Low - search and replace operation

### Step 2: Fix Desktop Notifications Not Working
**Scope**: Enhance notification handling with error handling, test button, and fallback
**Files**: `plugins/m42-sprint/compiler/src/status-server/page.ts` (lines ~1948-2169)
**Dependencies**: None
**Risk**: Medium - browser API complexity, needs careful testing

### Step 3: Create Cross-Platform Browser Opener Utility
**Scope**: New utility module for opening browsers on macOS/Windows/Linux
**Files**: NEW `plugins/m42-sprint/compiler/src/status-server/browser.ts`
**Dependencies**: None
**Risk**: Low - isolated utility with clear interface

### Step 4: Add EventEmitter Pattern to StatusServer
**Scope**: Implement ready signal to eliminate race condition on startup
**Files**: `plugins/m42-sprint/compiler/src/status-server/server.ts`
**Dependencies**: Step 3 (browser utility exists)
**Risk**: Medium - changes server startup flow, affects consumers

### Step 5: Integrate Browser Auto-Open in Status Server Startup
**Scope**: Make browser auto-open default behavior, add --no-browser flag
**Files**:
- `plugins/m42-sprint/compiler/src/status-server/index.ts`
- `plugins/m42-sprint/commands/run-sprint.md`
**Dependencies**: Steps 3, 4 (browser utility + EventEmitter ready)
**Risk**: Medium - changes default behavior

### Step 6: Implement Keyboard Shortcuts
**Scope**: Add global keydown listener with P, L, N, D, Esc, ? shortcuts
**Files**: `plugins/m42-sprint/compiler/src/status-server/page.ts`
**Dependencies**: None
**Risk**: Low - additive JavaScript feature

### Step 7: Add Enhanced Error Messages with Recovery Actions
**Scope**: Error classification system with category badges and recovery suggestions
**Files**: `plugins/m42-sprint/compiler/src/status-server/page.ts`
**Dependencies**: None
**Risk**: Medium - requires understanding error patterns

### Step 8: Enhance Log Viewer
**Scope**: Line numbers, search with highlight/navigation, jump to error
**Files**: `plugins/m42-sprint/compiler/src/status-server/page.ts`
**Dependencies**: None
**Risk**: Medium - complex UI state management

### Step 9: Create SprintScanner Module
**Scope**: Module to enumerate and parse sprints in .claude/sprints/
**Files**: NEW `plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts`
**Dependencies**: None
**Risk**: Low - isolated read-only module

### Step 10: Create MetricsAggregator Module
**Scope**: Aggregate statistics across multiple sprints
**Files**: NEW `plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts`
**Dependencies**: Step 9 (SprintScanner types)
**Risk**: Low - pure calculation module

### Step 11: Create Dashboard Page HTML
**Scope**: New page generator for dashboard with metrics and sprint list
**Files**: NEW `plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts`
**Dependencies**: Steps 9, 10 (scanner + aggregator)
**Risk**: Medium - significant new UI code

### Step 12: Add URL Routing to Status Server
**Scope**: Implement routing for /, /dashboard, /sprint/:id, /api/sprints, /api/metrics
**Files**: `plugins/m42-sprint/compiler/src/status-server/server.ts`
**Dependencies**: Steps 9, 10, 11 (scanner, aggregator, dashboard page)
**Risk**: Medium - changes request handling architecture

### Step 13: Add Navigation Header to Sprint Detail Page
**Scope**: Navigation bar with back link, breadcrumb, sprint switcher
**Files**:
- `plugins/m42-sprint/compiler/src/status-server/page.ts`
- `plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts`
**Dependencies**: Step 12 (routing in place)
**Risk**: Low - UI enhancement

### Step 14: Update sprint-watch Command for Dashboard Mode
**Scope**: Add --dashboard flag to sprint-watch command
**Files**: `plugins/m42-sprint/commands/sprint-watch.md`
**Dependencies**: Step 12 (routing supports /dashboard)
**Risk**: Low - documentation update

### Step 15: Enhanced Connection Status with Reconnection Info
**Scope**: Show reconnection attempts, countdown, visual indicators
**Files**: `plugins/m42-sprint/compiler/src/status-server/page.ts`
**Dependencies**: None
**Risk**: Low - UI enhancement with existing SSE

### Step 16: Add Mobile Responsive CSS
**Scope**: Media queries for mobile (<768px) and tablet (<1024px)
**Files**: `plugins/m42-sprint/compiler/src/status-server/page.ts` (CSS section)
**Dependencies**: None
**Risk**: Low - CSS-only changes

### Step 17: Add Performance Metrics Section
**Scope**: Collapsible section with per-phase timing and bar chart
**Files**:
- `plugins/m42-sprint/compiler/src/status-server/page.ts`
- `plugins/m42-sprint/compiler/src/status-server/server.ts` (add /api/timing if needed)
**Dependencies**: None (timing tracker already exists)
**Risk**: Medium - new UI section with data visualization

### Step 18: Build Verification and Cleanup
**Scope**: Final build, typecheck, fix any remaining issues
**Files**: All modified files in `plugins/m42-sprint/compiler/`
**Dependencies**: All previous steps
**Risk**: Low - verification only

## Step Dependency Graph

```
Phase 1 (P0 Quick Wins) - Independent:
  step-0 (timer fix)
  step-1 (max iterations)
  step-2 (notifications)

Phase 2 (P0 Core Reliability) - Sequential:
  step-3 (browser utility)
    ↓
  step-4 (EventEmitter)
    ↓
  step-5 (browser auto-open)

Phase 3 (P1 Developer Experience) - Independent:
  step-6 (keyboard shortcuts)
  step-7 (error messages)
  step-8 (log viewer)

Phase 4 (P1 Major Feature - Dashboard) - Sequential:
  step-9 (SprintScanner)
    ↓
  step-10 (MetricsAggregator)
    ↓
  step-11 (Dashboard Page)
    ↓
  step-12 (URL Routing)
    ↓
  step-13 (Navigation)
    ↓
  step-14 (sprint-watch flag)

Phase 5 (P2 Polish) - Independent:
  step-15 (connection status)
  step-16 (mobile CSS)
  step-17 (performance metrics)

Final:
  step-18 (build verification) - depends on ALL
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| page.ts too large to edit cleanly | Medium | Edit specific functions by line number, test after each change |
| EventEmitter changes break existing consumers | High | Test startup sequence carefully, ensure backward compatibility |
| Browser auto-open behavior change | Medium | Add --no-browser flag, document change |
| Dashboard routing conflicts with existing endpoints | Medium | Design URL scheme to avoid collisions |
| Mobile CSS breaks desktop layout | Low | Use media queries that don't affect desktop |
| TypeScript strict mode catches hidden issues | Medium | Fix all type errors during step 18 |

## Estimated Complexity

| Step | Complexity | Reason |
|------|------------|--------|
| step-0 | Low | Single function modification |
| step-1 | Low | Search and replace in docs |
| step-2 | Medium | Browser API edge cases |
| step-3 | Low | Simple utility function |
| step-4 | Medium | Affects startup flow |
| step-5 | Medium | Integration of new patterns |
| step-6 | Low | Additive event handler |
| step-7 | Medium | New classification logic |
| step-8 | Medium | Complex UI state |
| step-9 | Low | Read-only filesystem scan |
| step-10 | Low | Pure calculations |
| step-11 | Medium | New HTML generation |
| step-12 | Medium | URL routing changes |
| step-13 | Low | UI additions |
| step-14 | Low | Documentation only |
| step-15 | Low | UI enhancement |
| step-16 | Low | CSS media queries |
| step-17 | Medium | Data visualization |
| step-18 | Low | Build and fix |
