# Worktree Information

## Paths
- **Worktree**: `/home/konstantin/projects/.worktrees/m42-claude-plugins/2026-01-20_dashboard-improvements`
- **Branch**: `sprint/2026-01-20_dashboard-improvements`
- **Main repo**: `/home/konstantin/projects/m42-claude-plugins`

## Working in the Worktree
All subsequent phases will work in the worktree directory:
```bash
cd /home/konstantin/projects/.worktrees/m42-claude-plugins/2026-01-20_dashboard-improvements
```

## Sprint Files Location (in worktree)
```
.claude/sprints/2026-01-20_dashboard-improvements/
├── SPRINT.yaml
├── BACKLOG.yaml
├── PROGRESS.yaml
├── context/
├── artifacts/
└── transcriptions/
```

## After Sprint Completion
1. Create PR from `sprint/2026-01-20_dashboard-improvements` branch
2. Merge PR to main
3. Clean up worktree:
   ```bash
   git worktree remove /home/konstantin/projects/.worktrees/m42-claude-plugins/2026-01-20_dashboard-improvements
   git branch -d sprint/2026-01-20_dashboard-improvements
   ```

## Worktree Commands Reference
```bash
# List all worktrees
git worktree list

# Navigate to this worktree
cd /home/konstantin/projects/.worktrees/m42-claude-plugins/2026-01-20_dashboard-improvements

# Check status
git status

# View branch
git branch --show-current
```
