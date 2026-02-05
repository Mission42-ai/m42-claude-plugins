---
allowed-tools: Bash(test:*, mkdir:*, wc:*, split:*), Read(*), Glob(*), Task(*), Write(.claude/learnings/backlog.yaml)
argument-hint: "<transcript-path> [--dry-run] [--focus <area>] [--min-confidence <level>]"
description: Extract learnings from session transcript via parallel subagent processing
model: sonnet
---

# Extract Learnings from Session Transcript

Analyze Claude Code session transcript to extract **signs** - contextual learnings that help future agents work effectively.

**Operator pattern**: Orchestrates subagents (transcript-section-analyzer, context-matcher, quality-reviewer) with domain knowledge in @learning-extraction skill.

## Arguments

- `<transcript-path>` (required): Path to `.jsonl` or `.log` transcript
- `--dry-run`: Preview without writing
- `--focus <area>`: Focus extraction (e.g., "api", "testing")
- `--min-confidence <level>`: Minimum confidence (low|medium|high, default: medium)

## Preflight Checks

- Transcript exists: !`test -f "$TRANSCRIPT_PATH" || { echo "Error: Transcript not found: $TRANSCRIPT_PATH"; exit 1; }`
- Learnings directory: !`mkdir -p .claude/learnings`
- Preprocessing script: !`test -f "${CLAUDE_PLUGIN_ROOT}/scripts/extract-reasoning.sh" || echo "Warning: extract-reasoning.sh not found"`
- Find targets: !`find . -name "CLAUDE.md" -type f > /tmp/claude-md-$$.txt`
- Check size: !`wc -l "$TRANSCRIPT_PATH"`

## Context

- **Project root**: Current directory
- **Targets**: CLAUDE.md files (/tmp/claude-md-$$.txt)
- **Focus**: --focus value (if specified)
- **Min confidence**: --min-confidence value (default: medium)
- **Domain knowledge**: @learning-extraction skill (loaded by subagents)

## Task Instructions

### Step 1: Section Division

Determine processing strategy based on transcript size:

```bash
LINE_COUNT=$(wc -l < "$TRANSCRIPT_PATH")

if [ "$LINE_COUNT" -gt 100 ]; then
  # Preprocess: extract reasoning, split if needed
  "${CLAUDE_PLUGIN_ROOT}/scripts/extract-reasoning.sh" "$TRANSCRIPT_PATH" > /tmp/reasoning-$$.jsonl
  [ $(wc -l < /tmp/reasoning-$$.jsonl) -gt 50 ] && split -l 50 /tmp/reasoning-$$.jsonl /tmp/section-$$-
  SECTIONS=($(ls /tmp/section-$$-* 2>/dev/null || echo /tmp/reasoning-$$.jsonl))
else
  SECTIONS=("$TRANSCRIPT_PATH")
fi
```

Exit early if:
- Empty transcript: "Error: Transcript is empty"
- No assistant messages: "No reasoning content found"

### Step 2: Extract Candidates (Parallel)

For each section, spawn analyzer:

```
Task(
  subagent_type="m42-signs:transcript-section-analyzer",
  description="Analyze section {i}",
  prompt="Section: {section}
Focus: {FOCUS}

Extract candidates using @learning-extraction skill."
)
```

Merge results. If all empty → "Session appears mechanical - no learning patterns detected"

### Step 3: Match Targets

```
Task(
  subagent_type="m42-signs:context-matcher",
  description="Match to targets",
  prompt="Candidates: {json}
Targets: /tmp/claude-md-$$.txt

Assign targets, flag duplicates."
)
```

If all duplicates → "All learnings already in target files"

### Step 4: Quality Review

```
Task(
  subagent_type="m42-signs:quality-reviewer",
  description="Score and filter",
  prompt="Candidates: {json}
Min: {MIN_CONFIDENCE}

Use @learning-extraction criteria."
)
```

If all rejected → Show reasons, suggest lowering --min-confidence

### Step 5: Output

**Dry run**: Preview table

```
## Preview
Sections: {n} | Candidates: {total} → {accepted}

| # | Title | Confidence | Target |
|---|-------|------------|--------|

Run without --dry-run to save.
```

**Normal**: Append YAML to .claude/learnings/backlog.yaml

```yaml
- id: {id}
  status: pending
  title: {title}
  problem: |
    {problem}
  solution: |
    {solution}
  target: {target}
  confidence: {confidence}
  source:
    tool: {tool}
    context: {context}
```

Show summary:

```
## Complete
Learnings: {n}

| # | Title | Confidence | Target |

Written to: .claude/learnings/backlog.yaml
Next: /m42-signs:review
```

## Success Criteria

- All sections analyzed via subagents
- Domain logic in @learning-extraction (not command)
- Edge cases handled clearly
- Correct output format (YAML/tables)
- Dry run has no side effects
- Command ~150 lines (operator pattern)

**IMPORTANT:** Work in ultrathink mode. Think strategically, plan the workflow ahead, review actions to ensure highest quality. Use all resources and time needed. Reiterate as often as needed for excellence.
