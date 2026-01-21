"use strict";
/**
 * Operator Queue Page Generator
 * Generates HTML page for viewing and managing operator requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPriorityBadge = renderPriorityBadge;
exports.renderReasoningBlock = renderReasoningBlock;
exports.renderActionButtons = renderActionButtons;
exports.renderPendingRequestCard = renderPendingRequestCard;
exports.renderPendingRequestsSection = renderPendingRequestsSection;
exports.renderDecisionHistorySection = renderDecisionHistorySection;
exports.renderBacklogSection = renderBacklogSection;
exports.renderQueueStats = renderQueueStats;
exports.renderOperatorNavBadge = renderOperatorNavBadge;
exports.generateOperatorQueuePage = generateOperatorQueuePage;
const operator_queue_transforms_js_1 = require("./operator-queue-transforms.js");
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
    if (str == null)
        return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// ============================================================================
// Constants
// ============================================================================
/** CSS classes for priority badges */
const PRIORITY_CLASSES = {
    critical: 'priority-critical danger',
    high: 'priority-high',
    medium: 'priority-medium',
    low: 'priority-low',
};
/** Status icons for decision history */
const STATUS_ICONS = {
    approved: '✅',
    rejected: '❌',
    deferred: '⏸️',
};
// ============================================================================
// Priority Badge Component
// ============================================================================
/**
 * Render a priority badge with appropriate color
 */
function renderPriorityBadge(priority) {
    const colorClass = PRIORITY_CLASSES[priority] ?? 'priority-low';
    return `<span class="priority-badge ${colorClass}">${priority.toUpperCase()}</span>`;
}
// ============================================================================
// Reasoning Block Component
// ============================================================================
/**
 * Render a collapsible reasoning block
 */
function renderReasoningBlock(reasoning) {
    return `
    <details class="reasoning-block collapsible">
      <summary class="reasoning-header">Operator Reasoning</summary>
      <div class="reasoning-content">${escapeHtml(reasoning)}</div>
    </details>`;
}
// ============================================================================
// Action Buttons Component
// ============================================================================
/**
 * Render action buttons for a pending request
 */
function renderActionButtons(requestId) {
    return `
    <div class="action-buttons">
      <button class="btn btn-approve" data-action="approve" data-request-id="${escapeHtml(requestId)}">Approve</button>
      <button class="btn btn-reject" data-action="reject" data-request-id="${escapeHtml(requestId)}">Reject</button>
      <button class="btn btn-defer" data-action="defer" data-request-id="${escapeHtml(requestId)}">Defer</button>
    </div>`;
}
// ============================================================================
// Pending Request Card Component
// ============================================================================
/**
 * Render a single pending request card with all details
 */
function renderPendingRequestCard(request) {
    const relativeTime = (0, operator_queue_transforms_js_1.formatRelativeTime)(request['created-at']);
    const files = request.context?.relatedFiles ?? [];
    const suggestedWorkflow = request.context?.suggestedWorkflow;
    return `
    <div class="request-card pending-card" data-request-id="${escapeHtml(request.id)}">
      <div class="request-header">
        ${renderPriorityBadge(request.priority)}
        <span class="request-title">${escapeHtml(request.title)}</span>
      </div>
      <div class="request-meta">
        <span class="discovered-in">Discovered in: ${escapeHtml(request['discovered-in'])}</span>
        <span class="created-at">${relativeTime}</span>
      </div>
      ${files.length > 0 ? `<div class="request-files">Files: ${files.map(f => escapeHtml(f)).join(', ')}</div>` : ''}
      <details class="description-block collapsible">
        <summary>Description</summary>
        <div class="description-content">${escapeHtml(request.description)}</div>
      </details>
      ${suggestedWorkflow ? `<div class="suggested-workflow">Suggested: ${escapeHtml(suggestedWorkflow)}</div>` : ''}
      ${renderActionButtons(request.id)}
    </div>`;
}
// ============================================================================
// Pending Requests Section
// ============================================================================
/**
 * Render the pending requests section
 */
