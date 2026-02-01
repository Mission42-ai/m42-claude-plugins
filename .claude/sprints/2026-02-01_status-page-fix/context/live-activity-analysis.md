# Fix: Live Activity Hiding Relevant Information

## Problem

The live activity panel hides important information that users need to understand what the agent is doing:

1. **Agent text output is NOT CAPTURED in non-streaming mode** - The transcription watcher ignores text blocks entirely!
2. **TaskUpdate shows no detail** - "Updated task list" gives no indication of what changed
3. **Too much noise at "basic" level** - Every file read/edit/grep clutters the view, obscuring the meaningful activity

## Root Cause Discovery

Looking at actual transcription logs (e.g., `phase-1_step-0_execute.log`), agents **do** output conversational text between tool calls:

```
"I'll analyze the design documents and implementation plan to understand the full scope of this task."
"Now let me read the existing files that need to be modified to understand the current structure."
"Good. I now have a clear understanding of the existing code. Now I need to..."
```

But in `transcription-watcher.ts` lines 289-301, the non-streaming format handler:
- Loops through `message.content` array
- **Only extracts `tool_use` blocks** (line 293: `if (block.type === 'tool_use')`)
- **Completely ignores `text` blocks!**

This means agent reasoning is captured in the logs but **never converted to ActivityEvents**.

## Current Behavior Analysis

### Verbosity Level Assignments (`transcription-watcher.ts` lines 41-56)

| Level | Tools |
|-------|-------|
| `minimal` | TodoWrite, AskUserQuestion |
| `basic` | Read, Write, Edit, Glob, Grep |
| `detailed` | Everything else (Bash, Task, WebFetch, etc.) |

### Tool Descriptions (`page.ts` lines 5468-5495)

| Tool | Current Description |
|------|---------------------|
| `TodoWrite` | "Updated task list" (no detail) |
| `TaskUpdate` | Falls through to default - just shows "TaskUpdate" |
| `TaskList` | Falls through to default - just shows "TaskList" |

### Assistant Events

Assistant text events are assigned `level: 'minimal'` (line 424 in `transcription-watcher.ts`), which SHOULD make them visible at basic level. However:
- They only emit after text streaming completes (`block.stopped = true`)
- The rendering may not differentiate thinking vs final output clearly

## Desired Behavior for "Basic" Level

The default "basic" view should show what matters to monitor progress:

1. **Agent thinking and output** (already minimal, but needs prominence)
2. **Task list changes WITH DETAILS** about what was created/updated/completed
3. **Major actions**: Task delegation, user questions, final outputs
4. **NOT**: Individual file reads, searches, edits (move to detailed)

## Solution

### Part 0: Fix Text Block Extraction (CRITICAL)

**File: `plugins/m42-sprint/compiler/src/status-server/transcription-watcher.ts`**

In `parseLine()` (lines 289-301), add text block extraction for non-streaming format:

```typescript
// Format 1: Assistant message with tool_use and text in content array
if (event.type === 'assistant' && event.message?.content) {
  const content = event.message.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'tool_use' && block.id && block.name) {
        toolUses.push({
          id: block.id,
          name: block.name,
          input: block.input || {},
        });
      }
      // NEW: Extract text blocks (agent's reasoning/output)
      if (block.type === 'text' && block.text) {
        const textEvent: ActivityEvent = {
          ts: timestamp,
          type: 'assistant',
          tool: '',
          level: 'minimal',
          text: block.text,
          isThinking: false, // Non-streaming = complete message
        };
        this.addToRecentActivity(textEvent);
        this.emit('activity', textEvent);
      }
    }
  }
}
```

This is the critical fix - without it, agent text output is completely invisible.

### Part 1: Improve Task Tool Descriptions

**File: `plugins/m42-sprint/compiler/src/status-server/page.ts`**

In `getToolDescription()` (lines 5468-5495), add cases for task tools:

