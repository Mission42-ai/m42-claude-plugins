# Claude Code Configuration - m42-sprint Plugin

## Learnings

- **Use Explore agent for comprehensive codebase research in preflight**: Preflight phase needs to understand codebase structure, patterns, test framework, and architectural decisions before implementation begins. Direct file reading/grepping is inefficient when you need broad understanding of a subsystem. This is especially important for complex plugins with multiple directories (runtime, compiler, skills, commands) where patterns span across different modules. Solution: In preflight phase, delegate comprehensive codebase exploration to the Explore agent rather than manually reading files. Pattern: Preflight -> Explore agent -> Structured context document -> Implementation.

- **Create shared context document in preflight for multi-step sprints**: Sprints with multiple development steps run in fresh context for each step. Without shared context, each step must rediscover the same architectural patterns, test commands, file locations, and dependencies. Solution: In preflight phase, create `context/_shared-context.md` with: Project Info (test framework, build commands), Key Directories, Architectural Patterns, Sprint Steps Overview, Dependencies Between Steps, Testing Approach, and Key Files Quick Reference. File location: `.claude/sprints/{sprint-id}/context/_shared-context.md`.

- **Preserve detailed analysis in separate context files, not just shared context**: Some sprint steps require deep problem analysis beyond general codebase patterns (bug fixes need root cause analysis, proposed solutions, specific code locations). Putting all detail in _shared-context.md makes it too long and unfocused. Solution: Create step-specific context files like `context/bug-analysis.md` or `context/live-activity-analysis.md` with root cause, proposed solution, and before/after behavior. Step prompts can reference these files. File pattern: `.claude/sprints/{sprint-id}/context/{topic}.md`.

- **m42-sprint uses custom Node.js test runner, not vitest/jest**: Attempting to use standard test frameworks will fail. The plugin has a custom lightweight test runner with pattern: `function test(name, fn)` that catches errors and logs results. Test locations: `runtime/src/*.test.ts`, `compiler/src/*.test.ts`, `e2e/*.test.ts`. Run tests with `cd plugins/m42-sprint/runtime && npm test` or `cd plugins/m42-sprint/compiler && npm test`. When writing new tests, follow this lightweight pattern rather than importing test frameworks.

- **Assess implementation changes before assuming documentation updates needed**: Documentation phases in sprints can waste effort by creating unnecessary documentation updates when implementation changes are bug fixes or internal improvements to existing features rather than new user-facing functionality. Solution: Follow this assessment pattern: 1. Analyze implementation changes using git diff to understand what actually changed (bug fixes, UI improvements, internal refactoring, new features). 2. Classify change type (bug fixes to existing features → usually no doc updates; internal improvements → no docs; UI enhancements → check if behavior changed; new features → documentation required). 3. Check existing documentation coverage to verify if existing docs already cover the improved functionality. 4. Document decision in artifacts summary. This prevents documentation churn while ensuring truly new features get documented.

- **Use git diff to identify implementation changes at start of documentation phase**: Documentation phases need to know what was implemented in previous steps. Reading individual files doesn't give the complete picture of what changed. Solution: Start documentation phases with `git diff --name-status main...HEAD` to see which files changed and `git diff main...HEAD` to see actual code changes. This reveals scope, nature of changes, and which areas were touched, allowing you to distinguish sprint context files from actual implementation, identify which subsystems were modified, and determine if changes are bug fixes, features, or refactoring. This gives a complete picture before diving into individual files.

- **Use parallel subagent delegation for tooling update reviews**: After making implementation changes to a plugin with multiple commands and skills, the tooling update phase needs to review each one to ensure documentation reflects the new capabilities. Sequential reviews are slow and inefficient. For plugins with 10+ commands/skills, this becomes a bottleneck. Solution: Spawn multiple review subagents in parallel using a single Task() call with multiple invocations. Pattern: 1) Analyze implementation changes to understand what changed, 2) List all commands and skills in the affected plugin, 3) Spawn review subagents in parallel (one per command/skill), 4) Each subagent reads the current command/skill file, reads related implementation files, determines if updates are needed, and makes necessary updates or reports "no changes needed". This parallelizes the review process and completes tooling updates much faster. Example: 13 commands/skills reviewed simultaneously instead of sequentially.

