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

## Scenario 1: Infer target script exists and is executable
Given the scripts directory structure is set up
When I check for the infer-target.sh script
Then plugins/m42-signs/scripts/infer-target.sh exists and is executable

Verification: `test -x plugins/m42-signs/scripts/infer-target.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Script accepts file paths as input
Given plugins/m42-signs/scripts/infer-target.sh exists
When I check its content for input handling
Then the script accepts file paths as arguments or from stdin

Verification: `grep -qE '(\$1|\$@|stdin|read.*path|FILE_PATH|PATHS)' plugins/m42-signs/scripts/infer-target.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Script extracts common directory prefix
Given plugins/m42-signs/scripts/infer-target.sh exists
When I check its content for common prefix logic
Then the script identifies common directory from multiple paths

Verification: `grep -qE '(common|prefix|dirname|shared|parent|ancestor)' plugins/m42-signs/scripts/infer-target.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Script checks for existing CLAUDE.md in hierarchy
Given plugins/m42-signs/scripts/infer-target.sh exists
When I check its content for CLAUDE.md detection
Then the script searches for existing CLAUDE.md files in parent directories

Verification: `grep -qE '(CLAUDE\.md|claude\.md|find.*CLAUDE|while.*parent|test.*-f)' plugins/m42-signs/scripts/infer-target.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Script implements category-based routing rules
Given plugins/m42-signs/scripts/infer-target.sh exists
When I check its content for category rules
Then the script routes scripts/ to scripts/CLAUDE.md and api/ to api/CLAUDE.md

Verification: `grep -qE '(scripts|api|src|lib|test)' plugins/m42-signs/scripts/infer-target.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Script defaults to project root for cross-cutting cases
Given plugins/m42-signs/scripts/infer-target.sh exists
When I check its content for default fallback logic
Then the script falls back to root CLAUDE.md for general cases

Verification: `grep -qE '(root|default|fallback|PROJECT_ROOT|\./CLAUDE\.md)' plugins/m42-signs/scripts/infer-target.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Script supports manual override option
Given plugins/m42-signs/scripts/infer-target.sh exists
When I check its content for override support
Then the script accepts a flag or argument to override inference

Verification: `grep -qE '(override|--target|--output|-o|manual|OVERRIDE)' plugins/m42-signs/scripts/infer-target.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Script outputs suggested CLAUDE.md path
Given plugins/m42-signs/scripts/infer-target.sh exists and is executable
When I run it with a sample path
Then the script outputs a valid CLAUDE.md path suggestion

Verification: `echo "/home/user/project/scripts/deploy.sh" | plugins/m42-signs/scripts/infer-target.sh 2>/dev/null | grep -qE 'CLAUDE\.md$'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
