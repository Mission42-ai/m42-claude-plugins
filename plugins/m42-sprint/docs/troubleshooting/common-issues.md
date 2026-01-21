# Common Issues & Troubleshooting

Quick solutions for frequent problems when using M42 Sprint.

---

## Quick Diagnostics

Run these commands to quickly assess the situation:

```bash
# Check sprint state
/sprint-status

# View PROGRESS.yaml structure
cat .claude/sprints/*/PROGRESS.yaml | head -50

# List available workflows
ls .claude/workflows/

# Verify dependencies
node --version  # Need Node.js for compiler and runtime
```

---

## Compilation Issues

### "Workflow not found" Error

**Symptom:**
```
Error: Workflow not found: xyz-workflow
```

**Cause:** The `workflow:` reference in SPRINT.yaml points to a non-existent file.

**Solution:**
1. Check available workflows:
   ```bash
   ls .claude/workflows/
   ```
2. Ensure the workflow name in SPRINT.yaml matches the filename (without `.yaml`):
   ```yaml
   # SPRINT.yaml
   workflow: sprint-default  # Matches sprint-default.yaml
   ```
3. Create the missing workflow file if needed

**Prevention:** Use `/run-sprint --dry-run` to validate before execution.

---

### YAML Syntax Errors

**Symptom:**
```
Error: YAML parse error at line X
```

**Cause:** Invalid YAML syntax in SPRINT.yaml (often indentation or special characters).

**Solution:**
1. Validate YAML syntax:
   ```bash
   cat .claude/sprints/*/SPRINT.yaml
   ```
2. Check for:
   - Inconsistent indentation (use 2 spaces, not tabs)
   - Unquoted special characters (`#`, `:`, `@`)
   - Missing colons after keys

**Common mistakes:**
```yaml
# Wrong - colon in unquoted string
prompt: Fix: This is broken

# Correct - use multiline or quote
prompt: |
  Fix: This is broken
```

**Prevention:** Use a YAML linter or IDE with YAML support.

---

### Node.js Not Available

**Symptom:**
```
node: command not found
```

**Cause:** The TypeScript compiler requires Node.js to run.

**Solution:**
1. Install Node.js (v18+ recommended):
   ```bash
   # macOS
   brew install node

   # Ubuntu/Debian
   sudo apt install nodejs npm

   # Or use nvm
   nvm install --lts
   ```
2. Verify installation:
   ```bash
   node --version
   ```

**Prevention:** Include Node.js in your development environment setup.

---

### TypeScript Runtime Build Errors

**Symptom:**
```
Error: Cannot find module './transition.js'
```

**Cause:** TypeScript runtime not compiled.

**Solution:**
```bash
cd plugins/m42-sprint/runtime && npm run build
```

---

### TypeScript Runtime Type Errors

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

---

### Empty Steps Array

**Symptom:**
```
Error: No steps found in SPRINT.yaml
```

**Cause:** SPRINT.yaml has no steps defined or steps array is empty.

**Solution:**
1. Add at least one step:
   ```yaml
   steps:
     - prompt: |
         Your task description here.
   ```
2. Or use `/add-step` command:
   ```bash
   /add-step "Implement the feature"
   ```

**Prevention:** Check SPRINT.yaml before running.

---

## Execution Issues

### Sprint Loop Not Progressing

**Symptom:** Status shows same phase repeatedly; no progress after multiple iterations.

**Cause:** Phase status not updating in PROGRESS.yaml, or current pointer stuck.

**Solution:**
1. Check current state:
   ```bash
   /sprint-status
   ```
2. Inspect PROGRESS.yaml:
   ```bash
   cat .claude/sprints/*/PROGRESS.yaml
   ```
3. Look for:
   - `status: blocked` or `status: needs-human`
   - `current:` pointer not advancing
   - Error messages in phase output
4. If truly stuck, stop and investigate:
   ```bash
   /stop-sprint
   ```

**Prevention:** Set reasonable `--max-iterations` limit to avoid infinite loops.

---

### Phase Blocked

**Symptom:**
```
Status: blocked
```

**Cause:** A phase encountered an error it couldn't resolve automatically.

**Solution:**
1. Check the blocked phase's details in PROGRESS.yaml:
   ```yaml
   phases:
     - id: implement
       status: blocked
       error: "Could not find required file"
   ```
2. Resolve the underlying issue manually
3. Either:
   - Edit PROGRESS.yaml to set status back to `pending`
   - Use `/resume-sprint` after fixing the issue

**Prevention:** Ensure prerequisites are met before starting sprints.

---

### Needs Human Intervention

**Symptom:**
```
Status: needs-human
```

**Cause:** The agent determined it needs human input to proceed.

**Solution:**
1. Check PROGRESS.yaml for details:
   ```yaml
   human-needed:
     reason: "Multiple architectural approaches possible"
     details: "Need decision on database schema"
   ```
