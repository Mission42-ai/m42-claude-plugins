# Step Context: step-18

## Task
Final Step: Build Verification and Cleanup

Verify all changes compile and pass quality checks.

Requirements:
- Run TypeScript compilation: `npm run build` in compiler directory
- Run type checking: `npm run typecheck` in compiler directory
- Fix any compilation errors
- Fix any type errors
- Ensure no unused imports or variables
- Verify no console.log statements left in production code (except intentional logging)

Verification:
- `npm run build` exits with code 0
- `npm run typecheck` exits with code 0
- No warnings in build output

Directory:
- plugins/m42-sprint/compiler/


## Related Code Patterns

### Build Configuration: package.json
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "test": "npm run build && node dist/validate.test.js"
  }
}
```
Note: No explicit "typecheck" script - use `npx tsc --noEmit` instead.

### TypeScript Configuration: tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```
Key: Strict mode enabled - all types must be explicit, no implicit any.

## Required Imports
### Internal (status-server modules)
- `status-types.ts`: Core type definitions (CompiledProgress, StatusUpdate, etc.)
- `activity-types.ts`: ActivityEvent types
- `transforms.ts`: toStatusUpdate, generateDiffLogEntries utilities
- `page.ts`: getPageHtml, SprintNavigation
- `timing-tracker.ts`: TimingTracker, SprintTimingInfo
- `sprint-scanner.ts`: SprintScanner, SprintSummary
- `metrics-aggregator.ts`: MetricsAggregator, AggregateMetrics
- `dashboard-page.ts`: generateDashboardPage

### External
- `commander ^12.0.0`: CLI argument parsing
- `js-yaml ^4.1.0`: YAML parsing
- Node.js built-ins: `http`, `fs`, `path`, `zlib`, `events`

## Types/Interfaces to Use
```typescript
// From status-types.ts
type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

// From sprint-scanner.ts
interface SprintSummary {
  sprintId: string;
  status: SprintStatus;
  startedAt: string | null;
  completedAt?: string | null;
  elapsed?: string;
  totalSteps: number;
  completedSteps: number;
  totalPhases: number;
  completedPhases: number;
  workflow?: string;
  path: string;
}

// From metrics-aggregator.ts
interface AggregateMetrics {
  totalSprints: number;
  completedSprints: number;
  failedSprints: number;
  inProgressSprints: number;
  // ... additional fields
}
```

## Integration Points
- Called by: Build/CI pipeline, developer verification
- Calls: TypeScript compiler (tsc)
- Tests: `validate.test.ts` runs after build

## Source Files to Verify (21 total)
```
plugins/m42-sprint/compiler/src/
├── index.ts                  # Main CLI entry
├── compile.ts                # Workflow compilation
├── types.ts                  # Core types
├── validate.ts               # YAML validation
├── validate.test.ts          # Tests
├── resolve-workflows.ts      # Workflow resolution
├── expand-foreach.ts         # For-each expansion
├── error-classifier.ts       # Error classification
└── status-server/
    ├── index.ts              # Status server CLI
    ├── server.ts             # HTTP server
    ├── page.ts               # HTML generation
    ├── watcher.ts            # Progress watcher
    ├── activity-watcher.ts   # Activity watcher
    ├── activity-types.ts     # Activity types
    ├── status-types.ts       # SSE types
    ├── transforms.ts         # Data transforms
    ├── timing-tracker.ts     # Timing calculations
    ├── browser.ts            # Browser launch
    ├── sprint-scanner.ts     # Sprint enumeration
    ├── metrics-aggregator.ts # Metrics aggregation
    └── dashboard-page.ts     # Dashboard HTML
```

## Expected Build Outputs
```
plugins/m42-sprint/compiler/dist/
├── index.js                  # Main entry
├── index.d.ts
├── compile.js
├── types.js
├── validate.js
├── validate.test.js
├── resolve-workflows.js
├── expand-foreach.js
├── error-classifier.js
└── status-server/
    ├── index.js              # Status server entry
    ├── server.js
    ├── page.js
    ├── watcher.js
    ├── activity-watcher.js
    ├── activity-types.js
    ├── status-types.js
    ├── transforms.js
    ├── timing-tracker.js
    ├── browser.js
    ├── sprint-scanner.js
    ├── metrics-aggregator.js
    └── dashboard-page.js
```

## Implementation Notes
- Build command: `cd plugins/m42-sprint/compiler && npm run build`
- Typecheck command: `cd plugins/m42-sprint/compiler && npx tsc --noEmit`
- All `.js` imports must use `.js` extension (NodeNext module resolution)
- Console logging should follow `[ComponentName]` prefix pattern for intentional logs
- No debug console.log statements should remain in production code
- Verify all new modules added in this sprint compile successfully:
  - sprint-scanner.ts (step-13)
  - metrics-aggregator.ts (step-14)
  - dashboard-page.ts (step-15)
  - server.ts updates for dashboard endpoints
