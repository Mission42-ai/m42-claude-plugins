# Gherkin Scenarios: step-0

## Step Task
## Phase 1.1: Plugin Structure Setup

Create the basic plugin structure for m42-signs:

### Tasks
1. Create .claude-plugin/plugin.json with:
   - Plugin metadata (name: "m42-signs", version: "0.1.0")
   - Author, description, keywords
   - NOTE: Commands and skills are auto-discovered, not declared in plugin.json

2. Create minimal README.md with:
   - One-line description
   - Installation instructions
   - Link to docs/ for detailed documentation (placeholder for now)

3. Create directory structure:
   - commands/ (for command definitions)
   - skills/managing-signs/ (skill directory)
     - SKILL.md (main skill file with frontmatter)
     - references/ (reference documentation)
     - assets/ (templates)
   - scripts/ (for utility scripts)
   - docs/ (for user documentation - will be populated later)

### Success Criteria
- Plugin structure follows m42-sprint patterns
- plugin.json is valid JSON with proper metadata
- README links to docs/ folder
- Skill directory has correct structure


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Plugin JSON exists and is valid JSON
```gherkin
Scenario: Plugin JSON exists and is valid JSON
  Given the plugin structure is being created
  When I check for the plugin.json file
  Then plugins/m42-signs/.claude-plugin/plugin.json exists and is valid JSON

Verification: `jq empty /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/.claude-plugin/plugin.json`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Plugin JSON has required metadata fields
```gherkin
Scenario: Plugin JSON has required metadata fields
  Given plugins/m42-signs/.claude-plugin/plugin.json exists
  When I check for required metadata fields
  Then name, version, description, author, and keywords are present

Verification: `jq -e '.name == "m42-signs" and .version == "0.1.0" and .description != null and .author != null and .keywords != null' /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/.claude-plugin/plugin.json`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: README.md exists with docs link
```gherkin
Scenario: README.md exists with docs link
  Given the plugin structure is set up
  When I check the README.md file
  Then it exists and contains a link to the docs/ folder

Verification: `test -f /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/README.md && grep -q "docs/" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/README.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Commands directory exists
```gherkin
Scenario: Commands directory exists
  Given the plugin structure is set up
  When I check for the commands directory
  Then plugins/m42-signs/commands/ directory exists

Verification: `test -d /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/commands`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Skill directory structure is correct
```gherkin
Scenario: Skill directory structure is correct
  Given the plugin structure is set up
  When I check for skill subdirectories
  Then skills/managing-signs/ has references/ and assets/ subdirectories

Verification: `test -d /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/references && test -d /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/assets`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: SKILL.md exists with valid frontmatter
```gherkin
Scenario: SKILL.md exists with valid frontmatter
  Given the skill directory structure exists
  When I check for the SKILL.md file
  Then skills/managing-signs/SKILL.md exists with name and description in frontmatter

Verification: `test -f /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/SKILL.md && grep -q "^name:" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/SKILL.md && grep -q "^description:" /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/skills/managing-signs/SKILL.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Scripts and docs directories exist
```gherkin
Scenario: Scripts and docs directories exist
  Given the plugin structure is set up
  When I check for utility directories
  Then scripts/ and docs/ directories exist

Verification: `test -d /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/scripts && test -d /home/konstantin/projects/m42-claude-plugins/plugins/m42-signs/docs`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```
