# Sprint Findings

## CRITICAL BUG: JSON Extraction Broken (Multi-line Result)

**Discovered**: During sprint debugging
**Severity**: CRITICAL (JSON result not extracted, steps lost)
**Status**: FIXED

### Problem
The `extract_json_result` function used `tail -1` to get the "last result", but this actually got the last LINE of a multi-line result string.

```bash
# BROKEN - tail -1 gets last line of 23-line result, not last result entry
result_text=$(jq -r 'select(.type=="result") | .result // empty' "$transcript_file" | tail -1)
```

The result text spans 23 lines (markdown with code blocks). `tail -1` returned just 3 chars.

### Fix Applied
Use `jq -s` (slurp) to read the whole file and get the last result properly:

```bash
# FIXED - slurp mode gets complete result
result_text=$(jq -rs '[.[] | select(.type=="result")] | last | .result // empty' "$transcript_file")
```

### Impact
Combined with the subshell bug, this was the ROOT CAUSE of lost steps:
1. `extract_json_result` returned empty (this bug)
2. Even if it worked, `while` loop lost changes (subshell bug)

---

## CRITICAL BUG: Dynamic Steps Not Persisted (Subshell Issue)

**Discovered**: During sprint execution monitoring
**Severity**: CRITICAL (sprint produces results but loses them)
**Status**: FIXED

### Problem
Ralph generates `pendingSteps` in JSON result, but they were never added to PROGRESS.yaml.

The bug was in `sprint-loop.sh` line 734:
```bash
echo "$pending_steps" | jq -c '.[]' | while read -r step; do
    yq -i ".dynamic-steps += [...]" "$PROGRESS_FILE"  # LOST!
done
```

**Piping into a `while` loop creates a subshell in bash!** All `yq -i` modifications inside the loop happen in the subshell and are discarded when it exits.

### Fix Applied
Changed to process substitution which keeps the loop in the main shell:
```bash
while read -r step; do
    yq -i ".dynamic-steps += [...]" "$PROGRESS_FILE"  # Now persists!
done < <(echo "$pending_steps" | jq -c '.[]')
```

### Impact
- All sprints since this code was written have been losing their dynamic steps
- Ralph appeared to be doing nothing because steps weren't visible
- The architecture analysis from iteration 1 generated 6 steps that were lost

---

## Issue: Per-Iteration Hook Output Discarded

**Discovered**: During sprint execution monitoring
**Severity**: Medium (hooks run but no visibility)
**Status**: FIXED (Iteration following iteration 5)

### Problem
Learning extraction hooks run but output goes to `/dev/null`:
```bash
claude -p "$HOOK_PROMPT" --dangerously-skip-permissions > /dev/null 2>&1
```

No way to see:
- If the hook succeeded or failed
- What was extracted
- Any error messages

### Fix Applied
Updated `spawn_per_iteration_hooks()` in `plugins/m42-sprint/scripts/sprint-loop.sh`:

1. **Log output to files**: Hook output now goes to `$SPRINT_DIR/logs/hook-iter{N}-{hook-id}.log`
2. **Capture exit codes**: Both parallel and blocking hooks capture exit codes
3. **Proper status tracking**: Failed hooks are marked as "failed" with exit code stored in PROGRESS.yaml
4. **Console feedback**: For blocking hooks, failures print a warning with log path
5. **Completion timestamps**: All hook completions now have a `completed-at` timestamp

**PROGRESS.yaml hook-tasks now include:**
```yaml
hook-tasks:
  - iteration: 1
    hook-id: learning
    status: completed  # or "failed"
    spawned-at: "2026-01-18T23:41:59Z"
    completed-at: "2026-01-18T23:42:15Z"  # NEW
    exit-code: 0  # NEW
```

---

## Issue: Status Page Doesn't Display Ralph Mode Sprints

**Discovered**: During sprint launch
**Severity**: Medium (sprint runs, but no visibility)
**Status**: PARTIALLY FIXED (Iteration 2)

### Problem
The status server UI was built for phase-based workflows and doesn't render Ralph mode sprints properly:

- `phaseTree: []` - empty because Ralph uses `dynamic-steps` not `phases`
- `totalPhases: 0` - Ralph is goal-driven, not phase-driven
- `currentTask: null` - no current task rendering for Ralph mode

### Fix Applied (Iteration 2)
Updated the status server data transformation layer to support Ralph mode:

**Files changed:**
- `plugins/m42-sprint/compiler/src/status-server/status-types.ts`
  - Added 'task' type to PhaseTreeNode
  - Added `mode` and `goal` fields to SprintHeader

- `plugins/m42-sprint/compiler/src/status-server/transforms.ts`
  - Added `countRalphTasks()` for counting dynamic-steps
  - Added `buildRalphTaskTree()` for converting dynamic-steps to tree nodes
  - Updated `countPhases()` to detect mode and delegate appropriately
  - Updated `toStatusUpdate()` to:
    - Detect Ralph vs standard mode
    - Include mode and goal in header
    - Build appropriate tree (tasks vs phases)

**API Response (now includes Ralph data):**
```json
{
  "header": {
    "sprintId": "2026-01-18_m42-sprint-refactor",
    "status": "in-progress",
    "mode": "ralph",
    "goal": "Refactor and harden...",
    "currentIteration": 2,
    "completedPhases": 0,
    "totalPhases": 0
  },
  "phaseTree": [
    { "id": "step-1", "label": "...", "type": "task", "status": "completed" }
  ],
  "currentTask": null
}
```

### Still Needed (UI Layer)
The data layer now provides Ralph-aware data. The frontend (page.ts) needs updates:
1. Conditional sidebar title ("Active Tasks" vs "Phase Tree")
2. Different rendering for task nodes vs phase nodes
3. Goal display in header area
4. Hook task status display

### Workaround (still valid)
Monitor via CLI:
```bash
yq '.status, .stats, ."dynamic-steps"' PROGRESS.yaml
tail -f transcripts/iteration-*.jsonl | jq '.type'
```

---

## Iteration 2: Pattern Layer Design

**Focus**: Design the "patterns" part of "Freedom + Patterns"

### Key Insight

The architecture analysis identified that Ralph has FREEDOM but the system lacks PATTERNS as invocable entities. Before implementing, we need to understand what patterns should be.

### Design Document Created

See: `context/pattern-layer-design.md`

### Summary of Design

**What patterns are**: Proven execution approaches that ensure consistent quality when Ralph decides to execute something.

**Recommended approach**: Phased implementation
1. **Phase 1**: Patterns as prompt templates (simple, validates concept)
2. **Phase 2**: Add verification commands (hard guarantees)
3. **Phase 3**: Consider workflow fragments (if multi-step needed)

**Key integration points**:
- Sprint loop detects `invokePattern` in Ralph's result JSON
- Loads pattern template, renders with params
- Executes in fresh context
- Results feed back to Ralph

**Minimum viable pattern set**:
- `implement-feature` - TDD implementation
- `fix-bug` - Debug and fix workflow
- `refactor` - Safe refactoring with tests
- `document` - Documentation update

### Open Questions Identified

1. Where do patterns live? (per-sprint, per-project, global)
2. Who creates patterns? (developers, Ralph, system evolution)
3. How does Ralph know when to invoke patterns vs. work directly?
4. What verification ensures patterns actually executed correctly?

---

## Iteration 3: Pattern Layer Implementation (Phase 1)

**Focus**: Implement the core pattern invocation mechanism

### What Was Implemented

**Phase 1 of the pattern layer is now complete:**

1. **Pattern Invocation Mechanism** (`plugins/m42-sprint/scripts/sprint-loop.sh`)
   - Added `execute_pattern()` function that:
     - Searches for patterns in 3 locations (sprint-local, project-level, plugin default)
     - Loads pattern template
     - Substitutes `{{param}}` placeholders with provided parameters
     - Executes pattern in fresh context
     - Logs transcript to `$SPRINT_DIR/transcripts/patterns/`
     - Records result in PROGRESS.yaml under `pattern-results`
   - Added pattern check in `process_ralph_result()` that detects `invokePattern` in JSON

2. **Initial Pattern Templates** (`plugins/m42-sprint/patterns/`)
   - `implement-feature.md` - TDD implementation pattern
   - `fix-bug.md` - Debug and fix workflow
   - `refactor.md` - Safe refactoring with tests
   - `document.md` - Documentation update pattern

   Each pattern has:
   - Frontmatter with name, description, version
   - Clear process steps
   - Completion checklist
   - Report template

3. **Ralph Prompt Updates** (`plugins/m42-sprint/scripts/build-ralph-prompt.sh`)
   - Documented `invokePattern` JSON field
   - Listed available patterns with their parameters
   - Ralph now knows it CAN invoke patterns when appropriate

