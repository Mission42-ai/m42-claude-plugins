# Step Context: step-2

## Task
Enhance extract.md command with large transcript handling workflow.

Modify: plugins/m42-signs/commands/extract.md

Add:
1. Size detection in preflight checks (after line 30)
2. New arguments: --preprocess-only, --parallel
3. Large Transcript Handling section with preprocessing workflow
4. Instructions for using chunk-analyzer subagent

The command should automatically detect large transcripts (>100 lines or >500KB) and activate preprocessing mode.

## Implementation Plan

Based on gherkin scenarios (8 total), implement in this order:

1. **Add size detection to Preflight Checks** (Scenarios 1, 2)
   - Add check #3 using `wc -l` for line count
   - Add check #4 using `stat` for file size in bytes
   - Add note about thresholds: >100 lines OR >500KB

2. **Extend Arguments section** (Scenarios 3, 4)
   - Add `--preprocess-only` argument with description
   - Add `--parallel` argument with description

3. **Create Large Transcript Handling section** (Scenarios 5, 6, 7, 8)
   - Add new `## Large Transcript Handling` section header
   - Reference all three preprocessing scripts
   - Document chunk-analyzer subagent usage with Task()
   - Document split command for 50-block chunks
   - Document aggregation/deduplication step

## Related Code Patterns

### Pattern from: plugins/m42-signs/commands/add.md - Preflight Checks
```markdown
## Preflight Checks

1. Check if backlog directory exists:
   !`test -d .claude/learnings && echo "EXISTS" || echo "NOT_EXISTS"`

2. Check if backlog file exists:
   !`test -f .claude/learnings/backlog.yaml && echo "EXISTS" || echo "NOT_EXISTS"`
```

### Pattern from: plugins/m42-signs/commands/extract.md - Current Preflight Checks (lines 24-30)
```markdown
## Preflight Checks

1. Check if learnings directory exists:
   !`test -d .claude/learnings && echo "EXISTS" || echo "NOT_EXISTS"`

2. List existing CLAUDE.md files for target inference:
   !`find . -name "CLAUDE.md" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -20`
```

### Pattern from: plugins/m42-signs/commands/extract.md - Current Arguments (lines 32-37)
```markdown
## Arguments

Parse `$ARGUMENTS` for:
- **Transcript path** (required): Path to `.jsonl` transcript file
- `--dry-run`: Preview learnings without writing to backlog
- `--focus <area>`: Focus extraction on specific area (e.g., "api", "testing", "build")
```

### Pattern from: context/plan.md - Size Detection Commands
```bash
wc -l "$TRANSCRIPT_PATH"
stat --printf="%s" "$TRANSCRIPT_PATH" 2>/dev/null || stat -f%z "$TRANSCRIPT_PATH"
```

## Scripts to Reference

### transcript-summary.sh
- Location: `plugins/m42-signs/scripts/transcript-summary.sh`
- Purpose: Generate quick stats (line count, assistant messages, errors, tool sequence)
- Usage: `!`plugins/m42-signs/scripts/transcript-summary.sh "$TRANSCRIPT_PATH"``

### find-learning-lines.sh
- Location: `plugins/m42-signs/scripts/find-learning-lines.sh`
- Purpose: Pattern-match high-value reasoning snippets
- Usage: `!`plugins/m42-signs/scripts/find-learning-lines.sh "$TRANSCRIPT_PATH"``

### extract-reasoning.sh
- Location: `plugins/m42-signs/scripts/extract-reasoning.sh`
- Purpose: Extract assistant text blocks (>50 chars) as JSONL
- Usage: `!`plugins/m42-signs/scripts/extract-reasoning.sh "$TRANSCRIPT_PATH" > /tmp/reasoning-$$.jsonl``

## Subagent Reference

### chunk-analyzer
- Location: `plugins/m42-signs/agents/chunk-analyzer.md`
- Purpose: Analyze preprocessed transcript chunk for learning extraction
- Input: Path to chunk file (JSONL with `{text: ...}` objects)
- Output: YAML array matching backlog schema
- Usage: Spawn via Task() for parallel processing

## Types/Interfaces to Use

N/A - This is a markdown command definition, not TypeScript code.

## Integration Points

