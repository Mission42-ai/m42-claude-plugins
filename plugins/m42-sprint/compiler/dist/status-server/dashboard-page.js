"use strict";
/**
 * Dashboard Page Generator - Sprint history and metrics dashboard
 * All CSS and JavaScript is embedded as template literals
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDashboardPage = generateDashboardPage;
/**
 * Generate the complete HTML page for the sprint dashboard
 * @param sprints Array of sprint summaries
 * @param metrics Aggregated metrics across all sprints
 * @param activeSprint Currently active sprint ID (if any)
 * @returns Complete HTML document as a string
 */
function generateDashboardPage(sprints, metrics, activeSprint) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprint Dashboard</title>
  <style>
${getDashboardStyles()}
  </style>
</head>
<body>
  <div class="container">
    ${generateHeader(activeSprint)}
    ${generateFiltersSection()}
    ${generateMetricsSection(metrics, activeSprint)}
    ${generateSprintTable(sprints)}
  </div>
  <script>
${getDashboardScript()}
  </script>
</body>
</html>`;
}
/**
 * Generate the navigation bar for the dashboard
 */
function generateNavigationBar() {
    return `
    <nav class="nav-bar">
      <div class="nav-left">
        <span class="breadcrumb">
          <span class="breadcrumb-current">Dashboard</span>
        </span>
      </div>
      <div class="nav-right">
        <a href="https://github.com/anthropics/claude-code/tree/main/plugins/m42-sprint/docs"
           class="nav-link docs-link"
           target="_blank"
           rel="noopener noreferrer">
          Documentation
        </a>
      </div>
    </nav>`;
}
/**
 * Generate the worktree filter section
 */
function generateFiltersSection() {
    return `
    <section class="filters-section">
      <div class="filters-container">
        <div class="filter-group">
          <label for="worktree-filter" class="filter-label">Worktree:</label>
          <select id="worktree-filter" class="filter-select">
            <option value="all">All Worktrees</option>
            <!-- Options populated dynamically via JavaScript -->
          </select>
        </div>
        <div class="filter-info" id="filter-info">
          <!-- Shows current filter context -->
        </div>
      </div>
    </section>`;
}
/**
 * Generate the dashboard header with title and navigation
 */
function generateHeader(activeSprint) {
    const activeSprintLink = activeSprint
        ? `<a href="/sprint/${activeSprint}" class="nav-link active-sprint-link">
        <span class="active-sprint-indicator"></span>
        View Active Sprint
      </a>`
        : '';
    return `
    ${generateNavigationBar()}
    <header class="header">
      <div class="header-left">
        <h1 class="dashboard-title">Sprint Dashboard</h1>
      </div>
      <div class="header-right">
        ${activeSprintLink}
      </div>
    </header>`;
}
/**
 * Generate the metrics summary cards section
 */
function generateMetricsSection(metrics, activeSprint) {
    const activeDisplay = activeSprint
        ? `<a href="/sprint/${activeSprint}" class="active-link">${activeSprint}</a>`
        : '<span class="no-active">None</span>';
    return `
    <section class="metrics-section">
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total Sprints</div>
          <div class="metric-value">${metrics.totalSprints}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Success Rate</div>
          <div class="metric-value ${metrics.successRate >= 80 ? 'success' : metrics.successRate >= 50 ? 'warning' : 'danger'}">${metrics.successRate}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Duration</div>
          <div class="metric-value">${metrics.averageDurationFormatted}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Active Sprint</div>
          <div class="metric-value active-sprint">${activeDisplay}</div>
        </div>
      </div>
    </section>`;
}
/**
 * Generate the sprint list table
 */
function generateSprintTable(sprints) {
    if (sprints.length === 0) {
        return `
      <section class="sprints-section">
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-message">No sprints found</div>
          <div class="empty-hint">Start a sprint to see it here</div>
        </div>
      </section>`;
    }
    const rows = sprints.map(sprint => generateSprintRow(sprint)).join('');
    const showLoadMore = sprints.length >= 20;
    return `
    <section class="sprints-section">
      <div class="table-container">
        <table class="sprint-table">
          <thead>
            <tr>
              <th>Sprint ID</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Steps</th>
            </tr>
          </thead>
          <tbody id="sprint-table-body">
            ${rows}
          </tbody>
        </table>
      </div>
      ${showLoadMore ? `
        <div class="load-more-container">
          <button class="load-more-btn" id="load-more-btn">Load More</button>
        </div>
      ` : ''}
    </section>`;
}
/**
 * Generate a single sprint table row
 */
function generateSprintRow(sprint) {
    const statusClass = getStatusClass(sprint.status);
    const statusLabel = getStatusLabel(sprint.status);
    const startedDisplay = sprint.startedAt
        ? formatDate(sprint.startedAt)
        : '<span class="not-started">Not started</span>';
    const durationDisplay = sprint.elapsed || '--';
    // Worktree data for filtering (extract from path if available)
    // Sprint paths are like: /path/to/worktree/.claude/sprints/sprint-id
    const worktreeName = extractWorktreeName(sprint.path);
    return `
    <tr class="sprint-row" data-sprint-id="${escapeHtml(sprint.sprintId)}" data-worktree="${escapeHtml(worktreeName)}">
      <td class="sprint-id-cell">
        <a href="/sprint/${escapeHtml(sprint.sprintId)}" class="sprint-link">${escapeHtml(sprint.sprintId)}</a>
        ${worktreeName !== 'main' ? `<span class="worktree-badge">${escapeHtml(worktreeName)}</span>` : ''}
      </td>
      <td class="status-cell">
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </td>
      <td class="started-cell">${startedDisplay}</td>
      <td class="duration-cell">${durationDisplay}</td>
      <td class="steps-cell">
        <span class="steps-progress">${sprint.completedSteps}/${sprint.totalSteps}</span>
      </td>
    </tr>`;
}
/**
 * Extract worktree name from sprint path
 * Defaults to 'main' if cannot determine
 */
function extractWorktreeName(sprintPath) {
    // Path pattern: /path/to/worktree-name/.claude/sprints/sprint-id
    // or: /path/to/repo/.claude/sprints/sprint-id (main worktree)
    const parts = sprintPath.split('/.claude/sprints/');
    if (parts.length > 0) {
        const worktreeRoot = parts[0];
        const basename = worktreeRoot.split('/').pop() || 'main';
        return basename;
    }
    return 'main';
}
/**
 * Get CSS class for sprint status
 */
function getStatusClass(status) {
    switch (status) {
        case 'completed': return 'completed';
        case 'in-progress': return 'in-progress';
        case 'blocked': return 'blocked';
        case 'paused': return 'paused';
        case 'needs-human': return 'needs-human';
        case 'not-started': return 'pending';
        default: return 'pending';
    }
}
/**
 * Get human-readable label for sprint status
 */
function getStatusLabel(status) {
    switch (status) {
        case 'completed': return 'Completed';
        case 'in-progress': return 'In Progress';
        case 'blocked': return 'Blocked';
        case 'paused': return 'Paused';
        case 'needs-human': return 'Needs Human';
        case 'not-started': return 'Not Started';
        default: return status;
    }
}
/**
 * Format ISO date string to human-readable format
 */
function formatDate(isoString) {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        }
        else if (diffDays === 1) {
            return `Yesterday ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        }
        else if (diffDays < 7) {
            return `${diffDays} days ago`;
        }
        else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }
    catch {
        return isoString;
    }
}
/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
/**
 * Generate the CSS styles for the dashboard
 */
