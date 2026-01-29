# Sprint Context

## Project Info
- Test framework: Native Node.js test runner (custom test infrastructure with `test()`, `assert()`, `assertEqual()`)
- Test location: `plugins/m42-sprint/runtime/src/*.test.ts`
- Build command: `npm run build` (in `plugins/m42-sprint/runtime/`)
- Test command: `npm run test` (in `plugins/m42-sprint/runtime/`)
- Lint command: `npm run typecheck` (TypeScript type checking)

## Target Files

### Primary Implementation File
- **File:** `plugins/m42-sprint/runtime/src/loop.ts`
- **Line ~960-970:** Where prompt is built before calling Claude
- **Key Function:** `runLoop()` - main sprint execution loop

### Supporting Files
- **File:** `plugins/m42-sprint/runtime/src/worktree.ts`
- **Key Function:** `getWorktreeInfo()` - returns `WorktreeInfo` with:
  - `isWorktree: boolean`
  - `path: string` (worktree root)
  - `mainWorktreePath: string` (main repository path)
- **Key Function:** `getProjectRoot()` - determines working directory for Claude

### Test File
- **File:** `plugins/m42-sprint/runtime/src/loop.test.ts`
- **Pattern:** Uses custom test infrastructure with `test()`, `assert()`, `assertEqual()`

## Key Code Patterns

### 1. Worktree Config in PROGRESS.yaml
```yaml
worktree:
  enabled: true
  branch: "sprint/{sprint-id}"
  path: "../trees/{sprint-id}"  # relative to main repo
  working-dir: "/absolute/path/to/worktree"  # resolved absolute path
```

### 2. Working Directory Resolution (loop.ts ~960-970)
```typescript
// Current pattern for determining workingDir:
let workingDir: string;
if (progress.worktree?.enabled && progress.worktree?.path) {
  const worktreeInfo = getWorktreeInfo(sprintDir);
  workingDir = path.resolve(worktreeInfo.mainWorktreePath, progress.worktree.path);
} else {
  workingDir = getProjectRoot(sprintDir);
}
```

### 3. Claude Invocation Pattern
```typescript
const spawnResult = await deps.runClaude({
  prompt,       // <-- INJECT CONTEXT HERE
  cwd: workingDir,
  outputFile,
  jsonSchema: SPRINT_RESULT_SCHEMA,
  model: currentModel,
});
```

## Sprint Steps Overview

### Step 1: worktree-context-injection
**Problem:** When sprints run in a worktree, spawned agents don't know they're in an isolated context.

**Solution:** Prepend worktree context to the phase prompt when `progress.worktree?.enabled` is true.

**Implementation:**
1. Check if `progress.worktree?.enabled` is true
2. If so, build context block with:
   - Working directory (from `workingDir` variable)
   - Branch (from `progress.worktree.branch`)
   - Main repo path (from `getWorktreeInfo().mainWorktreePath`)
3. Prepend context block to `prompt` before passing to `runClaude()`

**Context Template:**
```markdown
## Execution Context

You are operating in a **git worktree** for isolated sprint development.

| Property | Value |
|----------|-------|
| Working Directory | {workingDir} |
| Branch | {progress.worktree.branch} |
| Main Repo | {worktreeInfo.mainWorktreePath} |

**Worktree Guidelines:**
1. Use RELATIVE paths for all file operations (e.g., `plugins/m42-sprint/...`)
2. All git commits go to the sprint branch automatically
3. You MAY read files from the main repo for research, but ALL changes must be made
   in the worktree (current working directory)
4. Do NOT `cd` to the main repository for git operations - stay in the worktree

---
```

**Acceptance Criteria:**
- [ ] When worktree is enabled, context is prepended to every phase prompt
- [ ] Context includes working directory, branch, and main repo path
- [ ] Guidelines are clear about relative paths and where to make changes
- [ ] Non-worktree sprints are unaffected (no context injected)
- [ ] Add test to verify context injection

## Dependencies
None - this is a standalone step.
