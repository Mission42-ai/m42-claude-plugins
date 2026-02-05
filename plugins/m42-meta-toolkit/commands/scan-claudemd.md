---
allowed-tools: Bash(bash:*), Bash(python3:*), Bash(ls:*), Bash(find:*), Read, Grep, Glob, Skill
argument-hint: [project-path]
description: Scan CLAUDE.md configuration and report structure for a project
---

## Preflight Checks

- crafting-claudemd skill exists: !`test -f "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/SKILL.md" && echo "✓ Available" || echo "⚠ Missing"`
- Scan script exists: !`test -f "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/scan_claudemd.sh" && echo "✓ Available" || echo "⚠ Missing"`
- Validation script exists: !`test -f "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/validate_claudemd.py" && echo "✓ Available" || echo "⚠ Missing"`

## Context

- Current directory: !`pwd`
- Target project path: !`echo "${ARGUMENTS:-$(pwd)}"`
- Project has CLAUDE.md files: !`find "${ARGUMENTS:-.}" -name "CLAUDE.md" -o -name "CLAUDE.local.md" 2>/dev/null | head -5 || echo "None found"`
- Claude rules directory: !`test -d "${ARGUMENTS:-.}/.claude/rules" && echo "✓ Exists (.claude/rules/)" || echo "✗ Not present"`

## Task Instructions

Scan the target project's CLAUDE.md configuration and produce a comprehensive diagnostic report.

**This is a read-only diagnostic command. Do NOT modify any files.**

If `$ARGUMENTS` is provided, use it as the project root path to scan. Otherwise, default to the current working directory.

### Workflow

1. **Load domain knowledge**: Invoke `Skill(skill='crafting-claudemd')` to load CLAUDE.md domain knowledge and access bundled scripts.

2. **Discover CLAUDE.md files**: Run the scan script from the crafting-claudemd skill to discover all CLAUDE.md files in the project:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/scan_claudemd.sh" ${ARGUMENTS:-.}
   ```

   The script outputs:
   - All CLAUDE.md and CLAUDE.local.md files
   - All `.claude/rules/` entries
   - Line counts per file
   - Loading behavior annotations (startup vs lazy-loaded)

3. **Validate each CLAUDE.md file**: For each discovered CLAUDE.md file, run the validation script:
   ```bash
   python3 "${CLAUDE_PLUGIN_ROOT}/skills/crafting-claudemd/scripts/validate_claudemd.py" <path-to-file>
   ```

   The script checks:
   - File size (warnings if >300 lines)
   - Heading structure
   - Anti-patterns (vague instructions, negative-only constraints, emphasis overuse)
   - Content coverage

4. **Aggregate results**: Collect all scan and validation output into a unified report.

5. **Present unified report** with the following sections:

   **A. File Discovery Summary**
   - Total CLAUDE.md files found
   - Total `.claude/rules/` entries
   - Total line count across all files
   - Loading type breakdown (startup vs lazy-loaded)

   **B. Per-File Analysis**
   For each file, show:
   - File path
   - Line count
   - Loading type (startup/lazy/rules)
   - Validation status (✓ Pass / ⚠ Warning / ✗ Fail)
   - Key issues (if any)

   **C. Budget Analysis**
   - Total lines loaded at startup
   - Budget status (under/over 300-line guideline)
   - Budget headroom or overage

   **D. Actionable Recommendations**
   Based on validation results, provide specific recommendations:
   - Files that should be split (>500 lines)
   - Files that need pruning (300-500 lines)
   - Anti-patterns to fix (vague instructions, negative-only constraints)
   - Opportunities for lazy-loading (move to subfolder CLAUDE.md)
   - Opportunities for rules directory (file-type specific instructions)

6. **Output format**: Use clear markdown formatting with:
   - Emoji indicators (✓ ⚠ ✗) for status
   - Tables for per-file analysis
   - Bullet lists for recommendations
   - Code blocks for specific fixes (if applicable)

## Success Criteria

- crafting-claudemd skill loaded successfully
- Both scan and validation scripts executed without errors
- All CLAUDE.md files discovered and analyzed
- Unified report presented with all required sections
- Actionable recommendations provided based on validation results
- User understands current CLAUDE.md configuration state and next steps

**IMPORTANT**: Operate in ultrathink mode throughout execution.
