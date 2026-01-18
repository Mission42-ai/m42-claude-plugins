# How to Integrate with Sprint Workflows

Set up automated learning extraction in your sprint workflow.

---

## Sprint Integration

Add a learning extraction phase to your sprint workflow:

```yaml
# In your workflow definition
phases:
  - name: development
    # ... your development phases

  - name: learn
    description: Extract learnings from sprint execution
    steps:
      - name: extract-learnings
        task: Extract learnings from sprint transcripts
        uses: m42-signs:extract
```

---

## Workflow Template

A complete workflow template is available at:

```
plugins/m42-signs/skills/managing-signs/assets/sprint-with-learning.yaml
```

---

## Manual Sprint Integration

After completing a sprint:

```bash
# Extract from sprint transcripts
/m42-signs:extract .claude/sprints/<sprint-name>/transcripts/

# Review findings
/m42-signs:review

# Apply approved signs
/m42-signs:apply --commit
```

---

[Back to Getting Started](../getting-started.md)
