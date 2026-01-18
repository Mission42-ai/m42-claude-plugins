# Step Context: step-14

## Task
Phase 4 - Step 6: Update sprint-watch Command for Dashboard Mode

Add --dashboard flag to sprint-watch command to open dashboard view.

Requirements:
- Add `--dashboard` flag to sprint-watch.md command
- When --dashboard, open browser to `/` instead of `/sprint/<id>`
- Update command help text with new flag
- Allow running dashboard mode without active sprint

Verification:
- Run `/sprint-watch --dashboard`, verify dashboard opens
- Run `/sprint-watch` normally, verify sprint detail opens

File to modify:
- plugins/m42-sprint/commands/sprint-watch.md

## Related Code Patterns

### Similar Implementation: run-sprint.md argument parsing
```markdown
## Argument Parsing

The first argument MUST be the sprint directory path. Parse $ARGUMENTS to extract:

1. **Sprint Directory Path** (REQUIRED): The path to the sprint directory
   - Example: `.claude/sprints/2026-01-15_my-sprint`
   - Must contain SPRINT.yaml

2. **Options** (OPTIONAL):
   - `--max-iterations N` - Maximum loop iterations (default: 60)
   - `--dry-run` - Preview tasks without executing (read-only mode)
   - `--recompile` - Force recompilation even if PROGRESS.yaml exists
   - `--no-status` - Skip launching the live status server
   - `--no-browser` - Disable automatic browser opening when status server starts
```

### Server Routing Pattern: server.ts
The server already supports dashboard at `/` and sprint detail at `/sprint/:id`:
```typescript
switch (urlObj.pathname) {
  case '/':
  case '/dashboard':
    this.handleDashboardPageRequest(res);
    break;
  // ... sprint detail handled via:
  // const sprintDetailMatch = url.match(/^\/sprint\/([^/?]+)/);
}
```

### Browser Opening Pattern: index.ts
```typescript
// Get the server URL
const url = server.getUrl();
// ...
// Open browser if not disabled
if (options.browser) {
  openBrowser(url);
}
```

### Current sprint-watch.md patterns
- Finds most recent sprint if none provided
- Checks for existing server via `.sprint-status.port` file
- Launches server in background with `run_in_background: true`
- Reports URL to user

## Required Imports
### Internal
- No additional imports needed - command is markdown instructions

### External
- No external packages - command uses existing Bash tool

## Types/Interfaces to Use
No TypeScript changes needed - this is a command definition file (markdown).

## Integration Points
- **Called by**: User via `/sprint-watch --dashboard`
- **Calls**:
  - `node "${CLAUDE_PLUGIN_ROOT}/compiler/dist/status-server/index.js" "$SPRINT_DIR"`
  - Status server serves `/` for dashboard view
  - Status server serves `/sprint/<id>` for sprint detail view
- **Tests**: Gherkin scenarios in artifacts/step-14-gherkin.md

## Implementation Notes

1. **Argument Parsing Changes**:
   - Add `--dashboard` as optional flag
   - Document flag in the argument parsing section
   - Keep sprint directory path as OPTIONAL (existing behavior)

2. **Dashboard Mode Behavior**:
   - When `--dashboard` flag is present, skip sprint directory requirement
   - Open browser to root URL (`/`) instead of sprint detail URL (`/sprint/<id>`)
   - Server still needs ONE sprint directory to determine sprints parent folder
   - Can use most recent sprint's directory as the reference (existing logic)

3. **URL Construction**:
   - Normal mode: `http://localhost:{port}/sprint/{sprint-id}` (current behavior: `http://localhost:{port}`)
   - Dashboard mode: `http://localhost:{port}/` (dashboard landing page)
   - Note: Current implementation opens root URL but server redirects to sprint detail for the monitored sprint

4. **Preflight Check Adjustments**:
   - In dashboard mode, can relax PROGRESS.yaml requirement since dashboard shows all sprints
   - Still need sprint directory exists (to locate sprints parent directory for scanning)
   - Could find most recent sprint even without PROGRESS.yaml for dashboard mode

5. **Status Server Note**:
   - The status server already serves dashboard at `/` and sprint detail at `/sprint/:id`
   - No server changes needed - just update command to open correct URL

6. **Gherkin Verification Requirements** (from step-14-gherkin.md):
   - Scenario 2: `--dashboard` flag documented in argument parsing section
   - Scenario 3: File specifies opening `/` (root dashboard) when --dashboard used
   - Scenario 4: Dashboard mode works without active sprint requirement
   - Scenario 5: Dashboard flag purpose explained in description
   - Scenario 6: Usage examples include --dashboard
