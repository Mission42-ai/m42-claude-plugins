# Claude Code Configuration - m42-sprint/runtime

## Learnings

- **Mark steps in-progress BEFORE writeProgressAtomic for parallel execution visibility**: When running parallel steps, if you mark them in-progress after writing to disk, the status page never sees the in-progress state. Steps appear to jump from pending directly to completed. This happens because parallel step execution is async - by the time the status page reads PROGRESS.yaml, the step might already be done. Solution: In the parallel execution loop (runtime/src/loop.ts ~lines 1372-1384): (1) Mark all ready steps as in-progress in the progress data structure, (2) Write progress to disk via writeProgressAtomic, (3) THEN start executing the parallel steps. This ensures status watchers see the in-progress state before execution completes.