- **Analyze implementation changes before spawning tooling review subagents**: When updating command/skill documentation after implementation changes, review subagents need context about what changed to make informed decisions. Without this context, they might miss relevant updates or make unnecessary changes. Solution: Before spawning tooling review subagents, create a comprehensive analysis of implementation changes: 1) Check git diff for committed changes, 2) Check git status for uncommitted changes, 3) Read modified implementation files, 4) Summarize the changes in a structured format (File changed, What was added/modified, Why it matters for commands/skills). This summary can be passed to review subagents as context or used by the main agent to decide which commands/skills need review.

- **Edit tool uses absolute paths - be aware of worktree context**: When working in a git worktree, path confusion can occur between the worktree location and the parent repository location. This happens because you're in a worktree at `/path/to/trees/sprint-name/` but files reference full paths from the parent repo. The Edit tool can use full paths from parent repo instead of relative paths, causing edits to fail or not persist. Solution: When working in a sprint worktree, always use relative paths with Edit tool. Incorrect: `Edit(file_path: "/home/user/projects/repo/plugins/m42-sprint/plugin.json")`. Correct: `Edit(file_path: "plugins/m42-sprint/plugin.json")`. The worktree directory is a complete checkout of the repository, so all files exist at relative paths from the worktree root. Key indicators you're in a worktree: PWD shows `/trees/sprint-name/` path segment, git worktree list shows multiple working trees. When edits don't persist or fail, check if you're using absolute vs relative paths and adjust to relative paths from the current worktree root.

- **Verify context files before declaring preflight complete**: During sprint preflight, context files may already exist from previous runs. Simply checking git status isn't sufficient. In preflight phases: 1) Check if context directory exists, 2) Read existing context files (_shared-context.md, implementation-plan.md), 3) Verify they contain required information, 4) Check git log for preflight commit, 5) Only re-create if missing or incomplete. This prevents duplicate work and ensures context quality.

- **Use worktree-specific paths when referencing sprint context**: Sprint context files live in the worktree-specific directory structure: `trees/<sprint-id>/.claude/sprints/<sprint-id>/context/` and `trees/<sprint-id>/.claude/sprints/<sprint-id>/transcriptions/`. Always use full worktree paths for sprint context. The sprint framework handles this via CWD, but explicit paths prevent confusion.

- **Use "preflight:" prefix for sprint context setup commits**: Sprint phases need to identify when preflight is complete via git log. Preflight commits must use format: "preflight: sprint context prepared". This allows `git log --oneline -1 --grep="^preflight:"` to check completion and creates clear separation between setup and development commits.

- **Delegate codebase research to Explore subagent during preflight**: Sprint preflight phases need to understand project structure, test framework, patterns, and key files before implementation begins. Use Task(subagent_type="Explore") to delegate systematic codebase research. The subagent will methodically explore and return a comprehensive summary. This creates reusable context documents (_shared-context.md and implementation-plan.md) that all subsequent phases can reference.

- **Create _shared-context.md and implementation-plan.md during preflight**: Sprint steps need consistent access to project patterns, file paths, schemas, and the overall implementation strategy. During preflight, create two standardized context files: _shared-context.md (project info, test framework, key paths, patterns, schemas, edge cases) and implementation-plan.md (goals, current problems, architecture, files to create/modify, phases, verification). These become reference documentation for all subsequent sprint phases.

- **Document edge case handling matrix in sprint context**: Complex commands need to handle edge cases gracefully, and all sprint phases should handle them consistently. Create an "Edge Cases to Handle" matrix in _shared-context.md mapping each edge case to its expected response. Include cases like empty input, no content, mechanical tasks, all-filtered results, and duplicates.

