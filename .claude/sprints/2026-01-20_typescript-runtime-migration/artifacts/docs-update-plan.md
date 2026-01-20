# Documentation Update Plan: 2026-01-20_typescript-runtime-migration

## Code Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `plugins/m42-sprint/runtime/` (new directory) | Added | New TypeScript runtime with 8 modules |
| `runtime/src/transition.ts` | Added | Pure state machine transition function |
| `runtime/src/yaml-ops.ts` | Added | Atomic YAML operations with checksum validation |
| `runtime/src/prompt-builder.ts` | Added | Prompt generation (replaces bash scripts) |
| `runtime/src/claude-runner.ts` | Added | Claude CLI wrapper with error handling |
| `runtime/src/executor.ts` | Added | Action executor mapping |
| `runtime/src/loop.ts` | Added | Main Ralph Loop implementation |
| `runtime/src/cli.ts` | Added | CLI entry point |
| `runtime/src/index.ts` | Added | Module exports |
| `runtime/*.test.ts` | Added | Unit tests for all modules |
| `compiler/src/types.ts` | Modified | Added discriminated unions for type-safe states |
| `scripts/sprint-loop.sh` | Deleted | Replaced by TypeScript runtime |
| `scripts/build-sprint-prompt.sh` | Deleted | Replaced by prompt-builder.ts |
| `scripts/build-parallel-prompt.sh` | Deleted | Merged into prompt-builder.ts |
| `scripts/preflight-check.sh` | Deleted | Replaced by TypeScript validation |
| `scripts/test-*.sh` | Kept | Integration tests preserved |

## Documentation Impact

### Already Updated (In Sprint)

The following files were updated during the sprint:

| File | Status | What Was Updated |
|------|--------|------------------|
| `README.md` | Updated | Removed yq requirement, documented TypeScript runtime |
| `docs/reference/commands.md` | Updated | Documented TypeScript runtime usage in /run-sprint |
| `docs/concepts/overview.md` | Updated | Component map shows runtime/ directory structure |

### User Guide Updates

| Section | Action | Reason |
|---------|--------|--------|
| Prerequisites section | **NONE NEEDED** | Already mentions only Node.js |
| Activity Logging section | Verify | Hook script path still valid after bash removal |

### Getting Started Updates

| Section | Action | Reason |
|---------|--------|--------|
| `docs/getting-started/quick-start.md` | **UPDATE** | Still references yq requirement that was removed |
| `docs/getting-started/first-sprint.md` | **UPDATE** | Full yq section in prerequisites + yq troubleshooting section needs removal |

### Troubleshooting Updates

| Section | Action | Reason |
|---------|--------|--------|
| "Node.js Not Available" section | **NONE NEEDED** | Already covers Node.js requirement |
| "yq" mentions | **VERIFY** | Quick diagnostics section still shows `which yq` |
| Add TypeScript section | **ADD** | New troubleshooting for TypeScript-specific issues |

### Reference Updates

| Item | Action | Details |
|------|--------|---------|
| API Reference | **NONE NEEDED** | Status server unchanged |
| SPRINT.yaml Schema | **NONE NEEDED** | Format unchanged |
| PROGRESS.yaml Schema | **NONE NEEDED** | Format unchanged |
| Workflow Schema | **NONE NEEDED** | Format unchanged |

### Concept Documentation Updates

| File | Action | Reason |
|------|--------|--------|
| `docs/concepts/ralph-loop.md` | **UPDATE** | Contains bash/yq code snippet for mode detection (line 356) |
| `docs/concepts/overview.md` | **VERIFIED** | Already shows runtime/ in component map - no changes needed |

## Files to Update

| File | Updates Needed | Priority |
|------|----------------|----------|
| `docs/getting-started/quick-start.md` | Remove yq from prerequisites, update install commands | High |
| `docs/getting-started/first-sprint.md` | Remove yq prerequisites section (lines 11-30), remove yq troubleshooting (lines 508-525) | High |
| `docs/troubleshooting/common-issues.md` | Remove `which yq` from quick diagnostics (line 23), add TypeScript section | High |
| `docs/concepts/ralph-loop.md` | Update mode detection code snippet from bash/yq to TypeScript | Medium |
| `docs/USER-GUIDE.md` | Verify hook script path reference is still valid | Low |

## Detailed Update Instructions

### 1. `docs/getting-started/quick-start.md`

**Current (lines 11-29):**
```markdown
## Prerequisites

Before starting, verify you have these tools installed:

```bash
# Check yq (required for YAML processing)
yq --version
# Expected: yq (https://github.com/mikefarah/yq/) version v4.x

# Check Node.js (required for compilation - workflow mode only)
node --version
# Expected: v18.x or higher
```

**Install if missing:**
```bash
# macOS
brew install yq node

# Linux (Ubuntu/Debian)
sudo snap install yq
sudo apt install nodejs npm
```
```

