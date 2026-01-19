# Iteration 22 Findings

## Task: Review m42-signs Learning Extraction Backlog

### What Was Done

Reviewed the 4 pending learnings in `.claude/learnings/backlog.yaml` that were extracted from earlier sprint iterations.

### Analysis

The backlog contained 4 learnings, all about handling large files with the Read tool:

1. **fix-read-tool-file-size-handling** (high confidence) - Good guidance on offset/limit
2. **fix-read-file-path-for-status-server** (high confidence) - Too specific, one-time mistake
3. **handle-read-tool-large-file-with-offset-limit** (high confidence) - Overlaps with #1
4. **handle-read-tool-large-file-with-limit** (medium confidence) - Overlaps with #1 and #3

### Decision: Consolidation

Rather than maintaining 4 overlapping learnings, I consolidated them into a single comprehensive learning:

**Approved:**
- `handle-large-files-with-read-tool` - Comprehensive guidance combining all strategies:
  - Use offset/limit parameters for large files
  - Use Grep for searching instead of reading entire files
  - Read smaller related files when exploring
  - Special handling for very large files (>40k tokens)

**Rejected:**
- `fix-read-file-path-for-status-server` - Too specific, not generalizable
- `handle-read-tool-large-file-with-offset-limit` - Consolidated
- `handle-read-tool-large-file-with-limit` - Consolidated

### Rationale

This approach:
- Reduces noise in the backlog
- Creates one clear, actionable learning instead of multiple overlapping ones
- Preserves all the valuable insights from the individual learnings
- Makes it easier to apply and maintain

### Next Steps

The approved learning is ready to be applied to `/home/konstantin/projects/CLAUDE.md` using `/m42-signs:apply`.

### Reflection

The m42-signs learning extraction is working as designed - it's capturing error patterns from sprint iterations. The consolidation step is important to prevent backlog bloat from similar patterns. This demonstrates the value of the review phase before applying learnings.