2. Make the required decision
3. Update PROGRESS.yaml with decision context
4. Resume: `/resume-sprint`

**Prevention:** Provide clear requirements in step prompts.

---

### Background Loop Died

**Symptom:** Sprint started but no progress; `/sprint-status` shows old state.

**Cause:** Background process terminated unexpectedly.

**Solution:**
1. Check for running tasks:
   ```bash
   /tasks
   ```
2. Look for error output in task logs
3. Restart the sprint:
   ```bash
   /stop-sprint  # Clean up state
   /run-sprint .claude/sprints/your-sprint
   ```

**Prevention:** Monitor `/sprint-status` periodically during execution.

---

### New Steps Not Appearing

**Symptom:** Added steps with `/add-step` but they don't run.

**Cause:** PROGRESS.yaml was compiled before steps were added.

**Solution:**
```bash
/run-sprint .claude/sprints/your-sprint --recompile
```

**Prevention:** Add all steps before first `/run-sprint`, or always use `--recompile` after adding steps.

---

## Environment Issues

### Sprint Directory Not Found

**Symptom:**
```
Error: Sprint directory path is required.
```
or
```
No active sprint. Use /start-sprint to create one.
```

**Cause:** No sprint directory exists, or path is incorrect.

**Solution:**
1. List existing sprints:
   ```bash
   ls -la .claude/sprints/
   ```
2. Create a new sprint:
   ```bash
   /start-sprint my-feature
   ```
3. Provide full path to commands:
   ```bash
   /run-sprint .claude/sprints/2026-01-16_my-feature
   ```

**Prevention:** Use tab completion or copy paths from `ls` output.

---

### Workflows Directory Missing

**Symptom:**
```
No workflows found. Create workflows in .claude/workflows/ first.
```

**Cause:** The `.claude/workflows/` directory doesn't exist.

**Solution:**
1. Create the directory:
   ```bash
   mkdir -p .claude/workflows
   ```
