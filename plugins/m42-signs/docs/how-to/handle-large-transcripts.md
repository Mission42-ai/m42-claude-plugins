---
title: Handling Large Transcripts
description: Preprocessing and parallel analysis for transcripts exceeding token limits
keywords: [large-transcript, preprocessing, parallel, chunking, transcript-summary, extract-reasoning]
---

# Handling Large Transcripts

When session transcripts exceed token limits, preprocessing extracts learning-worthy content into smaller artifacts that can be analyzed efficiently. This guide covers automatic detection, manual preprocessing workflows, and parallel chunk analysis.

## Quick Start

```bash
# Check if transcript is large
wc -l your-transcript.jsonl

# Automatic preprocessing (activates if >100 lines or >500KB)
/m42-signs:extract your-transcript.jsonl

# Manual preprocessing only
/m42-signs:extract your-transcript.jsonl --preprocess-only

# Parallel chunk analysis for very large transcripts
/m42-signs:extract your-transcript.jsonl --parallel
```

---

## When Automatic Preprocessing Activates

The `/m42-signs:extract` command automatically detects large transcripts and activates preprocessing mode.

### Detection Criteria

Preprocessing activates when **either** condition is met:

| Metric | Threshold | Why This Matters |
|--------|-----------|------------------|
| Line count | >100 lines | More than 100 JSONL entries indicates a substantial session |
| File size | >500KB | Large files exceed context window limits |

When activated, the command:
1. Generates a summary of the transcript
2. Identifies high-value learning patterns
3. Extracts reasoning blocks to a smaller file
4. Analyzes the condensed content

---

## Size Thresholds

| Transcript Size | Mode | Processing |
|-----------------|------|------------|
| ≤100 lines AND ≤500KB | Direct | Analyze full transcript |
| >100 lines OR >500KB | Preprocessing | Extract reasoning first |
| Reasoning has 100+ blocks | Chunking | Split into 50-block chunks |

---

## Manual Preprocessing Workflow

Use `--preprocess-only` to generate artifacts without running LLM analysis.

### Step 1: Generate Summary

```bash
plugins/m42-signs/scripts/transcript-summary.sh your-transcript.jsonl
```

Output includes:
- Total line count
- Error count and locations
- Tool usage sequence
- Session duration estimate

### Step 2: Find Learning Indicators

```bash
plugins/m42-signs/scripts/find-learning-lines.sh your-transcript.jsonl
```

Searches for patterns that indicate learnings:
- "I notice...", "I see that..."
- "The pattern here is..."
- Error → retry → success sequences

### Step 3: Extract Reasoning Blocks

```bash
plugins/m42-signs/scripts/extract-reasoning.sh your-transcript.jsonl > reasoning.jsonl
```

Creates a focused file containing only assistant text blocks where learning-worthy content lives.

### Step 4: Review Artifacts

Examine the generated artifacts before full analysis:

```bash
# Check reasoning file size
wc -l reasoning.jsonl

# Preview content
head -20 reasoning.jsonl | jq '.text' | head -5
```

---

## Parallel Processing with --parallel

Use `--parallel` when the extracted reasoning file contains 100+ blocks.

### When to Use

| Scenario | Recommendation |
|----------|----------------|
| Reasoning < 100 blocks | Sequential (default) |
| Reasoning 100-300 blocks | `--parallel` beneficial |
| Reasoning 300+ blocks | `--parallel` recommended |

### How It Works

1. Reasoning file is split into 50-block chunks
2. Each chunk is analyzed by a `chunk-analyzer` subagent in parallel
3. Results are aggregated and deduplicated

### Example

```bash
# Long sprint transcript with extensive reasoning
/m42-signs:extract .claude/sprints/big-feature/transcripts/session.jsonl --parallel
```

### Chunk Analysis

The `chunk-analyzer` subagent processes each chunk independently, applying the same learning extraction rules to its portion of the transcript.

---

## Artifacts Generated

During preprocessing, these artifacts are created:

| Artifact | Location | Contents |
|----------|----------|----------|
| Summary output | stdout | JSON stats: line count, errors, tools |
| Learning indicators | stdout | Line numbers with learning patterns |
| Reasoning file | `/tmp/reasoning-$$.jsonl` | Extracted assistant text blocks |
| Chunks (if parallel) | `/tmp/chunk-$$-*` | 50-block reasoning segments |

### Artifact Lifecycle

- **Summary**: Displayed during extraction, not persisted
- **Reasoning file**: Temporary, cleaned up after analysis
- **Chunks**: Temporary, cleaned up after parallel analysis

---

## Troubleshooting

### Preprocessing runs but no learnings found

The transcript may be procedural without learning-worthy reasoning. Try:
- Check the reasoning file manually
- Run `find-learning-lines.sh` to see if indicators exist

### Parallel processing is slow

Large transcripts still take time. Consider:
- Running `--preprocess-only` first to inspect artifacts
- Using `--focus <area>` to narrow extraction scope

### Missing jq error

The preprocessing scripts require `jq`. Install it:

```bash
# macOS
brew install jq

# Ubuntu/Debian
apt-get install jq
```

---

## Related Guides

- [Extract from Session](./extract-from-session.md) - Standard extraction workflow
- [Review and Apply](./review-and-apply.md) - Review extracted learnings
- [Getting Started](../getting-started.md) - m42-signs overview
