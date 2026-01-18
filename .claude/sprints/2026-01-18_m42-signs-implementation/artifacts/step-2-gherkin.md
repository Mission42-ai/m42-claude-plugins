# Step 2: Manual Sign Management Commands - Gherkin Scenarios

## Scenario 1: Add command has proper frontmatter
**Given** the add.md command file exists
**When** I check its frontmatter
**Then** it should have description, allowed-tools, and model fields

**Verification**:
```bash
head -10 plugins/m42-signs/commands/add.md | grep -E "^(description|allowed-tools|model):" | wc -l | grep -q "3" && echo "PASS" || echo "FAIL"
```

---

## Scenario 2: Add command supports --direct flag
**Given** the add.md command file exists
**When** I check its content
**Then** it should document the --direct flag for skipping backlog

**Verification**:
```bash
grep -q "\-\-direct" plugins/m42-signs/commands/add.md && echo "PASS" || echo "FAIL"
```

---

## Scenario 3: Add command has argument-hint
**Given** the add.md command file exists
**When** I check its frontmatter
**Then** it should have an argument-hint field

**Verification**:
```bash
grep -q "^argument-hint:" plugins/m42-signs/commands/add.md && echo "PASS" || echo "FAIL"
```

---

## Scenario 4: List command has proper frontmatter
**Given** the list.md command file exists
**When** I check its frontmatter
**Then** it should have description, allowed-tools, and model fields

**Verification**:
```bash
head -10 plugins/m42-signs/commands/list.md | grep -E "^(description|allowed-tools|model):" | wc -l | grep -q "3" && echo "PASS" || echo "FAIL"
```

---

## Scenario 5: List command supports JSON format
**Given** the list.md command file exists
**When** I check its content
**Then** it should document --format json option

**Verification**:
```bash
grep -q "\-\-format json" plugins/m42-signs/commands/list.md && echo "PASS" || echo "FAIL"
```

---

## Scenario 6: List command finds CLAUDE.md files
**Given** the list.md command file exists
**When** I check its content
**Then** it should use Glob pattern for CLAUDE.md discovery

**Verification**:
```bash
grep -qE "(CLAUDE\.md|\*\*/CLAUDE\.md)" plugins/m42-signs/commands/list.md && echo "PASS" || echo "FAIL"
```

---

## Scenario 7: Status command has proper frontmatter
**Given** the status.md command file exists
**When** I check its frontmatter
**Then** it should have description, allowed-tools, and model fields

**Verification**:
```bash
head -10 plugins/m42-signs/commands/status.md | grep -E "^(description|allowed-tools|model):" | wc -l | grep -q "3" && echo "PASS" || echo "FAIL"
```

---

## Scenario 8: Status command handles missing backlog
**Given** the status.md command file exists
**When** I check its content
**Then** it should have instructions for when backlog doesn't exist

**Verification**:
```bash
grep -qi "doesn.t exist\|NOT_EXISTS\|no backlog" plugins/m42-signs/commands/status.md && echo "PASS" || echo "FAIL"
```

---

## Scenario 9: Status command counts by status
**Given** the status.md command file exists
**When** I check its content
**Then** it should count learnings by status (pending, approved, rejected, applied)

**Verification**:
```bash
grep -E "(pending|approved|rejected|applied)" plugins/m42-signs/commands/status.md | wc -l | awk '{if ($1 >= 4) print "PASS"; else print "FAIL"}'
```

---

## Scenario 10: Help command exists
**Given** the commands directory exists
**When** I check for help.md
**Then** the help.md command file should exist

**Verification**:
```bash
test -f plugins/m42-signs/commands/help.md && echo "PASS" || echo "FAIL"
```

---

## Scenario 11: Help command has workflow diagram
**Given** the help.md command file exists
**When** I check its content
**Then** it should include a workflow diagram

**Verification**:
```bash
grep -qE "(Workflow Diagram|workflow diagram|───|───────)" plugins/m42-signs/commands/help.md && echo "PASS" || echo "FAIL"
```

---

## Scenario 12: Help command lists all commands
**Given** the help.md command file exists
**When** I check its content
**Then** it should reference add, list, and status commands

**Verification**:
```bash
grep -E "(/m42-signs:add|/m42-signs:list|/m42-signs:status)" plugins/m42-signs/commands/help.md | wc -l | awk '{if ($1 >= 3) print "PASS"; else print "FAIL"}'
```

---

## Scenario 13: All commands use simple names
**Given** the commands directory exists
**When** I list the command files
**Then** they should have simple names (add.md, list.md, status.md, help.md)

**Verification**:
```bash
ls plugins/m42-signs/commands/ | sort | tr '\n' ' ' | grep -qE "add\.md.*help\.md.*list\.md.*status\.md" && echo "PASS" || echo "FAIL"
```

---

## Scenario 14: Add command validates inputs
**Given** the add.md command file exists
**When** I check its content
**Then** it should include input validation rules

**Verification**:
```bash
grep -qi "validation" plugins/m42-signs/commands/add.md && echo "PASS" || echo "FAIL"
```

---

## Scenario 15: List handles no signs gracefully
**Given** the list.md command file exists
**When** I check its content
**Then** it should handle the case when no signs are found

**Verification**:
```bash
grep -qi "no signs\|NO_FILES\|not found" plugins/m42-signs/commands/list.md && echo "PASS" || echo "FAIL"
```
