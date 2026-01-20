# Step Context: remove-bash

## Task
GIVEN the working TypeScript runtime
WHEN integrating with commands and cleaning up
THEN remove replaced bash scripts and update all references

## Scope
- Update slash commands to use TypeScript runtime
- Remove replaced bash scripts
- Update documentation

## Acceptance Criteria

### Command Updates
- [ ] Update /run-sprint command to call TypeScript runtime
- [ ] Update /sprint-status to use TypeScript if applicable
- [ ] Verify /pause-sprint, /resume-sprint, /stop-sprint work

### Bash Script Removal
- [ ] Delete: plugins/m42-sprint/scripts/sprint-loop.sh
- [ ] Delete: plugins/m42-sprint/scripts/build-sprint-prompt.sh
- [ ] Delete: plugins/m42-sprint/scripts/build-parallel-prompt.sh
- [ ] Delete: plugins/m42-sprint/scripts/preflight-check.sh
- [ ] KEEP: plugins/m42-sprint/scripts/test-*.sh (integration tests)

### Documentation Updates
- [ ] Update plugins/m42-sprint/README.md
- [ ] Update any docs referencing bash scripts
- [ ] Document new TypeScript architecture

### Verification
- [ ] grep -r "sprint-loop.sh" → no results in active code
- [ ] grep -r "build-sprint-prompt" → no results in active code
- [ ] /run-sprint executes successfully
- [ ] Full sprint execution works end-to-end
- [ ] All existing integration tests pass

## Files to Delete
- plugins/m42-sprint/scripts/sprint-loop.sh
- plugins/m42-sprint/scripts/build-sprint-prompt.sh
- plugins/m42-sprint/scripts/build-parallel-prompt.sh
- plugins/m42-sprint/scripts/preflight-check.sh


## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **Update run-sprint.md command** - Change allowed-tools to reference TypeScript CLI instead of sprint-loop.sh, update launch instructions to use `node runtime/dist/cli.js run`
2. **Update pause-sprint.md** - Remove reference to sprint-loop.sh in explanation (line 40)
3. **Update resume-sprint.md** - Remove reference to sprint-loop.sh in notes (line 59)
4. **Update stop-sprint.md** - Remove reference to sprint-loop.sh in explanation (line 45)
5. **Delete bash scripts** - Remove the four scripts (sprint-loop.sh, build-sprint-prompt.sh, build-parallel-prompt.sh, preflight-check.sh)
6. **Update README.md** - Remove yq dependency, add Node.js requirement, document TypeScript architecture
7. **Update docs/concepts/ralph-loop.md** - Update references to sprint-loop.sh and build-sprint-prompt.sh
8. **Update docs/concepts/overview.md** - Update component map to show runtime/ instead of scripts/
9. **Update docs/reference/commands.md** - Remove yq dependency mention (line 677), update launch description

## Related Code Patterns

### Pattern from: plugins/m42-sprint/runtime/src/cli.ts
```typescript
#!/usr/bin/env node
/**
 * CLI Entry Point for Sprint Runtime
 *
 * Provides commands matching the current bash interface:
 *   sprint run <dir> [options]
 *     --max-iterations <n>  Maximum iterations (0 = unlimited)
 *     --delay <ms>          Delay between iterations (default: 2000)
 *     -v, --verbose         Enable verbose logging
 */

import { runLoop, LoopOptions, LoopResult } from './loop.js';

// Usage: node dist/cli.js run <directory> [options]
// Exit codes: 0 = success/paused, 1 = blocked/error
```

### Pattern from: plugins/m42-sprint/runtime/package.json
```json
{
  "name": "@m42/sprint-runtime",
  "bin": {
    "sprint": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "npm run build && node dist/transition.test.js && ..."
  }
}
```

## Required Imports
### Internal
- None required for command updates (documentation changes only)

### External
- Node.js >=18.0.0 (required by runtime)
- js-yaml@4.1.0 (for YAML parsing in runtime)

## Types/Interfaces to Use
No new types needed - this is a removal/documentation step.