```javascript
case 'TaskCreate':
  return params ? 'Creating task: ' + params : 'Creating task';
case 'TaskUpdate':
  return params ? 'Task: ' + params : 'Updating task';
case 'TaskList':
  return 'Checking tasks';
case 'TaskGet':
  return params ? 'Getting task: ' + params : 'Getting task';
```

**File: `plugins/m42-sprint/compiler/src/status-server/transcription-watcher.ts`**

In `extractParams()` (lines 81-92), add extraction for task tools:

```typescript
case 'TaskCreate':
  return input.subject as string | undefined;
case 'TaskUpdate':
  // Format: "completed: <subject>" or "in_progress: <subject>" etc.
  const status = input.status as string | undefined;
  const subject = input.subject as string | undefined;
  if (status && subject) return status + ': ' + subject;
  if (status) return status;
  if (subject) return subject;
  return undefined;
case 'TaskGet':
  return input.taskId as string | undefined;
```

### Part 2: Reclassify Verbosity Levels

**File: `plugins/m42-sprint/compiler/src/status-server/transcription-watcher.ts`**

Modify `getToolVerbosityLevel()` (lines 41-56):

```typescript
function getToolVerbosityLevel(toolName: string): VerbosityLevel {
  // Minimal: Agent communication and task tracking (the important stuff)
  const minimalTools = ['TodoWrite', 'AskUserQuestion', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'Task', 'Skill'];
  if (minimalTools.includes(toolName)) {
    return 'minimal';
  }

  // Basic: File operations that users might care about
  const basicTools = ['Write', 'Edit', 'Bash'];
  if (basicTools.includes(toolName)) {
    return 'basic';
  }

  // Detailed: Everything else (reads, searches, etc.)
  return 'detailed';
}
```

This changes:
- Task tools → `minimal` (always visible)
- `Task`, `Skill` → `minimal` (agent delegation is important)
- `Read`, `Glob`, `Grep` → `detailed` (noise at basic level)
- `Write`, `Edit`, `Bash` → `basic` (actual changes/commands)

### Part 3: Enhance Assistant Event Display

**File: `plugins/m42-sprint/compiler/src/status-server/page.ts`**

In `renderLiveActivity()` (lines 5520-5546), give assistant events more prominence:

```javascript
// Handle assistant events (chat bubble style)
if (event.type === 'assistant') {
  const text = event.text || '';
  const thinkingClass = event.isThinking ? ' activity-thinking' : '';
  const bubbleClass = event.isThinking ? 'activity-bubble-thinking' : 'activity-bubble-final';
  return '<div class="activity-entry activity-assistant' + thinkingClass + '">' +
    '<span class="activity-time" title="' + escapeHtml(fullDateTime) + '">' + escapeHtml(timeStr) + '</span>' +
    '<span class="activity-icon">' + (event.isThinking ? '💭' : '💬') + '</span>' +
    '<span class="' + bubbleClass + '">' + escapeHtml(text) + '</span>' +
    '</div>';
}
```

Add CSS for final output prominence (in the CSS section):

```css
.activity-bubble-final {
  color: var(--text-primary);
  font-weight: 500;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.activity-bubble-thinking {
  color: var(--text-secondary);
  font-style: italic;
}
```

## Files to Modify

| File | Change |
|------|--------|
| `plugins/m42-sprint/compiler/src/status-server/page.ts` | Add task tool descriptions, enhance assistant display |
| `plugins/m42-sprint/compiler/src/status-server/transcription-watcher.ts` | Add task param extraction, reclassify verbosity levels |

## Verification

1. Start a sprint and open status page at "basic" verbosity (default)
2. Verify agent thinking/output is visible and prominent
3. Verify TaskCreate/TaskUpdate show meaningful descriptions (e.g., "Creating task: Fix bug X", "completed: Fix bug X")
4. Verify file reads and searches are NOT shown at basic level
5. Switch to "detailed" to verify those operations are still visible there
6. Verify "minimal" still works for milestones only
