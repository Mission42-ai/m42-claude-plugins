# Step Context: step-11

## Task
Track D - Step 4: Implement Progress Estimation

Add time estimation and progress tracking for sprints and phases.

Requirements:
- Track historical phase durations in `<sprint-dir>/timing.jsonl`
- Record format: `{"phaseId":"string","workflow":"string","startTime":"ISO","endTime":"ISO","durationMs":number}`
- Create timing database aggregating data from all past sprints
- Store in `.claude/sprints/.timing-history.jsonl`
- Calculate rolling averages per workflow/phase type
- Display in status page:
  - "Estimated time remaining" in sprint header
  - Per-phase ETA based on similar past phases
  - Visual timeline showing projected completion
  - Actual vs estimated comparison for completed phases
- Handle first-run case (no historical data) gracefully
- Update estimates in real-time as phases complete
- Show confidence level based on sample size

Files to modify:
- scripts/sprint-loop.sh (record phase timing)
- compiler/src/status-server/server.ts (timing aggregation endpoints)
- compiler/src/status-server/page.ts (estimation UI)

New files:
- compiler/src/status-server/timing-tracker.ts (timing logic)

## Related Code Patterns

### Similar Implementation: activity-watcher.ts (JSONL tailing)
```typescript
// Pattern for reading JSONL files incrementally
// From: compiler/src/status-server/activity-watcher.ts
export class ActivityWatcher extends EventEmitter {
  private readonly filePath: string;
  private lastPosition = 0;
  private lastSize = 0;

  // Read initial content (tail behavior)
  private readInitialContent(): void {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    // Process lines...
  }

  // Parse JSONL line with validation
  private parseLine(line: string): void {
    try {
      const parsed = JSON.parse(line);
      if (isValidEvent(parsed)) {
        this.emit('event', parsed);
      }
    } catch (error) {
      console.warn('[Watcher] Skipping corrupted line');
    }
  }
}
```

### Similar Implementation: activity-types.ts (Type guards)
```typescript
// Pattern for TypeScript type guards for JSONL data
// From: compiler/src/status-server/activity-types.ts
export function isActivityEvent(obj: unknown): obj is ActivityEvent {
  if (typeof obj !== 'object' || obj === null) return false;
  const event = obj as Record<string, unknown>;
  if (typeof event.ts !== 'string') return false;
  // Validate required fields...
  return true;
}
```

### Similar Implementation: sprint-activity-hook.sh (JSONL writing)
```bash
# Pattern for atomic JSONL append
# From: hooks/sprint-activity-hook.sh

ACTIVITY_FILE="$SPRINT_DIR/.sprint-activity.jsonl"
TEMP_FILE=$(mktemp -p "$SPRINT_DIR" .sprint-activity.tmp.XXXXXX)

# Append: copy existing + new line to temp, then atomically mv
{
  if [[ -f "$ACTIVITY_FILE" ]]; then
    cat "$ACTIVITY_FILE"
  fi
  echo "$OUTPUT"
} > "$TEMP_FILE"

mv "$TEMP_FILE" "$ACTIVITY_FILE"
```

### Similar Implementation: transforms.ts (Duration formatting)
```typescript
// Pattern for elapsed time calculation
// From: compiler/src/status-server/transforms.ts
export function calculateElapsed(startIso: string, endIso?: string): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  const diffMs = end.getTime() - start.getTime();

  const seconds = Math.floor(diffMs / 1000) % 60;
  const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
```

### Similar Implementation: sprint-loop.sh (Phase timing)
```bash
# Existing pattern for recording elapsed time in PROGRESS.yaml
# From: scripts/sprint-loop.sh

calculate_elapsed() {
  local started_at="$1"
  local completed_at="$2"
  # Convert ISO timestamps to epoch seconds
  start_epoch=$(date -d "$started_at" "+%s")
  end_epoch=$(date -d "$completed_at" "+%s")
  local elapsed_seconds=$((end_epoch - start_epoch))
  printf "%02d:%02d:%02d" "$hours" "$minutes" "$seconds"
}

update_phase_elapsed() {
  local phase_idx="$1"
  local base_path=".phases[$phase_idx]"
  local started_at=$(yq -r "$base_path.\"started-at\"" "$PROGRESS_FILE")
  local completed_at=$(yq -r "$base_path.\"completed-at\"" "$PROGRESS_FILE")
  local elapsed=$(calculate_elapsed "$started_at" "$completed_at")
  yq -i "$base_path.elapsed = \"$elapsed\"" "$PROGRESS_FILE"
}
```

