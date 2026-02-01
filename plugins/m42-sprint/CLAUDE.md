# Claude Code Configuration - m42-sprint

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
