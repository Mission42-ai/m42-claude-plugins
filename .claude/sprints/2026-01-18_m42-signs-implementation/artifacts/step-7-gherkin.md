# Gherkin Scenarios: step-7

## Step Task
## Phase 3.1: Interactive Review Command

Implement /m42-signs:review command:

### Tasks
1. Create commands/review.md:
   - Proper frontmatter (description, allowed-tools, model)
   - Load .claude/learnings/backlog.yaml
   - Filter to status: pending
   - For each learning:
     - Display: title, problem, solution, target, confidence
     - Show context (origin, source tool/error)
     - Prompt: [A]pprove / [R]eject / [E]dit / [S]kip / [Q]uit
   - Update status based on choice
   - Save changes after each decision

2. Add edit mode:
   - Allow editing title, problem, solution, target
   - Re-validate edited learning
   - Update confidence if significantly changed

3. Add batch operations:
   - --approve-all-high: auto-approve high confidence
   - --reject-all-low: auto-reject low confidence

### Success Criteria
- Interactive flow is intuitive
- Edits are validated before saving
- Batch operations are safe (with confirmation)


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Command File Exists with Valid Frontmatter

```gherkin
Scenario: Command file exists with valid frontmatter
  Given the m42-signs plugin structure exists
  When I check for the review command file
  Then plugins/m42-signs/commands/review.md exists with required frontmatter fields

Verification: `test -f plugins/m42-signs/commands/review.md && grep -q "^---" plugins/m42-signs/commands/review.md && grep -q "^allowed-tools:" plugins/m42-signs/commands/review.md && grep -q "^description:" plugins/m42-signs/commands/review.md && grep -q "^model:" plugins/m42-signs/commands/review.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Command Has Argument Hint for Batch Operations

```gherkin
Scenario: Command supports batch operation arguments
  Given plugins/m42-signs/commands/review.md exists
  When I check for argument-hint in frontmatter
  Then the command documents --approve-all-high and --reject-all-low options

Verification: `grep -q "argument-hint:" plugins/m42-signs/commands/review.md && grep -E "\-\-approve-all-high|\-\-reject-all-low" plugins/m42-signs/commands/review.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Command Documents Interactive Review Flow

```gherkin
Scenario: Command documents interactive review actions
  Given plugins/m42-signs/commands/review.md exists
  When I check for interactive action documentation
  Then the command documents Approve, Reject, Edit, Skip, and Quit actions

Verification: `grep -i "approve" plugins/m42-signs/commands/review.md && grep -i "reject" plugins/m42-signs/commands/review.md && grep -i "edit" plugins/m42-signs/commands/review.md && grep -i "skip" plugins/m42-signs/commands/review.md && grep -i "quit" plugins/m42-signs/commands/review.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Command Documents Learning Display Fields

```gherkin
Scenario: Command specifies learning fields to display
  Given plugins/m42-signs/commands/review.md exists
  When I check for field display instructions
  Then the command includes title, problem, solution, target, and confidence display

Verification: `grep -i "title" plugins/m42-signs/commands/review.md && grep -i "problem" plugins/m42-signs/commands/review.md && grep -i "solution" plugins/m42-signs/commands/review.md && grep -i "target" plugins/m42-signs/commands/review.md && grep -i "confidence" plugins/m42-signs/commands/review.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Command Documents Backlog Status Updates

```gherkin
Scenario: Command documents status update logic
  Given plugins/m42-signs/commands/review.md exists
  When I check for status update instructions
  Then the command documents changing status from pending to approved or rejected

Verification: `grep -E "status.*pending|pending.*status" plugins/m42-signs/commands/review.md && grep -E "status.*approved|approved.*status" plugins/m42-signs/commands/review.md && grep -E "status.*rejected|rejected.*status" plugins/m42-signs/commands/review.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Command Documents Edit Mode with Validation

```gherkin
Scenario: Command documents edit mode with re-validation
  Given plugins/m42-signs/commands/review.md exists
  When I check for edit mode documentation
  Then the command includes edit mode instructions with validation requirement

Verification: `grep -iE "edit.*mode|edit.*title|edit.*problem|edit.*solution|edit.*target" plugins/m42-signs/commands/review.md && grep -iE "valid|re-valid" plugins/m42-signs/commands/review.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```
