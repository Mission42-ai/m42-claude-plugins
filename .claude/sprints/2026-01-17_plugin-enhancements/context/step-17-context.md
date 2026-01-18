# Step Context: step-17

## Task
Phase 5 - Step 3: Add Performance Metrics Section

Add collapsible section showing phase timing statistics with bar chart visualization.

## Related Code Patterns

### Similar Implementation: Live Activity Collapsible Section (page.ts:131-148)
```html
<section class="live-activity" id="live-activity-section">
  <div class="section-header-row">
    <h2 class="section-title">Live Activity</h2>
    <div class="activity-controls">
      <!-- controls here -->
      <button class="collapse-btn" id="collapse-activity-btn" title="Collapse/Expand">▼</button>
    </div>
  </div>
  <div class="live-activity-content" id="live-activity-content">
    <!-- content here -->
  </div>
</section>
```

### Similar CSS: Collapse Toggle (page.ts:1119-1136)
```css
.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.collapse-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--text-muted);
}
```

### Similar CSS: Section Collapsed State (page.ts:1071-1074)
```css
.live-activity.collapsed {
  max-height: 36px;
  overflow: hidden;
}
```

### Similar JS: Collapse Toggle Handler (page.ts:4129-4139)
```javascript
elements.collapseActivityBtn.addEventListener('click', function() {
  activityCollapsed = !activityCollapsed;
  if (activityCollapsed) {
    elements.liveActivitySection.classList.add('collapsed');
    this.textContent = '▶';
  } else {
    elements.liveActivitySection.classList.remove('collapsed');
    this.textContent = '▼';
  }
});
```

### Section Header Row Pattern (page.ts:1076-1090)
```css
.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
```

## Required Imports
### Internal (already imported in page.ts)
- No new imports needed - page.ts is self-contained

### External
- No new external packages needed

## Types/Interfaces to Use

### From timing-tracker.ts
```typescript
interface PhaseTimingStats {
  phaseId: string;
  workflow: string;
  sampleSize: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  stdDevMs?: number;
}
```

### /api/timing Response Structure (server.ts:719-727)
```json
{
  "estimatedRemainingMs": 0,
  "estimatedRemaining": "unknown",
  "estimateConfidence": "no-data",
  "estimatedCompletionTime": null,
  "phaseEstimates": {},
  "historicalStats": []  // Array of PhaseTimingStats
}
```

### timing.jsonl Record Format
```json
{
  "phaseId": "context",
  "workflow": "unknown",
  "startTime": "2026-01-17T21:23:36Z",
  "endTime": "2026-01-17T21:23:36Z",
  "durationMs": 0,
  "sprintId": "2026-01-17_plugin-enhancements"
}
```

## Integration Points

### HTML Insertion Location
- Insert the performance metrics section after the Activity Feed section (after line 155 in page.ts HTML structure)
- Alternative: Insert after Live Activity section (line 148)

### Data Flow
1. Fetch `/api/timing` on page load (inside `init()` function)
2. Re-fetch on `status-update` SSE events (in `handleStatusUpdate()`)
3. Parse `historicalStats` array for per-phase timing statistics
4. Calculate sprint totals from the data
5. Render bar chart using CSS width percentages

### CSS Section Location
- Add new CSS rules after the live-activity styles (~line 1140)
- Follow existing naming pattern: `.performance-metrics`, `.metrics-*`

### JavaScript Section
- Add DOM element reference in `elements` object (~line 2530)
- Add state variable `metricsCollapsed` similar to `activityCollapsed`
- Add fetch function `fetchTimingData()`
- Add render function `renderPerformanceMetrics()`
- Add event listener for collapse toggle

## Implementation Notes

### Bar Chart Visualization
```javascript
// Calculate max duration for percentage scaling
const maxDuration = Math.max(...stats.map(s => s.avgDurationMs));

// Render bar with relative width
const widthPercent = (stat.avgDurationMs / maxDuration) * 100;
```

### Duration Formatting (reuse existing pattern from timing-tracker.ts:459-473)
```javascript
function formatDuration(ms) {
  if (ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) return hours + 'h ' + minutes + 'm';
  if (minutes > 0) return minutes + 'm ' + seconds + 's';
  return seconds + 's';
}
```

### Sprint Totals Calculation
```javascript
const totalExecutionMs = stats.reduce((sum, s) => sum + (s.avgDurationMs * s.sampleSize), 0) / totalSamples;
const avgPhaseDuration = totalExecutionMs / stats.length;
const longestPhase = stats.reduce((max, s) => s.avgDurationMs > max.avgDurationMs ? s : max);
const shortestPhase = stats.reduce((min, s) => s.avgDurationMs < min.avgDurationMs ? s : min);
```

### Color Scheme for Bars
- Use existing accent colors: `--accent-blue` (#58a6ff) for bars
- Background: `--bg-tertiary` (#21262d)
- Alternative gradient based on duration: green (fast) -> yellow (medium) -> red (slow)

### Auto-refresh Pattern
Already handled by SSE - the `handleStatusUpdate()` function can trigger re-fetch of timing data:
```javascript
function handleStatusUpdate(data) {
  // ... existing code ...
  fetchTimingData(); // Add this call
}
```

## Test Integration Points
- TypeScript compilation: `cd plugins/m42-sprint/compiler && npx tsc --noEmit`
- No separate test files to extend - verification is via grep patterns in gherkin scenarios

## Gherkin Verification Patterns
From step-17-gherkin.md, the implementation must include text/patterns matching:
1. `id="performance-metrics"` or `class="[^"]*metrics[^"]*"` + `Performance.*Metrics|Timing.*Statistics`
2. `metrics.*collapse|collapse.*metrics|toggle.*metrics|metrics.*toggle`
3. `phase.*duration|duration.*phase|timing.*phase|phase.*timing`
4. `metrics.*bar|bar.*width|duration.*bar|timing.*bar|progress.*bar.*metrics`
5. `total.*time|total.*duration|average.*phase|longest.*phase|shortest.*phase|total.*execution`
6. TypeScript compiles without errors