2. Add workflow files (check plugin's default workflows):
   ```bash
   # Copy from plugin directory or create your own
   ls $(claude plugin path m42-sprint)/workflows/
   ```

**Prevention:** Initialize workflows when setting up a new project.

---

### Permission Prompts During Execution

**Symptom:** Bash commands require manual approval, interrupting autonomous execution.

**Cause:** Commands not covered by command's `allowed-tools` configuration.

**Solution:**
1. Update to latest plugin version (uses Read tool instead of bash `cat`)
2. Check if custom commands need `allowed-tools` updates
3. For persistent issues, review Claude Code permission settings

**Prevention:** Keep plugin updated; use built-in tools (Read, Edit) over bash equivalents.

---

## Status Issues

### Can't Determine Current Position

**Symptom:** `/sprint-status` output unclear or missing position info.

**Cause:** PROGRESS.yaml `current:` pointer malformed or missing.

**Solution:**
1. Inspect PROGRESS.yaml directly:
   ```bash
   cat .claude/sprints/*/PROGRESS.yaml
   ```
2. Look for `current:` section:
   ```yaml
   current:
     phase: 1
     step: 0
     sub-phase: 2
   ```
3. If missing, sprint may not have started or file is corrupted

**Prevention:** Don't manually edit PROGRESS.yaml unless necessary.

---

### Status Server Not Starting

**Symptom:**
```
Status server failed to start. Sprint continues without live status.
```

**Cause:** Port conflict or Node.js issue.

**Solution:**
1. Check if port is in use:
   ```bash
   lsof -i :3100
   ```
2. Kill conflicting process or use different port
3. Sprint still runs; use `/sprint-status` instead

**Prevention:** Use `--no-status` flag if you don't need live status page.

---

### Stale Status Information

**Symptom:** `/sprint-status` shows outdated information.

**Cause:** Viewing cached data or PROGRESS.yaml not being updated.

**Solution:**
1. Re-run status command:
   ```bash
   /sprint-status
   ```
2. Check PROGRESS.yaml directly for ground truth:
   ```bash
   cat .claude/sprints/*/PROGRESS.yaml | grep -A5 "current:"
   ```
3. Check if background loop is still running:
   ```bash
   /tasks
   ```

**Prevention:** Trust `/sprint-status` for live updates; it reads fresh data.

---

### Stale Sprint Detection

**Symptom:** Dashboard shows "Stale - no activity for X minutes" warning.

**Cause:** Sprint status is "in-progress" but no activity has been recorded for 5+ minutes. This usually means the Claude process crashed or was terminated.

**Solution:**
1. **Via Dashboard**: Click the "Resume" button shown in the stale warning
2. **Via API**:
   ```bash
   curl -X POST http://localhost:3100/api/sprint/<sprint-id>/resume
   ```
3. **Via CLI**:
   ```bash
   /resume-sprint
   ```

**What happens:** The resume signal creates a `.resume-requested` file that the sprint runner picks up to restart execution from the current position.

**Prevention:** Monitor `/sprint-watch` during execution; use process managers for long-running sprints.

---

### Model Not Applied

**Symptom:** Sprint runs with wrong model despite setting `model` field.

**Cause:** Model selection uses precedence; a higher-priority setting may override yours.

**Solution:**
1. Check the model precedence order (highest to lowest):
   - Step-level `model` in SPRINT.yaml
   - Workflow phase-level `model`
   - Sprint-level `model` in SPRINT.yaml
   - Workflow-level `model`
   - CLI default

2. Verify your setting is at the appropriate level:
   ```yaml
   # Sprint-level (applies to all phases without override)
   model: opus
   steps:
     - Design architecture  # Uses opus

   # Step-level (highest priority)
   steps:
     - prompt: Complex task
       model: opus  # Definitely uses opus
   ```

3. Check compiled PROGRESS.yaml to see resolved model:
   ```bash
   grep -A2 "model:" PROGRESS.yaml
   ```

**Prevention:** Set model at step-level when you need guaranteed model selection.

---

## Recovery Procedures

### Full Reset

When things are badly broken, start fresh:

```bash
# Stop any running sprint
/stop-sprint

# Backup current state (optional)
cp -r .claude/sprints/your-sprint .claude/sprints/your-sprint.backup

# Remove compiled state
rm .claude/sprints/your-sprint/PROGRESS.yaml

# Recompile and restart
/run-sprint .claude/sprints/your-sprint
```

### Manual Pointer Adjustment

For advanced users only - manually fix the execution position:

```bash
# Edit PROGRESS.yaml
# Find the current: section and adjust phase/step/sub-phase indices
# Indices are 0-based

current:
  phase: 1      # Which top-level phase (0 = prepare, 1 = development, etc.)
  step: 2       # Which step within a for-each phase
  sub-phase: 0  # Which sub-phase within a step
```

### Skip a Problematic Phase

If one phase consistently fails:

```yaml
# In PROGRESS.yaml, find the phase and set:
- id: problematic-phase
  status: skipped
  skipped-reason: "Manual skip - issue #123"
```

Then resume: `/resume-sprint`

---

## Development & Testing

### Running the Status Server Manually

For debugging or development, run the status server directly:

```bash
# Build the compiler (if needed)
cd plugins/m42-sprint/compiler && npm run build && cd -

# Run server for a sprint directory
node plugins/m42-sprint/compiler/dist/status-server/index.js .claude/sprints/<sprint-id> --no-browser

# Use alternate port if default is busy
node plugins/m42-sprint/compiler/dist/status-server/index.js .claude/sprints/<sprint-id> --port 3101 --no-browser
```

**Options:**
- `-p, --port <number>` - Port to listen on (default: 3100)
- `-H, --host <host>` - Host to bind to (default: localhost)
- `--no-browser` - Disable automatic browser opening

### Testing API Endpoints

```bash
# Sprint status
curl http://localhost:3100/api/status | jq

# List worktrees and their sprints
curl http://localhost:3100/api/worktrees | jq

# Available controls
curl http://localhost:3100/api/controls | jq

# Timing estimates
curl http://localhost:3100/api/timing | jq

# SSE events stream
curl -N http://localhost:3100/events
```

### Checking Port Conflicts

```bash
# See what's using port 3100
lsof -i :3100

# Kill the process if needed
kill -9 <PID>
```

---

## Debug Commands Reference

| Command | Purpose |
|---------|---------|
| `/sprint-status` | View current progress dashboard |
| `/tasks` | List background tasks |
| `TaskOutput(id)` | Get output from background task |
| `cat PROGRESS.yaml` | Raw view of execution state |
| `cat SPRINT.yaml` | View sprint definition |
| `ls .claude/workflows/` | List available workflows |
| `/stop-sprint` | Force stop execution |
| `/pause-sprint` | Request graceful pause |
| `/run-sprint --dry-run` | Preview without executing |
| `/run-sprint --recompile` | Force recompilation |

---

## Getting More Help

If these solutions don't resolve your issue:

1. Check the [Architecture Overview](../concepts/overview.md) to understand how components interact
2. Review the [Ralph Loop Pattern](../concepts/ralph-loop.md) for execution model details
3. Review the [Operator System](../concepts/operator-system.md) for dynamic work injection
4. Inspect sprint logs in the `artifacts/` directory
5. Open an issue on GitHub with:
   - Your SPRINT.yaml (sanitized)
   - Relevant PROGRESS.yaml sections
   - Error messages
   - Steps to reproduce

---

[← Back to Documentation Index](../index.md)
