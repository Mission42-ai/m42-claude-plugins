---
allowed-tools: Read, Write, Edit, Glob, Bash(test:*), Bash(chmod:*), Bash(ls:*), Bash(cat:*), Bash(python3:*), Task, TodoWrite, Skill
argument-hint: <description-of-hook>
description: Create quality-assured hook with review
---

## Preflight Checks

- Hooks directory exists: !`(test -d ~/.claude/hooks || test -d .claude/hooks) && echo "✓ Directory exists" || echo "ℹ Will create"`
- Creating-hooks skill exists: !`test -f ~/.claude/skills/creating-hooks/SKILL.md && echo "✓ Available" || echo "⚠ Missing"`
- Settings file exists: !`(test -f ~/.claude/settings.json || test -f .claude/settings.json) && echo "✓ Settings found" || echo "ℹ Will create"`
- Python3 available: !`which python3 || echo "not found"`

## Context

- Target location: !`test -d .claude/hooks && git rev-parse --git-dir >/dev/null 2>&1 && echo "Project (.claude/hooks/)" || echo "Personal (~/.claude/hooks/)"`
- Existing hooks: !`(ls -1 ~/.claude/hooks/*.py .claude/hooks/*.py 2>/dev/null | xargs -n1 basename | head -5) || echo "none"`
- Settings path: !`test -f .claude/settings.json && git rev-parse --git-dir >/dev/null 2>&1 && echo ".claude/settings.json" || echo "~/.claude/settings.json"`

## Your Task

Create a new hook based on this description: **$ARGUMENTS**

**This workflow includes mandatory independent review and iteration until perfect.**

### Workflow

1. **Create task list** using TodoWrite:
   - Analyze description and determine hook type and location
   - Draft hook using creating-hooks skill
   - Review by independent agent
   - Iterate on feedback (repeat until scores ≥4/5)
   - Write final hook script and configuration

2. **Analyze description and determine hook type and location**:
   - Parse the task description from $ARGUMENTS
   - Determine the appropriate hook event type (PreToolUse, PostToolUse, UserPromptSubmit, Stop, etc.)
   - Generate a descriptive hook script name following best practices:
     - Use descriptive names (e.g., validate_bash.py, format_files.py, inject_context.py)
     - Include the event type or purpose in the name
     - Use .py extension for Python scripts
   - Determine location automatically:
     - If `.claude/hooks/` exists AND in a git repo → Project (.claude/)
     - Otherwise → Personal (~/.claude/)
   - Output the chosen name, event type, and location for visibility

3. **Draft hook** - Use the **creating-hooks** skill to:
   - Design the hook event type and matcher pattern
   - Write the hook script with proper JSON input/output handling
   - Configure settings.json entry
   - Ensure proper exit codes and error handling

4. **Independent review** - Use the Task tool with **artifact-quality-reviewer** subagent type:

   ```
   Task(
     subagent_type="artifact-quality-reviewer",
     description="Review hook draft",
     prompt="Review the hook artifact at: [specify exact path to draft script file]"
   )
   ```

   The artifact-quality-reviewer will:
   - Apply hook-specific quality criteria via @reviewing-artifacts skill
   - Validate script implementation and settings configuration
   - Test structure and safety (functionality only if no side effects)
   - Return JSON with scores, issues, and recommendation

5. **Iterate on feedback**:
   - If NEEDS_REVISION or any score <4: Implement improvements
   - Re-review if changes made
   - Repeat up to 2 times; if still not passing:
     - Output detailed summary of remaining issues
     - Ask user whether to: (a) proceed with current version, (b) make manual adjustments, or (c) abandon hook creation

6. **Write final hook** automatically after review passes:
   - Determine target paths based on location from step 2
   - Personal:
     - Script: ~/.claude/hooks/[chosen-name].py
     - Settings: ~/.claude/settings.json
   - Project:
     - Script: .claude/hooks/[chosen-name].py
     - Settings: .claude/settings.json
   - Create directories if needed: `mkdir -p [hooks-dir]`
   - Write hook script file
   - Make script executable: `chmod +x [script-path]`
   - Use the creating-hooks skill helper scripts to add hook to settings:
     - Detect script location based on skill installation (personal vs project)
     - Validate configuration with validate_hook.py
     - Add to settings.json using add_hook_to_settings.py
   - Verify creation: `ls -lh [script-path]`
   - Test the hook with sample input
   - Output summary:
     - Hook name: [chosen-name]
     - Event type: [event-name]
     - Location: [full-path]
     - Settings: [settings-path]
     - Review scores: [show all scores]
     - Testing instructions

## Success Criteria

- Descriptive hook script name chosen following best practices
- Location determined automatically (project vs personal)
- Hook script created with proper JSON handling and exit codes
- Settings configuration added to appropriate settings.json
- Script is executable (chmod +x)
- Independent review scores ≥4/5 in all categories
- Files written to correct location and immediately functional
- Hook tested with sample input
- Summary output includes: hook name, event type, paths, review scores, testing instructions

**IMPORTANT:** Only work in ultrathink mode. Your contribution is critical. Think strategically, plan your workflow ahead, review your actions to ensure highest quality. Use all resources and time needed. Reiterate as often as needed for excellence.