function renderPendingRequestsSection(requests) {
    if (requests.length === 0) {
        return `
      <section class="queue-section pending-section">
        <div class="section-header">
          <h2>Pending Requests (0)</h2>
        </div>
        <div class="empty-state">
          <span class="empty-icon">✓</span>
          <span class="empty-message">No pending requests</span>
        </div>
      </section>`;
    }
    const cards = requests.map(r => renderPendingRequestCard(r)).join('');
    return `
    <section class="queue-section pending-section">
      <div class="section-header">
        <h2>Pending Requests (${requests.length})</h2>
        <button class="btn btn-secondary" id="process-all-btn">Process All</button>
      </div>
      <div class="request-list">
        ${cards}
      </div>
    </section>`;
}
// ============================================================================
// Decision History Card Component
// ============================================================================
/**
 * Get status icon for a decision
 */
function getStatusIcon(status) {
    return STATUS_ICONS[status] ?? '🔔';
}
/**
 * Render a single decision history card
 */
function renderDecisionCard(request) {
    const relativeTime = request['decided-at']
        ? (0, operator_queue_transforms_js_1.formatRelativeTime)(request['decided-at'])
        : 'unknown';
    const statusClass = request.status;
    const statusLabel = request.status.toUpperCase();
    const reasoning = request.decision?.reasoning ?? '';
    let extraInfo = '';
    if (request.status === 'approved' && request.decision?.injection) {
        extraInfo = `<div class="injected-after">Injected after: ${escapeHtml(request['discovered-in'])}</div>`;
    }
    if (request.status === 'deferred' && request['deferred-until']) {
        extraInfo = `<div class="deferred-until">Deferred until: ${escapeHtml(request['deferred-until'])}</div>`;
    }
    return `
    <div class="request-card history-card ${statusClass}" data-request-id="${escapeHtml(request.id)}">
      <div class="request-header">
        <span class="status-icon">${getStatusIcon(request.status)}</span>
        <span class="status-label ${statusClass}">${statusLabel}</span>
        <span class="request-title">${escapeHtml(request.title)}</span>
      </div>
      <div class="request-meta">
        <span class="decided-at">Decided: ${relativeTime}</span>
        ${extraInfo}
      </div>
      ${reasoning ? renderReasoningBlock(reasoning) : ''}
    </div>`;
}
// ============================================================================
// Decision History Section
// ============================================================================
/** History filter dropdown HTML */
const HISTORY_FILTER_CONTROLS = `
  <div class="filter-controls">
    <select id="history-filter" class="filter-select">
      <option value="all">All</option>
      <option value="approved">Approved</option>
      <option value="rejected">Rejected</option>
      <option value="deferred">Deferred</option>
    </select>
  </div>`;
/**
 * Render the decision history section with filter controls
 */
function renderDecisionHistorySection(history) {
    const content = history.length === 0
        ? `<div class="empty-state">
        <span class="empty-icon">📋</span>
        <span class="empty-message">No decisions yet</span>
      </div>`
        : `<div class="request-list" id="history-list">
        ${history.map(r => renderDecisionCard(r)).join('')}
      </div>`;
    return `
    <section class="queue-section history-section">
      <div class="section-header">
        <h2>Decision History</h2>
        ${HISTORY_FILTER_CONTROLS}
      </div>
      ${content}
    </section>`;
}
// ============================================================================
// Backlog Item Card Component
// ============================================================================
/**
 * Render a single backlog item card
 */
function renderBacklogItemCard(item) {
    const relativeTime = (0, operator_queue_transforms_js_1.formatRelativeTime)(item['created-at']);
    const statusClass = item.status;
    return `
    <div class="request-card backlog-card ${statusClass}" data-item-id="${escapeHtml(item.id)}">
      <div class="request-header">
        <span class="backlog-icon">📌</span>
        <span class="status-label">BACKLOG</span>
        <span class="request-title">${escapeHtml(item.title)}</span>
      </div>
      <div class="request-meta">
        <span class="category">Category: ${escapeHtml(item.category)}</span>
        <span class="suggested-priority">Suggested Priority: ${escapeHtml(item['suggested-priority'])}</span>
        <span class="created-at">Added: ${relativeTime}</span>
      </div>
      <details class="notes-block collapsible">
        <summary>Operator Notes</summary>
        <div class="notes-content">${escapeHtml(item['operator-notes'])}</div>
      </details>
      <div class="backlog-status">Status: ${escapeHtml(item.status)}</div>
      <div class="action-buttons backlog-actions">
        <button class="btn btn-primary" data-action="create-issue" data-item-id="${escapeHtml(item.id)}">Create Issue</button>
        ${item.status !== 'acknowledged' ? `<button class="btn btn-secondary" data-action="acknowledge" data-item-id="${escapeHtml(item.id)}">Acknowledge</button>` : ''}
        <button class="btn btn-danger" data-action="delete" data-item-id="${escapeHtml(item.id)}">Delete</button>
      </div>
    </div>`;
}
// ============================================================================
// Backlog Section
// ============================================================================
/**
 * Render the backlog section
 */
