---
allowed-tools: Bash(ls:*), Bash(test:*), Bash(grep:*), Bash(cat:*), Bash(sleep:*), Bash(rm:*), Bash(node:*), Bash(node ${CLAUDE_PLUGIN_ROOT}/runtime/dist/cli.js:*), Bash(git:*), Bash(mkdir:*), Bash(cp:*), Read(*), Edit(*)
argument-hint: <sprint-directory> [--max-iterations N] [--dry-run] [--recompile] [--no-status] [--no-browser]
description: Start sprint execution loop (fresh context per task)
---

# Run Sprint Command

Starts the sprint loop to process the workflow phases with **fresh context per task**.

Each task iteration invokes Claude CLI as a separate process, ensuring 100% context
utilization with no accumulated context between tasks. This follows the Ralph Loop
pattern: "a dumb bash loop that keeps restarting the agent."

## Argument Parsing

The first argument MUST be the sprint directory path. Parse $ARGUMENTS to extract:

1. **Sprint Directory Path** (REQUIRED): The path to the sprint directory
   - Example: `.claude/sprints/2026-01-15_my-sprint`
   - Must contain SPRINT.yaml

2. **Options** (OPTIONAL):
   - `--max-iterations N` - Maximum loop iterations (default: unlimited, use 0 for unlimited)
   - `--dry-run` - Preview tasks without executing (read-only mode)
   - `--recompile` - Force recompilation even if PROGRESS.yaml exists
   - `--no-status` - Skip launching the live status server
   - `--no-browser` - Disable automatic browser opening when status server starts

Parse arguments and extract SPRINT_DIR:

```bash
# Extract sprint directory (first non-option argument)
SPRINT_DIR=$(echo "$ARGUMENTS" | sed 's/ --.*$//' | awk '{print $1}')
```

If no sprint directory is provided, output this error and stop:
```
Error: Sprint directory path is required.

Usage: /run-sprint <sprint-directory> [--max-iterations N] [--dry-run] [--recompile] [--no-status] [--no-browser]

Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --max-iterations 50
Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --dry-run
Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --recompile
Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --no-status
Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --no-browser
```

## Preflight Checks

Execute these validation checks BEFORE proceeding. Each check must pass or the command stops with a clear error message.

Parse arguments first:

- Parse sprint directory: !`SPRINT_DIR=$(echo "$ARGUMENTS" | sed 's/ --.*$//' | awk '{print $1}'); echo "Using sprint directory: $SPRINT_DIR"`

Then run validation checks:

- Sprint directory provided: !`echo "$ARGUMENTS" | sed 's/ --.*$//' | awk '{print $1}' | grep -q '.' && echo "✓ Provided" || echo "✗ Missing - Sprint directory is required"`

- Git repository: !`git rev-parse --git-dir 2>/dev/null && echo "✓ Git repository" || echo "✗ Not a git repository"`

- Sprint directory exists: !`SPRINT_DIR=$(echo "$ARGUMENTS" | sed 's/ --.*$//' | awk '{print $1}'); test -d "$SPRINT_DIR" && echo "✓ Directory exists: $SPRINT_DIR" || echo "✗ Directory not found: $SPRINT_DIR"`

- SPRINT.yaml exists: !`SPRINT_DIR=$(echo "$ARGUMENTS" | sed 's/ --.*$//' | awk '{print $1}'); test -f "$SPRINT_DIR/SPRINT.yaml" && echo "✓ SPRINT.yaml found" || echo "✗ SPRINT.yaml not found in $SPRINT_DIR"`

- Runtime CLI available: !`test -f "${CLAUDE_PLUGIN_ROOT}/runtime/dist/cli.js" && echo "✓ Runtime CLI available" || echo "✗ Runtime CLI not found at ${CLAUDE_PLUGIN_ROOT}/runtime/dist/cli.js"`

- Compiler available: !`test -f "${CLAUDE_PLUGIN_ROOT}/compiler/dist/index.js" && echo "✓ Compiler available" || echo "✗ Compiler not found at ${CLAUDE_PLUGIN_ROOT}/compiler/dist/index.js"`

**If any preflight check shows ✗, stop immediately with:**

```
Preflight checks failed. Please resolve the issues above before running the sprint.
```

## Worktree Setup (Automatic)

**Before compilation**, check if the sprint's workflow enables worktree execution:

1. **Load the workflow reference** from SPRINT.yaml:
   ```bash
   # Extract workflow name from SPRINT.yaml
   WORKFLOW_NAME=$(grep '^workflow:' "$SPRINT_DIR/SPRINT.yaml" | sed 's/workflow: *//' | tr -d '"' | tr -d "'")
   ```

