# Bug Priority - Dashboard Bug Fixes

## Priority Order

### Critical Issues (Fix First)
None

### High Priority (3 bugs)
1. **BUG-003**: Live Activity Always Shows "Waiting for activity"
   - **Why High**: Core feature completely broken, affects visibility into sprint progress
   - **Impact**: Users cannot see real-time activity, making debugging difficult
   - **Dependencies**: None

2. **BUG-001**: Sprint Steps Show No Progress Indicators
   - **Why High**: Major usability issue, makes it hard to track progress
   - **Impact**: Users cannot tell at a glance what's done, in-progress, or pending
   - **Dependencies**: None

3. **BUG-007**: Steps/Substeps Missing Duration and Clickable Logs
   - **Why High**: Critical for discoverability and debugging
   - **Impact**: Users cannot see how long steps took or access logs easily
   - **Dependencies**: None

### Medium Priority (4 bugs)
4. **BUG-002**: Worktree Filter Shows No Sprints
   - **Why Medium**: Filtering broken but workaround exists (use "All Worktrees")
   - **Impact**: Multi-worktree users affected
   - **Dependencies**: None

5. **BUG-006**: Total Sprint Duration Not Displayed
   - **Why Medium**: Useful information missing but not blocking
   - **Impact**: Users don't have quick overview of sprint timing
   - **Dependencies**: None

6. **BUG-004**: Performance Metrics Cluttered and Uninformative
   - **Why Medium**: Polish issue, metrics exist but need improvement
   - **Impact**: Metrics less useful than they could be
   - **Dependencies**: None

7. **BUG-005**: Completed Sprint Triggers Completion Sound
   - **Why Medium**: Annoying but not breaking functionality
   - **Impact**: Unnecessary sound notifications
   - **Dependencies**: None

## Recommended Fix Order

1. BUG-003 (Live Activity)
2. BUG-001 (Progress Indicators)
3. BUG-007 (Duration + Clickable Logs)
4. BUG-002 (Worktree Filter)
5. BUG-006 (Total Duration)
6. BUG-004 (Metrics Polish)
7. BUG-005 (Sound Notification)

## Bug Clusters

### Cluster 1: Visual Feedback (BUG-001, BUG-007)
Both involve improving visual indicators and information display for steps.

### Cluster 2: Timing Information (BUG-006, BUG-007)
Both involve displaying duration/timing information.

### Cluster 3: Data Display Issues (BUG-003, BUG-004)
Both involve displaying dynamic data from files or calculations.

## Deferred Bugs
None - all bugs should be fixed in this sprint.