### Pattern Search Order
Patterns are searched in order of precedence:
1. `$SPRINT_DIR/patterns/` - Sprint-specific patterns
2. `.claude/patterns/` - Project-level patterns
3. `$PLUGIN_DIR/patterns/` - Plugin defaults

This answers Open Question #1: Patterns can live at all three levels.

### Integration Flow

```
Ralph JSON result
    |
    +-- Has invokePattern? ──► execute_pattern()
    |       |                       |
    |       |                       ├── Find pattern template
    |       |                       ├── Substitute params
    |       |                       ├── Execute fresh context
    |       |                       └── Log to PROGRESS.yaml
    |       |
    +── Process normal status (continue/goal-complete/needs-human)
```

### What's NOT Implemented Yet (Phase 2+)
- Verification commands (hard guarantees)
- Pattern success validation
- Pattern result feeding back to Ralph context
- Pattern metrics/analytics

### Testing Status
- Bash syntax verified for both modified scripts
- No runtime testing done this iteration (would need actual sprint execution)

### Remaining Open Questions
- How does Ralph know WHEN to invoke patterns vs work directly?
  - Current answer: Ralph decides based on context, documented in prompt
- Pattern evolution: How do learnings improve patterns?
  - Future: m42-signs could extract pattern-specific learnings

---

## Iteration 4: Pattern Verification System (Phase 2)

**Focus**: Add verification commands to patterns - hard guarantees that patterns executed correctly

### What Was Implemented

**Phase 2 of the pattern layer is now complete:**

1. **Verification Schema in Pattern Frontmatter**

   Patterns now support a `verify` section with commands that run after Claude execution:
   ```yaml
   verify:
     - id: tests-pass
       type: bash
       command: "npm test 2>&1 || npm run test 2>&1 || yarn test 2>&1"
       expect: exit-code-0
       description: All tests must pass
       required: true
     - id: code-committed
       type: bash
       command: "git status --porcelain"
       expect: empty
       description: All changes must be committed
       required: true
   ```

2. **Supported Expectation Types**
   - `exit-code-0`: Command must exit with code 0
   - `empty`: Command output must be empty (good for `git status --porcelain`)
   - `non-empty`: Command output must have content
   - `contains-ok-or-empty`: Output is empty or equals "OK"

3. **`run_pattern_verification()` Function** (`sprint-loop.sh`)
   - Extracts `verify` section from pattern frontmatter
   - Runs each verification command
   - Evaluates expectations
   - Distinguishes required vs optional checks
   - Returns JSON result with all check details

4. **Updated Patterns with Verification**
   - `implement-feature.md`: tests-pass (required), code-committed (required), has-commits (optional)
   - `fix-bug.md`: tests-pass (required), code-committed (required), has-commits (optional)
   - `refactor.md`: tests-pass (required), code-committed (required)
   - `document.md`: code-committed (required), no-broken-links (optional)

5. **Integration with Pattern Execution**
   - Verification runs automatically after Claude execution completes
   - Results saved to `transcripts/patterns/iter{N}-{pattern}-verification.json`
   - Pattern marked as failed if required verifications don't pass
   - PROGRESS.yaml now includes `verified` and `verification-message` fields

### Example Verification Output
```
Running verification commands for pattern: implement-feature
------------------------------------------------------------
  [tests-pass] All tests must pass
    ✓ passed
  [code-committed] All changes must be committed (working tree clean)
    ✗ FAILED (required)
  [has-commits] At least one commit was made during pattern execution
    ✓ passed
------------------------------------------------------------
Verification: 2/3 checks passed
Result: VERIFICATION FAILED ✗
```

### Key Design Decisions

1. **Required vs Optional**: Patterns distinguish between must-have guarantees (tests pass) and nice-to-have checks (recent commits exist)

2. **Fail-Safe**: If verification section is missing, pattern succeeds (backward compatible)

3. **Separation of Concerns**: Claude executes the pattern freely; verification is an independent post-check

4. **Visibility**: Verification results are stored as JSON files for debugging and fed back to Ralph

### What This Enables

- **Trust**: Patterns now provide hard guarantees, not just instructions
- **Debugging**: When patterns fail verification, the cause is clear
- **Evolution**: Patterns can be measured and improved based on verification data
- **Scaling**: Consistent quality even without human review of every pattern execution

