# Step Context: step-0

## Task
Track A - Step 1: Add API Endpoints for Status Page Controls

Add pause/resume/stop control API endpoints to the status server.

Requirements:
- Add POST /api/pause endpoint that creates .pause-requested signal file
- Add POST /api/resume endpoint that creates .resume-requested signal file
- Add POST /api/stop endpoint that creates .stop-requested signal file
- Add GET /api/controls endpoint that returns available actions based on current sprint state
- Signal files should be created in the sprint directory
- Endpoints should read current PROGRESS.yaml to determine valid actions
- Return appropriate HTTP status codes and JSON responses

Files to modify:
- plugins/m42-sprint/compiler/src/status-server/server.ts

## Related Code Patterns

### Similar Implementation: Status API Request Handler (server.ts:239-258)
```typescript
/**
 * Handle JSON API request
 */
private handleAPIRequest(res: http.ServerResponse): void {
  try {
    const progress = this.loadProgress();
    const statusUpdate = toStatusUpdate(progress, true);

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify(statusUpdate, null, 2));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Failed to load progress',
        message: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
```

### Similar Implementation: Request Router (server.ts:157-191)
```typescript
private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = req.url || '/';

  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  switch (url) {
    case '/':
      this.handlePageRequest(res);
      break;
    case '/events':
      this.handleSSERequest(req, res);
      break;
    case '/api/status':
      this.handleAPIRequest(res);
      break;
    default:
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
  }
}
```

### Similar Implementation: Progress Loading (server.ts:318-327)
```typescript
private loadProgress(): CompiledProgress {
  const content = fs.readFileSync(this.progressFilePath, 'utf-8');
  const progress = yaml.load(content) as CompiledProgress;

  if (!progress || typeof progress !== 'object') {
    throw new Error('Invalid PROGRESS.yaml format');
  }

  return progress;
}
```

## Required Imports
### Internal
- Already imported: `fs`, `path` - for file system operations
- Already imported: `CompiledProgress` from `./status-types.js` - for progress data type

### External
- Already imported: `http` - for request/response handling
- Already imported: `js-yaml` as `yaml` - for YAML parsing (if needed)

No new imports required - all necessary modules are already imported in server.ts.

## Types/Interfaces to Use
```typescript
// From status-types.ts - SprintStatus (re-exported from types.ts)
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

// New interface for controls response (to be defined)
interface ControlsResponse {
  sprintStatus: SprintStatus;
  availableActions: Array<'pause' | 'resume' | 'stop'>;
}

// New interface for action response (to be defined)
interface ActionResponse {
  success: boolean;
  action: 'pause' | 'resume' | 'stop';
  message: string;
}
```

## Integration Points
- **Called by**: Frontend status page (via HTTP/fetch), command-line tools
- **Calls**: `this.loadProgress()` to get current sprint state, `fs.writeFileSync()` to create signal files
- **Tests**: No existing tests for server.ts; gherkin scenarios serve as acceptance tests

## Signal Files Pattern (from _shared-context.md)
The sprint loop uses signal files for control:
- `.pause-requested` - Request pause after current task
- `.resume-requested` - Resume paused sprint
- `.stop-requested` - Stop sprint execution

Signal files should be created in `this.config.sprintDir`.

## Sprint Status State Machine
Based on sprint-loop.sh behavior:
- **Valid actions by status**:
  - `not-started`: none (sprint not running)
  - `in-progress`: pause, stop
  - `paused`: resume, stop
  - `completed`: none (sprint finished)
  - `blocked`: stop (may need human intervention)
  - `needs-human`: stop (requires human resolution)

## Implementation Notes

1. **CORS Update Required**: The current CORS settings only allow `GET, OPTIONS`. Must update to include `POST` for the control endpoints:
   ```typescript
   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
   ```

2. **Request Method Handling**: Current implementation returns 405 for non-GET requests. Need to refactor to allow POST for control endpoints:
   - Parse URL first
   - Check if it's a control endpoint
   - Allow POST for `/api/pause`, `/api/resume`, `/api/stop`
   - Allow GET for `/api/controls`

3. **Signal File Creation**: Use synchronous file operations to keep it simple:
   ```typescript
   const signalPath = path.join(this.config.sprintDir, '.pause-requested');
   fs.writeFileSync(signalPath, new Date().toISOString());
   ```

4. **Available Actions Logic**:
   ```typescript
   function getAvailableActions(status: SprintStatus): Array<'pause' | 'resume' | 'stop'> {
     switch (status) {
       case 'in-progress':
         return ['pause', 'stop'];
       case 'paused':
         return ['resume', 'stop'];
       case 'blocked':
       case 'needs-human':
         return ['stop'];
       default:
         return [];
     }
   }
   ```

5. **Error Handling Pattern**: Follow the existing pattern of returning JSON error responses with appropriate HTTP status codes.

6. **Response Format**: Keep responses simple and consistent:
   ```json
   { "success": true, "action": "pause", "message": "Pause requested" }
   { "success": false, "action": "pause", "error": "Cannot pause - sprint is not running" }
   ```
