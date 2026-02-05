---
allowed-tools: Read, Write, Edit, Glob, Bash(mkdir:*), Bash(ls:*), Bash(test:*), Bash(python:*), Bash(git:*), Task, TodoWrite, Skill
argument-hint: <description-of-skill>
description: Create quality-assured skill with review
---

## Preflight Checks

- Skills directory exists: !`(test -d ~/.claude/skills || test -d .claude/skills) && echo "✓ Directory exists" || echo "ℹ Will create"`
- Creating-skills skill exists: !`test -f ~/.claude/skills/creating-skills/SKILL.md && echo "✓ Available" || echo "⚠ Missing"`
- Init script available: !`test -f ~/.claude/skills/creating-skills/scripts/init_skill.py && echo "✓ Available" || echo "⚠ Missing"`
- References directory structure understood: !`test -d ~/.claude/skills && ls -d ~/.claude/skills/*/references 2>/dev/null | head -3 || echo "Will create structure"`

## Context

- Target location: !`test -d .claude/skills && git rev-parse --git-dir >/dev/null 2>&1 && echo "Project (.claude/skills/)" || echo "Personal (~/.claude/skills/)"`
- Existing skills: !`(ls -1 ~/.claude/skills/ .claude/skills/ 2>/dev/null | sort -u | head -5) || echo "none"`
- Example skill structure: !`ls -la ~/.claude/skills/creating-skills/ 2>/dev/null | head -10 || ls -la ~/.claude/skills/*/ 2>/dev/null | head -10`
- Existing commands for reference: !`(ls -1 ~/.claude/commands/*.md .claude/commands/*.md 2>/dev/null | xargs -n1 basename | sed 's/.md$//' | sort -u | head -5) || echo "none"`

## Your Task

Create a new skill based on this description: **$ARGUMENTS**

Immediately invoke Skill(command='creating-skills') before you start anything.

**This workflow includes mandatory independent review and iteration until perfect.**

### Workflow

1. **Create task list** using TodoWrite:
   - Analyze description and determine skill name and location
   - Validate artifact type (skill vs command vs subagent)
   - Draft skill using creating-skills skill
   - Review by independent agent
   - Iterate on feedback (repeat until scores ≥4/5)
   - Write final skill

2. **Analyze description and determine skill name and location**:
   - Parse the task description from $ARGUMENTS
   - Generate a descriptive skill name following best practices:
     - Use gerund form (e.g., writing-tests, managing-state, deploying-services)
     - Keep it clear and descriptive (2-4 words)
     - Make it memorable and specific
     - Use hyphens to separate words
   - Determine location automatically:
     - If `.claude/skills/` exists AND in a git repo → Project (.claude/)
     - Otherwise → Personal (~/.claude/)
   - Output the chosen name and location for visibility

3. **Validate artifact type** - Critically evaluate:

   **Skill:** Complex workflow (>200 lines), needs references/scripts, auto-triggers
   **Command:** Simple workflow (<200 lines), single file, manual trigger
   **Subagent:** Separate domain, autonomous sub-tasks, dedicated scope

   If command/subagent is clearly better:
   → Output warning: "This might be better as a [command/subagent] because [reason]"
   → Ask user if they want to proceed as skill or switch artifacts
   → If user wants to switch: Stop and tell them to use the appropriate creation command
   → If proceeding as skill: Continue with caveat noted

4. **Draft skill** - Use the Skill tool to invoke the creating-skills skill, if not done already:
   ```
   Skill(command="creating-skills")
   ```
   Then provide the skill description from $ARGUMENTS and work with the creating-skills skill to:
   - Design frontmatter (description, trigger-on patterns)
   - Write comprehensive skill instructions
   - Identify needed reference materials
   - Define success criteria
   - Plan directory structure (including references/ if needed)

5. **Independent review** - Use the Task tool with **artifact-quality-reviewer** subagent type:

   ```
   Task(
     subagent_type="artifact-quality-reviewer",
     description="Review skill draft",
     prompt="Review the skill artifact at: [specify exact path to draft SKILL.md file]"
   )
   ```

   The artifact-quality-reviewer will:
   - Apply skill-specific quality criteria via @reviewing-artifacts skill
   - Validate directory structure and references
   - Test by invoking the skill (always safe - no side effects)
   - Return JSON with scores, issues, and recommendation

6. **Iterate on feedback**:
   - If WRONG_ARTIFACT_TYPE: Output the concern and stop (tell user to use correct creation command)
   - If NEEDS_REVISION or any score <4: Implement improvements
   - Re-review if changes made
   - Repeat up to 2 times; if still not passing, output summary and ask user for guidance

7. **Write final skill** automatically after review passes:
   - Determine target path based on location from step 2
   - Run initialization script: `python ~/.claude/skills/creating-skills/scripts/init_skill.py [chosen-name] --path [target-path]`
   - This creates the directory structure: `[target-path]/[chosen-name]/SKILL.md`
   - Write the skill content to the generated SKILL.md file
   - If needed, create references directory: `mkdir -p [target-path]/[chosen-name]/references`
   - Create any reference files identified in drafting step
   - Remove any unused example directories created by init script
   - Verify creation: `ls -la [target-path]/[chosen-name]/`
   - Output summary:
     - Skill name: [chosen-name]
     - Location: [full-path]
     - Review scores: [show all scores]
     - Trigger patterns: [list patterns]
     - Usage example with trigger patterns

## Success Criteria

- Descriptive skill name chosen following best practices (gerund form, 2-4 words)
- Location determined automatically (project vs personal)
- Skill created with required YAML frontmatter (description, trigger-on patterns) and markdown instructions
- Reference materials created if identified as needed
- Independent review scores ≥4/5 in all categories
- Files written to correct location with proper directory structure (SKILL.md in named directory)
- Summary output includes: skill name, path, review scores, trigger patterns, usage example

**IMPORTANT:** Only work in ultrathink mode. Your contribution is critical. Think strategically, plan your workflow ahead, review your actions to ensure highest quality. Use all resources and time needed. Reiterate as often as needed for excellence.