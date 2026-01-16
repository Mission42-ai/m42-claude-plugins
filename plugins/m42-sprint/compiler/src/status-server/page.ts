/**
 * HTML page generator for the Sprint Status Server
 * All CSS and JavaScript is embedded as template literals
 */

/**
 * Generate the complete HTML page for the status dashboard
 * @returns Complete HTML document as a string
 */
export function getPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprint Status</title>
  <style>
${getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-left">
        <h1 class="sprint-name" id="sprint-name">Loading...</h1>
        <span class="status-badge" id="status-badge">--</span>
      </div>
      <div class="header-right">
        <div class="iteration" id="iteration"></div>
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <span class="progress-text" id="progress-text">0%</span>
        </div>
        <div class="header-actions">
          <button class="header-download-btn" id="download-all-logs-btn" title="Download All Logs">⬇ All Logs</button>
        </div>
      </div>
    </header>

    <div class="control-bar" id="control-bar">
      <button class="control-btn" id="pause-btn" style="display: none;">
        <span class="control-btn-icon">⏸</span>
        <span>Pause</span>
      </button>
      <button class="control-btn" id="resume-btn" style="display: none;">
        <span class="control-btn-icon">▶</span>
        <span>Resume</span>
      </button>
      <button class="control-btn danger" id="stop-btn" style="display: none;">
        <span class="control-btn-icon">⏹</span>
        <span>Stop</span>
      </button>
    </div>

    <div class="main">
      <aside class="sidebar">
        <h2 class="sidebar-title">Phase Tree</h2>
        <div class="phase-tree" id="phase-tree">
          <div class="loading">Loading...</div>
        </div>
      </aside>

      <main class="content">
        <section class="current-task" id="current-task-section">
          <h2 class="section-title">Current Task</h2>
          <div class="task-content" id="current-task">
            <div class="no-task">No active task</div>
          </div>
        </section>

        <section class="live-activity" id="live-activity-section">
          <div class="section-header-row">
            <h2 class="section-title">Live Activity</h2>
            <div class="activity-controls">
              <select id="verbosity-select" class="verbosity-dropdown">
                <option value="minimal">Minimal</option>
                <option value="basic">Basic</option>
                <option value="detailed" selected>Detailed</option>
                <option value="verbose">Verbose</option>
              </select>
              <button class="clear-activity-btn" id="clear-activity-btn" title="Clear Activity">Clear</button>
              <button class="collapse-btn" id="collapse-activity-btn" title="Collapse/Expand">▼</button>
            </div>
          </div>
          <div class="live-activity-content" id="live-activity-content">
            <div class="activity-empty">Waiting for activity...</div>
          </div>
        </section>

        <section class="activity-feed">
          <h2 class="section-title">Activity Feed</h2>
          <div class="feed-content" id="activity-feed">
            <div class="feed-empty">Waiting for updates...</div>
          </div>
        </section>
      </main>
    </div>

    <footer class="footer">
      <div class="connection-status" id="connection-status">
        <span class="status-dot disconnected"></span>
        <span class="status-text">Connecting...</span>
      </div>
      <div class="elapsed" id="elapsed"></div>
    </footer>
  </div>

  <div class="modal-overlay" id="stop-confirm-modal">
    <div class="modal-content">
      <div class="modal-title">Stop Sprint</div>
      <div class="modal-warning">
        <span class="modal-warning-icon">⚠</span>
        <span class="modal-warning-text">
          This will stop the sprint immediately. Any incomplete work will be left in its current state.
          Are you sure you want to stop?
        </span>
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-cancel" id="stop-cancel-btn">Cancel</button>
        <button class="modal-btn modal-btn-confirm" id="stop-confirm-btn">Stop Sprint</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="skip-confirm-modal">
    <div class="modal-content">
      <div class="modal-title">Skip Phase</div>
      <div class="modal-warning">
        <span class="modal-warning-icon">⚠</span>
        <span class="modal-warning-text">
          Warning: Skipping this phase may result in incomplete work and potential data loss.
          Any progress in this phase will be abandoned. Are you sure you want to skip?
        </span>
      </div>
      <div class="modal-phase-info" id="skip-phase-info"></div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-cancel" id="skip-cancel-btn">Cancel</button>
        <button class="modal-btn modal-btn-confirm modal-btn-warning" id="skip-confirm-btn">Skip Phase</button>
      </div>
    </div>
  </div>

  <div class="toast-container" id="toast-container"></div>

  <div class="log-viewer-modal" id="log-viewer-modal">
    <div class="log-viewer-content">
      <div class="log-viewer-header">
        <span class="log-viewer-title" id="log-viewer-title">Phase Log</span>
        <div class="log-viewer-controls">
          <input type="text" class="log-search-input" id="log-search-input" placeholder="Search logs..." />
          <button class="log-download-btn" id="log-download-btn">Download Log</button>
          <button class="log-viewer-close" id="log-viewer-close">Close</button>
        </div>
      </div>
      <div class="log-viewer-body" id="log-viewer-body">
        <div class="log-loading">Loading log...</div>
      </div>
    </div>
  </div>

  <script>
${getScript()}
  </script>
</body>
</html>`;
}

/**
 * Generate the CSS styles for the status page
 */
function getStyles(): string {
  return `
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --bg-highlight: #30363d;
      --border-color: #30363d;
      --text-primary: #c9d1d9;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --accent-blue: #58a6ff;
      --accent-green: #3fb950;
      --accent-yellow: #d29922;
      --accent-red: #f85149;
      --accent-purple: #a371f7;
      --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--font-mono);
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-primary);
      background-color: var(--bg-primary);
      min-height: 100vh;
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-width: 100%;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sprint-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }

    .status-badge.pending { background-color: var(--bg-tertiary); color: var(--text-secondary); }
    .status-badge.in-progress { background-color: rgba(88, 166, 255, 0.15); color: var(--accent-blue); }
    .status-badge.completed { background-color: rgba(63, 185, 80, 0.15); color: var(--accent-green); }
    .status-badge.failed { background-color: rgba(248, 81, 73, 0.15); color: var(--accent-red); }
    .status-badge.blocked { background-color: rgba(210, 153, 34, 0.15); color: var(--accent-yellow); }

    .header-right {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .iteration {
      color: var(--text-secondary);
      font-size: 12px;
    }

    .progress-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .progress-bar {
      width: 150px;
      height: 6px;
      background-color: var(--bg-tertiary);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background-color: var(--accent-green);
      border-radius: 3px;
      transition: width 0.3s ease;
      width: 0%;
    }

    .progress-text {
      font-size: 12px;
      color: var(--text-secondary);
      min-width: 35px;
    }

    /* Main Layout */
    .main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* Sidebar */
    .sidebar {
      width: 320px;
      background-color: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
    }

    .sidebar-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      padding: 12px 16px 8px;
      border-bottom: 1px solid var(--border-color);
    }

    .phase-tree {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }

    .loading {
      color: var(--text-muted);
      padding: 16px;
      text-align: center;
    }

    /* Phase Tree Nodes */
    .tree-node {
      padding: 4px 12px 4px 0;
      cursor: default;
    }

    .tree-node-content {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .tree-node-content:hover {
      background-color: var(--bg-tertiary);
    }

    .tree-node-content.active {
      background-color: rgba(88, 166, 255, 0.1);
    }

    .tree-toggle {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .tree-toggle:hover {
      color: var(--text-secondary);
    }

    .tree-toggle.collapsed::before {
      content: '\\25B6';
      font-size: 8px;
    }

    .tree-toggle.expanded::before {
      content: '\\25BC';
      font-size: 8px;
    }

    .tree-toggle.leaf {
      visibility: hidden;
    }

    .tree-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }

    .tree-icon.pending { color: var(--text-muted); }
    .tree-icon.pending::before { content: '\\25CB'; }

    .tree-icon.in-progress { color: var(--accent-blue); }
    .tree-icon.in-progress::before { content: '\\25CF'; animation: pulse 1.5s infinite; }

    .tree-icon.completed { color: var(--accent-green); }
    .tree-icon.completed::before { content: '\\2713'; }

    .tree-icon.failed { color: var(--accent-red); }
    .tree-icon.failed::before { content: '\\2717'; }

    .tree-icon.blocked { color: var(--accent-yellow); }
    .tree-icon.blocked::before { content: '\\26A0'; }

    .tree-icon.skipped { color: var(--text-muted); }
    .tree-icon.skipped::before { content: '\\2014'; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .tree-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
    }

    .tree-elapsed {
      font-size: 10px;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .tree-children {
      margin-left: 16px;
    }

    .tree-children.collapsed {
      display: none;
    }

    /* Phase Action Buttons (Skip/Retry) */
    .tree-actions {
      display: none;
      gap: 4px;
      margin-left: auto;
      flex-shrink: 0;
    }

    .tree-node-content:hover .tree-actions {
      display: flex;
    }

    .phase-action-btn {
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid transparent;
      background-color: transparent;
    }

    .phase-action-btn.skip-btn {
      color: var(--accent-yellow);
    }

    .phase-action-btn.skip-btn:hover {
      background-color: rgba(210, 153, 34, 0.15);
      border-color: var(--accent-yellow);
    }

    .phase-action-btn.retry-btn {
      color: var(--accent-blue);
    }

    .phase-action-btn.retry-btn:hover {
      background-color: rgba(88, 166, 255, 0.15);
      border-color: var(--accent-blue);
    }

    .phase-action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .phase-action-btn.loading {
      position: relative;
      pointer-events: none;
    }

    /* Content Area */
    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      padding: 12px 16px 8px;
      border-bottom: 1px solid var(--border-color);
      background-color: var(--bg-secondary);
    }

    /* Current Task */
    .current-task {
      flex-shrink: 0;
      border-bottom: 1px solid var(--border-color);
    }

    .task-content {
      padding: 12px 16px;
      background-color: var(--bg-primary);
      max-height: 200px;
      overflow-y: auto;
    }

    .no-task {
      color: var(--text-muted);
      font-style: italic;
    }

    .task-path {
      color: var(--accent-blue);
      font-size: 12px;
      margin-bottom: 8px;
    }

    .task-prompt {
      color: var(--text-primary);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 120px;
      overflow-y: auto;
      padding: 8px;
      background-color: var(--bg-secondary);
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    .task-meta {
      display: flex;
      gap: 16px;
      margin-top: 8px;
      font-size: 11px;
      color: var(--text-secondary);
    }

    /* Activity Feed */
    .activity-feed {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .feed-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
      background-color: var(--bg-primary);
    }

    .feed-empty {
      color: var(--text-muted);
      padding: 16px;
      text-align: center;
      font-style: italic;
    }

    .feed-entry {
      display: flex;
      padding: 6px 16px;
      gap: 8px;
      font-size: 12px;
    }

    .feed-entry:hover {
      background-color: var(--bg-secondary);
    }

    .feed-time {
      color: var(--text-muted);
      flex-shrink: 0;
      width: 65px;
    }

    .feed-icon {
      width: 16px;
      flex-shrink: 0;
      text-align: center;
    }

    .feed-icon.info { color: var(--text-secondary); }
    .feed-icon.info::before { content: '\\2022'; }

    .feed-icon.start { color: var(--accent-blue); }
    .feed-icon.start::before { content: '\\25B6'; }

    .feed-icon.complete { color: var(--accent-green); }
    .feed-icon.complete::before { content: '\\2713'; }

    .feed-icon.error { color: var(--accent-red); }
    .feed-icon.error::before { content: '\\2717'; }

    .feed-icon.warning { color: var(--accent-yellow); }
    .feed-icon.warning::before { content: '\\26A0'; }

    .feed-icon.skip { color: var(--text-muted); }
    .feed-icon.skip::before { content: '\\2014'; }

    .feed-message {
      flex: 1;
      color: var(--text-primary);
      word-break: break-word;
    }

    /* Live Activity Panel */
    .live-activity {
      flex-shrink: 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      max-height: 300px;
      transition: max-height 0.2s ease;
    }

    .live-activity.collapsed {
      max-height: 36px;
      overflow: hidden;
    }

    .section-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .section-header-row .section-title {
      padding: 0;
      border: none;
      background: none;
    }

    .activity-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .verbosity-dropdown {
      padding: 4px 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 11px;
      cursor: pointer;
    }

    .verbosity-dropdown:hover {
      border-color: var(--text-muted);
    }

    .verbosity-dropdown:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .clear-activity-btn,
    .collapse-btn {
      padding: 4px 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--bg-tertiary);
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .clear-activity-btn:hover,
    .collapse-btn:hover {
      background-color: var(--bg-highlight);
      color: var(--text-primary);
      border-color: var(--text-muted);
    }

    .live-activity-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
      background-color: var(--bg-primary);
      min-height: 60px;
    }

    .activity-empty {
      color: var(--text-muted);
      padding: 16px;
      text-align: center;
      font-style: italic;
    }

    .activity-entry {
      display: flex;
      padding: 4px 16px;
      gap: 8px;
      font-size: 12px;
      align-items: flex-start;
    }

    .activity-entry:hover {
      background-color: var(--bg-secondary);
    }

    .activity-time {
      color: var(--text-muted);
      flex-shrink: 0;
      font-size: 11px;
      min-width: 55px;
      cursor: help;
    }

    .activity-icon {
      width: 18px;
      flex-shrink: 0;
      text-align: center;
      font-size: 13px;
    }

    .activity-tool {
      color: var(--accent-purple);
      font-weight: 500;
      flex-shrink: 0;
      min-width: 60px;
    }

    .activity-desc {
      flex: 1;
      color: var(--text-primary);
      word-break: break-word;
    }

    .activity-path {
      color: var(--accent-blue);
      max-width: 250px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: help;
    }

    .activity-params {
      color: var(--text-secondary);
      font-size: 11px;
    }

    /* Footer */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background-color: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      font-size: 11px;
      flex-shrink: 0;
    }

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

    .status-text {
      color: var(--text-secondary);
    }

    .elapsed {
      color: var(--text-muted);
    }

    /* Control Bar */
    .control-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 20px;
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .control-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .control-btn:hover:not(:disabled) {
      background-color: var(--bg-highlight);
      border-color: var(--text-muted);
    }

    .control-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .control-btn.loading {
      position: relative;
      pointer-events: none;
    }

    .control-btn.loading::after {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      margin-left: 6px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .control-btn.danger {
      border-color: var(--accent-red);
      color: var(--accent-red);
    }

    .control-btn.danger:hover:not(:disabled) {
      background-color: rgba(248, 81, 73, 0.15);
      border-color: var(--accent-red);
    }

    .control-btn-icon {
      font-size: 10px;
    }

    /* Confirmation Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .modal-overlay.visible {
      display: flex;
    }

    .modal-content {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 20px;
      max-width: 400px;
      width: 90%;
    }

    .modal-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    .modal-warning {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px;
      background-color: rgba(248, 81, 73, 0.1);
      border: 1px solid rgba(248, 81, 73, 0.3);
      border-radius: 6px;
      margin-bottom: 16px;
    }

    .modal-warning-icon {
      color: var(--accent-red);
      font-size: 16px;
      flex-shrink: 0;
    }

    .modal-warning-text {
      color: var(--text-primary);
      font-size: 12px;
      line-height: 1.5;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .modal-btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .modal-btn-cancel {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }

    .modal-btn-cancel:hover {
      background-color: var(--bg-highlight);
    }

    .modal-btn-confirm {
      background-color: var(--accent-red);
      border: 1px solid var(--accent-red);
      color: white;
    }

    .modal-btn-confirm:hover {
      background-color: #da3633;
    }

    .modal-btn-warning {
      background-color: var(--accent-yellow);
      border: 1px solid var(--accent-yellow);
      color: #0d1117;
    }

    .modal-btn-warning:hover {
      background-color: #b88a1b;
    }

    .modal-phase-info {
      padding: 8px 12px;
      background-color: var(--bg-tertiary);
      border-radius: 4px;
      margin-bottom: 16px;
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* Toast Notifications */
    .toast-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1001;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 12px;
      animation: slideIn 0.2s ease;
      max-width: 350px;
    }

    .toast.success {
      border-color: var(--accent-green);
    }

    .toast.error {
      border-color: var(--accent-red);
    }

    .toast-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .toast.success .toast-icon {
      color: var(--accent-green);
    }

    .toast.error .toast-icon {
      color: var(--accent-red);
    }

    .toast-message {
      color: var(--text-primary);
      flex: 1;
    }

    .toast-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0;
      font-size: 14px;
    }

    .toast-close:hover {
      color: var(--text-primary);
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    /* Log Viewer */
    .log-viewer-toggle {
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid transparent;
      background-color: transparent;
      color: var(--accent-purple);
    }

    .log-viewer-toggle:hover {
      background-color: rgba(163, 113, 247, 0.15);
      border-color: var(--accent-purple);
    }

    .log-viewer-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .log-viewer-modal.visible {
      display: flex;
    }

    .log-viewer-content {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      width: 90%;
      max-width: 1200px;
      height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .log-viewer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .log-viewer-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .log-viewer-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .log-search-input {
      padding: 6px 10px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 12px;
      width: 200px;
    }

    .log-search-input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .log-download-btn {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .log-download-btn:hover {
      background-color: var(--bg-highlight);
      border-color: var(--text-muted);
    }

    .log-viewer-close {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 12px;
      cursor: pointer;
    }

    .log-viewer-close:hover {
      background-color: var(--bg-highlight);
    }

    .log-viewer-body {
      flex: 1;
      overflow: auto;
      padding: 12px;
      background-color: var(--bg-primary);
    }

    .log-content-pre {
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
      color: var(--text-primary);
    }

    .log-content-pre .highlight {
      background-color: rgba(210, 153, 34, 0.3);
      border-radius: 2px;
      padding: 0 2px;
    }

    .log-loading {
      color: var(--text-muted);
      text-align: center;
      padding: 40px;
      font-style: italic;
    }

    .log-error {
      color: var(--accent-red);
      text-align: center;
      padding: 40px;
    }

    /* ANSI color code styles */
    .ansi-black { color: #6e7681; }
    .ansi-red { color: #f85149; }
    .ansi-green { color: #3fb950; }
    .ansi-yellow { color: #d29922; }
    .ansi-blue { color: #58a6ff; }
    .ansi-magenta { color: #a371f7; }
    .ansi-cyan { color: #56d4dd; }
    .ansi-white { color: #c9d1d9; }
    .ansi-bold { font-weight: bold; }
    .ansi-dim { opacity: 0.7; }

    /* Header download buttons */
    .header-actions {
      display: flex;
      gap: 8px;
      margin-left: 16px;
    }

    .header-download-btn {
      padding: 4px 10px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--bg-tertiary);
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .header-download-btn:hover {
      background-color: var(--bg-highlight);
      color: var(--text-primary);
      border-color: var(--text-muted);
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--bg-highlight);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted);
    }
  `;
}

/**
 * Generate the JavaScript for the status page
 */
function getScript(): string {
  return `
    (function() {
      'use strict';

      // DOM Elements
      const elements = {
        sprintName: document.getElementById('sprint-name'),
        statusBadge: document.getElementById('status-badge'),
        iteration: document.getElementById('iteration'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),
        phaseTree: document.getElementById('phase-tree'),
        currentTask: document.getElementById('current-task'),
        activityFeed: document.getElementById('activity-feed'),
        connectionStatus: document.getElementById('connection-status'),
        elapsed: document.getElementById('elapsed'),
        pauseBtn: document.getElementById('pause-btn'),
        resumeBtn: document.getElementById('resume-btn'),
        stopBtn: document.getElementById('stop-btn'),
        stopConfirmModal: document.getElementById('stop-confirm-modal'),
        stopCancelBtn: document.getElementById('stop-cancel-btn'),
        stopConfirmBtn: document.getElementById('stop-confirm-btn'),
        toastContainer: document.getElementById('toast-container'),
        liveActivitySection: document.getElementById('live-activity-section'),
        liveActivityContent: document.getElementById('live-activity-content'),
        verbositySelect: document.getElementById('verbosity-select'),
        clearActivityBtn: document.getElementById('clear-activity-btn'),
        collapseActivityBtn: document.getElementById('collapse-activity-btn'),
        skipConfirmModal: document.getElementById('skip-confirm-modal'),
        skipCancelBtn: document.getElementById('skip-cancel-btn'),
        skipConfirmBtn: document.getElementById('skip-confirm-btn'),
        skipPhaseInfo: document.getElementById('skip-phase-info'),
        logViewerModal: document.getElementById('log-viewer-modal'),
        logViewerTitle: document.getElementById('log-viewer-title'),
        logViewerBody: document.getElementById('log-viewer-body'),
        logViewerClose: document.getElementById('log-viewer-close'),
        logSearchInput: document.getElementById('log-search-input'),
        logDownloadBtn: document.getElementById('log-download-btn'),
        downloadAllLogsBtn: document.getElementById('download-all-logs-btn')
      };

      // State
      let eventSource = null;
      let reconnectAttempts = 0;
      const maxReconnectDelay = 30000;
      const activityLog = [];
      const maxLogEntries = 100;
      let expandedNodes = new Set();
      let currentSprintStatus = null;
      let isLoading = { pause: false, resume: false, stop: false };

      // Live Activity State
      const liveActivityLog = [];
      const MAX_ACTIVITY_ENTRIES = 100;
      let verbosityLevel = localStorage.getItem('verbosity') || 'detailed';
      let activityAutoScroll = true;
      let activityCollapsed = false;

      // Verbosity level ordering for filtering
      const VERBOSITY_ORDER = { minimal: 0, basic: 1, detailed: 2, verbose: 3 };

      // Phase action state
      let pendingSkipPhaseId = null;
      let phaseActionLoading = {};

      // Log viewer state
      let currentLogPhaseId = null;
      let currentLogContent = '';

      // ANSI escape code to HTML converter
      function ansiToHtml(text) {
        // Handle both \\x1b and \\033 escape sequences
        const ansiRegex = /\\x1b\\[(\\d+)m|\\033\\[(\\d+)m/g;
        let result = '';
        let lastIndex = 0;
        let currentSpan = null;

        // Map ANSI codes to CSS classes
        const ansiMap = {
          '0': null, // Reset
          '1': 'ansi-bold',
          '2': 'ansi-dim',
          '30': 'ansi-black',
          '31': 'ansi-red',
          '32': 'ansi-green',
          '33': 'ansi-yellow',
          '34': 'ansi-blue',
          '35': 'ansi-magenta',
          '36': 'ansi-cyan',
          '37': 'ansi-white',
          '90': 'ansi-black',  // Bright black
          '91': 'ansi-red',    // Bright red
          '92': 'ansi-green',  // Bright green
          '93': 'ansi-yellow', // Bright yellow
          '94': 'ansi-blue',   // Bright blue
          '95': 'ansi-magenta',// Bright magenta
          '96': 'ansi-cyan',   // Bright cyan
          '97': 'ansi-white'   // Bright white
        };

        let match;
        while ((match = ansiRegex.exec(text)) !== null) {
          // Add text before this escape sequence
          result += escapeHtml(text.slice(lastIndex, match.index));

          const code = match[1] || match[2];
          const cssClass = ansiMap[code];

          if (currentSpan) {
            result += '</span>';
            currentSpan = null;
          }

          if (cssClass) {
            result += '<span class="' + cssClass + '">';
            currentSpan = cssClass;
          }

          lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        result += escapeHtml(text.slice(lastIndex));

        // Close any open span
        if (currentSpan) {
          result += '</span>';
        }

        return result;
      }

      // Tool icons mapping
      const toolIcons = {
        Read: '📖',
        Write: '✏️',
        Edit: '📝',
        Bash: '⚡',
        Grep: '🔍',
        Glob: '📂',
        Task: '🔄',
        WebFetch: '🌐',
        WebSearch: '🔎',
        TodoWrite: '📋',
        TodoRead: '📋',
        AskUserQuestion: '❓',
        Skill: '🎯',
        default: '🔧'
      };

      // Initialize
      function init() {
        connect();
        setupControlButtons();
        setupLiveActivityControls();
        setupSkipModal();
        setupLogViewer();
        // Update elapsed time every second
        setInterval(updateElapsedTimes, 1000);
        // Update relative times in activity panel
        setInterval(updateActivityRelativeTimes, 1000);
      }

      // Log Viewer Setup
      function setupLogViewer() {
        elements.logViewerClose.addEventListener('click', hideLogViewer);
        elements.logDownloadBtn.addEventListener('click', downloadCurrentLog);
        elements.downloadAllLogsBtn.addEventListener('click', downloadAllLogs);
        elements.logSearchInput.addEventListener('input', handleLogSearch);

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && elements.logViewerModal.classList.contains('visible')) {
            hideLogViewer();
          }
        });

        // Close on backdrop click
        elements.logViewerModal.addEventListener('click', function(e) {
          if (e.target === elements.logViewerModal) {
            hideLogViewer();
          }
        });
      }

      function showLogViewer(phaseId) {
        currentLogPhaseId = phaseId;
        elements.logViewerTitle.textContent = 'Log: ' + phaseId;
        elements.logViewerBody.innerHTML = '<div class="log-loading">Loading log...</div>';
        elements.logSearchInput.value = '';
        elements.logViewerModal.classList.add('visible');

        fetchLogContent(phaseId);
      }

      function hideLogViewer() {
        elements.logViewerModal.classList.remove('visible');
        currentLogPhaseId = null;
        currentLogContent = '';
      }

      async function fetchLogContent(phaseId) {
        try {
          const response = await fetch('/api/logs/' + encodeURIComponent(phaseId));

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch log');
          }

          currentLogContent = await response.text();
          renderLogContent(currentLogContent);
        } catch (err) {
          elements.logViewerBody.innerHTML = '<div class="log-error">Error: ' + escapeHtml(err.message) + '</div>';
        }
      }

      function renderLogContent(content, searchTerm) {
        let html = ansiToHtml(content);

        // Apply search highlighting if search term is provided
        if (searchTerm && searchTerm.length > 0) {
          // Escape regex special characters in the search term
          var escapedTerm = escapeHtml(searchTerm).replace(/[.*+?^$\\{\\}()|\\[\\]\\\\]/g, '\\\\$&');
          var regex = new RegExp('(' + escapedTerm + ')', 'gi');
          html = html.replace(regex, '<span class="highlight">$1</span>');
        }

        elements.logViewerBody.innerHTML = '<pre class="log-content-pre">' + html + '</pre>';
      }

      function handleLogSearch() {
        const searchTerm = elements.logSearchInput.value;
        if (currentLogContent) {
          renderLogContent(currentLogContent, searchTerm);
        }
      }

      function downloadCurrentLog() {
        if (!currentLogPhaseId) return;
        window.location.href = '/api/logs/download/' + encodeURIComponent(currentLogPhaseId);
      }

      function downloadAllLogs() {
        window.location.href = '/api/logs/download-all';
      }

      function handleViewLogClick(e) {
        e.stopPropagation();
        var phaseId = e.target.dataset.phaseId;
        if (phaseId) {
          showLogViewer(phaseId);
        }
      }

      // Control Button Setup
      function setupControlButtons() {
        elements.pauseBtn.addEventListener('click', handlePauseClick);
        elements.resumeBtn.addEventListener('click', handleResumeClick);
        elements.stopBtn.addEventListener('click', handleStopClick);
        elements.stopCancelBtn.addEventListener('click', hideStopModal);
        elements.stopConfirmBtn.addEventListener('click', confirmStop);
      }

      async function handlePauseClick() {
        if (isLoading.pause) return;
        setLoading('pause', true);
        try {
          const response = await fetch('/api/pause', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          const result = await response.json();
          handleControlResponse('pause', result);
        } catch (err) {
          showToast('error', 'Failed to pause: ' + err.message);
        } finally {
          setLoading('pause', false);
        }
      }

      async function handleResumeClick() {
        if (isLoading.resume) return;
        setLoading('resume', true);
        try {
          const response = await fetch('/api/resume', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          const result = await response.json();
          handleControlResponse('resume', result);
        } catch (err) {
          showToast('error', 'Failed to resume: ' + err.message);
        } finally {
          setLoading('resume', false);
        }
      }

      function handleStopClick() {
        showStopModal();
      }

      function showStopModal() {
        elements.stopConfirmModal.classList.add('visible');
      }

      function hideStopModal() {
        elements.stopConfirmModal.classList.remove('visible');
      }

      async function confirmStop() {
        hideStopModal();
        if (isLoading.stop) return;
        setLoading('stop', true);
        try {
          const response = await fetch('/api/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          const result = await response.json();
          handleControlResponse('stop', result);
        } catch (err) {
          showToast('error', 'Failed to stop: ' + err.message);
        } finally {
          setLoading('stop', false);
        }
      }

      function handleControlResponse(action, result) {
        if (result.success) {
          showToast('success', result.message || (action.charAt(0).toUpperCase() + action.slice(1) + ' request sent'));
        } else {
          showToast('error', result.error || 'Failed to ' + action);
        }
      }

      function setLoading(action, loading) {
        isLoading[action] = loading;
        const btn = elements[action + 'Btn'];
        if (btn) {
          btn.disabled = loading;
          if (loading) {
            btn.classList.add('loading');
          } else {
            btn.classList.remove('loading');
          }
        }
      }

      function updateControlButtons(status) {
        currentSprintStatus = status;

        // Hide all buttons first
        elements.pauseBtn.style.display = 'none';
        elements.resumeBtn.style.display = 'none';
        elements.stopBtn.style.display = 'none';

        switch (status) {
          case 'in-progress':
            elements.pauseBtn.style.display = 'inline-flex';
            elements.stopBtn.style.display = 'inline-flex';
            break;
          case 'paused':
            elements.resumeBtn.style.display = 'inline-flex';
            elements.stopBtn.style.display = 'inline-flex';
            break;
          case 'blocked':
          case 'needs-human':
            elements.stopBtn.style.display = 'inline-flex';
            break;
        }
      }

      // Toast Notifications
      function showToast(type, message) {
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;

        const icon = type === 'success' ? '✓' : '✕';
        toast.innerHTML = '<span class="toast-icon">' + icon + '</span>' +
          '<span class="toast-message">' + escapeHtml(message) + '</span>' +
          '<button class="toast-close">×</button>';

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', function() {
          removeToast(toast);
        });

        elements.toastContainer.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(function() {
          removeToast(toast);
        }, 5000);
      }

      function removeToast(toast) {
        if (!toast.parentNode) return;
        toast.style.animation = 'slideOut 0.2s ease forwards';
        setTimeout(function() {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 200);
      }

      // Skip Modal Functions
      function setupSkipModal() {
        elements.skipCancelBtn.addEventListener('click', hideSkipModal);
        elements.skipConfirmBtn.addEventListener('click', confirmSkipPhase);
      }

      function showSkipModal(phaseId) {
        pendingSkipPhaseId = phaseId;
        elements.skipPhaseInfo.textContent = 'Phase: ' + phaseId;
        elements.skipConfirmModal.classList.add('visible');
      }

      function hideSkipModal() {
        elements.skipConfirmModal.classList.remove('visible');
        pendingSkipPhaseId = null;
      }

      async function confirmSkipPhase() {
        if (!pendingSkipPhaseId) return;
        hideSkipModal();
        await skipPhase(pendingSkipPhaseId);
      }

      // Phase Action Functions (Skip/Retry)
      async function skipPhase(phaseId) {
        if (phaseActionLoading[phaseId]) return;
        phaseActionLoading[phaseId] = true;

        try {
          const response = await fetch('/api/skip/' + encodeURIComponent(phaseId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const result = await response.json();

          if (result.success) {
            showToast('success', result.message || 'Phase skipped');
          } else {
            showToast('error', result.error || 'Failed to skip phase');
          }
        } catch (err) {
          showToast('error', 'Failed to skip phase: ' + err.message);
        } finally {
          phaseActionLoading[phaseId] = false;
        }
      }

      async function retryPhase(phaseId) {
        if (phaseActionLoading[phaseId]) return;
        phaseActionLoading[phaseId] = true;

        try {
          const response = await fetch('/api/retry/' + encodeURIComponent(phaseId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const result = await response.json();

          if (result.success) {
            showToast('success', result.message || 'Phase queued for retry');
          } else {
            showToast('error', result.error || 'Failed to retry phase');
          }
        } catch (err) {
          showToast('error', 'Failed to retry phase: ' + err.message);
        } finally {
          phaseActionLoading[phaseId] = false;
        }
      }

      function handleSkipClick(e) {
        e.stopPropagation();
        var phaseId = e.target.dataset.phaseId;
        if (phaseId) {
          showSkipModal(phaseId);
        }
      }

      function handleRetryClick(e) {
        e.stopPropagation();
        var phaseId = e.target.dataset.phaseId;
        if (phaseId) {
          retryPhase(phaseId);
        }
      }

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

        eventSource.addEventListener('status-update', function(e) {
          try {
            const event = JSON.parse(e.data);
            handleStatusUpdate(event.data);
          } catch (err) {
            console.error('Failed to parse status update:', err);
          }
        });

        eventSource.addEventListener('log-entry', function(e) {
          try {
            const event = JSON.parse(e.data);
            handleLogEntry(event.data);
          } catch (err) {
            console.error('Failed to parse log entry:', err);
          }
        });

        eventSource.addEventListener('keep-alive', function() {
          // Keep-alive received, connection is healthy
        });

        eventSource.addEventListener('activity-event', function(e) {
          try {
            const event = JSON.parse(e.data);
            handleActivityEvent(event.data);
          } catch (err) {
            console.error('Failed to parse activity event:', err);
          }
        });
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

      // Status Update Handler
      function handleStatusUpdate(update) {
        updateHeader(update.header);
        updatePhaseTree(update.phaseTree);
        updateCurrentTask(update.currentTask);
      }

      function updateHeader(header) {
        elements.sprintName.textContent = header.sprintId;

        elements.statusBadge.textContent = header.status;
        elements.statusBadge.className = 'status-badge ' + header.status;

        elements.progressFill.style.width = header.progressPercent + '%';
        elements.progressText.textContent = header.progressPercent + '%';

        if (header.currentIteration && header.maxIterations) {
          elements.iteration.textContent = 'Iteration ' + header.currentIteration + '/' + header.maxIterations;
        } else if (header.currentIteration) {
          elements.iteration.textContent = 'Iteration ' + header.currentIteration;
        } else {
          elements.iteration.textContent = '';
        }

        if (header.startedAt) {
          elements.elapsed.dataset.startedAt = header.startedAt;
        }

        // Update control buttons based on sprint status
        updateControlButtons(header.status);
      }

      function updatePhaseTree(phaseTree) {
        if (!phaseTree || phaseTree.length === 0) {
          elements.phaseTree.innerHTML = '<div class="loading">No phases</div>';
          return;
        }

        const html = phaseTree.map(node => renderTreeNode(node)).join('');
        elements.phaseTree.innerHTML = html;

        // Add click handlers for toggles
        elements.phaseTree.querySelectorAll('.tree-toggle').forEach(toggle => {
          toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const nodeId = this.dataset.nodeId;
            const children = this.closest('.tree-node').querySelector('.tree-children');

            if (children) {
              if (expandedNodes.has(nodeId)) {
                expandedNodes.delete(nodeId);
                children.classList.add('collapsed');
                this.classList.remove('expanded');
                this.classList.add('collapsed');
              } else {
                expandedNodes.add(nodeId);
                children.classList.remove('collapsed');
                this.classList.remove('collapsed');
                this.classList.add('expanded');
              }
            }
          });
        });

        // Add click handlers for skip buttons
        elements.phaseTree.querySelectorAll('.skip-btn').forEach(btn => {
          btn.addEventListener('click', handleSkipClick);
        });

        // Add click handlers for retry buttons
        elements.phaseTree.querySelectorAll('.retry-btn').forEach(btn => {
          btn.addEventListener('click', handleRetryClick);
        });

        // Add click handlers for view log buttons
        elements.phaseTree.querySelectorAll('.log-viewer-toggle').forEach(btn => {
          btn.addEventListener('click', handleViewLogClick);
        });
      }

      function renderTreeNode(node, parentPath = '') {
        const nodePath = parentPath ? parentPath + '/' + node.id : node.id;
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.has(nodePath) || node.status === 'in-progress' || hasActiveChild(node);
        const isActive = node.status === 'in-progress';

        // Auto-expand active nodes
        if (isActive && !expandedNodes.has(nodePath)) {
          expandedNodes.add(nodePath);
        }

        const depth = (parentPath.match(/\\//g) || []).length;
        const indent = depth * 16;

        // Build phaseId for API calls (use ' > ' separator)
        const phaseId = parentPath ? parentPath.replace(/\\//g, ' > ') + ' > ' + node.id : node.id;

        let html = '<div class="tree-node" style="padding-left: ' + indent + 'px">';
        html += '<div class="tree-node-content' + (isActive ? ' active' : '') + '">';

        if (hasChildren) {
          html += '<span class="tree-toggle ' + (isExpanded ? 'expanded' : 'collapsed') + '" data-node-id="' + nodePath + '"></span>';
        } else {
          html += '<span class="tree-toggle leaf"></span>';
        }

        html += '<span class="tree-icon ' + node.status + '"></span>';
        html += '<span class="tree-label" title="' + escapeHtml(node.label) + '">' + escapeHtml(node.label) + '</span>';

        if (node.elapsed) {
          html += '<span class="tree-elapsed">' + node.elapsed + '</span>';
        }

        // Add skip/retry/view-log action buttons based on status
        html += '<span class="tree-actions">';

        // View Log button: visible for completed or in-progress phases (leaf nodes only)
        if (!hasChildren && (node.status === 'completed' || node.status === 'in-progress')) {
          html += '<button class="log-viewer-toggle" data-phase-id="' + escapeHtml(phaseId) + '" title="View Log">View Log</button>';
        }

        // Skip button: visible for blocked, in-progress, or pending (stuck phases)
        if (node.status === 'blocked' || node.status === 'in-progress' || node.status === 'pending') {
          html += '<button class="phase-action-btn skip-btn" data-phase-id="' + escapeHtml(phaseId) + '" title="Skip this phase">Skip</button>';
        }

        // Retry button: visible for failed phases
        if (node.status === 'failed') {
          html += '<button class="phase-action-btn retry-btn" data-phase-id="' + escapeHtml(phaseId) + '" title="Retry this phase">Retry</button>';
        }

        html += '</span>';

        html += '</div>';

        if (hasChildren) {
          html += '<div class="tree-children' + (isExpanded ? '' : ' collapsed') + '">';
          html += node.children.map(child => renderTreeNode(child, nodePath)).join('');
          html += '</div>';
        }

        html += '</div>';
        return html;
      }

      function hasActiveChild(node) {
        if (!node.children) return false;
        return node.children.some(child =>
          child.status === 'in-progress' || hasActiveChild(child)
        );
      }

      function updateCurrentTask(task) {
        if (!task) {
          elements.currentTask.innerHTML = '<div class="no-task">No active task</div>';
          return;
        }

        let html = '<div class="task-path">' + escapeHtml(task.path) + '</div>';

        // Truncate prompt for display
        const promptPreview = task.prompt.length > 500
          ? task.prompt.substring(0, 500) + '...'
          : task.prompt;

        html += '<div class="task-prompt">' + escapeHtml(promptPreview) + '</div>';
        html += '<div class="task-meta">';

        if (task.startedAt) {
          html += '<span data-started-at="' + task.startedAt + '">Started: ' + formatTime(task.startedAt) + '</span>';
        }

        if (task.elapsed) {
          html += '<span class="task-elapsed">Elapsed: ' + task.elapsed + '</span>';
        }

        html += '</div>';

        elements.currentTask.innerHTML = html;
      }

      // Log Entry Handler
      function handleLogEntry(entry) {
        activityLog.unshift(entry);

        // Trim to max entries
        if (activityLog.length > maxLogEntries) {
          activityLog.pop();
        }

        renderActivityFeed();
      }

      function renderActivityFeed() {
        if (activityLog.length === 0) {
          elements.activityFeed.innerHTML = '<div class="feed-empty">Waiting for updates...</div>';
          return;
        }

        const html = activityLog.map(entry => {
          return '<div class="feed-entry">' +
            '<span class="feed-time">' + formatTime(entry.timestamp) + '</span>' +
            '<span class="feed-icon ' + entry.type + '"></span>' +
            '<span class="feed-message">' + escapeHtml(entry.message) + '</span>' +
            '</div>';
        }).join('');

        elements.activityFeed.innerHTML = html;
      }

      // Live Activity Functions
      function setupLiveActivityControls() {
        // Restore verbosity from localStorage
        if (verbosityLevel && elements.verbositySelect) {
          elements.verbositySelect.value = verbosityLevel;
        }

        // Verbosity change handler
        elements.verbositySelect.addEventListener('change', function() {
          verbosityLevel = this.value;
          localStorage.setItem('verbosity', verbosityLevel);
          renderLiveActivity();
        });

        // Clear activity button
        elements.clearActivityBtn.addEventListener('click', function() {
          liveActivityLog.length = 0;
          renderLiveActivity();
        });

        // Collapse toggle button
        elements.collapseActivityBtn.addEventListener('click', function() {
          activityCollapsed = !activityCollapsed;
          if (activityCollapsed) {
            elements.liveActivitySection.classList.add('collapsed');
            this.textContent = '▶';
          } else {
            elements.liveActivitySection.classList.remove('collapsed');
            this.textContent = '▼';
          }
        });

        // Scroll lock detection
        elements.liveActivityContent.addEventListener('scroll', function() {
          const el = this;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
          activityAutoScroll = atBottom;
        });
      }

      function handleActivityEvent(event) {
        // Add to log
        liveActivityLog.unshift(event);

        // Trim to max entries
        if (liveActivityLog.length > MAX_ACTIVITY_ENTRIES) {
          liveActivityLog.pop();
        }

        renderLiveActivity();
      }

      function shouldShowActivityEvent(eventLevel) {
        return VERBOSITY_ORDER[eventLevel] <= VERBOSITY_ORDER[verbosityLevel];
      }

      function getToolIcon(toolName) {
        return toolIcons[toolName] || toolIcons.default;
      }

      function formatRelativeTime(isoString) {
        const now = Date.now();
        const then = new Date(isoString).getTime();
        const diff = Math.floor((now - then) / 1000);

        if (diff < 5) return 'just now';
        if (diff < 60) return diff + 's ago';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        return Math.floor(diff / 3600) + 'h ago';
      }

      function truncatePath(filePath, maxLength) {
        maxLength = maxLength || 40;
        if (!filePath || filePath.length <= maxLength) return filePath;
        const parts = filePath.split('/');
        const fileName = parts.pop();
        const remaining = maxLength - fileName.length - 3;
        if (remaining <= 0) return '...' + fileName.slice(-(maxLength - 3));
        return filePath.slice(0, remaining) + '...' + fileName;
      }

      function renderLiveActivity() {
        // Filter by verbosity
        const filtered = liveActivityLog.filter(function(event) {
          return shouldShowActivityEvent(event.level);
        });

        if (filtered.length === 0) {
          elements.liveActivityContent.innerHTML = '<div class="activity-empty">Waiting for activity...</div>';
          return;
        }

        const html = filtered.map(function(event) {
          const icon = getToolIcon(event.tool);
          const relTime = formatRelativeTime(event.ts);
          const absTime = new Date(event.ts).toLocaleString();

          let desc = '';
          if (event.file) {
            const truncated = truncatePath(event.file);
            desc = '<span class="activity-path" title="' + escapeHtml(event.file) + '">' + escapeHtml(truncated) + '</span>';
          }
          if (event.params) {
            desc += (desc ? ' ' : '') + '<span class="activity-params">' + escapeHtml(event.params) + '</span>';
          }
          if (!desc) {
            desc = '<span class="activity-desc">-</span>';
          }

          return '<div class="activity-entry">' +
            '<span class="activity-time" title="' + escapeHtml(absTime) + '">' + escapeHtml(relTime) + '</span>' +
            '<span class="activity-icon">' + icon + '</span>' +
            '<span class="activity-tool">' + escapeHtml(event.tool) + '</span>' +
            '<span class="activity-desc">' + desc + '</span>' +
            '</div>';
        }).join('');

        const wasAtBottom = activityAutoScroll;
        elements.liveActivityContent.innerHTML = html;

        // Auto-scroll to top (newest entries are at top)
        if (wasAtBottom) {
          elements.liveActivityContent.scrollTop = 0;
        }
      }

      function updateActivityRelativeTimes() {
        // Update relative times for visible activity entries
        const entries = elements.liveActivityContent.querySelectorAll('.activity-time');
        const filtered = liveActivityLog.filter(function(event) {
          return shouldShowActivityEvent(event.level);
        });

        entries.forEach(function(el, index) {
          if (filtered[index]) {
            const relTime = formatRelativeTime(filtered[index].ts);
            const absTime = new Date(filtered[index].ts).toLocaleString();
            el.textContent = relTime;
            el.title = absTime;
          }
        });
      }

      // Utilities
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      function formatTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }

      function formatElapsed(ms) {
        if (ms < 0) return '0s';

        const seconds = Math.floor(ms / 1000) % 60;
        const minutes = Math.floor(ms / (1000 * 60)) % 60;
        const hours = Math.floor(ms / (1000 * 60 * 60));

        if (hours > 0) {
          return hours + 'h ' + minutes + 'm';
        }
        if (minutes > 0) {
          return minutes + 'm ' + seconds + 's';
        }
        return seconds + 's';
      }

      function updateElapsedTimes() {
        // Update footer elapsed time
        const startedAt = elements.elapsed.dataset.startedAt;
        if (startedAt) {
          const elapsed = Date.now() - new Date(startedAt).getTime();
          elements.elapsed.textContent = 'Total: ' + formatElapsed(elapsed);
        }
      }

      // Start the application
      init();
    })();
  `;
}