- **Structure sprint implementation as creation phases before refactoring**: Refactoring existing code while simultaneously creating new dependencies can lead to broken intermediate states. Order sprint phases so all new components (skills, subagents) are created and tested individually before refactoring the existing command that depends on them. This ensures the refactored command can immediately use validated components.

- **Sprint workflows read from main repo and write to worktree paths**: Sprint workflows in worktree environments must handle two path contexts: 1) Worktree-local paths for current sprint artifacts, modified plugin files, test outputs, 2) Main repo paths for historical sprint data, shared configuration, reference transcripts. Commands should accept absolute paths for inputs (allowing main repo references) while writing outputs to relative paths (landing in current worktree). Preflight checks use CWD-relative paths for targets but accept absolute paths for source data.

- **Sprint tooling phase validates docs match implementation**: After implementing feature changes (like removing depends-on), documentation, commands, and skills need to be reviewed for consistency. Stale references can remain in unrelated files. During sprint tooling phase: 1) Identify affected plugin, 2) Review all commands and skills for stale references using grep/rg, 3) Check that documentation examples match current implementation, 4) Update SKILL.md files to remove deprecated feature references (id, depends-on, parallel execution sections).

- **Version bump must check both committed and uncommitted plugin changes**: When determining which plugin to version bump in a sprint worktree, checking only `git diff main..HEAD` misses uncommitted changes that are part of the sprint work. Example: Branch named `sprint/extract-command-refactor` suggests m42-signs work, but `git diff main..HEAD` only shows m42-sprint commits. The actual m42-signs changes are uncommitted. For comprehensive version bump determination: 1) Check committed changes with `git diff main..HEAD --name-only | grep "^plugins/"`, 2) Check uncommitted changes with `git status --short | grep "plugins/"`, 3) Take union of both results to identify all affected plugins needing version bumps.

- **Phase-2 documentation delegates to parallel Task subagents**: The phase-2_documentation workflow uses the operator pattern - it reads sprint context files (_shared-context.md, implementation-plan.md), analyzes git diff to identify changed files, then spawns multiple parallel Task subagents (one per documentation category: getting-started, user-guide, reference). Each subagent independently updates its assigned documentation and commits changes. This enables parallel processing of independent documentation updates while the coordinator aggregates results into a summary artifact.

- **Sprint context files guide documentation phase strategy**: The documentation phase depends on preflight-created context files to understand what changed and why. It reads _shared-context.md and implementation-plan.md to get the "why" (goals, architecture decisions), then uses git diff against main branch to get the "what" (specific file changes). Combining context + diff enables intelligent documentation updates that explain both the changes and their rationale.

- **Documentation phase creates summary artifact for audit trail**: After subagents complete documentation updates, the phase-2 coordinator creates `artifacts/docs-summary.md` containing: changes analyzed (git diff summary), updates made (grouped by category), commits created (with messages), files modified (with line counts), files NOT changed (with rationale explaining why they were intentionally skipped), and verification checklist. This artifact provides complete transparency into what was updated and why, preventing future confusion about intentional non-changes.

- **Large-scale documentation cleanup requires thorough grep verification**: Removing deprecated features from documentation requires multiple grep passes to ensure completeness. Pattern: 1) Grep for feature name and variations, 2) Read all matches to understand context, 3) Edit files to remove deprecated sections, 4) Grep again for related terms to catch indirect references, 5) Document in summary artifact which files were intentionally NOT changed (e.g., files mentioning "parallel execution" for worktree feature vs removed depends-on feature). Statistics help scope the effort: track files edited, total lines removed per category, and commits created.

