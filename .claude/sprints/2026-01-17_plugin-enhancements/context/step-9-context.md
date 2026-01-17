# Step Context: step-9

## Task
Phase 4 - Step 1: Create SprintScanner Module

Create module to enumerate and parse all sprints in .claude/sprints/ directory.

Requirements:
- Create sprint-scanner.ts with SprintScanner class
- Scan .claude/sprints/ directory for sprint folders
- Parse PROGRESS.yaml from each sprint to extract:
  - Sprint ID, name, status
  - Start time, end time, duration
  - Step count, completed count
  - Workflow used
- Sort sprints by date (newest first)
- Limit to last 50 sprints for performance
- Handle missing/corrupted PROGRESS.yaml gracefully
- Export SprintSummary type and SprintScanner class

New file to create:
- plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts

## Related Code Patterns

### Similar Implementation: timing-tracker.ts
The `TimingTracker` class in `timing-tracker.ts:96-510` provides an excellent pattern for:
- Directory scanning with `getSprintDirectories()` method
- YAML/JSONL file parsing with error handling
- Class structure with constructor taking sprint directory

```typescript
// Key pattern: Directory scanning (timing-tracker.ts:410-418)
private getSprintDirectories(): string[] {
  try {
    const entries = fs.readdirSync(this.sprintsBaseDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => path.join(this.sprintsBaseDir, e.name));
  } catch {
    return [];
  }
}
```

### Similar Implementation: server.ts
The `StatusServer` class in `server.ts:88-1345` demonstrates:
- Loading and parsing PROGRESS.yaml with js-yaml
- Error handling patterns for file operations

```typescript
// Key pattern: Loading PROGRESS.yaml (server.ts:1274-1283)
private loadProgress(): CompiledProgress {
  const content = fs.readFileSync(this.progressFilePath, 'utf-8');
  const progress = yaml.load(content) as CompiledProgress;

  if (!progress || typeof progress !== 'object') {
    throw new Error('Invalid PROGRESS.yaml format');
  }

  return progress;
}
```

### Similar Implementation: watcher.ts
The `ProgressWatcher` class demonstrates the EventEmitter extension pattern and file path handling.

## Required Imports
### Internal
- `types.js`: `CompiledProgress`, `SprintStatus`, `SprintStats` for type definitions

### External
- `js-yaml`: `load` function for YAML parsing (already a project dependency)
- `fs`: File system operations (readFileSync, readdirSync, existsSync)
- `path`: Path manipulation (join, dirname, basename)

## Types/Interfaces to Use
```typescript
// From types.ts - relevant for parsing PROGRESS.yaml
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
}

interface SprintStats {
  'started-at': string | null;
  'completed-at'?: string | null;
  'total-phases': number;
  'completed-phases': number;
  'total-steps'?: number;
  'completed-steps'?: number;
  elapsed?: string;
}

type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
```

## SprintSummary Interface Design
Based on requirements and PROGRESS.yaml structure:
```typescript
export interface SprintSummary {
  sprintId: string;           // From 'sprint-id' field
  status: SprintStatus;       // From 'status' field
  startedAt: string | null;   // From stats['started-at']
  completedAt?: string | null; // From stats['completed-at']
  elapsed?: string;           // From stats.elapsed
  totalSteps: number;         // Counted from phases with steps
  completedSteps: number;     // Counted from completed phases
  totalPhases: number;        // From stats['total-phases']
  completedPhases: number;    // From stats['completed-phases']
  workflow?: string;          // From SPRINT.yaml if available
  path: string;               // Full path to sprint directory
}
```

## Integration Points
- **Called by**: Status server page.ts (for sprint history view), future dashboard endpoints
- **Calls**: Node.js fs, path, js-yaml
- **Tests**: No existing test files for status-server modules; create unit tests if time permits

## Implementation Notes
1. **Constructor**: Take `sprintsDir` parameter (path to `.claude/sprints/`)
2. **Static method alternative**: Could use `SprintScanner.scan(sprintsDir)` pattern like `loadTimingHistory()`
3. **Sort by date**: Sprint folder names follow YYYY-MM-DD pattern, so lexicographic sort works
4. **Limit 50 sprints**: After sorting, take first 50 (newest first)
5. **Graceful errors**: Use try-catch around each sprint's PROGRESS.yaml parse, skip corrupted ones
6. **Calculate step counts**: Iterate through `phases[].steps` to count total and completed
7. **Workflow detection**: Could read SPRINT.yaml's `workflow` field if present

## File Structure
```
plugins/m42-sprint/compiler/src/status-server/
├── sprint-scanner.ts  ← NEW FILE
├── index.ts           (CLI entry point)
├── server.ts          (HTTP server)
├── page.ts            (HTML generator)
├── status-types.ts    (Types)
├── transforms.ts      (Progress conversion)
├── watcher.ts         (File watcher)
├── activity-watcher.ts
├── activity-types.ts
└── timing-tracker.ts  (Similar patterns)
```

## Error Handling Pattern
From timing-tracker.ts - skip corrupted entries without crashing:
```typescript
try {
  const content = fs.readFileSync(progressPath, 'utf-8');
  const progress = yaml.load(content) as CompiledProgress;
  if (!this.isValidProgress(progress)) {
    continue; // Skip invalid
  }
  summaries.push(this.extractSummary(progress, sprintDir));
} catch {
  // Skip corrupted PROGRESS.yaml
  console.warn(`[SprintScanner] Skipping corrupted sprint: ${sprintDir}`);
}
```

## Verification Strategy
1. Create scanner module
2. Instantiate with `.claude/sprints/` path
3. Call `scan()` method
4. Verify array of SprintSummary returned
5. Verify sorted by date (newest first)
6. Create test case with missing PROGRESS.yaml - should not crash