function renderBacklogSection(backlog) {
    const header = `
    <div class="backlog-notice">
      Items in backlog will <strong>NOT</strong> be auto-implemented. Review and convert to GitHub issues or add to future sprints manually.
    </div>`;
    if (backlog.length === 0) {
        return `
      <section class="queue-section backlog-section">
        <div class="section-header">
          <h2>Backlog (For Human Review)</h2>
          <button class="btn btn-secondary" id="export-csv-btn">Export CSV</button>
        </div>
        ${header}
        <div class="empty-state">
          <span class="empty-icon">📝</span>
          <span class="empty-message">No backlog items</span>
        </div>
      </section>`;
    }
    const cards = backlog.map(item => renderBacklogItemCard(item)).join('');
    return `
    <section class="queue-section backlog-section">
      <div class="section-header">
        <h2>Backlog (For Human Review)</h2>
        <button class="btn btn-secondary" id="export-csv-btn">Export CSV</button>
      </div>
      ${header}
      <div class="request-list">
        ${cards}
      </div>
    </section>`;
}
// ============================================================================
// Queue Stats Component
// ============================================================================
/**
 * Render queue statistics summary bar
 */
function renderQueueStats(stats) {
    return `
    <div class="queue-stats">
      <div class="stat-item pending">
        <span class="stat-label">Pending</span>
        <span class="stat-value">${stats.pending}</span>
      </div>
      <div class="stat-item approved">
        <span class="stat-label">Approved</span>
        <span class="stat-value">${stats.approved}</span>
      </div>
      <div class="stat-item rejected">
        <span class="stat-label">Rejected</span>
        <span class="stat-value">${stats.rejected}</span>
      </div>
      <div class="stat-item deferred">
        <span class="stat-label">Deferred</span>
        <span class="stat-value">${stats.deferred}</span>
      </div>
      <div class="stat-item backlog">
        <span class="stat-label">Backlog</span>
        <span class="stat-value">${stats.backlog}</span>
      </div>
    </div>`;
}
// ============================================================================
// Navigation Badge Component
// ============================================================================
/**
 * Render navigation badge with pending count
 */
