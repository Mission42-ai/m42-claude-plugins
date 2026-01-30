---
title: Gherkin Patterns by Feature Type
description: Pattern catalog for writing Gherkin scenarios based on feature type (new features, process interactions, state changes, APIs)
keywords: gherkin patterns, scenario templates, feature types, test patterns
file-type: reference
skill: creating-gherkin-scenarios
---

# Gherkin Patterns by Feature Type

## Pattern Selection

| Feature Type | Primary Pattern | Verification Focus |
|--------------|----------------|-------------------|
| New user-facing feature | End-to-end workflow | User journey completion |
| External process (hooks, subagents) | Process lifecycle | Spawn → execute → output capture |
| State persistence | State modification cycle | Write → persist → read → verify |
| API/integration | Request → response | Input transformation → output validation |
| Async/parallel operations | Concurrency scenario | All operations complete → outcomes correct |
| Error handling/recovery | Failure injection | Error detected → recovery executed → state restored |

## Pattern 1: End-to-End Feature Workflow

**Use when:** Testing new user-facing features with clear input/output.

**Structure:**
```gherkin
Scenario: [Feature name] works end-to-end
  Given [precondition - environment setup]
  When [user action - feature invocation]
  Then [primary outcome - main result]
  And [verification 1 - side effect]
  And [verification 2 - state change]
```

**Example:**
```gherkin
Scenario: Story detailing generates complete specification
  Given an epic with 5 story outlines in stories.md
  And story-1 is selected for detailing
  When I run /detail-story story-1
  Then a story folder .claude/stories/story-1/ is created
  And the folder contains 8 required files (story.md, gherkin.md, design.md, tasks.md, test-strategy.md, files-to-change.md, dependencies.md, progress.yaml)
  And story.md has complete frontmatter (id, title, epic, status, estimate)
  And gherkin.md contains full scenario catalogue (not just high-level scenarios)
```

**Verifies:** Directory creation, file generation, content completeness, schema correctness.

## Pattern 2: External Process Interaction

**Use when:** Feature spawns external processes (Claude CLI, bash scripts, hooks, subagents).

**Structure:**
```gherkin
Scenario: [Process name] spawns and executes
  Given [trigger condition setup]
  When [event that triggers process]
  Then [process spawned - verify PID/process list]
  And [process output captured - verify transcript/log file]
  And [output contains expected data]
  And [side effects observable - file system, state changes]
```

**Example:**
```gherkin
Scenario: Learning extraction hook executes after iteration
  Given a sprint with learning hook enabled in SPRINT.yaml
  And iteration 1 completes successfully
  When the sprint loop transitions to iteration 2
  Then a Claude CLI process is spawned with learning extraction prompt
  And the hook transcript is written to .claude/sprints/{sprint}/hooks/learning/iteration-1.md
  And the transcript contains "## Extracted Learnings" section
  And learnings are added to the backlog at .claude/sprints/{sprint}/learnings/backlog.yaml
```

**Verifies:** Process spawning, IPC/file output, data capture, downstream effects.

## Pattern 3: State Persistence and Modification

**Use when:** Feature maintains state that must survive restarts or external changes.

**Structure:**
```gherkin
Scenario: [State] persists across [boundary]
  Given [initial state setup]
  When [state modification]
  And [boundary crossed - restart, external edit, crash recovery]
  Then [state retained - verify data integrity]
  And [no conflicts - verify merge/locking]
```

**Example:**
```gherkin
Scenario: External PROGRESS.yaml edits are preserved
  Given a sprint in progress with PROGRESS.yaml checksum
  When I add a custom field "notes: manual annotation" to PROGRESS.yaml externally
  And I modify the checksum file to match
  And the sprint loop continues to next task
  Then the "notes" field remains in PROGRESS.yaml
  And no checksum validation errors are logged
  And subsequent loop iterations preserve the custom field
```

**Verifies:** File watching, merge logic, conflict resolution, data preservation.

## Pattern 4: API/Integration Testing

**Use when:** Testing external service integration or internal API contracts.

**Structure:**
```gherkin
Scenario: [API endpoint] handles [request type]
  Given [service state/preconditions]
  When [API request with specific input]
  Then [response status is correct]
  And [response body matches schema]
  And [side effects occurred - database, file system, downstream calls]
```

**Example:**
```gherkin
Scenario: GitHub issue creation via gh CLI
  Given a valid GitHub repository "org/repo"
  And gh CLI is authenticated
  When I invoke gh issue create with title "Bug report" and body "Description"
  Then the command returns issue number
  And the issue exists in GitHub UI
  And the issue has correct title, body, and default labels
```

**Verifies:** Request handling, response correctness, side effect execution.

## Pattern 5: Async/Parallel Operations

**Use when:** Testing concurrent execution, race conditions, or parallelization.

**Structure:**
```gherkin
Scenario: [Operations] execute in parallel correctly
  Given [concurrent operation setup]
  When [multiple operations triggered simultaneously]
  Then [all operations complete - verify count]
  And [no race conditions - verify data consistency]
  And [outputs are correct - verify each result]
  And [execution time suggests parallelism - optional performance check]
```

**Example:**
```gherkin
Scenario: Multiple story detailing runs in parallel
  Given an epic with 3 stories (story-1, story-2, story-3)
  When I run 3 concurrent /detail-story commands
  Then all 3 story folders are created
  And no file conflicts exist (each folder isolated)
  And each story.md has correct story-specific content (not mixed)
  And progress.yaml tracks all 3 stories independently
```

**Verifies:** Concurrency safety, isolation, correctness under parallelism.

## Pattern 6: Error Handling and Recovery

**Use when:** Testing failure scenarios, error detection, and recovery logic.

**Structure:**
```gherkin
Scenario: [Error condition] is handled correctly
  Given [normal operation state]
  When [error injected - missing file, invalid input, timeout]
  Then [error detected - verify error message/log]
  And [recovery executed - retry, fallback, cleanup]
  And [state restored or safe - verify consistency]
  And [user notified appropriately - error message quality]
```

**Example:**
```gherkin
Scenario: Compilation handles malformed SPRINT.yaml gracefully
  Given a SPRINT.yaml with invalid syntax (missing colon)
  When I run sprint compilation
  Then compilation fails with clear error message
  And the error message indicates line number and syntax issue
  And no partial PROGRESS.yaml is created
  And the original SPRINT.yaml is not modified
```

**Verifies:** Error detection, message clarity, safe failure, no data corruption.

## Composite Patterns

Real features often combine multiple patterns:

```gherkin
# Combines: Process interaction + State persistence + Error handling
Scenario: Sprint loop with hook failure recovery
  Given a sprint with learning hook enabled
  When iteration 1 completes
  And the learning hook fails (Claude API timeout)
  Then the hook failure is logged
  And the sprint continues to iteration 2 (not blocked)
  And PROGRESS.yaml marks hook as failed for iteration 1
  And hook retry is scheduled for next iteration
```

## Pattern Selection Logic

```
What does the feature do?
├─ Adds user-facing capability → Pattern 1 (End-to-End)
├─ Spawns external process → Pattern 2 (Process Interaction)
├─ Maintains persistent state → Pattern 3 (State Persistence)
├─ Calls external API → Pattern 4 (API Integration)
├─ Runs concurrent operations → Pattern 5 (Async/Parallel)
└─ Handles errors/failures → Pattern 6 (Error Handling)

Complex feature?
└─ Combine relevant patterns (most features use 2-3 patterns)
```