2. **Load the workflow definition** and check for worktree config:
   ```bash
   WORKFLOW_FILE=".claude/workflows/${WORKFLOW_NAME}.yaml"

   # Check if workflow has worktree.enabled: true
   if [ -f "$WORKFLOW_FILE" ]; then
     WORKTREE_ENABLED=$(grep -A5 '^worktree:' "$WORKFLOW_FILE" | grep 'enabled:' | grep -q 'true' && echo "true" || echo "false")
   fi

   # Sprint worktree config overrides workflow config
   SPRINT_WORKTREE=$(grep -A5 '^worktree:' "$SPRINT_DIR/SPRINT.yaml" | grep 'enabled:')
   if echo "$SPRINT_WORKTREE" | grep -q 'false'; then
     WORKTREE_ENABLED="false"
   elif echo "$SPRINT_WORKTREE" | grep -q 'true'; then
     WORKTREE_ENABLED="true"
   fi
   ```

3. **If worktree is enabled** and NOT already in a worktree for this sprint:

   Use the runtime worktree module to create branch and worktree:

   ```bash
   # Check if worktree already exists for this sprint
   SPRINT_ID=$(basename "$SPRINT_DIR")
   WORKTREE_CHECK=$(git worktree list --porcelain | grep -A1 "branch.*sprint/${SPRINT_ID}" || true)

   if [ -z "$WORKTREE_CHECK" ] && [ "$WORKTREE_ENABLED" = "true" ]; then
     echo "Creating worktree for sprint: $SPRINT_ID"

     # Use the compiler's worktree config resolver to get paths
     WORKTREE_PATHS=$(node -e "
       const yaml = require('js-yaml');
       const fs = require('fs');
       const { shouldCreateWorktree, resolveWorktreePath } = require('${CLAUDE_PLUGIN_ROOT}/compiler/dist/worktree-config.js');

       const sprintDef = yaml.load(fs.readFileSync('${SPRINT_DIR}/SPRINT.yaml', 'utf8'));
       const workflowPath = '.claude/workflows/' + sprintDef.workflow + '.yaml';
       const workflowDef = fs.existsSync(workflowPath) ? yaml.load(fs.readFileSync(workflowPath, 'utf8')) : { name: sprintDef.workflow, phases: [] };

       if (shouldCreateWorktree(sprintDef, workflowDef)) {
         const sprintId = sprintDef['sprint-id'] || '${SPRINT_ID}';
         const resolved = resolveWorktreePath(sprintId, workflowDef.worktree, sprintDef.worktree);
         console.log(JSON.stringify(resolved));
       } else {
         console.log('null');
       }
     ")

     if [ "$WORKTREE_PATHS" != "null" ]; then
       BRANCH=$(echo "$WORKTREE_PATHS" | node -e "console.log(JSON.parse(require('fs').readFileSync(0, 'utf8')).branch)")
       WORKTREE_PATH=$(echo "$WORKTREE_PATHS" | node -e "console.log(JSON.parse(require('fs').readFileSync(0, 'utf8')).path)")

       # Create branch if it doesn't exist
       if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
         git branch "$BRANCH"
         echo "Created branch: $BRANCH"
       fi

       # Create worktree
       if [ ! -d "$WORKTREE_PATH" ]; then
         git worktree add "$WORKTREE_PATH" "$BRANCH"
         echo "Created worktree: $WORKTREE_PATH"

         # Copy sprint files to worktree
         WORKTREE_SPRINT_DIR="${WORKTREE_PATH}/.claude/sprints/${SPRINT_ID}"
         mkdir -p "$WORKTREE_SPRINT_DIR"
         cp -r "${SPRINT_DIR}"/* "$WORKTREE_SPRINT_DIR/"

         echo ""
         echo "Worktree created successfully!"
         echo "Sprint directory: $WORKTREE_SPRINT_DIR"
         echo ""
         echo "To run the sprint in the worktree:"
         echo "  cd $WORKTREE_PATH && /run-sprint .claude/sprints/${SPRINT_ID}"
         echo ""

         # Exit here - user should run from worktree
         exit 0
       fi
     fi
   fi
   ```

   **Note**: If worktree is enabled but doesn't exist yet, the command creates it and exits with instructions. The user should then cd to the worktree and re-run `/run-sprint` from there.

## Workflow Compilation

Check if SPRINT.yaml uses the new workflow format (has `workflow:` and `collections:` keys):

```bash
# Check if SPRINT.yaml has workflow format
grep -q '^workflow:' "$SPRINT_DIR/SPRINT.yaml"
```

