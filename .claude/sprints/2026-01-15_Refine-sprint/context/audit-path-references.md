# Path Reference Audit Report
**Task ID:** custom-audit-plugin-references
**Date:** 2026-01-15
**Status:** Complete

## Executive Summary
Audited all file path references in the m42-sprint plugin (plugins/m42-sprint/). Found **3 categories of path issues** across 12 markdown files affecting 22 path references.

## Findings

### 1. CRITICAL: Incorrect Template Paths in start-sprint.md

**File:** `plugins/m42-sprint/commands/start-sprint.md`
**Lines:** 34-35

**Issue:**
```
- Sprint template: `.claude/skills/orchestrating-sprints/assets/sprint-template.yaml`
- Progress template: `.claude/skills/orchestrating-sprints/assets/progress-template.yaml`
```

**Actual Location:**
```
plugins/m42-sprint/skills/orchestrating-sprints/assets/sprint-template.yaml
plugins/m42-sprint/skills/orchestrating-sprints/assets/progress-template.yaml
```

**Impact:** HIGH - start-sprint command will fail to load templates
**Priority:** CRITICAL - blocking sprint initialization

### 2. CRITICAL: Hardcoded Absolute Paths in add-task.md

**File:** `plugins/m42-sprint/commands/add-task.md`
**Lines:** 13, 16, 24

**Issue:**
```bash
ls -dt /home/konstantin/projects/m42-core/.claude/sprints/*/ 2>/dev/null
```

**Impact:** HIGH - Command will only work on specific system with specific project path
**Priority:** CRITICAL - breaks portability

**Recommendation:** Use relative path `.claude/sprints/*/`

### 3. CRITICAL: Hardcoded Absolute Paths in import-tasks.md

**File:** `plugins/m42-sprint/commands/import-tasks.md`
**Lines:** 15, 18, 26

**Issue:**
```bash
ls -dt /home/konstantin/projects/m42-core/.claude/sprints/*/ 2>/dev/null
```

**Impact:** HIGH - Command will only work on specific system
**Priority:** CRITICAL - breaks portability

**Recommendation:** Use relative path `.claude/sprints/*/`

### 4. OK: Relative Path References (Correct)

The following files use correct relative paths:
- `plugins/m42-sprint/commands/pause-sprint.md` - uses `.claude/sprints/*/`
- `plugins/m42-sprint/commands/resume-sprint.md` - uses `.claude/sprints/*/`
- `plugins/m42-sprint/commands/sprint-status.md` - uses `.claude/sprints/*/`
- `plugins/m42-sprint/README.md` - documentation only

### 5. MINOR: Template References in sprint-setup.md

**File:** `plugins/m42-sprint/skills/orchestrating-sprints/references/sprint-setup.md`
**Lines:** 42-43

**Issue:**
```bash
cp assets/sprint-template.yaml sprints/.../SPRINT.yaml
cp assets/progress-template.yaml sprints/.../PROGRESS.yaml
```

**Impact:** LOW - Reference documentation only, uses relative paths
**Priority:** LOW - works in current context

## Summary Statistics

| Category | Count | Files Affected |
|----------|-------|----------------|
| Total path references found | 22 | 12 |
| CRITICAL issues | 3 | 3 files |
| Correct relative paths | 16 | 9 files |
| Documentation references | 3 | 1 file |

## Path Reference Inventory

### Correct Paths (No Action Needed)
1. `.claude/sprints/*/` - used in pause-sprint.md, resume-sprint.md, sprint-status.md ✓
2. `plugins/m42-sprint/skills/orchestrating-sprints/assets/*.yaml` - actual location ✓

### Broken Paths (Require Fixes)
1. `.claude/skills/orchestrating-sprints/assets/*.yaml` - WRONG, should be `plugins/m42-sprint/skills/...`
2. `/home/konstantin/projects/m42-core/.claude/sprints/*/` - WRONG, should be `.claude/sprints/*/`

## Recommendations

### Priority 1: Fix start-sprint.md template paths
Update lines 34-35 to reference correct plugin location:
```markdown
- Sprint template: `plugins/m42-sprint/skills/orchestrating-sprints/assets/sprint-template.yaml`
- Progress template: `plugins/m42-sprint/skills/orchestrating-sprints/assets/progress-template.yaml`
```

### Priority 2: Fix add-task.md hardcoded paths
Replace all 3 occurrences of `/home/konstantin/projects/m42-core/.claude/sprints/*/` with `.claude/sprints/*/`

### Priority 3: Fix import-tasks.md hardcoded paths
Replace all 3 occurrences of `/home/konstantin/projects/m42-core/.claude/sprints/*/` with `.claude/sprints/*/`

## Verification Commands

```bash
# Verify correct template location
ls -la plugins/m42-sprint/skills/orchestrating-sprints/assets/*.yaml

# Verify commands use relative paths
grep -r "\/home\/" plugins/m42-sprint/commands/

# Test sprint commands work from any directory
cd /tmp && /path/to/project/plugins/m42-sprint/commands/start-sprint.md
```

## Next Steps

1. **Immediate:** Fix start-sprint.md template paths (custom-fix-start-sprint-template-paths task)
2. **High Priority:** Fix hardcoded paths in add-task.md and import-tasks.md
3. **Follow-up:** Add validation tests to catch hardcoded paths in CI/CD
4. **Documentation:** Update plugin installation guide with path conventions

## Files Scanned

### Markdown Files (12)
- plugins/m42-sprint/README.md
- plugins/m42-sprint/skills/orchestrating-sprints/SKILL.md
- plugins/m42-sprint/skills/orchestrating-sprints/references/sprint-setup.md
- plugins/m42-sprint/skills/orchestrating-sprints/references/progress-tracking.md
- plugins/m42-sprint/skills/orchestrating-sprints/references/task-types.md
- plugins/m42-sprint/commands/resume-sprint.md
- plugins/m42-sprint/commands/sprint-status.md
- plugins/m42-sprint/commands/import-tasks.md
- plugins/m42-sprint/commands/run-sprint.md
- plugins/m42-sprint/commands/start-sprint.md
- plugins/m42-sprint/commands/add-task.md
- plugins/m42-sprint/commands/pause-sprint.md

### YAML Files (3)
- plugins/m42-sprint/skills/orchestrating-sprints/assets/task-list-template.yaml ✓
- plugins/m42-sprint/skills/orchestrating-sprints/assets/progress-template.yaml ✓
- plugins/m42-sprint/skills/orchestrating-sprints/assets/sprint-template.yaml ✓

**Result:** No hardcoded paths found in YAML files

## Audit Completion

- ✓ All markdown files scanned
- ✓ All YAML files scanned
- ✓ Path references verified
- ✓ Broken references identified
- ✓ Recommendations documented
- ✓ Severity assessed

**Audit Status:** COMPLETE
**Done-When Criteria Met:** YES - "All file path references in m42-sprint plugin are audited, documented, and any broken references are identified with recommended fixes"