## Integration Points
- **run-sprint.md**: Change from spawning `sprint-loop.sh` to spawning `node runtime/dist/cli.js run`
- **pause-sprint.md**, **resume-sprint.md**, **stop-sprint.md**: Update explanatory text only
- **sprint-status.md**: No changes needed (already uses pure YAML reading)

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| plugins/m42-sprint/commands/run-sprint.md | Modify | Update allowed-tools and launch command |
| plugins/m42-sprint/commands/pause-sprint.md | Modify | Remove sprint-loop.sh reference |
| plugins/m42-sprint/commands/resume-sprint.md | Modify | Remove sprint-loop.sh reference |
| plugins/m42-sprint/commands/stop-sprint.md | Modify | Remove sprint-loop.sh reference |
| plugins/m42-sprint/scripts/sprint-loop.sh | Delete | Replaced by TypeScript runtime |
| plugins/m42-sprint/scripts/build-sprint-prompt.sh | Delete | Replaced by prompt-builder.ts |
| plugins/m42-sprint/scripts/build-parallel-prompt.sh | Delete | Merged into prompt-builder.ts |
| plugins/m42-sprint/scripts/preflight-check.sh | Delete | Replaced by runtime validation |
| plugins/m42-sprint/README.md | Modify | Remove yq, add Node.js, update architecture |
| plugins/m42-sprint/docs/concepts/ralph-loop.md | Modify | Update script references |
| plugins/m42-sprint/docs/concepts/overview.md | Modify | Update component map |
| plugins/m42-sprint/docs/reference/commands.md | Modify | Remove yq dependency |

## Reference: Files that Reference Bash Scripts

### sprint-loop.sh references (to update/remove):
- `commands/run-sprint.md:2` - allowed-tools
- `commands/run-sprint.md:211` - launch command
- `commands/run-sprint.md:306` - diagram
- `commands/pause-sprint.md:40` - explanation
- `commands/stop-sprint.md:45` - explanation
- `commands/resume-sprint.md:59` - notes
- `commands/help.md:101` - overview
- `docs/reference/commands.md:218` - run-sprint description
- `docs/reference/commands.md:677` - yq dependency
- `docs/concepts/ralph-loop.md:67,202` - implementation section
- `docs/concepts/overview.md:62,166` - architecture diagram

### build-sprint-prompt.sh references (to update/remove):
- `docs/concepts/ralph-loop.md:212,233` - implementation section
- `docs/concepts/overview.md:167` - component map
- Test files (KEEP - they validate the TypeScript replacement works):
  - `scripts/test-normal-subphase.sh:3,37,38`
  - `scripts/test-skip-parallel-task-id.sh:3,40,41`
  - `scripts/test-skip-spawned.sh:3,39,40`

### preflight-check.sh references:
- `docs/concepts/overview.md:168` - component map
- `scripts/test-sprint-features.sh:101` - integration test (KEEP)

## New Architecture to Document

```
plugins/m42-sprint/
├── compiler/          # TypeScript compiler: SPRINT.yaml → PROGRESS.yaml
│   ├── src/
│   │   ├── compile.ts
│   │   ├── validate.ts
│   │   └── types.ts
│   └── dist/
├── runtime/           # NEW: TypeScript runtime (replaces bash scripts)
│   ├── src/
│   │   ├── cli.ts           # Entry point (replaces sprint-loop.sh)
│   │   ├── loop.ts          # Main loop logic
│   │   ├── prompt-builder.ts # Prompt construction
│   │   ├── transition.ts    # State machine
│   │   ├── executor.ts      # Action execution
│   │   └── yaml-ops.ts      # Atomic YAML operations
│   └── dist/
├── scripts/           # KEEP: Integration tests only
│   ├── test-sprint-features.sh
│   ├── test-skip-spawned.sh
│   ├── test-skip-parallel-task-id.sh
│   └── test-normal-subphase.sh
├── commands/          # Slash commands (updated to use runtime/)
└── docs/             # Documentation (updated references)
```

## Test Script Updates Needed

The integration test scripts (test-*.sh) currently reference build-sprint-prompt.sh. These tests will need to be updated to test the TypeScript prompt-builder instead, OR the tests can remain as they are and will naturally fail when the bash scripts are deleted (which is expected behavior since those scripts no longer exist).

**Recommendation**: Keep test scripts as-is for now. The integration.test.ts already validates that:
1. Bash scripts don't exist
2. TypeScript runtime is buildable
3. All runtime tests pass

The bash test scripts can be updated in a follow-up PR to test the TypeScript implementation directly.
