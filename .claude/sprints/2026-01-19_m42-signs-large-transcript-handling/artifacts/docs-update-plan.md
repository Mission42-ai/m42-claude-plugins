# Documentation Update Plan: 2026-01-19_m42-signs-large-transcript-handling

## Code Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `plugins/m42-signs/scripts/extract-reasoning.sh` | Added | Extracts assistant text blocks (>50 chars) from transcripts |
| `plugins/m42-signs/scripts/transcript-summary.sh` | Added | Generates quick stats (line count, errors, tool sequence) |
| `plugins/m42-signs/scripts/find-learning-lines.sh` | Added | Pattern-matches text for learning indicators |
| `plugins/m42-signs/agents/chunk-analyzer.md` | Added | Subagent for parallel chunk analysis |
| `plugins/m42-signs/commands/extract.md` | Modified | Added large transcript handling, new args |
| `plugins/m42-signs/docs/how-to/handle-large-transcripts.md` | Added | Complete guide for preprocessing workflow |

## Documentation Impact

### Already Complete (Created During Sprint)

| Document | Status | Notes |
|----------|--------|-------|
| `docs/how-to/handle-large-transcripts.md` | ✅ Created | Full guide with Quick Start, thresholds, manual workflow, parallel processing, artifacts, troubleshooting |

### Reference Updates Needed

| Item | Action | Details |
|------|--------|---------|
| `docs/reference/commands.md` - `/m42-signs:extract` | **Update** | Add `--preprocess-only` and `--parallel` arguments to the Options table |
| `docs/reference/commands.md` - extract examples | **Add** | Add examples showing preprocessing and parallel flags |

### How-To Guide Updates

| Document | Action | Details |
|----------|--------|-------|
| `docs/how-to/extract-from-session.md` | **Add link** | Add reference to `handle-large-transcripts.md` in Related Guides section |
| `docs/getting-started.md` | **Optional** | Could add mention of large transcript handling under Next Steps, but not required |

## New Documentation Created (Already Done)

- [x] `docs/how-to/handle-large-transcripts.md` - Complete guide with:
  - Quick Start section
  - When Automatic Preprocessing Activates (detection criteria)
  - Size Thresholds table
  - Manual Preprocessing Workflow (4 steps)
  - Parallel Processing with --parallel
  - Artifacts Generated table
  - Troubleshooting section
  - Related Guides links

## Files to Update

| File | Updates Needed |
|------|----------------|
| `plugins/m42-signs/docs/reference/commands.md` | 1. Add `--preprocess-only` to extract Options table<br>2. Add `--parallel` to extract Options table<br>3. Add usage examples for large transcripts |
| `plugins/m42-signs/docs/how-to/extract-from-session.md` | Add link to `handle-large-transcripts.md` in Related Guides |

## Specific Changes Required

### 1. Update `docs/reference/commands.md`

**Location**: Lines 175-181 (Options table for `/m42-signs:extract`)

**Add rows to Options table**:
```markdown
| `--preprocess-only` | No | false | Generate preprocessing artifacts without LLM analysis |
| `--parallel` | No | false | Enable parallel chunk processing for large transcripts |
```

**Add new examples section after existing examples** (around line 207):
```markdown
```bash
# Preprocess only - generate artifacts without analysis
/m42-signs:extract large-session.jsonl --preprocess-only
```

```bash
# Parallel processing for very large transcripts
/m42-signs:extract huge-session.jsonl --parallel
```
```

### 2. Update `docs/how-to/extract-from-session.md`

**Location**: Lines 193-197 (Related Guides section)

**Add link**:
```markdown
- [Handle Large Transcripts](./handle-large-transcripts.md) - Preprocessing for transcripts >100 lines
```

## Verification Plan

- [ ] `--preprocess-only` documented in commands.md Options table
- [ ] `--parallel` documented in commands.md Options table
- [ ] Examples for new flags added to commands.md
- [ ] Link to large transcript guide added to extract-from-session.md
- [ ] All links resolve correctly (relative paths)
- [ ] No broken references

## Assessment

**Documentation Coverage**: Good

The sprint already created the main documentation (`handle-large-transcripts.md`) during Step 3. The remaining updates are:
1. Minor updates to reference docs for new CLI arguments
2. Cross-linking between related guides

**Estimated Effort**: Low - 2 file edits with specific additions

## Notes

- The existing `handle-large-transcripts.md` is comprehensive and follows AI-ready principles
- The `extract.md` command file already documents the preprocessing workflow internally
- No new conceptual documentation needed - just reference completeness
