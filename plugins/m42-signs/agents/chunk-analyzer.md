---
name: chunk-analyzer
description: Analyze preprocessed transcript chunk for learning extraction. Use when extract command processes large transcripts in parallel.
tools: Read, Bash
model: sonnet
color: cyan
---

> **DEPRECATED**: This subagent is deprecated. Use `transcript-section-analyzer` instead,
> which provides improved taxonomy-based extraction with Skill integration.

# Chunk Analyzer

Analyze a preprocessed reasoning chunk and extract learnings.

## Input

Path to chunk file (JSONL with `{text: ...}` objects) and optional focus area.

## Process

1. Read the chunk file using Read tool
2. For each text block, identify learning-worthy content:
   - Architectural insights
   - Pitfalls discovered
   - Effective strategies
   - File relationships
   - Domain knowledge
3. Extract learnings with: id, title, problem, solution, target CLAUDE.md, confidence

## Output

YAML array matching backlog schema:

```yaml
learnings:
  - id: kebab-case-id
    status: pending
    title: Short description (5-10 words)
    problem: |
      What went wrong or was discovered
    solution: |
      How to fix or apply the insight
    target: path/to/CLAUDE.md
    confidence: low | medium | high
```

Prioritize high-confidence, reusable learnings. Skip generic programming knowledge.
