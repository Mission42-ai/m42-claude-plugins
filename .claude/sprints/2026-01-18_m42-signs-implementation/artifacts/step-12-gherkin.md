# Gherkin Scenarios: step-12

## Step Task
## Phase 5.2: How-To Guides

Create task-oriented how-to guides:

### Tasks
1. Create docs/how-to/add-sign-manually.md:
   - When to add signs manually vs extract
   - Step-by-step with /m42-signs:add
   - Using --direct flag
   - Examples of good sign content

2. Create docs/how-to/extract-from-session.md:
   - Finding session IDs
   - Running /m42-signs:extract
   - Understanding confidence levels
   - Filtering and dry-run options

3. Create docs/how-to/review-and-apply.md:
   - The review workflow
   - Editing learnings
   - Batch operations
   - Git commit integration

4. Create docs/how-to/integrate-with-sprint.md:
   - Adding learning extraction to workflows
   - Automatic vs manual extraction
   - End-of-sprint analysis patterns

### Success Criteria
- Each guide is self-contained and actionable
- Includes concrete examples
- Links to related guides where relevant


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Add Sign Manually Guide Exists
```gherkin
Scenario: Add sign manually guide exists with required content
  Given the docs/how-to directory exists
  When I check the add-sign-manually.md file
  Then it exists and contains key sections

Verification: `test -f plugins/m42-signs/docs/how-to/add-sign-manually.md && grep -q "Quick Start\|## When to" plugins/m42-signs/docs/how-to/add-sign-manually.md && grep -q "/m42-signs:add" plugins/m42-signs/docs/how-to/add-sign-manually.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Add Sign Guide Has Direct Flag Documentation
```gherkin
Scenario: Add sign guide documents the --direct flag
  Given docs/how-to/add-sign-manually.md exists
  When I check for direct flag documentation
  Then the --direct flag usage is explained with examples

Verification: `grep -q "\-\-direct" plugins/m42-signs/docs/how-to/add-sign-manually.md && grep -qE '(example|Example)' plugins/m42-signs/docs/how-to/add-sign-manually.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Extract From Session Guide Exists
```gherkin
Scenario: Extract from session guide exists with required content
  Given the docs/how-to directory exists
  When I check the extract-from-session.md file
  Then it contains session finding, extraction, and confidence documentation

Verification: `test -f plugins/m42-signs/docs/how-to/extract-from-session.md && grep -qE "(session|Session)" plugins/m42-signs/docs/how-to/extract-from-session.md && grep -q "/m42-signs:extract" plugins/m42-signs/docs/how-to/extract-from-session.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Extract Guide Documents Dry Run Option
```gherkin
Scenario: Extract guide documents dry-run and filtering options
  Given docs/how-to/extract-from-session.md exists
  When I check for dry-run documentation
  Then the --dry-run flag and filtering options are explained

Verification: `grep -q "\-\-dry-run" plugins/m42-signs/docs/how-to/extract-from-session.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Review and Apply Guide Exists
```gherkin
Scenario: Review and apply guide exists with required content
  Given the docs/how-to directory exists
  When I check the review-and-apply.md file
  Then it contains review workflow, editing, and batch operation documentation

Verification: `test -f plugins/m42-signs/docs/how-to/review-and-apply.md && grep -q "/m42-signs:review" plugins/m42-signs/docs/how-to/review-and-apply.md && grep -q "/m42-signs:apply" plugins/m42-signs/docs/how-to/review-and-apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Review Guide Documents Git Integration
```gherkin
Scenario: Review guide documents git commit integration
  Given docs/how-to/review-and-apply.md exists
  When I check for git commit documentation
  Then the --commit flag and git integration are explained

Verification: `grep -qE "(\-\-commit|git|Git)" plugins/m42-signs/docs/how-to/review-and-apply.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Sprint Integration Guide Exists
```gherkin
Scenario: Sprint integration guide exists with required content
  Given the docs/how-to directory exists
  When I check the integrate-with-sprint.md file
  Then it contains workflow integration and extraction patterns

Verification: `test -f plugins/m42-signs/docs/how-to/integrate-with-sprint.md && grep -qE "(workflow|Workflow)" plugins/m42-signs/docs/how-to/integrate-with-sprint.md && grep -qE "(sprint|Sprint)" plugins/m42-signs/docs/how-to/integrate-with-sprint.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: All Guides Link to Related Content
```gherkin
Scenario: All guides link back to getting started or related guides
  Given all four how-to guides exist
  When I check for cross-linking
  Then each guide links to getting-started.md or other guides

Verification: `grep -l "getting-started\|how-to/" plugins/m42-signs/docs/how-to/*.md | wc -l | grep -q "^4$"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```
