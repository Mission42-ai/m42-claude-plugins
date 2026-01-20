# Sprint Runtime Bug Report

**Date:** 2026-01-20
**Sprint:** documentation-update
**Plugin:** m42-sprint v2.0.0

## Bug 1: Bash History Expansion in Command Instructions

**Location:** `/run-sprint` command instructions (inline JavaScript via `node -e`)

**Symptom:**
```
SyntaxError: Invalid or unexpected token
    if (\!exists) {
        ^
```

**Root Cause:**
The command instructions use inline JavaScript with `node -e "..."` that contains `if (!exists)`. Bash interprets `!` as history expansion even inside quotes, transforming `!exists` into `\!exists`.

**Workaround Applied:**
Created a temporary script file `/tmp/merge-sprint-hooks.js` instead of inline JavaScript.

**Fix Required:**
Update command instructions to either:
1. Use a dedicated script file instead of inline `node -e`
2. Use `jq` if available
3. Use alternative JavaScript syntax: `if (exists === false)` instead of `if (!exists)`

---

## Bug 2: CLI Argument Parsing Overwrites Directory

**Location:** `/runtime/dist/cli.js` lines 81-84

**Symptom:**
```
Error: ENOTDIR: not a directory, open '.../.sprint-hooks.json/PROGRESS.yaml'
```

**Root Cause:**
The CLI argument parser treats any non-flag argument as the directory. When an unsupported flag like `--hook-config` is passed with a value:

```bash
node cli.js run "/path/to/sprint" --hook-config "/path/to/.sprint-hooks.json"
```

