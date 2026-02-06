---
allowed-tools: Bash(ls:*), Bash(find:*), Read, Glob, Grep, Task, Skill
argument-hint: (none)
description: Audit and optimize CLAUDE.md files across repository
---

## Preflight Checks

- crafting-claudemd skill exists: !`test -f "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/SKILL.md" && echo "✓ Skill found" || echo "✗ Skill missing"`
- claudemd-writer subagent exists: !`test -f "${CLAUDE_PLUGIN_ROOT}/agents/claudemd-writer.md" && echo "✓ Subagent found" || echo "✗ Subagent missing"`
- scan_claudemd.sh script exists: !`test -f "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/scan_claudemd.sh" && echo "✓ Scan script found" || echo "✗ Scan script missing"`
- validate_claudemd.py script exists: !`test -f "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/validate_claudemd.py" && echo "✓ Validation script found" || echo "✗ Validation script missing"`

## Context

- Current repository root: !`git rev-parse --show-toplevel 2>/dev/null || pwd`
- Existing CLAUDE.md files: !`find . -type f -name "CLAUDE.md" 2>/dev/null | head -20`
- Repository structure summary: !`ls -la`

## Task Instructions

Perform a comprehensive CLAUDE.md audit and optimization across the entire repository. Follow this three-phase workflow with strategic discovery, parallel subagent delegation, and quality assurance.

**IMPORTANT:** Load domain knowledge first by invoking the crafting-claudemd skill:

```
Skill(skill='m42-meta-toolkit:crafting-claudemd')
```

### Phase 1: Strategic Discovery

Analyze the repository to identify folders that warrant CLAUDE.md files and assess current state:

1. **Map repository structure** using `Bash(ls:*)` to explore the directory tree:
   - Start from root directory
   - Identify top-level source directories
   - For monorepos: identify packages/, services/, apps/ folders
   - Note directories with distinct tech stacks or frameworks
   - Note infrastructure/deployment directories

2. **Apply strategic priority criteria** to determine which folders need CLAUDE.md:
   - ✅ **Always include:** Root directory
   - ✅ **High priority:** Top-level source dirs with distinct conventions, monorepo packages/services, infrastructure/deployment dirs
   - ✅ **Medium priority:** Directories with complex or non-obvious patterns
   - ❌ **Skip:** node_modules, dist, build, .git, vendor, cache, tmp, coverage, .next, .turbo

3. **Inspect .claude/ folder**:
   - Read existing files in `.claude/rules/` directory
   - Identify gaps or stale conditional rules
   - Note patterns that could benefit from new conditional rules

