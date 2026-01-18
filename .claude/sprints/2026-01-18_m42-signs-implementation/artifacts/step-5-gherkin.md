# Gherkin Scenarios: step-5

## Step Task
## Phase 2.3: Target CLAUDE.md Inference

Implement logic to infer where signs should be stored:

### Tasks
1. Create scripts/infer-target.sh:
   - Input: file paths from tool calls
   - Extract common directory prefix
   - Check for existing CLAUDE.md in hierarchy
   - Suggest target CLAUDE.md path

2. Add rules:
   - Scripts/automation -> scripts/CLAUDE.md
   - API code -> api/CLAUDE.md
   - General/cross-cutting -> project root CLAUDE.md
   - Tool-specific -> create new CLAUDE.md if needed

3. Support manual override in extraction

### Success Criteria
- Inference is accurate for 90% of cases
- Edge cases have reasonable defaults
- User can override if needed

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Infer target script exists
  Given the plugin structure is set up
  When I check for the infer-target script
  Then plugins/m42-signs/scripts/infer-target.sh exists

Verification: `test -f plugins/m42-signs/scripts/infer-target.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Infer target script is executable
  Given the infer-target.sh script exists
  When I check its permissions
  Then the script has executable permission

Verification: `test -x plugins/m42-signs/scripts/infer-target.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Script handles missing file paths argument
  Given the infer-target.sh script is executable
  When I run the script without arguments
  Then it exits with non-zero status and shows usage

Verification: `plugins/m42-signs/scripts/infer-target.sh 2>&1 | grep -qi "usage\|error\|required"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Script infers root CLAUDE.md for cross-cutting paths
  Given the infer-target.sh script is executable
  When I provide paths from different top-level directories
  Then it suggests the project root CLAUDE.md

Verification: `plugins/m42-signs/scripts/infer-target.sh "src/foo.ts" "lib/bar.ts" "tests/test.ts" 2>/dev/null | grep -qE "^\.?/?CLAUDE\.md$|^CLAUDE\.md$"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Script infers subdirectory CLAUDE.md for common prefix
  Given the infer-target.sh script is executable
  When I provide paths all within the same subdirectory
  Then it suggests a CLAUDE.md in that subdirectory

Verification: `plugins/m42-signs/scripts/infer-target.sh "scripts/validate.sh" "scripts/build.sh" "scripts/test.sh" 2>/dev/null | grep -qE "^scripts/CLAUDE\.md$"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Script detects existing CLAUDE.md in hierarchy
  Given the infer-target.sh script is executable
  And a CLAUDE.md exists in plugins/m42-signs/
  When I provide paths under plugins/m42-signs/scripts/
  Then it suggests the existing plugins/m42-signs/CLAUDE.md

Verification: `test -f plugins/m42-signs/CLAUDE.md 2>/dev/null || touch plugins/m42-signs/CLAUDE.md; plugins/m42-signs/scripts/infer-target.sh "plugins/m42-signs/scripts/parse.sh" "plugins/m42-signs/scripts/find.sh" 2>/dev/null | grep -qE "plugins/m42-signs/CLAUDE\.md"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Script outputs valid target path format
  Given the infer-target.sh script is executable
  When I provide any valid file paths
  Then the output is a single path ending in CLAUDE.md

Verification: `plugins/m42-signs/scripts/infer-target.sh "src/index.ts" 2>/dev/null | grep -qE "CLAUDE\.md$"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Script supports JSON output mode for pipeline integration
  Given the infer-target.sh script is executable
  When I provide paths with --json flag
  Then it outputs valid JSON with target and reasoning fields

Verification: `plugins/m42-signs/scripts/infer-target.sh --json "src/foo.ts" "src/bar.ts" 2>/dev/null | jq -e '.target and .reasoning' >/dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
