# Step Context: yaml-ops

## Task
GIVEN the need to replace yq shell commands with TypeScript
WHEN implementing YAML operations
THEN create atomic read/write with checksum validation

## Scope
Create NEW file: plugins/m42-sprint/runtime/src/yaml-ops.ts

## Acceptance Criteria

### Atomic Write
- [ ] `writeProgressAtomic(filePath, progress)` → Promise<void>
- [ ] Write to temp file first (same directory for same filesystem)
- [ ] Atomic rename (mv is atomic on POSIX)
- [ ] Update checksum file after successful write

### Read with Validation
- [ ] `readProgress(filePath)` → CompiledProgress
- [ ] Validate checksum if checksum file exists
- [ ] Throw on checksum mismatch (corruption detection)

### Transaction Support
- [ ] `backupProgress(filePath)` → void (create .backup)
- [ ] `restoreProgress(filePath)` → boolean (restore from .backup)
- [ ] `cleanupBackup(filePath)` → void (remove .backup)

### Checksum
- [ ] `calculateChecksum(content)` → string (SHA256)
- [ ] Store in {file}.checksum

### Tests
- [ ] Test: atomic write survives process.exit
- [ ] Test: checksum detects file modification
- [ ] Test: backup/restore works correctly
- [ ] Test: missing checksum file is OK (first run)

## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **calculateChecksum(content)** - Pure function using crypto.createHash('sha256')
2. **writeProgressAtomic(filePath, progress)** - Async write with temp file + atomic rename
3. **readProgress(filePath)** - Sync read with optional checksum validation
4. **backupProgress(filePath)** - Copy file and checksum to .backup
5. **restoreProgress(filePath)** - Rename .backup to original (atomic)
6. **cleanupBackup(filePath)** - Remove backup files (idempotent)

## Related Code Patterns

### Pattern from: plugins/m42-sprint/scripts/sprint-loop.sh:190-340
The bash implementation provides the reference behavior:
```bash
# Checksum calculation (sha256sum or shasum -a 256)
calculate_checksum() {
  sha256sum "$PROGRESS_FILE" | cut -d' ' -f1
}

# Atomic write pattern using temp file + rename
yaml_atomic_update() {
  local temp_file="${PROGRESS_FILE}.tmp.$$"
  yq -e "$combined_expr" "$PROGRESS_FILE" > "$temp_file"
  mv "$temp_file" "$PROGRESS_FILE"  # Atomic on POSIX
  save_checksum
}

# Backup/restore uses mv (atomic rename)
restore_progress() {
  if [[ -f "$PROGRESS_BACKUP" ]]; then
    mv "$PROGRESS_BACKUP" "$PROGRESS_FILE"
    return 0
  fi
  return 1
}
```

### Pattern from: plugins/m42-sprint/runtime/src/transition.ts
Follow the module pattern:
```typescript
// Type definitions at top (copied from compiler for ESM compatibility)
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases?: CompiledTopPhase[];
  // ...
}

// Pure functions with explicit types
export function advancePointer(
  current: CurrentPointer,
  context: CompiledProgress
): { nextPointer: CurrentPointer; hasMore: boolean } {
  // Implementation
}
```

### Pattern from: xstate-patterns-plan.md Phase 7
```typescript
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as crypto from 'crypto';

const CHECKSUM_ALGORITHM = 'sha256';

export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void> {
  const content = yaml.dump(progress, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
  // Temp file pattern...
}
```

## Required Imports

### External
- `js-yaml` (^4.1.0): `yaml.dump()` and `yaml.load()` for YAML serialization
- `crypto` (Node built-in): `createHash('sha256')` for checksum calculation
- `fs` (Node built-in): File operations (writeFileSync, readFileSync, renameSync, copyFileSync, unlinkSync, existsSync)

### Internal
- Copy type definitions from transition.ts (CompiledProgress, SprintStatus, etc.) - avoids ESM import issues

## Types/Interfaces to Use