function getDashboardStyles() {
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
      padding: 0 20px;
    }

    /* Navigation Bar */
    .nav-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 8px;
    }

    .nav-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .breadcrumb-link {
      color: var(--accent-blue);
      text-decoration: none;
    }

    .breadcrumb-link:hover {
      text-decoration: underline;
    }

    .breadcrumb-separator {
      color: var(--text-muted);
    }

    .breadcrumb-current {
      color: var(--text-primary);
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 24px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .dashboard-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .nav-link {
      color: var(--accent-blue);
      text-decoration: none;
      font-size: 13px;
      padding: 6px 12px;
      border-radius: 6px;
      transition: background-color 0.15s;
    }

    .nav-link:hover {
      background-color: var(--bg-tertiary);
    }

    .active-sprint-link {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: rgba(63, 185, 80, 0.1);
      border: 1px solid rgba(63, 185, 80, 0.3);
    }

    .active-sprint-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--accent-green);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .docs-link {
      color: var(--text-secondary);
    }

    /* Filters Section */
    .filters-section {
      margin-bottom: 16px;
    }

    .filters-container {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
    }

    .filter-select {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 13px;
      font-family: var(--font-mono);
      cursor: pointer;
      min-width: 180px;
    }

    .filter-select:hover {
      border-color: var(--text-muted);
    }

    .filter-select:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .filter-info {
      font-size: 12px;
      color: var(--text-muted);
    }

    .filter-info .branch-name {
      color: var(--accent-purple);
    }

    /* Worktree badge in sprint row */
    .worktree-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 1px 6px;
      background-color: rgba(163, 113, 247, 0.15);
      color: var(--accent-purple);
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      vertical-align: middle;
    }

    /* Metrics Section */
    .metrics-section {
      margin-bottom: 24px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .metric-card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .metric-label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .metric-value {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .metric-value.success {
      color: var(--accent-green);
    }

    .metric-value.warning {
      color: var(--accent-yellow);
    }

    .metric-value.danger {
      color: var(--accent-red);
    }

    .metric-value.active-sprint {
      font-size: 14px;
    }

    .metric-value .active-link {
      color: var(--accent-blue);
      text-decoration: none;
    }

    .metric-value .active-link:hover {
      text-decoration: underline;
    }

    .metric-value .no-active {
      color: var(--text-muted);
    }

    /* Sprint Table */
    .sprints-section {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .table-container {
      overflow-x: auto;
    }

    .sprint-table {
      width: 100%;
      border-collapse: collapse;
    }

    .sprint-table th,
    .sprint-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    .sprint-table th {
      background-color: var(--bg-tertiary);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .sprint-row {
      transition: background-color 0.15s;
    }

    .sprint-row:hover {
      background-color: var(--bg-tertiary);
    }

    .sprint-row:last-child td {
      border-bottom: none;
    }

    .sprint-link {
      color: var(--accent-blue);
      text-decoration: none;
      font-weight: 500;
    }

    .sprint-link:hover {
      text-decoration: underline;
    }

    .not-started {
      color: var(--text-muted);
      font-style: italic;
    }

    .steps-progress {
      font-family: var(--font-mono);
      color: var(--text-secondary);
    }

    /* Status Badges */
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }

    .status-badge.pending {
      background-color: var(--bg-tertiary);
      color: var(--text-secondary);
    }

    .status-badge.in-progress {
      background-color: rgba(88, 166, 255, 0.15);
      color: var(--accent-blue);
    }

    .status-badge.completed {
      background-color: rgba(63, 185, 80, 0.15);
      color: var(--accent-green);
    }

    .status-badge.blocked,
    .status-badge.needs-human {
      background-color: rgba(248, 81, 73, 0.15);
      color: var(--accent-red);
    }

    .status-badge.paused {
      background-color: rgba(210, 153, 34, 0.15);
      color: var(--accent-yellow);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 48px 24px;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-message {
      font-size: 16px;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    .empty-hint {
      font-size: 13px;
      color: var(--text-muted);
    }

    /* Load More */
    .load-more-container {
      padding: 16px;
      text-align: center;
      border-top: 1px solid var(--border-color);
    }

    .load-more-btn {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      padding: 8px 24px;
      border-radius: 6px;
      font-size: 13px;
      font-family: var(--font-mono);
      cursor: pointer;
      transition: background-color 0.15s, border-color 0.15s;
    }

    .load-more-btn:hover {
      background-color: var(--bg-highlight);
      border-color: var(--text-muted);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .header {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
      }

      .header-right {
        width: 100%;
        justify-content: flex-start;
      }

      .sprint-table th,
      .sprint-table td {
        padding: 8px 12px;
      }
    }

    @media (max-width: 480px) {
      .metrics-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}
/**
 * Generate the JavaScript for the dashboard
 */
function getDashboardScript() {
    return `
    (function() {
      'use strict';

      let page = 1;
      const pageSize = 20;
      let loading = false;
      let currentWorktreeFilter = 'all';
      let worktreesData = [];

      // Initialize
      document.addEventListener('DOMContentLoaded', function() {
        initLoadMore();
        initWorktreeFilter();
      });

      // Initialize worktree filter
      async function initWorktreeFilter() {
        const filterSelect = document.getElementById('worktree-filter');
        const filterInfo = document.getElementById('filter-info');
        if (!filterSelect) return;

        try {
          // Fetch worktrees data
          const response = await fetch('/api/worktrees');
          if (!response.ok) throw new Error('Failed to fetch worktrees');

          const data = await response.json();
          worktreesData = data.worktrees || [];

          // Populate dropdown options
          if (worktreesData.length > 0) {
            // Clear existing options except "All"
            filterSelect.innerHTML = '<option value="all">All Worktrees (' + worktreesData.length + ')</option>';

            for (const wt of worktreesData) {
              const option = document.createElement('option');
              option.value = wt.name;
              const sprintCount = (wt.sprints || []).length;
              const activeMarker = wt.activeSprint ? ' *' : '';
              option.textContent = wt.name + ' (' + wt.branch + ')' + activeMarker + ' - ' + sprintCount + ' sprints';
              filterSelect.appendChild(option);
            }

            // Show server worktree context
            if (data.serverWorktree && filterInfo) {
              filterInfo.innerHTML = 'Server: <span class="branch-name">' +
                escapeHtml(data.serverWorktree.name) + '</span> (' +
                escapeHtml(data.serverWorktree.branch) + ')';
            }
          } else {
            filterSelect.style.display = 'none';
          }

          // Add change listener
          filterSelect.addEventListener('change', function() {
            currentWorktreeFilter = this.value;
            applyWorktreeFilter();
          });
        } catch (err) {
          console.error('Error loading worktrees:', err);
          filterSelect.style.display = 'none';
        }
      }

      // Apply the worktree filter to the sprint table
      function applyWorktreeFilter() {
        const rows = document.querySelectorAll('.sprint-row');
        let visibleCount = 0;

        for (const row of rows) {
          const rowWorktree = row.dataset.worktree || 'main';

          if (currentWorktreeFilter === 'all' || rowWorktree === currentWorktreeFilter) {
            row.style.display = '';
            visibleCount++;
          } else {
            row.style.display = 'none';
          }
        }

        // Update filter info with count
        const filterInfo = document.getElementById('filter-info');
        if (filterInfo) {
          const serverInfo = filterInfo.innerHTML.split('<br>')[0];
          if (currentWorktreeFilter === 'all') {
            filterInfo.innerHTML = serverInfo;
          } else {
            filterInfo.innerHTML = serverInfo + '<br>Showing ' + visibleCount + ' sprints';
          }
        }
      }

      // Load More functionality
      function initLoadMore() {
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (!loadMoreBtn) return;

        loadMoreBtn.addEventListener('click', async function() {
          if (loading) return;
          loading = true;
          loadMoreBtn.textContent = 'Loading...';
          loadMoreBtn.disabled = true;

          try {
            page++;
            const response = await fetch('/api/sprints?page=' + page + '&limit=' + pageSize);
            if (!response.ok) throw new Error('Failed to load sprints');

            const data = await response.json();
            const sprints = data.sprints || [];

            if (sprints.length > 0) {
              appendSprintRows(sprints);
            }

            if (sprints.length < pageSize) {
              loadMoreBtn.style.display = 'none';
            } else {
              loadMoreBtn.textContent = 'Load More';
              loadMoreBtn.disabled = false;
            }
          } catch (err) {
            console.error('Error loading more sprints:', err);
            loadMoreBtn.textContent = 'Error - Retry';
            loadMoreBtn.disabled = false;
            page--;
          }

          loading = false;
        });
      }

      // Append new sprint rows to the table
      function appendSprintRows(sprints) {
        const tbody = document.getElementById('sprint-table-body');
        if (!tbody) return;

        for (const sprint of sprints) {
          const row = document.createElement('tr');
          row.className = 'sprint-row';
          row.dataset.sprintId = sprint.sprintId;

          // Extract worktree name from path
          const worktreeName = extractWorktreeName(sprint.path || '');
          row.dataset.worktree = worktreeName;

          // Check if this row should be visible based on current filter
          if (currentWorktreeFilter !== 'all' && worktreeName !== currentWorktreeFilter) {
            row.style.display = 'none';
          }

          const worktreeBadge = worktreeName !== 'main'
            ? '<span class="worktree-badge">' + escapeHtml(worktreeName) + '</span>'
            : '';

          row.innerHTML =
            '<td class="sprint-id-cell">' +
              '<a href="/sprint/' + escapeHtml(sprint.sprintId) + '" class="sprint-link">' + escapeHtml(sprint.sprintId) + '</a>' +
              worktreeBadge +
            '</td>' +
            '<td class="status-cell">' +
              '<span class="status-badge ' + getStatusClass(sprint.status) + '">' + getStatusLabel(sprint.status) + '</span>' +
            '</td>' +
            '<td class="started-cell">' + formatStartDate(sprint.startedAt) + '</td>' +
            '<td class="duration-cell">' + (sprint.elapsed || '--') + '</td>' +
            '<td class="steps-cell">' +
              '<span class="steps-progress">' + sprint.completedSteps + '/' + sprint.totalSteps + '</span>' +
            '</td>';

          tbody.appendChild(row);
        }
      }

      // Extract worktree name from sprint path
      function extractWorktreeName(sprintPath) {
        if (!sprintPath) return 'main';
        const parts = sprintPath.split('/.claude/sprints/');
        if (parts.length > 0) {
          const worktreeRoot = parts[0];
          const basename = worktreeRoot.split('/').pop() || 'main';
          return basename;
        }
        return 'main';
      }

      function getStatusClass(status) {
        switch (status) {
          case 'completed': return 'completed';
          case 'in-progress': return 'in-progress';
          case 'blocked': return 'blocked';
          case 'paused': return 'paused';
          case 'needs-human': return 'needs-human';
          case 'not-started': return 'pending';
          default: return 'pending';
        }
      }

      function getStatusLabel(status) {
        switch (status) {
          case 'completed': return 'Completed';
          case 'in-progress': return 'In Progress';
          case 'blocked': return 'Blocked';
          case 'paused': return 'Paused';
          case 'needs-human': return 'Needs Human';
          case 'not-started': return 'Not Started';
          default: return status;
        }
      }

      function formatStartDate(isoString) {
        if (!isoString) return '<span class="not-started">Not started</span>';

        try {
          const date = new Date(isoString);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays === 0) {
            return 'Today ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          } else if (diffDays === 1) {
            return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          } else if (diffDays < 7) {
            return diffDays + ' days ago';
          } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          }
        } catch (e) {
          return isoString;
        }
      }

      function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }
    })();
  `;
}
//# sourceMappingURL=dashboard-page.js.map