The parser:
1. Sets `directory = "/path/to/sprint"` (correct)
2. Encounters `--hook-config` (unknown flag, skipped)
3. Encounters `/path/to/.sprint-hooks.json` (doesn't start with `-`)
4. **OVERWRITES** `directory = "/path/to/.sprint-hooks.json"` (bug!)

**Code:**
```javascript
else if (!arg.startsWith('-')) {
    // Positional argument = directory
    result.directory = arg;  // BUG: Overwrites previous value
}
```

**Fix Required:**
1. Only set directory if not already set: `if (!result.directory) result.directory = arg;`
2. Or throw error on unknown arguments
3. Or implement `--hook-config` support properly

---

## Bug 3: CLI Silent Failure

**Location:** `/runtime/dist/cli.js` and `/runtime/dist/loop.js`

**Symptom:**
When running without `--hook-config`, the CLI exits with code 1 but produces **no output** - no errors, no logs, nothing.

```bash
$ node cli.js run "/path/to/sprint" -v 2>&1
# (no output)
$ echo $?
1
```

**Root Cause:**
Unknown - requires further investigation. Possible causes:
1. The `isMainModule` detection on lines 191-192 may be failing
2. An uncaught exception before any logging happens
3. The `runLoop` function may be throwing before any output

**Investigation Needed:**
- Add debug logging at the start of `main()`
- Check if `isMainModule` detection works correctly
- Verify `runLoop` function is being called

---

## Bug 4: `--hook-config` Not Implemented

**Location:** `/runtime/dist/cli.js`

**Symptom:**
The `/run-sprint` command instructions reference `--hook-config` flag, but the CLI doesn't implement it.

**Command Instructions Reference:**
```bash
node "...cli.js" run "$SPRINT_DIR" --max-iterations [N] --hook-config "$SPRINT_DIR/.sprint-hooks.json"
```

**Actual CLI Options (from help):**
```
Options:
  -n, --max-iterations <n>  Maximum iterations (0 = unlimited, default: 0)
  -d, --delay <ms>          Delay between iterations in ms (default: 2000)
  -v, --verbose             Enable verbose logging
  -h, --help                Show this help message
  --version                 Show version number
```

**Fix Required:**
Either:
1. Implement `--hook-config` in the CLI
2. Or update command instructions to not use this flag

---

## Environment Info

- **Node.js:** v22.17.0
- **Claude CLI:** 2.1.12
- **OS:** Linux (WSL2)
- **Plugin Path:** `/home/konstantin/.claude/plugins/cache/m42-claude-plugins/m42-sprint/2.0.0/`

## Files Involved

| File | Issue |
|------|-------|
| `/run-sprint` command | Bug 1 (bash escaping) |
| `runtime/dist/cli.js` | Bugs 2, 3, 4 |
| `runtime/dist/loop.js` | Bug 3 (needs investigation) |

## Workarounds Applied

1. Created temp script for hook config merging (Bug 1)
2. Ran CLI without `--hook-config` flag (Bug 4)
3. Sprint loop not running - **no workaround** (Bug 3)

## Bug 5: Compiler Doesn't Update Checksum File

**Location:** `/compiler/dist/index.js`

**Symptom:**
```
Error: checksum mismatch: expected a7c63f7579afc797844188d00f7c5100b5775d97c96e6da2eaed44865c8bd927, got f7e228c454aaff6dd6f442cacde7352b30fcc2a66cd240e631b1b815f43131ca
```

**Root Cause:**
The compiler writes PROGRESS.yaml but doesn't update or delete the `.checksum` file. When the runtime later reads PROGRESS.yaml, it finds a stale checksum file with the wrong hash and rejects the file.

**Workaround Applied:**
Manually delete `PROGRESS.yaml.checksum` after recompiling.

**Fix Required:**
The compiler should either:
1. Delete any existing `.checksum` file when writing PROGRESS.yaml
2. Or write the correct checksum after compiling

---

## Bug 6: Broken Hooks Cause Silent Failure (Not Plugin Bug)

**Location:** `.claude/settings.json` (project-level hooks)

**Symptom:**
Sprint blocked with "Unknown error" after attempting to run phase.

**Root Cause:**
The `pocketbase-tracker` binary was deleted in a recent git pull, but hooks in `.claude/settings.json` still referenced it. When `claude -p` spawned by the sprint runner ran, the SessionEnd hook failed, causing Claude CLI to exit with an error that wasn't properly captured.

**Fix Applied:**
Removed all `pocketbase-tracker` references from `.claude/settings.json`.

**Note:** This is NOT a plugin bug, but it shows that broken hooks can cause mysterious sprint failures. The sprint runtime could improve error reporting for this case.

---

## Bug 7: CRITICAL - runLoop Lacks Default Dependencies

**Location:** `/runtime/dist/loop.js` line 182, `/runtime/dist/cli.js` line 117

**Symptom:**
Sprint always fails with "Unknown error" because `runClaude` is never actually called.

**Root Cause:**
The `runLoop` function has a `deps` parameter for dependency injection (testing), but:
1. No default value is provided for `deps`
2. The CLI doesn't pass `deps` when calling `runLoop`

```javascript
// loop.js line 182
export async function runLoop(sprintDir, options = {}, deps) {  // deps has no default!

// cli.js line 117
const result = await loopFn(directory, options);  // deps not passed!
```

When `deps` is undefined, line 264-267 in loop.js:
```javascript
const spawnResult = await deps?.runClaude({...});  // Returns undefined!
```

Since `spawnResult` is undefined, `spawnResult?.success` is undefined (falsy), so the code falls into the else branch at line 284-291:
```javascript
event = {
    type: 'PHASE_FAILED',
    error: spawnResult?.error ?? 'Unknown error',  // "Unknown error"!
    category: 'logic',
    phaseId,
};
```

**Fix Required:**
Add default deps in loop.js:
```javascript
const defaultDeps = {
    runClaude: require('./claude-runner.js').runClaude,
};

export async function runLoop(sprintDir, options = {}, deps = defaultDeps) {
```

**Severity:** CRITICAL - Sprint runtime is completely non-functional.

---

## Status

**Sprint CANNOT RUN** due to Bug 7 - the runtime never actually invokes Claude CLI.

All previous bugs were fixed/worked around, but Bug 7 is a showstopper that requires code changes to the plugin.