### Next Steps (Phase 3 considerations)

1. Test verification with real pattern invocations
2. Consider retry logic for failed verifications
3. Add pattern-specific verification templates (e.g., linting for refactor)
4. Explore verification result feeding into learning extraction

---

## Iteration 5: Transaction-Safe YAML Updates

**Focus**: Harden error handling with atomic YAML updates to prevent corruption on interrupts

### Problem

The sprint-loop.sh script made multiple sequential `yq -i` calls to update PROGRESS.yaml. If the script was interrupted (Ctrl+C, crash, system restart) between calls, the YAML file could be left in an inconsistent state:

```bash
# Example of vulnerable code pattern:
yq -i "$base_path.status = \"completed\"" "$PROGRESS_FILE"
# <-- Interrupt here leaves status=completed but no timestamp!
yq -i "$base_path.\"started-at\" = \"$start_iso\"" "$PROGRESS_FILE"
yq -i "$base_path.\"completed-at\" = \"$end_iso\"" "$PROGRESS_FILE"
```

### Solution Implemented

**1. Atomic YAML Update Functions** (added to `sprint-loop.sh`):

```bash
# yaml_atomic_update - applies multiple yq expressions atomically
# Combines expressions with pipe, writes to temp file, then atomic mv
yaml_atomic_update() {
  local expressions=("$@")
  local combined_expr="${expressions[0]}"
  for ((i=1; i<${#expressions[@]}; i++)); do
    combined_expr="$combined_expr | ${expressions[i]}"
  done
  local temp_file="${PROGRESS_FILE}.tmp.$$"
  yq -e "$combined_expr" "$PROGRESS_FILE" > "$temp_file"
  mv "$temp_file" "$PROGRESS_FILE"  # Atomic on POSIX
}

# yaml_update - convenience wrapper for single expression
yaml_update() {
  yaml_atomic_update "$1"
}
```

**2. Transaction Block Support** (for recovery):
```bash
yaml_transaction_start  # Creates backup
# ... multiple atomic updates ...
yaml_transaction_end    # Removes backup on success
```

**3. Refactored Critical Update Sites**:

| Function | Before (vulnerable) | After (atomic) |
|----------|---------------------|----------------|
| `process_standard_result` completed | 3 `yq -i` calls | 1 `yaml_atomic_update` |
| `process_standard_result` needs-human | 4 `yq -i` calls | 1 `yaml_atomic_update` |
| `advance_pointer` | 2-7 `yq -i` calls | 1 `yaml_atomic_update` per branch |
| `record_ralph_completion` | 5-6 `yq -i` calls | 1 `yaml_atomic_update` |
| `process_ralph_result` dynamic steps | 2 `yq -i` per step | 1 `yaml_atomic_update` per step |

### Why This Works

1. **Write-to-temp-then-mv**: The temp file is written completely before renaming. The `mv` operation is atomic on POSIX filesystems when source and destination are on the same filesystem.

2. **yq pipe expressions**: Multiple updates combined with `|` execute as a single yq invocation, producing one coherent output.

3. **Same-directory temp files**: Using `${PROGRESS_FILE}.tmp.$$` ensures temp file is on the same filesystem as the target.

### Testing

```bash
# Unit test verified:
yaml_atomic_update \
  ".status = \"in-progress\"" \
  ".current.phase = 1" \
  ".current.step = 0" \
  ".stats.\"started-at\" = \"2026-01-19T12:00:00Z\""
# All 4 updates applied atomically
```

### What This Prevents

- Corrupted PROGRESS.yaml on Ctrl+C
- Inconsistent state after system crashes
- "completed" status with no `completed-at` timestamp
- Pointer advanced but status not updated

### Future Improvements (not done this iteration)

1. **Wrap entire iteration in transaction block**: Use `yaml_transaction_start/end` around the full iteration for recovery
2. **Add recovery on startup**: Check for `.backup` file and offer recovery
3. **Add checksum validation**: Detect partial writes

---

## Issue: Preflight Check Failed for Ralph Mode

**Discovered**: During sprint launch
**Severity**: High (blocked sprint start)
**Status**: FIXED

### Problem
The preflight-check.sh script required `phases` field, but Ralph mode uses `goal` instead.

### Fix Applied
Updated `/plugins/m42-sprint/scripts/preflight-check.sh` to check for mode-specific required fields:
- Standard mode: requires `phases`
- Ralph mode: requires `goal`
