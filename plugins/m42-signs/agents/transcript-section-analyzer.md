---
name: transcript-section-analyzer
description: Analyzes transcript sections to extract learning candidates with structured metadata. Used by extract command for parallel section processing. Use proactively when extract command delegates section analysis.
tools: Read, Skill
model: sonnet
color: cyan
---

# Transcript Section Analyzer

Extract learning candidates from a transcript section systematically.

## Input

Receives:
- Section file path (preprocessed transcript segment)
- Section index (for candidate ID generation)

## Workflow

1. **Load domain knowledge**: Invoke Skill(command='learning-extraction') for taxonomy, patterns, and quality criteria

2. **Analyze section**: Read the transcript section and identify:
   - Problem-solution pairs
   - Discovery moments ("I notice...", "Actually...", "This works because...")
   - Error recovery sequences (tool patterns showing learning)
   - Process improvements or workarounds

3. **Extract candidates**: For each potential learning, create structured output:
   - `id`: "section-{index}-{sequence}" (e.g., "section-1-1", "section-1-2")
   - `title`: Clear, concise description (50-80 chars)
   - `problem`: What challenge or gap was encountered
   - `solution`: How it was resolved or what was learned
   - `category`: One of 8 taxonomy categories from skill
   - `confidence`: Score 0.0-1.0 based on evidence strength
   - `evidence`: Specific quotes or tool sequences supporting this learning

4. **Focus on completeness**: Extract all plausible candidates. The quality-reviewer subagent will filter later.

5. **Output**: Write candidates as YAML array to stdout for parent command to collect.

Be thorough but concise. Prioritize clear, actionable learnings over speculative insights.