## Required Imports
### Internal (for timing-tracker.ts)
- `types.ts`: `CompiledProgress`, `CompiledPhase`, `CompiledStep`, `CompiledTopPhase`, `PhaseStatus`
- `status-types.ts`: `SprintHeader` (to extend with timing estimates)

### External
- `fs`: File system operations (readFileSync, writeFileSync, existsSync, statSync)
- `path`: Path manipulation (join, dirname, basename)
- No new external packages needed

## Types/Interfaces to Use

### New types for timing-tracker.ts
```typescript
/**
 * Individual phase timing record (stored in JSONL)
 */
export interface PhaseTimingRecord {
  phaseId: string;      // e.g., "context", "implement", "verify"
  workflow: string;     // e.g., "standard-workflow", "step-workflow"
  startTime: string;    // ISO timestamp
  endTime: string;      // ISO timestamp
  durationMs: number;   // Duration in milliseconds
  sprintId?: string;    // Optional: which sprint this was from
}

/**
 * Aggregated timing statistics for a phase type
 */
export interface PhaseTimingStats {
  phaseId: string;
  workflow: string;
  sampleSize: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  stdDevMs?: number;
}

/**
 * Estimate result with confidence
 */
export interface TimingEstimate {
  estimatedMs: number;
  confidence: 'low' | 'medium' | 'high';
  sampleSize: number;
  basedOn: string;  // Description of what the estimate is based on
}

/**
 * Confidence thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  low: 1,      // 1-2 samples
  medium: 3,   // 3-9 samples
  high: 10     // 10+ samples
} as const;
```

### Extended SprintHeader (for status-types.ts)
```typescript
// Fields to add to SprintHeader interface
interface SprintHeaderExtensions {
  /** Estimated milliseconds remaining */
  estimatedRemainingMs?: number;
  /** Formatted estimated time remaining */
  estimatedRemaining?: string;
  /** Confidence level of the estimate */
  estimateConfidence?: 'low' | 'medium' | 'high' | 'no-data';
  /** Estimated completion time (ISO) */
  estimatedCompletionTime?: string;
}
```

## Integration Points

### Called by
- `server.ts`: Will import and use `TimingTracker` class to:
  - Load timing history on startup
  - Add `/api/timing` endpoint for timing data
  - Include timing estimates in status updates
- `transforms.ts`: May need to call timing estimate functions when building `StatusUpdate`

### Calls
- File system APIs (fs) for reading/writing JSONL files
- Path APIs for resolving file paths

### Tests
- No existing test file for timing-tracker.ts (new file)
- Can follow pattern from `validate.test.ts` if tests are needed

## Implementation Notes

### Recording Phase Timing in sprint-loop.sh
- Timing data should be recorded AFTER phase completes (in the existing `update_phase_elapsed` function)
- Record format is JSONL (one JSON object per line)
- Use atomic write pattern from `sprint-activity-hook.sh`
- Extract workflow name from PROGRESS.yaml metadata
- File location: `$SPRINT_DIR/timing.jsonl`

### Aggregating Historical Data
- On server startup, scan all sprint directories under `.claude/sprints/`
- Read each `timing.jsonl` file if it exists
- Aggregate into `.claude/sprints/.timing-history.jsonl` (global history)
- Calculate rolling averages grouped by `(workflow, phaseId)`

### First-run Handling
- Check if `.timing-history.jsonl` exists and has data
- If no historical data: show "No estimate available" or use default estimates
- Confidence level should reflect sample size:
  - 1-2 samples: "low" confidence
  - 3-9 samples: "medium" confidence
  - 10+ samples: "high" confidence

### UI Updates in page.ts
- Add estimated time remaining to header section (near progress bar)
- Show confidence indicator (colored badge or icon)
- Add per-phase ETA tooltip or column in phase tree
- For completed phases: show "Actual vs Estimated" comparison
- Consider a visual timeline showing projected completion

### API Endpoints to Add in server.ts
- `GET /api/timing`: Returns current timing estimates for the sprint
- Include timing data in the existing `/api/status` response via `StatusUpdate`

### Real-time Updates
- When a phase completes, recalculate remaining time estimate
- Broadcast updated estimates via SSE to connected clients
- Update estimates optimistically based on completed phase times