- **Called by**: User via `/m42-signs:extract <path>`
- **Calls**:
  - `transcript-summary.sh` - For size analysis
  - `find-learning-lines.sh` - For pattern detection
  - `extract-reasoning.sh` - For preprocessing
  - `chunk-analyzer` subagent - For chunk analysis (via Task())
  - `split` command - For chunking reasoning file

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-signs/commands/extract.md` | Modify | Add preflight size checks, new arguments, Large Transcript Handling section |

## Exact Changes Required

### 1. After line 30 (Preflight Checks), insert:

```markdown
3. Assess transcript size:
   !`wc -l "$TRANSCRIPT_PATH" && stat --printf="%s" "$TRANSCRIPT_PATH" 2>/dev/null || stat -f%z "$TRANSCRIPT_PATH"`

4. Large transcript detection (>100 lines or >500KB activates preprocessing mode)
```

### 2. Replace lines 32-37 (Arguments section) with:

```markdown
## Arguments

Parse `$ARGUMENTS` for:
- **Transcript path** (required): Path to `.jsonl` transcript file
- `--dry-run`: Preview learnings without writing to backlog
- `--focus <area>`: Focus extraction on specific area (e.g., "api", "testing", "build")
- `--preprocess-only`: Generate preprocessing artifacts without LLM analysis
- `--parallel`: Enable parallel chunk processing for very large transcripts
```

### 3. After line 159 (after current Edge Cases section), insert:

```markdown
## Large Transcript Handling

When transcript exceeds 100 lines or 500KB, activate preprocessing mode:

### Step 1: Generate Summary
!`plugins/m42-signs/scripts/transcript-summary.sh "$TRANSCRIPT_PATH"`

Review stats to understand transcript scope.

### Step 2: Find High-Value Patterns
!`plugins/m42-signs/scripts/find-learning-lines.sh "$TRANSCRIPT_PATH"`

These snippets indicate where learnings concentrate.

### Step 3: Extract Reasoning Blocks
!`plugins/m42-signs/scripts/extract-reasoning.sh "$TRANSCRIPT_PATH" > /tmp/reasoning-$$.jsonl`

Creates a smaller file focused on learning-worthy content.

### Step 4: Analyze Reasoning File

If reasoning file has < 100 blocks, analyze directly using standard extraction.

If reasoning file has 100+ blocks, split into chunks:
```bash
split -l 50 /tmp/reasoning-$$.jsonl /tmp/chunk-$$-
```

- With `--parallel`: Spawn chunk-analyzer subagent per chunk via Task()
- Without: Analyze chunks sequentially

### Step 5: Aggregate and Deduplicate Results

Combine learnings from all chunks. Deduplicate by semantic similarity (same problem/solution).
```

## Verification Commands

From step-2-gherkin.md:
```bash
# Run full test suite
./tests/step-2-extract-command.sh

# Individual checks:
# Scenario 1: Size detection
grep -A10 "## Preflight Checks" plugins/m42-signs/commands/extract.md | grep -q "wc -l" && \
grep -A15 "## Preflight Checks" plugins/m42-signs/commands/extract.md | grep -q "stat"

# Scenario 2: Thresholds documented
grep -q "100.*line\|100 line" plugins/m42-signs/commands/extract.md && \
grep -q "500.*KB\|500KB" plugins/m42-signs/commands/extract.md

# Scenario 3-4: Arguments
grep -q "\-\-preprocess-only" plugins/m42-signs/commands/extract.md && \
grep -q "\-\-parallel" plugins/m42-signs/commands/extract.md

# Scenario 5: Section header
grep -q "^## Large Transcript Handling" plugins/m42-signs/commands/extract.md

# Scenario 6: Script references
grep -q "transcript-summary.sh" plugins/m42-signs/commands/extract.md && \
grep -q "find-learning-lines.sh" plugins/m42-signs/commands/extract.md && \
grep -q "extract-reasoning.sh" plugins/m42-signs/commands/extract.md

# Scenario 7: Subagent integration
grep -qi "chunk-analyzer" plugins/m42-signs/commands/extract.md && \
grep -qi "Task" plugins/m42-signs/commands/extract.md

# Scenario 8: Chunking workflow
grep -qi "split" plugins/m42-signs/commands/extract.md && \
grep -q "50" plugins/m42-signs/commands/extract.md && \
grep -qi "deduplicate" plugins/m42-signs/commands/extract.md
```
