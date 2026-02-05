---
allowed-tools: Read, Write, Edit, Glob, Bash(test:*), Bash(git:*), Task, TodoWrite, Skill
argument-hint: <description-of-task>
description: Create quality-assured command with review
---

## Preflight Checks

- Commands directory exists: !`(test -d ~/.claude/commands || test -d .claude/commands) && echo "✓ Directory exists" || echo "ℹ Will create"`
- Creating-commands skill exists: !`test -f ~/.claude/skills/creating-commands/SKILL.md && echo "✓ Available" || echo "⚠ Missing"`

## Context

- Target location: !`test -d .claude/commands && git rev-parse --git-dir >/dev/null 2>&1 && echo "Project (.claude/commands/)" || echo "Personal (~/.claude/commands/)"`
- Existing commands: !`(ls -1 ~/.claude/commands/*.md .claude/commands/*.md 2>/dev/null | xargs -n1 basename | sed 's/.md$//' | sort -u | head -5) || echo "none"`

## Your Task

Create a new slash command based on this description: **$ARGUMENTS**

**This workflow includes mandatory independent review and iteration until perfect.**

### Workflow

1. **Create task list** using TodoWrite:
   - Analyze description and determine command name and location
   - Validate artifact type (command vs skill vs subagent)
   - Draft command using creating-commands skill
   - Review by independent agent
   - Iterate on feedback (repeat until scores ≥4/5)
   - Write final command

2. **Analyze description and determine command name and location**:
   - Parse the task description from $ARGUMENTS
   - Generate an action-oriented command name following best practices:
     - Use action verbs (e.g., commit, review, test, deploy, scaffold)
     - Keep it short (1-2 words maximum)
     - Make it memorable and descriptive
     - Follow existing command naming patterns
   - Determine location automatically:
     - If `.claude/commands/` exists AND in a git repo → Project (.claude/)
     - Otherwise → Personal (~/.claude/)
   - Output the chosen name and location for visibility

3. **Validate artifact type** - Critically evaluate:

   **Command:** Simple workflow (<200 lines), single file, manual trigger
   **Skill:** Complex (>200 lines), needs references/scripts, auto-triggers
   **Subagent:** Separate domain, autonomous sub-tasks, dedicated scope

   If skill/subagent is clearly better:
   → Output warning: "This might be better as a [skill/subagent] because [reason]"
   → Ask user if they want to proceed as command or switch artifacts
   → If user wants to switch: Stop and tell them to use the appropriate creation command
   → If proceeding as command: Continue with caveat noted

4. **Draft command** - Use the Skill tool to invoke the creating-commands skill:
   ```
   Skill(command="creating-commands")
   ```
   Then work with the creating-commands skill to:
   - Design frontmatter (allowed-tools, argument-hint, description)
   - Add comprehensive preflight checks
   - Add rich context gathering
   - Write explicit task instructions with skill/subagent references
   - Define clear success criteria

5. **Independent review** - Use the Task tool with **artifact-quality-reviewer** subagent type:

   ```
   Task(
     subagent_type="artifact-quality-reviewer",
     description="Review command draft",
     prompt="Review the command artifact at: [specify exact path to draft file]"
   )
   ```

   The artifact-quality-reviewer will:
   - Apply command-specific quality criteria via @reviewing-artifacts skill
   - Evaluate using crafting-agentic-prompts principles
   - Test structure (functionality only if safe - no side effects)
   - Return JSON with scores, issues, and recommendation

6. **Iterate on feedback**:
   - If WRONG_ARTIFACT_TYPE: Output the concern and stop (tell user to use correct creation command)
   - If NEEDS_REVISION or any score <4: Implement improvements
   - Re-review if changes made
   - Repeat up to 2 times; if still not passing, output summary and ask user for guidance

7. **Write final command** automatically after review passes:
   - Determine target path based on location from step 2
   - Personal: ~/.claude/commands/[chosen-name].md
   - Project: .claude/commands/[chosen-name].md
   - Create directory if needed
   - Write command file
   - Verify creation: `ls -lh [path]`
   - Output summary:
     - Command name: /[chosen-name]
     - Location: [full-path]
     - Review scores: [show all scores]
     - Usage example with the new command name

## Success Criteria

- Action-oriented command name chosen following best practices
- Location determined automatically (project vs personal)
- Command created with all required sections (frontmatter, preflight, context, task, success)
- Independent review scores ≥4/5 in all categories
- File written to correct location and immediately usable
- Summary output includes: command name, path, review scores, usage example

IMPORTANT: Every command should explicitly invoke the ultrathink modus. Append something like this to every single command you write:
`**IMPORTANT:** Only work in ultrathink mode. Your contribution is critical. Think strategically, plan your workflow ahead, review your actions to ensure highest quality. Use all resources and time needed. Reiterate as often as needed for excellence.`