4. **Run baseline scan** to assess current CLAUDE.md state:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/scan_claudemd.sh"
   ```
   Parse the output to identify:
   - Existing CLAUDE.md files and their locations
   - Current line counts and token budget usage
   - Files that may need review or updates

5. **Produce prioritized plan** with three categories:
   - **Create new:** Folders needing new CLAUDE.md files (with justification)
   - **Review existing:** CLAUDE.md files that may need updates
   - **Update rules:** Suggested .claude/rules/ additions or modifications
   
   For each folder, explain why it warrants a CLAUDE.md file based on:
   - Distinct conventions or patterns
   - Technical complexity
   - Non-obvious structure
   - Strategic importance

   Typical good locations for dedicated CLAUDE.md files:
   - `/src`
   - `/lib`
   - `/app`
   - `/docs`
   - `/src`
   - `/scripts`
   - `/tests`
   
   **Conservative approach:** Only recommend CLAUDE.md creation when there's clear value. Better to skip than waste token budget.

### Phase 2: Parallel Subagent Delegation

For each folder in the prioritized plan, delegate to claudemd-writer subagents:

1. **Spawn subagents in parallel** for independent folders using the Task tool:

   ```
   Task(
     subagent_type='m42-meta-toolkit:claudemd-writer',
     description='Create/review CLAUDE.md for [folder]',
     prompt='Analyze the folder at [folder-path] and [create a new CLAUDE.md | review the existing CLAUDE.md].
     
     Context:
     - Repository root: [root-path]
     - Root CLAUDE.md exists: [yes/no]
     - Folder purpose: [brief description from discovery phase]
     - Justification: [why this folder needs CLAUDE.md]
     
     Load the crafting-claudemd skill for best practices.
     
     Either create/update the CLAUDE.md file or report "No updates needed" if the folder does not warrant one.'
   )
   ```

2. **For .claude/rules/ updates** (if recommended in discovery):
   - Spawn a dedicated subagent to review existing rules
   - Provide context about discovered patterns
   - Request suggestions for new conditional rules or updates to stale ones

3. **Execution notes:**
   - Launch independent folders in parallel (use single message with multiple Task calls)
   - Launch dependent folders sequentially (e.g., parent before child if context needed)
   - Each subagent must invoke `Skill(skill='m42-meta-toolkit:crafting-claudemd')` for domain knowledge
   - Valid outcomes: File created, file updated, or "no updates needed"

4. **Track subagent results:**
   - Record which folders were processed
   - Note which files were created vs updated vs unchanged
   - Collect any errors or blockers reported by subagents

### Phase 3: Quality Assurance

After all subagents complete, validate the results systematically:

1. **Run updated scan** to capture new state:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/scan_claudemd.sh"
   ```

2. **Validate every created/modified CLAUDE.md file**:
   For each file that was created or updated:
   ```bash
   python3 "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/validate_claudemd.py" [file-path]
   ```
   
3. **Check total instruction budget:**
   - Sum line counts from all startup-loaded CLAUDE.md files (root and .claude/rules/)
   - Verify total stays under 500 lines combined
   - Flag if approaching or exceeding budget

4. **Verify no anti-patterns introduced:**
   - Review validation script output for each file
   - Check for: vague instructions, implementation details, file paths, hard-coded values
   - Identify any files failing validation

5. **Handle validation failures:**
   - DO NOT auto-fix failures
   - Report issues clearly to user
   - Let user decide whether to fix or revert
   - Provide specific error messages from validation script

6. **Produce final report** with comprehensive summary:

   ```
   ## CLAUDE.md Optimization Report
   
   ### Files Created
   - [folder-path]/CLAUDE.md (X lines) - [Purpose]
   - ...
   
   ### Files Updated  
   - [folder-path]/CLAUDE.md (X lines → Y lines) - [Changes]
   - ...
   
   ### Files Unchanged
   - [folder-path]/CLAUDE.md - Subagent found no improvements needed
   - ...
   
   ### Validation Results
   - ✅ [file-path] - All checks passed
   - ❌ [file-path] - Failed: [specific issues]
   - ...
   
   ### Instruction Budget
   - Startup files total: X/500 lines
   - Status: [Under budget | Approaching limit | Over budget]
   
   ### Recommended Follow-up Actions
   - [Action 1 if needed]
   - [Action 2 if needed]
   - ...
   ```

7. **Success determination:**
   - ✅ All created/updated files pass validation
   - ✅ Instruction budget under 500 lines
   - ✅ No anti-patterns introduced
   - ⚠️ If any validation failures: Report but mark as "needs user review"

## Success Criteria

- Phase 1 discovery completed with prioritized plan showing folders to create/review/update
- Phase 2 subagents spawned (in parallel where possible) for all planned folders
- Phase 3 QA completed with validation results for all modified files
- Final report generated showing files created/updated/unchanged, validation status, and budget usage
- All validation failures reported to user (not auto-fixed)
- Total startup instruction budget verified under 500 lines

**IMPORTANT:** Only work in ultrathink mode. This contribution is critical. Think strategically, plan the workflow ahead, review actions to ensure highest quality. Use all resources and time needed. Reiterate as often as needed for excellence.