function renderOperatorNavBadge(pendingCount) {
    if (pendingCount === 0) {
        return `<span class="nav-item">Operator</span>`;
    }
    return `<span class="nav-item">Operator <span class="badge">${pendingCount}</span></span>`;
}
// ============================================================================
// CSS Styles
// ============================================================================
function getOperatorQueueStyles() {
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
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    /* Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 24px;
    }

    .page-title {
      font-size: 20px;
      font-weight: 600;
    }

    .back-link {
      color: var(--accent-blue);
      text-decoration: none;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    /* Queue Stats */
    .queue-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .stat-item {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px 20px;
      text-align: center;
      min-width: 100px;
    }

    .stat-label {
      display: block;
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .stat-value {
      display: block;
      font-size: 24px;
      font-weight: 600;
    }

    .stat-item.pending .stat-value { color: var(--accent-blue); }
    .stat-item.approved .stat-value { color: var(--accent-green); }
    .stat-item.rejected .stat-value { color: var(--accent-red); }
    .stat-item.deferred .stat-value { color: var(--accent-yellow); }
    .stat-item.backlog .stat-value { color: var(--text-secondary); }

    /* Sections */
    .queue-section {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 24px;
      overflow: hidden;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background-color: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
    }

    .section-header h2 {
      font-size: 16px;
      font-weight: 600;
    }

    .request-list {
      padding: 16px 20px;
    }

    /* Request Cards */
    .request-card {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .request-card:last-child {
      margin-bottom: 0;
    }

    .request-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .request-title {
      font-weight: 600;
      color: var(--text-primary);
    }

    .request-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .request-files {
      font-size: 12px;
      color: var(--accent-purple);
      margin-bottom: 8px;
    }

    .suggested-workflow {
      font-size: 12px;
      color: var(--accent-blue);
      margin-bottom: 12px;
    }

    /* Priority Badges */
    .priority-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }

    .priority-critical {
      background-color: rgba(248, 81, 73, 0.2);
      color: var(--accent-red);
      border: 1px solid var(--accent-red);
    }

    .priority-high {
      background-color: rgba(210, 153, 34, 0.2);
      color: var(--accent-yellow);
      border: 1px solid var(--accent-yellow);
    }

    .priority-medium {
      background-color: rgba(88, 166, 255, 0.2);
      color: var(--accent-blue);
      border: 1px solid var(--accent-blue);
    }

    .priority-low {
      background-color: rgba(110, 118, 129, 0.2);
      color: var(--text-muted);
      border: 1px solid var(--text-muted);
    }

    /* Status Labels */
    .status-icon {
      font-size: 16px;
    }

    .status-label {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .status-label.approved {
      background-color: rgba(63, 185, 80, 0.2);
      color: var(--accent-green);
    }

    .status-label.rejected {
      background-color: rgba(248, 81, 73, 0.2);
      color: var(--accent-red);
    }

    .status-label.deferred {
      background-color: rgba(210, 153, 34, 0.2);
      color: var(--accent-yellow);
    }

    /* Collapsible Blocks */
    .collapsible {
      margin-top: 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
    }

    .collapsible summary {
      padding: 8px 12px;
      cursor: pointer;
      background-color: var(--bg-highlight);
      font-size: 12px;
      color: var(--text-secondary);
    }

    .collapsible summary:hover {
      background-color: var(--bg-tertiary);
    }

    .reasoning-content,
    .description-content,
    .notes-content {
      padding: 12px;
      font-size: 13px;
      color: var(--text-primary);
      white-space: pre-wrap;
    }

    /* Buttons */
    .btn {
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: var(--font-mono);
      cursor: pointer;
      border: 1px solid var(--border-color);
      transition: background-color 0.15s, border-color 0.15s;
    }

    .btn-primary {
      background-color: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
    }

    .btn-primary:hover {
      background-color: #4c9aed;
    }

    .btn-secondary {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .btn-secondary:hover {
      background-color: var(--bg-highlight);
    }

    .btn-approve {
      background-color: var(--accent-green);
      color: white;
      border-color: var(--accent-green);
    }

    .btn-approve:hover {
      background-color: #36a348;
    }

    .btn-reject {
      background-color: var(--accent-red);
      color: white;
      border-color: var(--accent-red);
    }

    .btn-reject:hover {
      background-color: #e64a42;
    }

    .btn-defer {
      background-color: var(--accent-yellow);
      color: #0d1117;
      border-color: var(--accent-yellow);
    }

    .btn-defer:hover {
      background-color: #c4901f;
    }

    .btn-danger {
      background-color: transparent;
      color: var(--accent-red);
      border-color: var(--accent-red);
    }

    .btn-danger:hover {
      background-color: rgba(248, 81, 73, 0.1);
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    /* Filter Controls */
    .filter-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .filter-select {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      font-family: var(--font-mono);
    }

    /* Backlog Notice */
    .backlog-notice {
      padding: 12px 20px;
      background-color: rgba(210, 153, 34, 0.1);
      border-bottom: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--accent-yellow);
    }

    .backlog-status {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 8px;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--text-muted);
    }

    .empty-icon {
      display: block;
      font-size: 32px;
      margin-bottom: 12px;
    }

    .empty-message {
      font-size: 14px;
    }

    /* Navigation Badge */
    .nav-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      background-color: var(--accent-red);
      color: white;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 600;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .queue-stats {
        justify-content: center;
      }

      .stat-item {
        flex: 1 1 calc(50% - 8px);
        min-width: auto;
      }

      .section-header {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
      }

      .action-buttons {
        flex-wrap: wrap;
      }
    }
  `;
}
// ============================================================================
// JavaScript for Interactivity
// ============================================================================
function getOperatorQueueScript(sprintId) {
    return `
    (function() {
      'use strict';

      const sprintId = '${escapeHtml(sprintId)}';

      // Initialize
      document.addEventListener('DOMContentLoaded', function() {
        initActionButtons();
        initFilterControls();
        initSSEConnection();
      });

      // Action button handlers
      function initActionButtons() {
        document.addEventListener('click', async function(e) {
          const btn = e.target.closest('[data-action]');
          if (!btn) return;

          const action = btn.dataset.action;
          const requestId = btn.dataset.requestId;
          const itemId = btn.dataset.itemId;

          if (action === 'approve' || action === 'reject' || action === 'defer') {
            await handleDecision(requestId, action);
          } else if (action === 'create-issue') {
            await handleCreateIssue(itemId);
          } else if (action === 'acknowledge') {
            await handleAcknowledge(itemId);
          } else if (action === 'delete') {
            await handleDelete(itemId);
          }
        });
      }

      // Handle decision (approve/reject/defer)
      async function handleDecision(requestId, decision) {
        const reasoning = prompt('Enter reasoning for this decision:');
        if (reasoning === null) return;

        try {
          const response = await fetch('/api/sprint/' + sprintId + '/operator-queue/' + requestId + '/decide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision, reasoning })
          });

          if (response.ok) {
            // Reload page to show updated state
            window.location.reload();
          } else {
            const data = await response.json();
            alert('Error: ' + (data.error || 'Unknown error'));
          }
        } catch (err) {
          alert('Error: ' + err.message);
        }
      }

      // Handle create issue
      async function handleCreateIssue(itemId) {
        alert('Create Issue functionality coming soon for: ' + itemId);
      }

      // Handle acknowledge
      async function handleAcknowledge(itemId) {
        alert('Acknowledge functionality coming soon for: ' + itemId);
      }

      // Handle delete
      async function handleDelete(itemId) {
        if (!confirm('Are you sure you want to delete this item?')) return;
        alert('Delete functionality coming soon for: ' + itemId);
      }

      // Filter controls
      function initFilterControls() {
        const filterSelect = document.getElementById('history-filter');
        if (!filterSelect) return;

        filterSelect.addEventListener('change', function() {
          const filter = this.value;
          const cards = document.querySelectorAll('#history-list .history-card');

          cards.forEach(function(card) {
            if (filter === 'all') {
              card.style.display = '';
            } else if (card.classList.contains(filter)) {
              card.style.display = '';
            } else {
              card.style.display = 'none';
            }
          });
        });
      }

      // SSE connection for real-time updates
      function initSSEConnection() {
        const eventSource = new EventSource('/events');

        eventSource.addEventListener('operator-request', function(e) {
          console.log('New operator request:', e.data);
          // Could add notification or auto-reload
        });

        eventSource.addEventListener('operator-decision', function(e) {
          console.log('Operator decision:', e.data);
          // Could update UI without full reload
        });

        eventSource.addEventListener('queue-update', function(e) {
          console.log('Queue update:', e.data);
        });

        eventSource.onerror = function() {
          console.log('SSE connection error, will retry...');
        };
      }
    })();
  `;
}
// ============================================================================
// Main Page Generator
// ============================================================================
/**
 * Generate the complete operator queue page HTML
 */
function generateOperatorQueuePage(queueData, sprintId) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Operator Queue - ${escapeHtml(sprintId)}</title>
  <style>
${getOperatorQueueStyles()}
  </style>
</head>
<body>
  <div class="container">
    <header class="page-header">
      <h1 class="page-title">Operator Queue</h1>
      <a href="/sprint/${escapeHtml(sprintId)}" class="back-link">← Back to Sprint</a>
    </header>

    ${renderQueueStats(queueData.stats)}
    ${renderPendingRequestsSection(queueData.pending)}
    ${renderDecisionHistorySection(queueData.history)}
    ${renderBacklogSection(queueData.backlog)}
  </div>
  <script>
${getOperatorQueueScript(sprintId)}
  </script>
</body>
</html>`;
}
//# sourceMappingURL=operator-queue-page.js.map