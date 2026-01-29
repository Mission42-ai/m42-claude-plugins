# Sprint Overview: Workflow QA Improvements

## Background: The Per-Iteration-Hooks Gap

### What Happened

A feature was implemented, "verified", migrated, shipped, and used in production—but **never actually worked**.

**Timeline:**
1. **2026-01-18**: `ralph-mode-implementation` sprint added `spawn_per_iteration_hooks()` to bash
2. **2026-01-18**: QA "verified" function existed via `grep` (structural check ✗)
3. **2026-01-20**: `typescript-runtime-migration` sprint rewrote bash → TypeScript
4. **2026-01-20**: Migration step 6 acceptance criteria didn't list hooks
5. **2026-01-20**: Bash script with hooks deleted
6. **2026-01-29**: Discovery: hooks compile but never execute
7. **2026-01-29**: Workflows use `learning: enabled: true` (does nothing)

### Root Cause: Three Failures

#### 1. Weak Gherkin (Structural, Not Behavioral)

**What we tested:**
```gherkin
Scenario: spawn_per_iteration_hooks Function Exists
  When I check for the function definition
  Then the function is found in the script
```
Verification: `grep -qE '^spawn_per_iteration_hooks'`

**What we should have tested:**
```gherkin
Scenario: per-iteration hooks execute after each iteration
  Given a sprint with learning hook enabled
  When an iteration completes
  Then the learning extraction prompt is invoked
  And the hook runs in parallel
  And the hook transcript file exists
```

#### 2. Missing Feature Inventory (Migration)

The TypeScript migration sprint listed acceptance criteria like:
- Check max iterations
- Check pause signal
- Backup progress

**Missing from the list:**
- Execute per-iteration hooks if enabled
- Spawn hook processes in parallel
- Track hook-tasks in progress

#### 3. Zero Integration Tests

No test files verify hook execution:
```bash
$ grep -r "per-iteration-hooks" plugins/m42-sprint/**/*.test.ts
# No results
```

---

## This Sprint: Systematic Prevention

### Step 1: Create `creating-gherkin-scenarios` Skill

**Goal**: Teach agents to write behavioral scenarios, not structural checks.

**Core principle**: Behavioral Testing > Structural Testing

**Location**: `plugins/m42-meta-toolkit/skills/creating-gherkin-scenarios/`

**Content**:
- Anti-patterns (grep checks, "function exists", "file contains pattern")
- Correct patterns (observable outcomes, end-to-end flows)
- Integration test requirements (when to test external interactions)
- Examples from codebase (good and bad)

**Triggers**: "write gherkin", "create scenarios", "test strategy"

### Step 2: Update `plugin-development` Workflow

**Goal**: Enforce integration testing for features with external interactions.

**Location**: `.claude/workflows/plugin-development.yaml`

**Changes**:

1. **Add INTEGRATION TEST phase to TDD cycle:**
   ```markdown
   ### 4. INTEGRATION TEST Phase (if needed)

   Determine if integration testing required:
   - ✅ YES if: spawns processes, modifies state, async/parallel
   - ❌ NO if: pure function, isolated logic
   ```

2. **Update final output to track integration test count**

3. **Add integration test verification to QA phase**

### Step 3: Document as Learning Sign

**Goal**: Make this failure mode searchable and preventable.

**Action**: Use `/m42-signs:add` to create a sign

**Content**:
- Title: "Behavioral Gherkin Over Structural Verification"
- Problem: Structural tests give false confidence
- Solution: Always verify observable outcomes
- Target: `.claude/workflows/CLAUDE.md`

### Step 4: Create GitHub Issue

**Goal**: Track the actual implementation work.

**Action**: Use `gh issue create`

**Content**:
- Problem: Hooks compile but don't execute
- Implementation checklist (loop.ts changes, tests, docs)
- Reference to bash implementation
- Acceptance criteria

---

## Success Criteria

After this sprint completes:

**QA Improvements (Steps 1-4):**
1. **Skill exists**: `creating-gherkin-scenarios` provides guidance
2. **Workflow updated**: Integration testing enforced in plugin-development
3. **Learning captured**: Sign exists in backlog for review/approval
4. **Issue tracked**: GitHub issue ready for implementation sprint

**Discoverability Improvements (Steps 5-7):**
5. **Skill improved**: creating-workflows has inline schema + patterns
6. **Versioning added**: Workflows have schema-version, compiler warns
7. **Command created**: /validate-workflow available for users

---

## Impact

**Prevents**:
- Features "verified" with grep that don't work
- Features lost in migrations
- Zero-test features shipped to production
- Agents missing critical context from skills
- Outdated workflows used without awareness

**Enables**:
- Behavioral gherkin becomes the default
- Integration tests are explicitly required
- Agents learn from this specific failure
- Quick reference for common workflow patterns
- Schema versioning catches drift early
- Users can validate workflows before running

---

## Part 2: Discoverability Improvements (Steps 5-7)

Feedback from another agent revealed skill usability issues.
See: `context/skill-discoverability-feedback.md`

### Step 5: Improve creating-workflows Skill

- Add inline Quick Reference (cheat sheet)
- Add Current Patterns section
- Add "Read These First" guidance

### Step 6: Schema Version + Compiler Warnings

- Add `schema-version` field to WorkflowDefinition
- Compiler warns on missing/outdated versions
- Update all workflow templates

### Step 7: /validate-workflow Command

- User-invokable command to check workflows
- Clear pass/fail output with errors and warnings
- Uses compiler validation logic

---

## Follow-Up Work

After this sprint, a separate implementation sprint will:
- Implement hook execution in loop.ts
- Add integration tests for hooks
- Verify hooks work end-to-end

This sprint focuses on **prevention and discoverability**, not hook implementation.
