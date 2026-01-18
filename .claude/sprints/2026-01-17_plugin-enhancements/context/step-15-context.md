# Step Context: step-15

## Task
Phase 5 - Step 1: Enhanced Connection Status with Reconnection Info

Show reconnection attempt count and countdown timer when disconnected.

Requirements:
- Track reconnection attempt number
- Show countdown timer to next reconnection attempt
- Display format: "Reconnecting in 5s... (attempt 3/10)"
- Add visual indicator (pulsing dot, color change) for connection state
- Show toast when connection is restored
- Max 10 reconnection attempts before showing "Connection lost" with manual retry

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts

## Related Code Patterns

### Current SSE Connection Logic (page.ts:3181-3254)
```typescript
// SSE Connection
function connect() {
  updateConnectionStatus('connecting');

  eventSource = new EventSource('/events');

  eventSource.onopen = function() {
    reconnectAttempts = 0;
    updateConnectionStatus('connected');
  };

  eventSource.onerror = function() {
    eventSource.close();
    updateConnectionStatus('disconnected');
    scheduleReconnect();
  };
  // ... event listeners
}

function scheduleReconnect() {
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
  setTimeout(connect, delay);
}

function updateConnectionStatus(status) {
  const dot = elements.connectionStatus.querySelector('.status-dot');
  const text = elements.connectionStatus.querySelector('.status-text');

  dot.className = 'status-dot ' + status;

  switch (status) {
    case 'connected':
      text.textContent = 'Connected';
      break;
    case 'connecting':
      text.textContent = 'Connecting...';
      break;
    case 'disconnected':
      text.textContent = 'Disconnected - Reconnecting...';
      break;
  }
}
```

### State Variables (page.ts:2139-2141)
```typescript
let eventSource = null;
let reconnectAttempts = 0;
const maxReconnectDelay = 30000;
```

### Connection Status HTML (page.ts:160-163)
```html
<div class="connection-status" id="connection-status">
  <span class="status-dot disconnected"></span>
  <span class="status-text">Connecting...</span>
</div>
```

### Connection Status CSS (page.ts:1219-1245)
```css
.connection-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.connected {
  background-color: var(--accent-green);
}

.status-dot.disconnected {
  background-color: var(--accent-red);
}

.status-dot.connecting {
  background-color: var(--accent-yellow);
  animation: pulse 1s infinite;
}
```

### Toast Pattern (page.ts:3033-3053)
```typescript
function showToast(type, message) {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;

  const icon = type === 'success' ? '✓' : '✕';
  toast.innerHTML = '<span class="toast-icon">' + icon + '</span>' +
    '<span class="toast-message">' + escapeHtml(message) + '</span>' +
    '<button class="toast-close">×</button>';
  // ... close button and auto-remove
}
```

### Existing Pulse Animation (page.ts:688-691)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

## Required Imports
### Internal
- None - all code is inline JavaScript within `getScript()` function

### External
- None - no new dependencies required

## Types/Interfaces to Use
No TypeScript interfaces needed - this is vanilla JavaScript embedded in template literals.

## Integration Points
- **State location**: Add new variables near `reconnectAttempts` (line 2140)
- **Functions modified**:
  - `scheduleReconnect()` - add countdown timer logic
  - `updateConnectionStatus()` - enhanced display with attempt info
- **New functions needed**:
  - `startCountdownTimer()` - manage countdown interval
  - `clearCountdownTimer()` - cleanup interval
  - `manualReconnect()` - retry after max attempts exhausted
- **CSS additions**:
  - `.status-dot.connection-lost` style
  - `.connection-retry-btn` style
  - Potentially update `.connection-status` for retry button

## Implementation Notes

1. **New constants to add:**
   - `const MAX_RECONNECT_ATTEMPTS = 10;` or `const maxReconnectAttempts = 10;`

2. **New state variables to add:**
   - `let reconnectCountdown = 0;` - current countdown seconds
   - `let countdownTimer = null;` - interval ID for countdown

3. **Countdown timer logic:**
   - When `scheduleReconnect()` is called, calculate delay in seconds
   - Start interval that decrements countdown every second
   - Update status text with format: "Reconnecting in Xs... (attempt N/10)"
   - Clear interval when connection succeeds or max attempts reached

4. **Max attempts handling:**
   - Check `reconnectAttempts >= MAX_RECONNECT_ATTEMPTS` in `scheduleReconnect()`
   - If exhausted, show "Connection lost" with manual retry button
   - Add `connection-lost` status state

5. **Toast on reconnection:**
   - In `eventSource.onopen`, check if `reconnectAttempts > 0` before resetting
   - If was reconnecting, call `showToast('success', 'Connection restored')`

6. **HTML modifications:**
   - May need to add retry button element to connection-status div
   - Or create button dynamically when needed

7. **CSS for connection-lost state:**
   - Red pulsing dot similar to disconnected
   - Style for retry button matching existing button patterns

8. **Gherkin verification commands from step-15-gherkin.md:**
   - `MAX_RECONNECT_ATTEMPTS` or `maxReconnectAttempts = 10`
   - `reconnectCountdown` or `countdownTimer` or `reconnectTimer`
   - `attempt.*\/` pattern for attempt counter
   - `Reconnecting in.*s` pattern for countdown
   - `Connection lost` or `connection-lost`
   - `manualReconnect` or `retry-btn` or `retryConnection`
   - `showToast.*success.*[cC]onnect`
