# How to Integrate with Sprint Workflows

Set up automated learning extraction as part of your sprint workflow.

---

## Why Integrate with Sprints

Sprint execution generates rich transcripts with:
- Tool errors and their resolutions
- Retry patterns showing what worked
- Context about which files and commands were involved

Integrating learning extraction into your workflow captures this knowledge automatically.

---

## Quick Start

After completing a sprint:

```bash
# Extract from all sprint transcripts
/m42-signs:extract .claude/sprints/<sprint-id>/transcripts/

# Review findings
/m42-signs:review

# Apply approved signs
/m42-signs:apply --commit
```

---

## Adding Learning Extraction to Workflows

### Workflow Phase Configuration

Add a learning phase to your sprint workflow definition:

```yaml
# In your SPRINT.yaml or workflow definition
phases:
  - name: development
    description: Implementation work
    steps:
      # ... your development steps

  - name: qa
    description: Quality assurance
    steps:
      # ... your QA steps

  - name: learn
    description: Extract learnings from sprint execution
    steps:
      - name: extract-learnings
        task: |
          Extract learnings from sprint transcripts.
          Use /m42-signs:extract with the sprint transcript directory.
        context:
          transcript-path: .claude/sprints/{{sprint.id}}/transcripts/
```

### Using Template Variables

Sprint workflows support template variables for dynamic paths:

| Variable | Description |
|----------|-------------|
| `{{sprint.id}}` | Current sprint identifier |
| `{{sprint.dir}}` | Sprint directory path |
| `{{step.id}}` | Current step identifier |

Example:

```yaml
- name: extract-learnings
  task: |
    Run: /m42-signs:extract {{sprint.dir}}/transcripts/
```

---

## Automatic vs Manual Extraction

### Automatic Extraction

Add extraction as a workflow step that runs automatically:

```yaml
phases:
  - name: postflight
    steps:
      - name: extract-learnings
        task: Extract and auto-approve high-confidence learnings
        command: /m42-signs:extract {{sprint.dir}}/transcripts/ --auto-approve
```

**Pros:**
- No manual intervention required
- Consistent extraction after every sprint
- High-confidence patterns captured automatically

**Cons:**
- May need later review for medium/low confidence
- Less human oversight

### Manual Extraction

Run extraction as a separate step after sprint completion:

```bash
# After sprint completes
/m42-signs:extract .claude/sprints/my-sprint/transcripts/
/m42-signs:review
/m42-signs:apply
```

**Pros:**
- Full control over what gets approved
- Can review in context of overall sprint
- Better for learning nuanced patterns

**Cons:**
- Requires explicit action
- May forget to run it

### Hybrid Approach (Recommended)

Combine automatic extraction with manual review:

```yaml
phases:
  - name: postflight
    steps:
      - name: extract-learnings
        task: |
          Extract learnings from sprint:
          /m42-signs:extract {{sprint.dir}}/transcripts/ --auto-approve

          Manual follow-up recommended:
          /m42-signs:review
          /m42-signs:apply --commit
```

This auto-approves high-confidence patterns but leaves medium/low for manual review.

---

## End-of-Sprint Analysis Patterns

### Pattern 1: Single Sprint Extraction

After completing a single sprint:

```bash
# 1. Navigate to sprint
SPRINT_ID="2024-01-15_feature-auth"

# 2. Extract learnings
/m42-signs:extract .claude/sprints/$SPRINT_ID/transcripts/

# 3. Quick review (approve high, reject low)
/m42-signs:review --approve-all-high --reject-all-low

# 4. Manual review of medium confidence
/m42-signs:review

# 5. Apply with commit
/m42-signs:apply --commit
```

### Pattern 2: Multi-Sprint Batch

After completing several sprints:

```bash
# Extract from multiple sprints
for sprint in .claude/sprints/2024-01-*/; do
  /m42-signs:extract "$sprint/transcripts/"
done

# Review all accumulated learnings
/m42-signs:review

# Apply in batch
/m42-signs:apply --commit
```

### Pattern 3: Retrospective Integration

Combine with sprint retrospective:

```yaml
# Retrospective workflow
phases:
  - name: retrospective
    steps:
      - name: extract-learnings
        task: Extract and review learnings from sprint

      - name: document-insights
        task: |
          Document key learnings in retrospective:
          - What patterns emerged?
          - Which signs are most valuable?
          - Are there recurring issues?

      - name: apply-signs
        task: Apply approved signs with descriptive commit
```

---

## Workflow Template

A complete workflow template is available at:

```
plugins/m42-signs/skills/managing-signs/assets/sprint-with-learning.yaml
```

This template includes:
- Development phases
- QA phases
- Learning extraction phase
- Retrospective integration

To use it:

```bash
# Copy template to your sprint
cp plugins/m42-signs/skills/managing-signs/assets/sprint-with-learning.yaml \
   .claude/sprints/my-sprint/SPRINT.yaml
```

---

## Transcript Location Reference

### Sprint Transcripts

Located in `.claude/sprints/<sprint-id>/transcripts/`:

```
.claude/sprints/my-sprint/
├── SPRINT.yaml
├── PROGRESS.yaml
└── transcripts/
    ├── development-step-1-plan.jsonl
    ├── development-step-1-execute.jsonl
    ├── development-step-1-verify.jsonl
    └── ...
```

### Session Transcripts

Located in `~/.claude/projects/<encoded-path>/`:

```bash
# Find encoded path
echo $(pwd | sed 's|/|-|g')

# List transcripts
ls ~/.claude/projects/$(pwd | sed 's|/|-|g')/*.jsonl
```

---

## Related Guides

- [Extract from Session](./extract-from-session.md) - Basic extraction
- [Review and Apply](./review-and-apply.md) - Review workflow
- [Getting Started](../getting-started.md) - Overview
