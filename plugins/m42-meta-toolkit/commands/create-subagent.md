---
allowed-tools: Read, Write, Edit, Glob, Bash(test:*), Bash(ls:*), Bash(git:*), Task, TodoWrite, Skill
argument-hint: <description-of-subagent>
description: Create quality-reviewed subagent with iteration
---

## Preflight Checks

- Agents directory exists: !`(test -d ~/.claude/agents || test -d .claude/agents) && echo "✓ Directory exists" || echo "ℹ Will create"`
- Creating-subagents skill exists: !`test -f ~/.claude/skills/creating-subagents/SKILL.md && echo "✓ Available" || echo "⚠ Missing"`

## Context

- Target location: !`test -d .claude/agents && git rev-parse --git-dir >/dev/null 2>&1 && echo "Project (.claude/agents/)" || echo "Personal (~/.claude/agents/)"`
- Existing subagents: !`(ls -1 ~/.claude/agents/*.md .claude/agents/*.md 2>/dev/null | xargs -n1 basename | sed 's/.md$//' | sort -u | head -5) || echo "none"`
- Example subagent structure: !`(ls -1 ~/.claude/agents/*.md .claude/agents/*.md 2>/dev/null | head -1 | xargs cat | head -30) || echo "no examples available"`
- Available skills: !`(ls -1 ~/.claude/skills/ .claude/skills/ 2>/dev/null | sort -u | head -5) || echo "none"`

## Your Task

Create a new subagent based on this description: **$ARGUMENTS**

**This workflow includes mandatory independent review and iteration until perfect.**

### Workflow

1. **Create task list** using TodoWrite:
   - Analyze description and determine subagent name and location
   - Validate artifact type (subagent vs command vs skill)
   - Draft subagent using creating-subagents skill
   - Review by independent agent
   - Iterate on feedback (repeat until scores ≥4/5)
   - Write final subagent

2. **Analyze description and determine subagent name and location**:
   - Parse the task description from $ARGUMENTS
   - Generate a descriptive subagent name following best practices:
     - Use kebab-case (e.g., api-tester, code-reviewer, test-analyzer)
     - Keep it clear and descriptive (2-3 words)
     - Make it memorable and specific
     - Use nouns or noun-phrases
   - Determine location automatically:
     - If `.claude/agents/` exists AND in a git repo → Project (.claude/)
     - Otherwise → Personal (~/.claude/)
   - Output the chosen name and location for visibility

3. **Validate artifact type** - Critically evaluate:

   **Subagent:** Separate domain, autonomous sub-tasks, dedicated scope
   **Command:** Simple workflow (<200 lines), single file, manual trigger
   **Skill:** Complex workflow (>200 lines), needs references/scripts, auto-triggers

   If command/skill is clearly better:
   → Output warning: "This might be better as a [command/skill] because [reason]"
   → Ask user if they want to proceed as subagent or switch artifacts
   → If user wants to switch: Stop and tell them to use the appropriate creation command
   → If proceeding as subagent: Continue with caveat noted

4. **Draft subagent** - Invoke the creating-subagents skill explicitly:

   Skill(command="creating-subagents")

   Work with the creating-subagents skill to:
   - Define the subagent's purpose and when to invoke it
   - Validate if a skill should be created first (for complex knowledge)
   - Select minimal necessary tools
   - Choose appropriate color from the color coding system
   - Craft a concise prompt (50-200 words)
   - Reference relevant skills if needed

5. **Independent review** - Use the Task tool to launch artifact-quality-reviewer:

   Task(
     subagent_type="artifact-quality-reviewer",
     description="Review subagent draft at [path]",
     prompt="Review the subagent artifact at: [specify exact path to draft file]"
   )

   The artifact-quality-reviewer will:
   - Apply subagent-specific quality criteria via @reviewing-artifacts skill
   - Validate prompt conciseness and clarity
   - Test by attempting to understand invocation patterns
   - Return JSON with scores, issues, and recommendation

6. **Iterate on feedback**:
   - Parse the JSON response from artifact-quality-reviewer
   - Check the 'recommendation' field and 'scores' object
   - If recommendation is WRONG_ARTIFACT_TYPE: Stop and inform user to use correct creation command
   - If recommendation is NEEDS_REVISION or any score <4:
     - Review each issue in the 'issues' array
     - Implement the 'improvement' for each issue
     - Re-review by invoking artifact-quality-reviewer again (step 5)
   - Repeat up to 2 times; if still not passing, output summary and ask user for guidance

7. **Write final subagent** automatically after review passes:
   - Determine target path based on location from step 2
   - Personal: ~/.claude/agents/[chosen-name].md
   - Project: .claude/agents/[chosen-name].md
   - Create directory if needed
   - Write subagent file
   - Verify creation: `ls -lh [path]`
   - Output summary:
     - Subagent name: [chosen-name]
     - Location: [full-path]
     - Review scores: [show all scores]
     - Invocation pattern: When to use this subagent
     - Usage example

## Success Criteria

- Descriptive subagent name chosen following best practices (kebab-case, 2-3 words)
- Location determined automatically (project vs personal)
- Subagent created with required YAML frontmatter (name, description, tools, model, color) and concise prompt
- Prompt is under 200 words
- Independent review scores ≥4/5 in all categories
- File written to correct location and immediately usable
- Summary output includes: subagent name, path, review scores, invocation pattern, usage example

**IMPORTANT:** Only work in ultrathink mode. Your contribution is critical. Think strategically, plan your workflow ahead, review your actions to ensure highest quality. Use all resources and time needed. Reiterate as often as needed for excellence.