- **Distinguish between similar feature names when cleaning documentation**: Some codebases have multiple features with similar names serving different purposes (e.g., "depends-on" step-level dependencies vs "worktree-based parallel execution"). When removing one, grep patterns will match both. Solution: 1) Explicitly identify all similarly-named features upfront, 2) Use targeted edit patterns that remove only the deprecated feature, 3) Verify retained documentation with follow-up greps, 4) Document the distinction in summary artifact's "Files NOT Changed" section. This prevents accidental removal of active feature documentation.

- **Distinguish parallel execution contexts in feature removal**: When removing features with overloaded terminology (like "parallel", "dependency"), create a disambiguation map of legitimate vs deprecated contexts before executing removals. For example, when removing deprecated `depends-on` feature: "parallel sprint execution" refers to worktree isolation (keep), "parallel execution in workflows" means phase-level parallelism (keep), "step dependencies via depends-on" is the deprecated feature (remove). Use this map during grep/search to avoid false positives and preserve correct documentation. This prevents accidentally removing documentation for active features that share similar terminology with the deprecated feature.

## Signs

### Write progress to disk AFTER marking parallel steps as in-progress
**Problem**: When executing parallel steps, the status page doesn't show steps transitioning to `in-progress` - they jump directly from `pending` to `completed`. This happens because in executeParallelStep (loop.ts:~1180), the progress is written to disk BEFORE marking ready steps as `in-progress`. The sequence was: 1. Write progress to disk (line 1379) 2. Mark steps as in-progress (in-memory only, line 1180) 3. Execute steps 4. Mark steps as completed and write progress. Result: Status page never sees the in-progress state.

**Solution**: Update the progress object to mark steps as `in-progress` (with `started-at` timestamp) BEFORE writing to disk: 1. For each ready step, mark as `in-progress` in progress.phases[phaseId].steps[stepIndex] 2. If step has sub-phases, mark first sub-phase as `in-progress` 3. THEN write progress to disk 4. Execute the parallel steps. This ensures the status page sees state transitions in the correct order. File: plugins/m42-sprint/runtime/src/loop.ts lines 1372-1396

**Origin**: Extracted from session (Tool: Edit) [high confidence]

### ReadyStep references step by phaseId and stepIndex
**Problem**: When working with parallel execution in the sprint runtime, it's not obvious how ReadyStep objects relate to the progress data structure. The ReadyStep interface (in scheduler.ts) only has `id`, `phaseId`, and `stepIndex` - but how do you use these to access the actual step data?

**Solution**: ReadyStep provides indexes into the progress structure:

- ReadyStep.phaseId: Index into progress.phases array
- ReadyStep.stepIndex: Index into progress.phases[phaseId].steps array
- Access step: progress.phases[readyStep.phaseId].steps[readyStep.stepIndex]

Example:
```typescript
readySteps.forEach(readyStep => {
  const step = progress.phases[readyStep.phaseId].steps[readyStep.stepIndex];
  step.status = 'in-progress';
  step['started-at'] = new Date().toISOString();
});
```

Files:
- plugins/m42-sprint/runtime/src/scheduler.ts (ReadyStep interface)
- plugins/m42-sprint/runtime/src/loop.ts (usage)

**Origin**: Extracted from session (Tool: Read) [high confidence]

### Build runtime after TypeScript changes to loop.ts
**Problem**: After making TypeScript changes to files in plugins/m42-sprint/runtime/src/, the sprint loop may use old compiled JavaScript if you don't rebuild. Error pattern: "tsc: not found" when running `npm run build` in the runtime directory.

**Solution**: Always run the build command from the plugin ROOT directory (plugins/m42-sprint/), not the runtime subdirectory:

```bash
cd plugins/m42-sprint
npm run build
```

The sprint loop executes the compiled JavaScript in plugins/m42-sprint/runtime/dist/, so TypeScript changes in src/ won't take effect until compilation.

Alternative: Use the npm workspace command from repo root:
```bash
npm run build -w @m42/sprint-runtime
```

**Origin**: Extracted from session (Tool: Bash) [high confidence]
