# Step Context: step-2

## Task
Fix sprint dropdown switching and add stale sprint detection.

Requirements:
1. Fix dropdown in page.ts:
   - Close existing SSE connection on change
   - Navigate to /sprint/{id} with full page reload
   - Add loading indicator

2. Add heartbeat in loop.ts:
   - Write last-activity timestamp each iteration
   - Add process.on('SIGTERM') handler
   - Add process.on('SIGINT') handler
   - Mark sprint as 'interrupted' before exit

3. Detect staleness in transforms.ts:
   - If in-progress but last-activity > 15 min → stale
   - Add isStale flag to status

4. Show stale indicator in page.ts:
   - Display "Stale" badge next to status
   - Show "Resume Sprint" button

5. Add resume endpoint in server.ts:
   - Add /api/sprint/:id/resume endpoint
   - Trigger sprint loop restart

Files:
- plugins/m42-sprint/compiler/src/status-server/page.ts
- plugins/m42-sprint/compiler/src/status-server/server.ts
- plugins/m42-sprint/compiler/src/status-server/transforms.ts
- plugins/m42-sprint/runtime/src/loop.ts
- plugins/m42-sprint/runtime/src/cli.ts

Verification:
- Switch sprints via dropdown, verify correct data loads
- Kill sprint process, wait 15 min, verify "Stale" badge + "Resume" button

## Implementation Plan
Based on gherkin scenarios, implement in this order:
1. **transforms.ts**: Add `isStale` detection logic (Scenarios 6)
2. **loop.ts**: Add heartbeat writing and signal handlers (Scenarios 3, 4, 5)
3. **status-types.ts**: Add `isStale` field to SprintHeader interface
4. **page.ts**: Add dropdown SSE cleanup, loading indicator, stale badge, resume button (Scenarios 1, 2, 7)
5. **server.ts**: Add `/api/sprint/:id/resume` endpoint (Scenario 8)

## Related Code Patterns

### Pattern from: transforms.ts (StatusUpdate creation)
```typescript
// toStatusUpdate builds the header from CompiledProgress
export function toStatusUpdate(
  progress: CompiledProgress,
  includeRaw: boolean = false,
  timingInfo?: TimingInfo
): StatusUpdate {
  // Build the header
  const header: SprintHeader = {
    sprintId: progress['sprint-id'],
    status: progress.status,
    // ... other fields
  };
  // Add isStale detection here based on last-activity
}
```

### Pattern from: server.ts (Control endpoint)
```typescript
// Existing control endpoint pattern
private handlePauseRequest(res: http.ServerResponse): void {
  try {
    const progress = this.loadProgress();
    const availableActions = this.getAvailableActions(progress.status);

    if (!availableActions.includes('pause')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        action: 'pause',
        error: `Cannot pause - sprint status is "${progress.status}"`,
      }));
      return;
    }

    const signalPath = path.join(this.config.sprintDir, SIGNAL_FILES.PAUSE);
    fs.writeFileSync(signalPath, new Date().toISOString());

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      action: 'pause',
      message: 'Pause requested - sprint will pause after current task',
    }));
  } catch (error) {
    // Error handling...
  }
}
```

### Pattern from: page.ts (Navigation bar dropdown)
```typescript
// Existing dropdown - needs enhancement
function generateNavigationBar(navigation: SprintNavigation): string {
  return `
    <nav class="nav-bar">
      <div class="nav-right">
        <label class="sprint-switcher">
          <span class="sprint-switcher-label">Sprint:</span>
          <select id="sprint-select" class="sprint-select" onchange="window.location.href='/sprint/' + this.value">
            ${sprintOptions}
          </select>
        </label>
      </div>
    </nav>`;
}
```

### Pattern from: loop.ts (Progress writing)
```typescript
// Use writeProgressAtomic for safe writes
async function writeProgressAtomic(filePath: string, progress: CompiledProgress): Promise<void> {
  await writeProgressYamlAtomic(filePath, progress as unknown as YamlOpsProgress);
}

// In main loop - add heartbeat here
while (!isTerminalState(state) && state.status === 'in-progress') {
  // Write last-activity timestamp before each iteration
  // ...existing iteration logic...
}
```

## Required Imports

### Internal
- `transforms.ts`: Import `CompiledProgress` from `../types.js`, add `last-activity` field access
- `status-types.ts`: No new imports needed, extend `SprintHeader`
- `loop.ts`: No new imports needed, use existing `writeProgressAtomic`
- `server.ts`: No new imports needed, uses existing pattern for routes
- `page.ts`: No new imports needed

### External
- No new external packages required