**Should become:**
```markdown
## Prerequisites

Before starting, verify you have Node.js installed:

```bash
# Check Node.js (required for compilation and runtime)
node --version
# Expected: v18.x or higher
```

**Install if missing:**
```bash
# macOS
brew install node

# Linux (Ubuntu/Debian)
sudo apt install nodejs npm

# Or use nvm (recommended)
nvm install --lts
```
```

### 2. `docs/troubleshooting/common-issues.md`

**Updates needed:**

1. Remove yq from Quick Diagnostics section (line 23: `which yq`)
2. Add new section for TypeScript runtime issues:

```markdown
## TypeScript Runtime Issues

### Build Errors in Runtime

**Symptom:**
```
Error: Cannot find module './transition.js'
```

**Cause:** TypeScript runtime not compiled.

**Solution:**
```bash
cd plugins/m42-sprint/runtime && npm run build
```

### Type Errors During Execution

**Symptom:**
```
TypeError: Cannot read properties of undefined
```

**Cause:** PROGRESS.yaml may be malformed or missing required fields.

**Solution:**
1. Validate PROGRESS.yaml structure
2. Delete PROGRESS.yaml and recompile:
   ```bash
   /run-sprint .claude/sprints/your-sprint --recompile
   ```
```

### 3. `docs/getting-started/first-sprint.md`

**Remove yq Prerequisites section (lines 11-30):**
```markdown
### yq (YAML Processor)

M42 Sprint uses `yq` extensively for YAML manipulation.

```bash
# Check installation
yq --version
# Expected: yq (https://github.com/mikefarah/yq/) version v4.x
```

... [all yq install instructions]

**Important:** The `yq` we use is **Mike Farah's yq** (Go version)...
```

**Remove yq troubleshooting section (lines 508-525):**
```markdown
### "yq: command not found"

**Cause:** yq is not installed or not in PATH.

**Solution:**
```bash
# macOS
brew install yq
... [all yq install commands]
```
```

**Update troubleshooting commands (lines 565-571, 591-601):**
Replace yq commands with TypeScript-based alternatives or remove them.

### 4. `docs/concepts/ralph-loop.md`

**Update mode detection snippet (around line 356):**

**Current:**
```bash
MODE=$(yq -r '.mode // "standard"' "$PROGRESS_FILE")

if [[ "$MODE" == "ralph" ]]; then
  run_ralph_loop    # Autonomous goal-driven execution
```

**Should become:**
```typescript
// The TypeScript runtime reads mode from PROGRESS.yaml
const progress = await readProgress(progressFile);
const mode = progress.mode ?? 'standard';

if (mode === 'ralph') {
  await runRalphLoop(sprintDir, options);
```

### 5. `docs/USER-GUIDE.md`

**Verify line 94:** The hook script path `sprint-activity-hook.sh` still exists and is valid. This file was NOT deleted (only sprint-loop.sh and build-*.sh were removed).

## New Documentation Needed

No new documentation files needed. All changes are updates to existing files.

## Verification Plan

- [ ] All code examples tested (especially installation commands)
- [ ] All commands verified (`node --version` in prerequisites)
- [ ] All internal links checked (no broken references to deleted scripts)
- [ ] No references to yq as a requirement
- [ ] No references to deleted bash scripts (sprint-loop.sh, build-sprint-prompt.sh, etc.)
- [ ] TypeScript runtime directory structure documented in overview.md

## Grep Verification Commands

```bash
# Verify no yq requirements remain in user-facing docs
grep -r "yq" plugins/m42-sprint/docs/ --include="*.md"

# Verify no references to deleted scripts
grep -r "sprint-loop.sh" plugins/m42-sprint/docs/ --include="*.md"
grep -r "build-sprint-prompt" plugins/m42-sprint/docs/ --include="*.md"
grep -r "build-parallel-prompt" plugins/m42-sprint/docs/ --include="*.md"
grep -r "preflight-check" plugins/m42-sprint/docs/ --include="*.md"

# Verify runtime is documented
grep -r "runtime" plugins/m42-sprint/docs/ --include="*.md"
```

## Summary

The TypeScript runtime migration was largely self-documenting:
- **README.md** was updated during the sprint to remove yq and document TypeScript
- **commands.md** was updated to reference TypeScript runtime
- **overview.md** was updated with the new component structure

### Files Requiring Updates (4 files)

| File | Estimated Changes | Priority |
|------|-------------------|----------|
| `quick-start.md` | ~20 lines (remove yq prerequisites) | High |
| `first-sprint.md` | ~50 lines (remove yq section + troubleshooting) | High |
| `common-issues.md` | ~40 lines (remove yq, add TypeScript section) | High |
| `ralph-loop.md` | ~15 lines (update code snippet) | Medium |

### Total Scope
- **4 files** need updates
- **~125 lines** estimated to change
- **All documentation updates** are about removing outdated yq references and updating code examples

### Next Phase: doc-update
The next phase should apply these changes to the documentation files.
