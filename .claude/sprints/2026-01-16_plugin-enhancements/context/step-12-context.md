# Step Context: step-12

## Task
Track D - Step 5: Implement Improved Error Recovery

Add automatic retry with backoff and smart failure detection.

Requirements:
- Implement automatic retry with configurable exponential backoff (1s, 5s, 30s)
- Add retry configuration to SPRINT.yaml
- Classify errors into categories (network, rate-limit, timeout, validation, logic)
- Implement recovery strategies per error type
- Preserve partial completion on failure
- Add "intervention queue" for unrecoverable errors
- Display retry status in phase cards (attempt 2/3, next retry in Xs)
- Add manual "Force Retry" button that bypasses backoff

## Related Code Patterns

### Similar Implementation: sprint-loop.sh (Existing Retry Logic)
```bash
# File: plugins/m42-sprint/scripts/sprint-loop.sh:267-291
# Helper function to handle phase failure with retry logic
handle_phase_failure() {
  local exit_code="$1"
  local error_output="$2"
  local phase_path=$(get_current_phase_path)

  # Get current retry count
  local retry_count=$(yq -r "$phase_path.\"retry-count\" // 0" "$PROGRESS_FILE")

  if [[ "$retry_count" -lt "$MAX_RETRIES" ]]; then
    # Increment retry count and keep status as in-progress for retry
    local new_retry_count=$((retry_count + 1))
    echo "Phase failed (attempt $new_retry_count/$((MAX_RETRIES + 1))). Retrying..."
    yq -i "$phase_path.\"retry-count\" = $new_retry_count" "$PROGRESS_FILE"
    yq -i "$phase_path.error = \"Exit code: $exit_code - $error_output\"" "$PROGRESS_FILE"
    return 0  # Continue loop for retry
  else
    # Max retries exhausted, mark as blocked
    echo "Phase failed after $((retry_count + 1)) attempt(s). Marking as blocked."
    yq -i "$phase_path.status = \"blocked\"" "$PROGRESS_FILE"
    yq -i "$phase_path.error = \"Exit code: $exit_code - $error_output (retries exhausted)\"" "$PROGRESS_FILE"
    yq -i '.status = "blocked"' "$PROGRESS_FILE"
    return 1  # Signal to exit loop
  fi
}
```

### Similar Implementation: page.ts (Phase Action Buttons)
```typescript
// File: plugins/m42-sprint/compiler/src/status-server/page.ts
// Phase action buttons for skip/retry
// Skip button: visible for blocked, in-progress, or pending (stuck phases)
if (node.status === 'blocked' || node.status === 'in-progress' || node.status === 'pending') {
  html += '<button class="phase-action-btn skip-btn" data-phase-id="' + escapeHtml(phaseId) + '" title="Skip this phase">Skip</button>';
}

// Retry button: visible for failed phases
if (node.status === 'failed') {
  html += '<button class="phase-action-btn retry-btn" data-phase-id="' + escapeHtml(phaseId) + '" title="Retry this phase">Retry</button>';
}
```

### Similar Implementation: server.ts (API Retry Endpoint)
```typescript
// File: plugins/m42-sprint/compiler/src/status-server/server.ts:774-842
// Handle POST /api/retry/:phaseId request
// Resets the specified phase to "pending" for re-execution
private handleRetryRequest(res: http.ServerResponse, phaseId: string): void {
  // ... validation ...
  // Reset to pending
  targetItem.status = 'pending' as PhaseStatus;
  // Clear error field and timing but preserve partial work
  delete targetItem.error;
  // Increment retry count
  targetItem['retry-count'] = (targetItem['retry-count'] || 0) + 1;
  // Set the current pointer to this phase for re-execution
  this.setPointerToPhase(progress, location);
}
```

## Required Imports
### Internal
- `types.ts`: `PhaseStatus`, `SprintStatus`, `CompiledPhase`, `CompiledStep`, `CompiledTopPhase`
- `status-types.ts`: `LogEntry`, `SSEEventType`

### External
- No new external packages needed

## Types/Interfaces to Use

### From types.ts (extend for retry config)
```typescript
// Current SprintDefinition - needs retry config
export interface SprintDefinition {
  workflow: string;
  steps: SprintStep[];
  'sprint-id'?: string;
  name?: string;
  config?: {
    'max-tasks'?: number;
    'time-box'?: string;
    'auto-commit'?: boolean;
  };
  // NEW: Add retry configuration
  retry?: RetryConfig;
}

// NEW: Retry configuration interface
export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number[];
  retryOn: ErrorCategory[];
}

// NEW: Error category type
export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';
```