## Types/Interfaces to Use

### From status-types.ts (extend SprintHeader)
```typescript
export interface SprintHeader {
  // ... existing fields
  /** Whether the sprint is stale (in-progress but inactive > 15 min) */
  isStale?: boolean;
}
```

### From types.ts (CompiledProgress with last-activity)
```typescript
// Access via type assertion or extend interface
interface CompiledProgressWithHeartbeat extends CompiledProgress {
  'last-activity'?: string;  // ISO timestamp of last loop iteration
  'interrupted-at'?: string; // ISO timestamp when interrupted by signal
}
```

### New type for interrupted status
```typescript
// In transition.ts or types.ts
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human' | 'interrupted';
```

## Integration Points

### transforms.ts
- Called by: `server.ts::handleAPIRequest()`, `server.ts::handleProgressChange()`
- Receives: `CompiledProgress` with optional `last-activity` field
- Returns: `StatusUpdate` with `isStale` flag in header

### loop.ts
- Called by: `cli.ts::runCommand()`
- Writes to: `PROGRESS.yaml` (via `writeProgressAtomic`)
- New: Writes `last-activity` timestamp each iteration
- New: Handles SIGTERM/SIGINT signals

### server.ts
- New endpoint: `/api/sprint/:id/resume`
- Pattern: Match existing skip/retry endpoint handling
- Creates: `.resume-requested` signal file (already in SIGNAL_FILES)

### page.ts
- Generates: HTML with JavaScript
- New: SSE cleanup on dropdown change
- New: Loading indicator element + show logic
- New: Stale badge CSS and JS rendering
- New: Resume button (conditionally shown for stale/interrupted sprints)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `compiler/src/status-server/transforms.ts` | Modify | Add `isStale` detection based on `last-activity` timestamp |
| `compiler/src/status-server/status-types.ts` | Modify | Add `isStale?: boolean` to `SprintHeader` interface |
| `compiler/src/status-server/page.ts` | Modify | Add SSE cleanup, loading indicator, stale badge, resume button |
| `compiler/src/status-server/server.ts` | Modify | Add `/api/sprint/:id/resume` route handler |
| `runtime/src/loop.ts` | Modify | Add heartbeat writing and signal handlers |
| `compiler/src/types.ts` | Modify | Add 'interrupted' to SprintStatus type |

## Constants

```typescript
// Staleness threshold
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

// Signal file (already exists in server.ts)
const SIGNAL_FILES = {
  PAUSE: '.pause-requested',
  RESUME: '.resume-requested',  // Already defined
  STOP: '.stop-requested',
  FORCE_RETRY: '.force-retry-requested',
} as const;
```

## Test Files (Already Created - RED Phase)

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| `compiler/src/status-server/dropdown-navigation.test.ts` | 5 | 1, 2 |
| `runtime/src/loop-heartbeat.test.ts` | 6 | 3, 4, 5 |
| `compiler/src/status-server/stale-detection.test.ts` | 8 | 6, 7 |
| `compiler/src/status-server/resume-endpoint.test.ts` | 6 | 8 |

## Implementation Notes

1. **Staleness Detection Logic**:
   ```typescript
   function isSprintStale(progress: CompiledProgress): boolean {
     if (progress.status !== 'in-progress') return false;
     const lastActivity = (progress as any)['last-activity'];
     if (!lastActivity) return false;
     const elapsed = Date.now() - new Date(lastActivity).getTime();
     return elapsed > STALE_THRESHOLD_MS;
   }
   ```

2. **Signal Handler Pattern**:
   ```typescript
   function setupSignalHandlers(sprintDir: string, progress: CompiledProgress): void {
     const handler = async (signal: string) => {
       progress.status = 'interrupted' as SprintStatus;
       (progress as any)['interrupted-at'] = new Date().toISOString();
       await writeProgressAtomic(path.join(sprintDir, 'PROGRESS.yaml'), progress);
       process.exit(0);
     };
     process.on('SIGTERM', () => handler('SIGTERM'));
     process.on('SIGINT', () => handler('SIGINT'));
   }
   ```

3. **Dropdown Enhancement**:
   - Change inline `onchange` to use a JavaScript function
   - Function should: close eventSource, show loading indicator, then navigate

4. **Resume Endpoint**:
   - Should only allow resuming 'interrupted' or 'stale' (which is actually 'in-progress') sprints
   - Creates `.resume-requested` signal file
   - Returns success JSON response

5. **Existing Resume Button**: Note that page.ts already has a `resume-btn` element for paused sprints. The stale resume functionality should use a different button or enhance the existing one to also show for stale sprints.
