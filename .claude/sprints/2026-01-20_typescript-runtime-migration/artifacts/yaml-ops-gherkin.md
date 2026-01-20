# Gherkin Scenarios: yaml-ops

## Step Task
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

## Dependencies
- js-yaml (already in runtime/package.json)
- crypto (Node.js built-in)

## Files to Create
- plugins/m42-sprint/runtime/src/yaml-ops.ts
- plugins/m42-sprint/runtime/src/yaml-ops.test.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Atomic Write Creates Valid YAML File

```gherkin
Scenario: Atomic write creates valid YAML file
  Given a valid CompiledProgress object
  When writeProgressAtomic is called with a file path and progress
  Then the file is created with valid YAML content
  And the content can be parsed back to the original structure
  And a checksum file is created alongside it

Verification: `test -f PROGRESS.yaml && test -f PROGRESS.yaml.checksum && yq -e '.' PROGRESS.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Atomic Write Uses Temp File Pattern

```gherkin
Scenario: Atomic write uses temp file for atomicity
  Given a valid CompiledProgress object
  When writeProgressAtomic is called
  Then a temporary file is created in the same directory
  And the temp file is renamed to the target path (atomic on POSIX)
  And no temp file remains after completion

Verification: `ls -la *.tmp.* 2>/dev/null | wc -l`
Pass: Exit code = 0 and output = 0 → Score 1
Fail: Exit code ≠ 0 or temp files remain → Score 0
```

---

## Scenario 3: Read Progress Validates Checksum

```gherkin
Scenario: Read validates checksum when checksum file exists
  Given a PROGRESS.yaml file with a valid checksum file
  When readProgress is called
  Then the file content is validated against the checksum
  And the CompiledProgress object is returned

Verification: `node -e "const {readProgress} = require('./dist/yaml-ops.js'); readProgress('test/PROGRESS.yaml')"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Read Progress Throws on Checksum Mismatch

```gherkin
Scenario: Read throws error when file is corrupted (checksum mismatch)
  Given a PROGRESS.yaml file with a checksum file
  And the file content has been modified without updating checksum
  When readProgress is called
  Then an error is thrown with message containing "checksum mismatch"

Verification: `node -e "..." 2>&1 | grep -q "checksum mismatch"`
Pass: Exit code = 0 (grep finds match) → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Read Progress Succeeds Without Checksum File

```gherkin
Scenario: Read succeeds when no checksum file exists (first run)
  Given a PROGRESS.yaml file without a checksum file
  When readProgress is called
  Then the file is read without validation
  And the CompiledProgress object is returned

Verification: `rm -f test/PROGRESS.yaml.checksum && node -e "const {readProgress} = require('./dist/yaml-ops.js'); console.log(readProgress('test/PROGRESS.yaml')['sprint-id'])"`
Pass: Exit code = 0 and output is sprint ID → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Backup Creates .backup File

```gherkin
Scenario: Backup creates .backup file for recovery
  Given an existing PROGRESS.yaml file
  When backupProgress is called
  Then a PROGRESS.yaml.backup file is created
  And the backup content matches the original
  And if a checksum file exists, it is also backed up

Verification: `test -f PROGRESS.yaml.backup && diff PROGRESS.yaml PROGRESS.yaml.backup`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Restore Recovers From Backup

```gherkin
Scenario: Restore recovers file from backup
  Given a PROGRESS.yaml.backup file exists
  And the main PROGRESS.yaml may be corrupted or missing
  When restoreProgress is called
  Then the backup file is moved to PROGRESS.yaml
  And the checksum backup is also restored if it exists
  And the function returns true

Verification: `test -f PROGRESS.yaml && test ! -f PROGRESS.yaml.backup`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Restore Returns False When No Backup

```gherkin
Scenario: Restore returns false when no backup exists
  Given no PROGRESS.yaml.backup file exists
  When restoreProgress is called
  Then the function returns false
  And no files are modified

Verification: `node -e "const {restoreProgress} = require('./dist/yaml-ops.js'); process.exit(restoreProgress('nonexistent.yaml') ? 1 : 0)"`
Pass: Exit code = 0 (returned false) → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| plugins/m42-sprint/runtime/src/yaml-ops.test.ts | 18+ | 1, 2, 3, 4, 5, 6, 7, 8 |

### Test Case Breakdown

**writeProgressAtomic tests:**
1. Creates valid YAML file (Scenario 1)
2. Creates checksum file (Scenario 1)
3. Temp file cleanup on success (Scenario 2)
4. Temp file cleanup on error (Scenario 2)
5. Atomic rename pattern (Scenario 2)

**readProgress tests:**
6. Reads valid YAML (Scenario 3)
7. Validates checksum when present (Scenario 3)
8. Throws on checksum mismatch (Scenario 4)
9. Succeeds without checksum file (Scenario 5)
10. Returns correct structure (Scenario 3, 5)

**backupProgress tests:**
11. Creates .backup file (Scenario 6)
12. Backs up checksum file if present (Scenario 6)
13. Overwrites existing backup (Scenario 6)

**restoreProgress tests:**
14. Restores from backup (Scenario 7)
15. Restores checksum backup (Scenario 7)
16. Returns true on success (Scenario 7)
17. Returns false when no backup (Scenario 8)
18. Does not modify files when no backup (Scenario 8)

**cleanupBackup tests:**
19. Removes backup file
20. Removes checksum backup
21. No-op when no backup exists

**calculateChecksum tests:**
22. Returns SHA256 hex string
23. Same content produces same hash
24. Different content produces different hash

## RED Phase Verification

Tests are expected to FAIL at this point:
```bash
cd plugins/m42-sprint/runtime
npm run build && node dist/yaml-ops.test.js
# Expected: FAIL (no implementation yet)
# Error: Cannot find module './yaml-ops.js'
```

## API Contract

```typescript
// yaml-ops.ts exports
export async function writeProgressAtomic(filePath: string, progress: CompiledProgress): Promise<void>;
export function readProgress(filePath: string): CompiledProgress;
export function backupProgress(filePath: string): void;
export function restoreProgress(filePath: string): boolean;
export function cleanupBackup(filePath: string): void;
export function calculateChecksum(content: string): string;
```

## Error Types

| Error | Condition | Message Pattern |
|-------|-----------|-----------------|
| ChecksumMismatchError | Checksum validation fails | "checksum mismatch" |
| YamlParseError | Invalid YAML syntax | "YAML parse error" |
| FileNotFoundError | File doesn't exist on read | "ENOENT" |

## Notes

- Checksum uses SHA256 for reliability
- Temp files include PID for uniqueness: `{path}.tmp.{pid}`
- All file operations use synchronous fs for simplicity (except writeProgressAtomic which is async for consistency with future async operations)
- Backup/restore uses rename (atomic) not copy+delete
