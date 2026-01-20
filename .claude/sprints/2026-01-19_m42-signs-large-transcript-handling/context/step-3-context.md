# Step Context: step-3

## Task
Create documentation for large transcript handling.

Create: plugins/m42-signs/docs/how-to/handle-large-transcripts.md

Document:
- Automatic preprocessing activation
- Manual preprocessing workflow
- When to use --parallel flag
- Size thresholds table
- Artifacts generated

Follow AI-ready documentation principles (frontmatter, keywords, structure).

## Implementation Plan
Based on gherkin scenarios, implement in this order:
1. Create file with proper YAML frontmatter (title, description, keywords)
2. Add Quick Start section with essential commands
3. Document automatic preprocessing activation with thresholds
4. Create size thresholds table (lines, file size)
5. Document manual preprocessing workflow (--preprocess-only flag)
6. Explain parallel processing (--parallel flag) and chunk-analyzer
7. List artifacts generated during preprocessing
8. Add Related Guides section linking to other docs

## Related Code Patterns

### Pattern from: plugins/m42-signs/docs/how-to/extract-from-session.md
```markdown
# How to Extract Signs from a Session

Automatically extract learnings from Claude session transcripts.

---

## Quick Start

```bash
# Find your session ID
ls ~/.claude/projects/$(pwd | sed 's/\//-/g')/

# Extract from that session
/m42-signs:extract <session-id>
```

---

## Section Content...

---

## Related Guides

- [Add Signs Manually](./add-sign-manually.md) - Manual sign creation
- [Review and Apply](./review-and-apply.md) - Review workflow
```

Key pattern observations:
- H1 heading matching file topic
- Brief intro paragraph
- `---` separators between sections
- Quick Start section early
- Code blocks with comments
- Tables for structured data
- Related Guides at end linking to sibling docs

### Pattern from: plugins/m42-signs/commands/extract.md
```markdown
## Large Transcript Handling

When transcript exceeds 100 lines or 500KB, activate preprocessing mode:

### Step 1: Generate Summary
!`plugins/m42-signs/scripts/transcript-summary.sh "$TRANSCRIPT_PATH"`

### Step 2: Find High-Value Patterns
!`plugins/m42-signs/scripts/find-learning-lines.sh "$TRANSCRIPT_PATH"`

### Step 3: Extract Reasoning Blocks
!`plugins/m42-signs/scripts/extract-reasoning.sh "$TRANSCRIPT_PATH" > /tmp/reasoning-$$.jsonl`

### Step 4: Analyze Reasoning File
If reasoning file has < 100 blocks, analyze directly.
If 100+ blocks, split into chunks with --parallel.

### Step 5: Aggregate and Deduplicate Results
```

This is the authoritative source for documentation content.

## Required Imports
Not applicable - documentation file (no code imports).

## Types/Interfaces to Use
Not applicable - documentation file.

## Integration Points
- Referenced by: extract.md command (links to this doc for details)
- Cross-links to: extract-from-session.md, review-and-apply.md, getting-started.md
- Links from: README.md (will need update after creation)

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-signs/docs/how-to/handle-large-transcripts.md` | Create | Main documentation for large transcript handling |

## Documentation Requirements from Gherkin

| Scenario | Requirement | Verification |
|----------|-------------|--------------|
| 1 | File exists at path | `test -f` |
| 2 | YAML frontmatter with title, description, keywords | `head + grep` |
| 3 | Automatic activation, 100 lines, 500KB thresholds | `grep` patterns |
| 4 | --preprocess-only, transcript-summary, extract-reasoning | `grep` script names |
| 5 | --parallel flag, chunk analysis | `grep` patterns |
| 6 | Markdown table with threshold info | `grep` table pattern |
| 7 | Artifacts: reasoning output, summary | `grep` artifact mentions |
| 8 | 4+ H2 sections, Quick Start, Related section | `grep` structure |

## Content Sources

### Scripts to Reference
- `transcript-summary.sh`: Generates JSON stats (line count, errors, tool sequence)
- `extract-reasoning.sh`: Extracts assistant text blocks to JSONL
- `find-learning-lines.sh`: Pattern-matches for learning indicators

### Subagent to Reference
- `chunk-analyzer.md`: Parallel chunk processing agent

### Thresholds from extract.md
- Large transcript: >100 lines OR >500KB
- Chunk size: 50 blocks per chunk

## Documentation Structure Plan

```
---
title: Handling Large Transcripts
description: Preprocessing and parallel analysis for transcripts exceeding token limits
keywords: [large-transcript, preprocessing, parallel, chunking, transcript-summary]
---

# Handling Large Transcripts

Brief intro about when and why preprocessing is needed.

---

## Quick Start

Fastest path for common scenarios.

---

## When Preprocessing Activates

Explains automatic detection.

---

## Size Thresholds

Table with thresholds and modes.

---

## Manual Preprocessing

--preprocess-only workflow with script details.

---

## Parallel Processing

--parallel flag and chunk-analyzer.

---

## Artifacts Generated

List of files created during preprocessing.

---

## Related Guides

Cross-links to sibling documentation.
```