If SPRINT.yaml uses workflow format AND (PROGRESS.yaml doesn't exist OR --recompile flag):

1. **Compile the workflow** using the TypeScript compiler:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/compiler/dist/index.js" "$SPRINT_DIR" -w ".claude/workflows" -v
   ```

2. Report compilation result:
   - On success: "Workflow compiled successfully. Generated PROGRESS.yaml"
   - On failure: Report errors and stop

## Validation

After compilation (or if PROGRESS.yaml already exists), validate the sprint state:

- PROGRESS.yaml exists: !`SPRINT_DIR=$(echo "$ARGUMENTS" | sed 's/ --.*$//' | awk '{print $1}'); test -f "$SPRINT_DIR/PROGRESS.yaml" && echo "✓ PROGRESS.yaml found" || echo "✗ PROGRESS.yaml not found - run with --recompile"`

- Has phases: !`SPRINT_DIR=$(echo "$ARGUMENTS" | sed 's/ --.*$//' | awk '{print $1}'); grep -q '^phases:' "$SPRINT_DIR/PROGRESS.yaml" && echo "✓ Workflow has phases" || echo "✗ No phases found in PROGRESS.yaml"`

- Status not completed: !`SPRINT_DIR=$(echo "$ARGUMENTS" | sed 's/ --.*$//' | awk '{print $1}'); grep '^status:' "$SPRINT_DIR/PROGRESS.yaml" | grep -qv 'completed' && echo "✓ Sprint ready to run" || echo "✗ Sprint already completed"`

**If validation fails, stop with clear error message.**

## Context

Gather sprint configuration and state:

- Sprint configuration: @$SPRINT_DIR/SPRINT.yaml
- Compiled workflow state: @$SPRINT_DIR/PROGRESS.yaml
- Git status: !`git status --short`

## Task Instructions

### If --dry-run flag is present:

Display the workflow preview WITHOUT modifying any files:

```
Dry Run: Workflow Preview
==========================

Sprint: {sprint-id}
Directory: {sprint-dir}
Status: {current-status}

Workflow Phases:
-----------------
1. [phase] {phase-id}
   {prompt preview...}

2. [for-each] {phase-id} (collection: {collection-name})
   Items ({count}):
     - {item-0-id}: {item prompt preview...}
       Sub-phases: planning → implement → test → document
     - {item-1-id}: {item prompt preview...}
       Sub-phases: planning → implement → test → document

3. [phase] {phase-id}
   {prompt preview...}

Summary:
- Total phases: {count}
- Total items: {count}
- Total sub-phases: {count}
- Estimated iterations: {total}

To start execution, run without --dry-run:
  /run-sprint {sprint-dir} --max-iterations {suggested-limit}
```

Then STOP - do not start the loop or modify any files.

### If --dry-run flag is NOT present:

1. **Launch Sprint Loop**

   Execute the sprint loop as a **background task**:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/runtime/dist/cli.js" run "$SPRINT_DIR" --max-iterations [N]
   ```

   Use `run_in_background: true` when calling the Bash tool. This allows:
   - User to continue using Claude Code while sprint runs
   - Progress monitoring via `/sprint-status`
   - Output checking via TaskOutput tool

2. **Launch Status Server** (unless `--no-status` flag is present)

   After starting the sprint loop, launch the status server in background:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/compiler/dist/status-server/index.js" "$SPRINT_DIR" &
   ```

   Use `run_in_background: true` when calling the Bash tool.

   Wait briefly (up to 2 seconds) for the port file to appear, then read it:

   ```bash
   # Wait for port file to appear (up to 2 seconds)
   for i in 1 2 3 4; do
     if [ -f "$SPRINT_DIR/.sprint-status.port" ]; then
       break
     fi
     sleep 0.5
   done

   # Read port if file exists
   if [ -f "$SPRINT_DIR/.sprint-status.port" ]; then
     cat "$SPRINT_DIR/.sprint-status.port"
   fi
   ```

   **Handle status server failures:**
   - If port file doesn't appear after 2 seconds, the status server may have failed
   - Continue with sprint execution (don't block on status server failure)
   - Display warning: "Status server failed to start. Sprint continues without live status."
   - The sprint loop is the critical path; status server is enhancement only

3. **Report Launch Status**

   After launching, inform the user:

   ```
   Sprint Loop Launched
   ====================

   Sprint: {sprint-id}
   Directory: {sprint-dir}
   Background Task ID: {task_id}

   Workflow: {workflow-name}
   Phases: {phase-count}
   Items: {item-count}

   Live Status: http://localhost:{port}
   (Open in browser for real-time progress)

   Each phase/step runs with FRESH context (no accumulation).

   Monitor progress:
   - /sprint-status - View PROGRESS.yaml status
   - TaskOutput({task_id}) - View loop output

   Stop the sprint:
   - /stop-sprint - Terminate the loop
   - /pause-sprint - Request graceful pause
   ```

   If status server failed to start, omit the "Live Status" line and add a warning:
   ```
   ⚠ Status server not available (sprint continues normally)
   ```

## How the Sprint Loop Works

The sprint loop follows the Ralph Loop pattern:

1. **Bash loop** runs `claude -p` repeatedly
2. **Each invocation** is FRESH with only the task prompt
3. **Agent processes ONE task** and exits
4. **Bash loop checks** PROGRESS.yaml for status
5. **If not done**, starts NEW invocation with fresh context

```
┌─────────────────────────────────────────┐
│ User runs: /run-sprint <sprint-dir>     │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────────┐   ┌──────────────────────────────┐
│ sprint runtime   │   │ sprint-status-server         │
│ (background)     │   │ (background, optional)       │
│                  │   │                              │
│ Controls loop,   │   │ Watches PROGRESS.yaml,       │
│ monitors status  │   │ serves live web status page  │
└────────┬─────────┘   └──────────────────────────────┘
         │
  ┌──────┴──────┐
  │ BASH LOOP   │
  │ (iter N)    │
  └──────┬──────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ claude -p "$(build-prompt)"                │
│                                            │
│ FRESH CONTEXT WINDOW                       │
│ • Loads task prompt only                   │
│ • Processes ONE task                       │
│ • Updates PROGRESS.yaml                    │
│ • Commits changes                          │
│ • EXITS (context cleared)                  │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│ Bash loop checks PROGRESS.yaml status      │
│ • completed → exit loop (success)          │
│ • blocked → exit loop (failure)            │
│ • paused → exit loop (success)             │
│ • needs-human → exit loop (intervention)   │
│ • otherwise → continue to iteration N+1    │
└────────────────────────────────────────────┘
```

## Status Values

The sprint loop monitors these PROGRESS.yaml status values:

| Status | Meaning | Loop Action |
|--------|---------|-------------|
| `in-progress` | Tasks being processed | Continue |
| `completed` | All tasks done | Exit (success) |
| `blocked` | Task cannot proceed | Exit (failure) |
| `paused` | User requested pause | Exit (success) |
| `paused-at-breakpoint` | Breakpoint phase reached | Exit (human review) |
| `needs-human` | Human decision required | Exit (intervention) |

## Breakpoints and Quality Gates

Workflows can define two types of human checkpoints:

### Breakpoints (`break: true`)

Phases with `break: true` pause execution after completing, allowing human review before continuing:

```yaml
# In workflow definition
phases:
  - id: implement
    prompt: "Implement the feature..."
  - id: review-checkpoint
    prompt: "Prepare for review..."
    break: true  # Sprint pauses here after completion
  - id: deploy
    prompt: "Deploy to production..."
```

When a breakpoint is reached:
- Sprint status becomes `paused-at-breakpoint`
- Loop exits gracefully
- User reviews changes and uses `/resume-sprint` to continue

### Quality Gates (`gate:`)

Phases can include quality gate checks that run validation scripts after phase completion:

```yaml
# In workflow definition
phases:
  - id: implement
    prompt: "Implement the feature..."
    gate:
      script: "npm test && npm run lint"
      on-fail:
        prompt: "Tests or lint failed. Fix the issues based on this output:"
        max-retries: 3
      timeout: 120
```

Gate behavior:
- **Pass (exit 0)**: Phase completes, execution continues
- **Fail (exit non-0)**: Re-runs phase with fix prompt including script output
- **Max retries exceeded**: Sprint becomes `blocked`

Gate configuration:
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `script` | string | Required | Shell command to validate (exit 0 = pass) |
| `on-fail.prompt` | string | Required | Instructions for fixing failures |
| `on-fail.max-retries` | number | 3 | Maximum retry attempts |
| `timeout` | number | 60 | Script timeout in seconds |

## Success Criteria

### For --dry-run mode:
- Workflow phases displayed in execution order
- All phases/steps/sub-phases shown
- No files modified
- Clear instructions to run without --dry-run

### For normal execution:
- Sprint directory path correctly parsed from arguments
- All preflight checks passed with ✓ indicators
- Workflow compiled (if needed) from SPRINT.yaml + workflows
- PROGRESS.yaml validated (has phases, not completed)
- Sprint loop launched in background
- Status server launched in background (unless --no-status)
- Live status URL displayed (if status server started successfully)
- Task ID returned for monitoring
- User informed how to check progress and stop

**IMPORTANT:** Only work in ultrathink mode. Your contribution is critical. Think strategically, plan your workflow ahead, review your actions to ensure highest quality. Use all resources and time needed. Reiterate as often as needed for excellence.
