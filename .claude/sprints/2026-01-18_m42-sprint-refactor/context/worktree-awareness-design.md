# Worktree Awareness Design

**Created**: 2026-01-19 (Iteration 6)
**Purpose**: Document the worktree awareness implementation for parallel sprint execution

---

## Problem Statement

The vision calls for parallel sprint execution via git worktrees:
- Multiple sprints running in different worktrees
- Status server that can track them all
- Isolation so they don't interfere

Currently, the status server only knows about the single sprint directory it monitors.

---

## Solution Design

### New Module: `worktree.ts`

Created a dedicated module for worktree detection with these key functions:

| Function | Purpose |
|----------|---------|
| `detectWorktree(path)` | Get WorktreeInfo for any path |
| `listWorktrees(path)` | List all worktrees in the repository |
| `findSprintsAcrossWorktrees(path)` | Find all sprint directories across worktrees |
| `getWorktreeLabel(worktree)` | Human-readable label like "main (feature-branch)" |
| `isInWorktree(path)` | Quick check if path is in a linked worktree |
| `getWorktreeName(sprintDir)` | Get worktree name for a sprint |

### Extended SprintSummary

Added optional `worktree` field to `SprintSummary`:

```typescript
worktree?: {
  name: string;    // "main" or worktree directory name
  branch: string;  // Current git branch
  isMain: boolean; // True for main worktree
};
```

### Extended SprintScanner

Added `SprintScannerOptions` to control behavior:

```typescript
interface SprintScannerOptions {
  includeWorktreeInfo?: boolean; // Default: false for performance
}
```

### New Cross-Worktree Function

```typescript
scanSprintsAcrossWorktrees(targetPath, sprintsRelativePath?): SprintSummary[]
```

Scans all worktrees in the repository and returns a merged, sorted list of sprints with worktree context.

---

## Implementation Notes

### Git Commands Used

| Command | Purpose |
|---------|---------|
| `git rev-parse --show-toplevel` | Get worktree root |
| `git rev-parse --abbrev-ref HEAD` | Get branch name |
| `git rev-parse --short HEAD` | Get abbreviated commit |
| `git worktree list --porcelain` | List all worktrees |

### Main vs Linked Worktree Detection

- **Main worktree**: Has `.git` as a directory
- **Linked worktree**: Has `.git` as a file (pointing to main repo's git dir)

```typescript
const isMain = fs.statSync(path.join(root, '.git')).isDirectory();
```

### Performance Considerations

- Worktree detection is cached per SprintScanner instance
- `includeWorktreeInfo` defaults to false for normal scans
- Git commands use `stdio: ['pipe', 'pipe', 'pipe']` to suppress stderr

---

## Server Integration (Iteration 7)

### StatusServer Enhancements

Added worktree awareness directly to the StatusServer:

```typescript
// StatusServer now detects its worktree on startup
private worktreeInfo: WorktreeInfo | null = null;

async start(): Promise<void> {
  // Detect worktree context for this server instance
  this.worktreeInfo = detectWorktree(this.config.sprintDir);
  // ...
}
```

### API Updates

#### `/api/status` - Now includes worktree context

```json
{
  "header": { ... },
  "phaseTree": [ ... ],
  "currentTask": { ... },
  "worktree": {
    "name": "main",
    "branch": "sprint/2026-01-18_m42-sprint-refactor",
    "commit": "8eea34b",
    "isMain": true,
    "root": "/home/konstantin/projects/m42-claude-plugins"
  }
}
```

#### `/api/sprints` - Enhanced with worktree options

Query parameters:
- `includeWorktree=true` - Include worktree info on each sprint

Response now includes:
```json
{
  "sprints": [ ... ],
  "serverWorktree": {
    "name": "main",
    "branch": "sprint/...",
    "isMain": true
  }
}
```

---

## Remaining Work

1. **Dashboard UI**: Update `dashboard-page.ts` to show worktree context
   - Group sprints by worktree
   - Show worktree label in the header
   - Indicate which worktree the current server is monitoring

2. **API Enhancement**: Add `/api/worktrees` endpoint to list all worktrees

3. **Cross-Worktree SSE**: Consider whether a central dashboard should aggregate SSE from multiple status servers

---

## Testing

To test worktree detection:

```bash
# From main worktree
git worktree list

# Test the detection
cd /home/konstantin/projects/m42-claude-plugins
node -e "
  const { detectWorktree, listWorktrees } = require('./plugins/m42-sprint/compiler/dist/status-server/worktree.js');
  console.log('Current:', detectWorktree('.'));
  console.log('All:', listWorktrees('.'));
"
```

---

## Design Decisions

1. **Optional worktree info**: For backward compatibility and performance, worktree info is only included when explicitly requested.

2. **Worktree name convention**: Use "main" for the main worktree rather than its directory name, as it's the canonical location.

3. **No shared state**: Each status server is independent; cross-worktree awareness is read-only discovery.

---

*This iteration focused on the foundation; dashboard integration follows in the next iteration.*
