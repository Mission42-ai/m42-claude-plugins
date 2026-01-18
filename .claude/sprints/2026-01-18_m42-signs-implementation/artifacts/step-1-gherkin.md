# Gherkin Scenarios: step-1

## Step Task
## Phase 1.2: Backlog Schema and Templates

Create the learning backlog structure:

### Tasks
1. Create skills/managing-signs/assets/backlog-template.yaml with:
   - Schema version
   - Metadata fields (extracted-from, extracted-at)
   - Empty learnings array
   - Example learning entry (commented)

2. Create skills/managing-signs/references/backlog-schema.md documenting:
   - All fields and their purpose
   - Status enum values (pending, approved, rejected, applied)
   - Confidence levels (low, medium, high)
   - Source metadata structure
   - Include proper frontmatter (title, description, skill)

3. Create scripts/validate-backlog.sh to:
   - Check YAML syntax
   - Validate required fields
   - Check status values are valid
   - Ensure target paths exist

### Success Criteria
- Template is valid YAML
- Reference has proper frontmatter and is LLM-optimized (dense, structured)
- Validation script catches common errors


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Backlog template file exists and is valid YAML
```gherkin
Scenario: Backlog template file exists and is valid YAML
  Given the skill assets directory exists
  When I check for the backlog template file
  Then plugins/m42-signs/skills/managing-signs/assets/backlog-template.yaml exists and is valid YAML

Verification: `yq eval '.' /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/assets/backlog-template.yaml > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Backlog template has required schema fields
```gherkin
Scenario: Backlog template has required schema fields
  Given backlog-template.yaml exists
  When I check for required schema fields
  Then version, extracted-from, extracted-at, and learnings fields are present

Verification: `yq eval -e '.version != null and .["extracted-from"] != null and .["extracted-at"] != null and .learnings != null' /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/assets/backlog-template.yaml > /dev/null`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Backlog template has learnings as array
```gherkin
Scenario: Backlog template has learnings as array
  Given backlog-template.yaml exists
  When I check the learnings field type
  Then learnings is an array (can be empty)

Verification: `yq eval -e '.learnings | type == "!!seq"' /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/assets/backlog-template.yaml > /dev/null`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Backlog template contains commented example
```gherkin
Scenario: Backlog template contains commented example
  Given backlog-template.yaml exists
  When I check for a commented example learning entry
  Then the file contains YAML comments showing example learning structure

Verification: `grep -q "^#.*id:" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/assets/backlog-template.yaml && grep -q "^#.*status:" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/assets/backlog-template.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Backlog schema reference exists with frontmatter
```gherkin
Scenario: Backlog schema reference exists with frontmatter
  Given the skill references directory exists
  When I check for the backlog schema reference
  Then plugins/m42-signs/skills/managing-signs/references/backlog-schema.md exists with title and description frontmatter

Verification: `test -f /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/references/backlog-schema.md && grep -q "^title:" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/references/backlog-schema.md && grep -q "^description:" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/references/backlog-schema.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Backlog schema documents status enum values
```gherkin
Scenario: Backlog schema documents status enum values
  Given backlog-schema.md exists
  When I check for status enum documentation
  Then all four status values are documented (pending, approved, rejected, applied)

Verification: `grep -q "pending" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/references/backlog-schema.md && grep -q "approved" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/references/backlog-schema.md && grep -q "rejected" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/references/backlog-schema.md && grep -q "applied" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/references/backlog-schema.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Validation script exists and is executable
```gherkin
Scenario: Validation script exists and is executable
  Given the scripts directory exists
  When I check for the validation script
  Then plugins/m42-signs/scripts/validate-backlog.sh exists and is executable

Verification: `test -x /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/scripts/validate-backlog.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Validation script validates the template successfully
```gherkin
Scenario: Validation script validates the template successfully
  Given validate-backlog.sh exists and backlog-template.yaml exists
  When I run the validation script on the template
  Then the template passes validation

Verification: `/home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/scripts/validate-backlog.sh /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/assets/backlog-template.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```
