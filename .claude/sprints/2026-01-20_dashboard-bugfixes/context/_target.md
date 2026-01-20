# Dashboard Bug Fixes - Target Context

## Target Component
**Sprint Status Dashboard** - Web-based real-time monitoring interface for sprints

## Location
`plugins/m42-sprint/compiler/src/status-server/`

## Key Files to Investigate
- Status server implementation
- Frontend React components (if used)
- WebSocket/polling logic for live updates
- PROGRESS.yaml parsing
- Activity file (`.sprint-activity.jsonl`) reading
- Log file serving

## Test Environment
- Run status server: `node plugins/m42-sprint/compiler/dist/status-server/index.js <sprint-dir>`
- Access: `http://localhost:<port>` (port written to `.sprint-status.port`)
- Test with existing completed sprints in `.claude/sprints/`

## Related Systems
- **PROGRESS.yaml**: Sprint state, timing, step status
- **Activity Hook**: `plugins/m42-sprint/hooks/sprint-activity-hook.sh`
- **Activity File**: `.sprint-activity.jsonl` (JSONL format, one event per line)
- **Log Files**: `{sprintDir}/logs/{phaseId}.log`

## Bug Categories
1. **Visual Indicators** (BUG-001, BUG-006, BUG-007): Missing or incorrect UI elements
2. **Filtering** (BUG-002): Worktree filter broken
3. **Live Data** (BUG-003): Activity feed not working
4. **UX Polish** (BUG-004, BUG-005): Metrics cluttered, unwanted notifications

## Testing Strategy
1. Start status server with a completed sprint
2. Verify each bug exists
3. Fix and verify with live status server
4. Test with both completed and running sprints
5. Test filtering with multiple worktrees

## Success Criteria
All 7 bugs fixed with:
- Visual regression testing
- Functional testing with real sprints
- Manual UX review