### From CompiledPhase (already has retry-count)
```typescript
export interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
  error?: string;
  'retry-count'?: number;  // Already exists
  // NEW: Add retry state
  'next-retry-at'?: string;
  'error-category'?: ErrorCategory;
}
```

## Integration Points
- **Called by**: `sprint-loop.sh` (bash script invokes error classification)
- **Calls**: Nothing - pure classification logic
- **Tests**: Create `error-classifier.test.ts` alongside `error-classifier.ts`

### File Locations
- New file: `plugins/m42-sprint/compiler/src/error-classifier.ts`
- Modify: `plugins/m42-sprint/scripts/sprint-loop.sh`
- Modify: `plugins/m42-sprint/compiler/src/types.ts` (add RetryConfig, ErrorCategory)
- Modify: `plugins/m42-sprint/compiler/src/status-server/page.ts` (add Force Retry button, retry status display)

## Implementation Notes

### Error Classification Logic
Error classification should analyze:
1. Exit code patterns
2. Error message content
3. API response codes (429 for rate-limit)

```typescript
// Patterns to match for each category
const errorPatterns = {
  network: [/ECONNREFUSED/, /ETIMEDOUT/, /ENOTFOUND/, /DNS/i, /connection/i],
  'rate-limit': [/429/, /rate.*limit/i, /too many requests/i, /throttl/i],
  timeout: [/timeout/i, /timed out/i, /exceeded.*time/i],
  validation: [/invalid/i, /schema/i, /validation/i, /required.*field/i],
  logic: [/error/i]  // Default fallback
};
```

### Backoff Implementation in Bash
```bash
# Read backoff array from SPRINT.yaml or use defaults
BACKOFF_MS=(1000 5000 30000)

# Calculate delay for current retry
get_backoff_delay() {
  local retry_count=$1
  local index=$((retry_count - 1))
  if [[ $index -ge ${#BACKOFF_MS[@]} ]]; then
    index=$((${#BACKOFF_MS[@]} - 1))
  fi
  echo "${BACKOFF_MS[$index]}"
}

# Apply backoff before retry
apply_backoff() {
  local delay_ms=$1
  local delay_s=$((delay_ms / 1000))
  echo "Waiting ${delay_s}s before retry..."
  sleep "$delay_s"
}
```

### Intervention Queue
For non-retryable errors (validation, logic), store in a JSONL file:
```bash
# File: $SPRINT_DIR/intervention-queue.jsonl
echo "{\"phaseId\":\"$PHASE_ID\",\"error\":\"$ERROR\",\"category\":\"$CATEGORY\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> "$SPRINT_DIR/intervention-queue.jsonl"
```

### Force Retry Signal File Pattern
Follow existing signal file pattern from server.ts:
```typescript
// Create .force-retry-requested signal with phase ID
const signalPath = path.join(this.config.sprintDir, '.force-retry-requested');
fs.writeFileSync(signalPath, JSON.stringify({ phaseId, timestamp: new Date().toISOString() }));
```

### Status Page UI Updates
Add retry status display in phase card rendering:
```javascript
// In renderTreeNode function, add retry status
if (node['retry-count'] && node['retry-count'] > 0) {
  html += '<span class="retry-status">Attempt ' + (node['retry-count'] + 1) + '/' + maxAttempts + '</span>';
}
if (node['next-retry-at']) {
  const countdownSec = Math.max(0, Math.floor((new Date(node['next-retry-at']) - Date.now()) / 1000));
  html += '<span class="retry-countdown">Next retry in ' + countdownSec + 's</span>';
}
```

### Force Retry Button
Add alongside existing Retry button but only when waiting for backoff:
```javascript
// Force retry button: visible when phase is in backoff wait
if (node.status === 'in-progress' && node['next-retry-at']) {
  html += '<button class="phase-action-btn force-retry-btn" data-phase-id="' + escapeHtml(phaseId) + '" title="Force immediate retry">Force Retry</button>';
}
```

## Verification Commands (from gherkin)
```bash
# Scenario 1: Error classifier exists
test -f plugins/m42-sprint/compiler/src/error-classifier.ts

# Scenario 2: All error categories defined
grep -q "network\|rate-limit\|timeout\|validation\|logic" plugins/m42-sprint/compiler/src/error-classifier.ts

# Scenario 4: Backoff in sprint-loop
grep -qE "backoff|BACKOFF" plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 8: TypeScript compiles
cd plugins/m42-sprint/compiler && npm run build
```
