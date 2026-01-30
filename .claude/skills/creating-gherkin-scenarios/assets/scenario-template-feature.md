# Gherkin Scenario Template: New Feature

Use this template for testing new user-facing features with clear input/output.

## Template

```gherkin
Scenario: [Feature name] works end-to-end
  Given [precondition - environment setup, initial state]
  When [user action - feature invocation with specific input]
  Then [primary outcome - main result that user observes]
  And [verification 1 - important side effect or state change]
  And [verification 2 - additional validation, schema check, or constraint]
```

## Example: Story Detailing

```gherkin
Scenario: Story detailing generates complete specification
  Given an epic with 5 story outlines in stories.md
  And story-1 is selected for detailing
  When I run /detail-story story-1
  Then a story folder .claude/stories/story-1/ is created
  And the folder contains 8 required files (story.md, gherkin.md, design.md, tasks.md, test-strategy.md, files-to-change.md, dependencies.md, progress.yaml)
  And story.md has complete frontmatter (id, title, epic, status, estimate)
  And gherkin.md contains full scenario catalogue (not just high-level scenarios)
  And tasks.md contains granular tasks (15-30 min each)
```

## Guidelines

- **Given:** Set up test environment with specific, minimal preconditions
- **When:** Invoke the feature exactly as a user would (command, API call, UI action)
- **Then:** Verify the primary observable outcome first
- **And:** Add progressive verifications (side effects, state changes, schema compliance)

## Common Mistakes

- ❌ Verifying code exists instead of feature working
- ❌ Vague outcomes ("system works correctly")
- ❌ Missing specific values (file paths, field names, counts)
- ❌ No schema or structure validation

## Anti-Pattern to Avoid

```gherkin
# ❌ WRONG - Structural verification
Scenario: Feature code exists
  Given the codebase
  When I search for feature function
  Then the function is found
```

## Correct Pattern

```gherkin
# ✅ CORRECT - Behavioral verification
Scenario: Feature produces expected output
  Given valid input data
  When I invoke the feature
  Then the output matches expected schema
  And all required fields are populated
```
