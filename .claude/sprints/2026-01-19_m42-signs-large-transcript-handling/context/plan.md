# Plan: Large Transcript Handling for m42-signs

## Problem Statement

The `/m42-signs:extract` command fails on large transcripts (>100 lines, >500KB) because:
1. Token limits prevent reading full transcripts in one pass
2. No preprocessing exists to create lightweight analysis artifacts
3. No chunking strategy for parallel or sequential analysis
4. The command mentions "process in chunks with offset/limit" but provides no implementation

## Solution Overview

Add preprocessing scripts + chunk analyzer subagent + enhanced extract command workflow.

---

## Implementation

### 1. Create Preprocessing Scripts

**Location**: `plugins/m42-signs/scripts/`

#### 1.1 `extract-reasoning.sh`
Extract only assistant text blocks (PRIMARY learning source), reducing file size 5-10x.

```bash
#!/bin/bash
# Extract assistant reasoning text blocks from transcript
# Usage: extract-reasoning.sh <transcript.jsonl> [max-blocks]
set -euo pipefail

TRANSCRIPT="${1:?Usage: extract-reasoning.sh <transcript.jsonl> [max-blocks]}"
MAX_BLOCKS="${2:-9999}"

command -v jq &>/dev/null || { echo "Error: jq required" >&2; exit 1; }

jq -c '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "text" and .text != null and (.text | length) > 50) |
  {text: .text}
' "$TRANSCRIPT" | head -n "$MAX_BLOCKS"
```

#### 1.2 `transcript-summary.sh`
Generate quick stats without reading full content.

```bash
#!/bin/bash
# Generate transcript summary for triage
set -euo pipefail

TRANSCRIPT="${1:?Usage: transcript-summary.sh <transcript.jsonl>}"

jq -s '
{
  total_lines: length,
  assistant_messages: [.[] | select(.type == "assistant")] | length,
  text_blocks: [.[] | select(.type == "assistant") | .message.content[]? | select(.type == "text")] | length,
  error_count: [.[] | select(.type == "user") | .message.content[]? | select(.is_error == true)] | length,
  tool_sequence: [.[] | select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | .name][0:30]
}
' "$TRANSCRIPT"
```

#### 1.3 `find-learning-lines.sh`
Pattern-match high-value reasoning for prioritized analysis.

```bash
#!/bin/bash
# Find lines with discovery/decision patterns
set -euo pipefail

TRANSCRIPT="${1:?Usage: find-learning-lines.sh <transcript.jsonl>}"

jq -c '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "text") |
  select(.text | test("I notice|I see that|This means|Actually|The issue|This works because|The pattern|must change together|requires"; "i")) |
  {snippet: (.text | .[0:150])}
' "$TRANSCRIPT" | head -30
```

---

### 2. Create Chunk Analyzer Subagent

**Location**: `plugins/m42-signs/agents/chunk-analyzer.md`

```markdown
---
name: chunk-analyzer
description: Analyze preprocessed transcript chunk for learning extraction. Use when extract command processes large transcripts in parallel.
tools: Read, Bash
model: sonnet
color: cyan
---

Analyze a preprocessed reasoning chunk and extract learnings.

Input: Path to chunk file (JSONL with {text: ...} objects) and optional focus area.

Process:
1. Read the chunk file
2. For each text block, identify learning-worthy content:
   - Architectural insights
   - Pitfalls discovered
   - Effective strategies
   - File relationships
   - Domain knowledge
3. Extract learnings with: id, title, problem, solution, target CLAUDE.md, confidence

Output YAML array matching backlog schema. Prioritize high-confidence, reusable learnings.
Skip generic programming knowledge.
```

---

### 3. Enhance Extract Command

**File**: `plugins/m42-signs/commands/extract.md`

#### 3.1 Add to Preflight Checks (after line 30):

```markdown
3. Assess transcript size:
   !`wc -l "$TRANSCRIPT_PATH" && stat --printf="%s" "$TRANSCRIPT_PATH" 2>/dev/null || stat -f%z "$TRANSCRIPT_PATH"`

4. If > 100 lines or > 500KB, note: "Large transcript detected - will use preprocessing"
```

#### 3.2 Add new Arguments (update line 34-37):

```markdown
## Arguments

Parse `$ARGUMENTS` for:
- **Transcript path** (required): Path to `.jsonl` transcript file
- `--dry-run`: Preview learnings without writing to backlog
- `--focus <area>`: Focus extraction on specific area
- `--preprocess-only`: Generate preprocessing artifacts without LLM analysis
- `--parallel`: Enable parallel chunk processing for very large transcripts
```

#### 3.3 Add Large Transcript Section (after line 159):

```markdown
## Large Transcript Handling

When transcript exceeds 100 lines or 500KB:

### Step 1: Generate Summary
!`plugins/m42-signs/scripts/transcript-summary.sh "$TRANSCRIPT_PATH"`

Review to understand scope.

### Step 2: Find High-Value Patterns
!`plugins/m42-signs/scripts/find-learning-lines.sh "$TRANSCRIPT_PATH"`

These snippets indicate where learnings concentrate.

### Step 3: Extract Reasoning Blocks
!`plugins/m42-signs/scripts/extract-reasoning.sh "$TRANSCRIPT_PATH" > /tmp/reasoning-$$.jsonl`

This creates a smaller file focused on learning-worthy content.

### Step 4: Analyze Reasoning File

If reasoning file has < 100 blocks, analyze directly.

If reasoning file has 100+ blocks:
- Split: `split -l 50 /tmp/reasoning-$$.jsonl /tmp/chunk-$$-`
- With `--parallel`: Spawn chunk-analyzer subagent per chunk via Task()
- Without: Analyze chunks sequentially

### Step 5: Aggregate Results

Combine learnings from all chunks, deduplicate by semantic similarity.
```

---

### 4. Create Documentation

**File**: `plugins/m42-signs/docs/how-to/handle-large-transcripts.md`

Document:
- Automatic preprocessing activation
- Manual preprocessing workflow
- When to use `--parallel`
- Size thresholds table

---

### 5. Create agents/ Directory

```bash
mkdir -p plugins/m42-signs/agents
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `plugins/m42-signs/scripts/extract-reasoning.sh` | Create |
| `plugins/m42-signs/scripts/transcript-summary.sh` | Create |
| `plugins/m42-signs/scripts/find-learning-lines.sh` | Create |
| `plugins/m42-signs/agents/chunk-analyzer.md` | Create |
| `plugins/m42-signs/commands/extract.md` | Modify |
| `plugins/m42-signs/docs/how-to/handle-large-transcripts.md` | Create |

---

## Verification

1. **Test scripts individually**:
   ```bash
   ./plugins/m42-signs/scripts/transcript-summary.sh .claude/sprints/2026-01-18_ralph-mode-implementation/transcripts/development-step-0-execute.jsonl
   ./plugins/m42-signs/scripts/extract-reasoning.sh .claude/sprints/2026-01-18_ralph-mode-implementation/transcripts/development-step-0-execute.jsonl | wc -l
   ./plugins/m42-signs/scripts/find-learning-lines.sh .claude/sprints/2026-01-18_ralph-mode-implementation/transcripts/development-step-0-execute.jsonl
   ```

2. **Test extract with preprocessing**:
   ```bash
   /m42-signs:extract .claude/sprints/2026-01-18_ralph-mode-implementation/transcripts/development-step-0-execute.jsonl --dry-run
   ```

3. **Verify backlog output** matches existing schema after full extraction.

---

## Dependencies

- `jq` - Required for all scripts (already used in existing deprecated scripts)
- `split` - Standard Unix utility for chunking