```typescript
// Copy from transition.ts for ESM compatibility
// (runtime can't import from compiler due to different tsconfig)

export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

export interface CurrentPointer {
  phase: number;
  step: number | null;
  'sub-phase': number | null;
}

export interface SprintStats {
  'started-at': string | null;
  'completed-at'?: string | null;
  'total-phases': number;
  'completed-phases': number;
  elapsed?: string;
}

// Minimal CompiledProgress for yaml-ops (doesn't need full types)
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases?: unknown[];  // yaml-ops doesn't inspect phases
  current: CurrentPointer;
  stats: SprintStats;
  [key: string]: unknown;  // Allow other fields
}
```

## Integration Points

### Called by:
- `runtime/src/loop.ts` (future) - Main sprint loop will use these functions
- `runtime/src/executor.ts` (future) - WRITE_PROGRESS action handler

### Calls:
- `js-yaml` - For YAML serialization/deserialization
- `crypto` - For SHA256 checksum
- `fs` - For file operations

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-sprint/runtime/src/yaml-ops.ts` | Create | Atomic YAML operations |
| `plugins/m42-sprint/runtime/src/yaml-ops.test.ts` | Already exists | Tests (RED phase complete) |

## API Contract

```typescript
// yaml-ops.ts exports

/**
 * Write progress to file atomically with checksum.
 * Uses temp file + rename pattern for atomicity.
 */
export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void>;

/**
 * Read progress from file with optional checksum validation.
 * Throws on checksum mismatch if checksum file exists.
 */
export function readProgress(filePath: string): CompiledProgress;

/**
 * Create backup of progress file before critical operations.
 * Also backs up checksum file if it exists.
 */
export function backupProgress(filePath: string): void;

/**
 * Restore progress from backup file.
 * Returns true if backup existed and was restored, false otherwise.
 */
export function restoreProgress(filePath: string): boolean;

/**
 * Remove backup files. Idempotent - no error if backups don't exist.
 */
export function cleanupBackup(filePath: string): void;

/**
 * Calculate SHA256 checksum of content string.
 */
export function calculateChecksum(content: string): string;
```

## Error Handling

| Error Type | Condition | Message Pattern |
|------------|-----------|-----------------|
| ChecksumMismatchError | Checksum validation fails | "checksum mismatch" |
| YamlParseError | Invalid YAML syntax | Propagate js-yaml error |
| FileNotFoundError | File doesn't exist on read | Propagate ENOENT |

## Implementation Notes

1. **Temp file naming**: `${filePath}.tmp.${process.pid}` for uniqueness
2. **Checksum file path**: `${filePath}.checksum`
3. **Backup file path**: `${filePath}.backup`
4. **Checksum backup path**: `${filePath}.checksum.backup`
5. **YAML dump options**: `{ lineWidth: -1, noRefs: true, sortKeys: false }` for consistency
6. **Always use sync fs operations** for backupProgress/restoreProgress/cleanupBackup (simplicity)
7. **writeProgressAtomic is async** for future extensibility (though current impl could be sync)

## Test Mapping (from gherkin)

| Scenario | Test Function | Key Assertions |
|----------|---------------|----------------|
| 1 | writeProgressAtomic: creates valid YAML file | File exists, parseable YAML, checksum exists |
| 2 | writeProgressAtomic: no temp files remain | No .tmp. files after operation |
| 3 | readProgress: validates checksum | Returns data when valid |
| 4 | readProgress: throws on checksum mismatch | Error contains "checksum mismatch" |
| 5 | readProgress: succeeds without checksum | Works on first run |
| 6 | backupProgress: creates .backup file | Backup exists, matches original |
| 7 | restoreProgress: recovers from backup | Main file restored, backup removed |
| 8 | restoreProgress: returns false when no backup | Returns false, no modifications |

## Sprint Context

This is part of the TypeScript runtime migration:
- **Phase**: development (2/10)
- **Step**: yaml-ops (3/9)
- **Previous steps**: types (enhanced), transition (pure function)
- **Next steps**: prompt-builder, executor, loop

The yaml-ops module provides the foundation for persistent state management that the loop and executor will depend on.
