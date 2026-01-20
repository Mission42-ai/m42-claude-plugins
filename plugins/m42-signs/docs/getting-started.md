# Getting Started

Add your first sign in under 5 minutes.

---

## Prerequisites

Before starting, ensure you have:

1. **Claude Code** installed and running
2. **m42-signs plugin** enabled

```bash
# Verify Claude Code is running
claude --version

# Enable the plugin (if not already)
claude plugins add m42-signs
```

**Optional tools** (for automated extraction):
```bash
# Check jq (required for transcript parsing and large transcript preprocessing)
jq --version
# Install: brew install jq (macOS) or apt-get install jq (Ubuntu/Debian)

# Check yq (required for YAML processing)
yq --version
```

---

## Step 1: Add Your First Sign

Signs capture learnings from your development sessions. Add one manually:

```bash
/m42-signs:add
```

**What happens:**
- You'll be prompted for the sign details:
  - **Title**: Short description (e.g., "Always use absolute paths with Read tool")
  - **Problem**: What went wrong
  - **Solution**: How to avoid it
  - **Target**: Which CLAUDE.md file should receive this sign

**Example input:**
```
Title: Use absolute paths with Read tool
Problem: Read tool fails silently with relative paths
Solution: Always convert to absolute paths before calling Read
Target: ./CLAUDE.md
```

**Expected output:**
```
Sign added to backlog!

ID: use-absolute-paths-with-read-tool
Status: pending
Target: ./CLAUDE.md

Next: Run /m42-signs:review to approve, then /m42-signs:apply to write to CLAUDE.md
```

---

## Step 2: List Your Signs

See all signs in the backlog:

```bash
/m42-signs:list
```

**Expected output:**
```
Signs Backlog
=============

| ID | Status | Title | Target |
|----|--------|-------|--------|
| use-absolute-paths-with-read-tool | pending | Use absolute paths with Read tool | ./CLAUDE.md |

Total: 1 signs (1 pending, 0 approved, 0 applied)
```

---

## Step 3: Check Status

Get a summary of your backlog:

```bash
/m42-signs:status
```

**Expected output:**
```
Backlog Status
==============

Total signs: 1
- Pending: 1
- Approved: 0
- Applied: 0
- Rejected: 0

Backlog file: .claude/learnings/backlog.yaml
```

---

## Step 4: Review and Apply

When ready to apply a sign:

```bash
# Review pending signs
/m42-signs:review

# Apply approved signs to CLAUDE.md files
/m42-signs:apply
```

**What happens:**
- Review lets you approve, reject, or edit each pending sign
- Apply writes approved signs to their target CLAUDE.md files
- Signs appear under a `## Signs (Accumulated Learnings)` section

---

## What Just Happened?

1. **You captured a learning**: A sign describing a problem and solution
2. **It went to the backlog**: A staging area for human review
3. **You can review and apply**: When approved, it becomes permanent guidance

This is the **Learning Loop** - failures become wisdom that prevents future mistakes.

---

## Next Steps

| Want to... | Read |
|------------|------|
| Add signs faster | [Add Sign Manually](how-to/add-sign-manually.md) |
| Extract from sessions | [Extract from Session](how-to/extract-from-session.md) |
| Handle large transcripts | [Handle Large Transcripts](how-to/handle-large-transcripts.md) |
| Set up automated extraction | [Integrate with Sprint](how-to/integrate-with-sprint.md) |
| See all commands | [Commands Reference](reference/commands.md) |

---

## Quick Reference

```bash
# Manual sign management
/m42-signs:add          # Add a sign interactively
/m42-signs:list         # List all signs
/m42-signs:status       # Show backlog summary

# Extract from sessions
/m42-signs:extract <session-id>   # Extract from transcript
/m42-signs:extract <file> --parallel  # Large transcripts with parallel processing

# Review and apply
/m42-signs:review       # Review pending signs
/m42-signs:apply        # Apply approved to CLAUDE.md

# Help
/m42-signs:help         # Show all commands
```

---

[Back to README](../README.md)
