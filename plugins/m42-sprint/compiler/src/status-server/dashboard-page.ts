/**
 * Dashboard Page Generator - Sprint history and metrics dashboard
 * All CSS and JavaScript is embedded as template literals
 */

import type { SprintSummary } from './sprint-scanner.js';
import type { AggregateMetrics } from './metrics-aggregator.js';

/**
 * Generate the complete HTML page for the sprint dashboard
 * @param sprints Array of sprint summaries
 * @param metrics Aggregated metrics across all sprints
 * @param activeSprint Currently active sprint ID (if any)
 * @returns Complete HTML document as a string
 */
export function generateDashboardPage(
  sprints: SprintSummary[],
  metrics: AggregateMetrics,
  activeSprint: string | null
): string {
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
function generateNavigationBar(): string {
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
function generateFiltersSection(): string {
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
function generateHeader(activeSprint: string | null): string {
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
 * Organized into categories: Health Overview, Performance, Workflows, Trends
 * Uses actionable metrics with insights and alerts
 */
function generateMetricsSection(metrics: AggregateMetrics, _activeSprint: string | null): string {
  // Calculate finished sprints for context
  const finishedSprints = metrics.completedSprints + metrics.failedSprints;

  // Get recent trend summary
  const recentTrend = metrics.dailyTrend.length > 0
    ? metrics.dailyTrend[metrics.dailyTrend.length - 1]
    : null;

  // Get health status styling
  const healthClass = metrics.healthStatus === 'healthy' ? 'success'
    : metrics.healthStatus === 'warning' ? 'warning' : 'danger';
  const healthIcon = metrics.healthStatus === 'healthy' ? '●'
    : metrics.healthStatus === 'warning' ? '◐' : '○';

  // Get trend indicator
  const trendIcon = metrics.successRateTrend === 'improving' ? '↑'
    : metrics.successRateTrend === 'declining' ? '↓' : '→';
  const trendClass = metrics.successRateTrend === 'improving' ? 'success'
    : metrics.successRateTrend === 'declining' ? 'danger' : '';

  return `
    <section class="metrics-section">
      ${generateAlertsSection(metrics.alerts)}
      ${generateInsightsSection(metrics.insights)}

      <!-- Health Overview - Primary status at a glance -->
      <div class="metrics-category">
        <h3 class="category-title">Health Overview</h3>
        <div class="metrics-grid health-grid">
          <div class="metric-card metric-primary health-status-card ${healthClass}">
            <div class="metric-label">Sprint Health</div>
            <div class="metric-value ${healthClass}">
              <span class="health-icon">${healthIcon}</span>
              ${metrics.healthStatus.charAt(0).toUpperCase() + metrics.healthStatus.slice(1)}
            </div>
            <div class="metric-context">
              ${metrics.successRate}% success rate
              <span class="trend-indicator ${trendClass}" title="Trend: ${metrics.successRateTrend}">${trendIcon}</span>
            </div>
          </div>
          <div class="metric-card metric-secondary">
            <div class="metric-label">Completed</div>
            <div class="metric-value success">${metrics.completedSprints}</div>
            <div class="metric-context">of ${metrics.totalSprints} total</div>
          </div>
          <div class="metric-card metric-secondary">
            <div class="metric-label">Failed</div>
            <div class="metric-value ${metrics.failedSprints > 0 ? 'danger' : ''}">${metrics.failedSprints}</div>
            ${metrics.durationAnomalies > 0 ? `<div class="metric-context warning">${metrics.durationAnomalies} anomalies</div>` : ''}
          </div>
          <div class="metric-card metric-secondary">
            <div class="metric-label">In Progress</div>
            <div class="metric-value">${metrics.inProgressSprints}</div>
          </div>
        </div>
      </div>

      <!-- Performance Category - Efficiency metrics -->
      <div class="metrics-category">
        <h3 class="category-title">Performance</h3>
        <div class="metrics-grid performance-grid">
          <div class="metric-card metric-secondary">
            <div class="metric-label">Avg Duration</div>
            <div class="metric-value">${metrics.averageDurationFormatted}</div>
            ${metrics.comparison.durationChange !== 0 ? `
            <div class="metric-context ${metrics.comparison.durationChange > 0 ? 'warning' : 'success'}">
              ${metrics.comparison.durationChange > 0 ? '+' : ''}${metrics.comparison.durationChange}% vs prior
            </div>` : ''}
          </div>
          <div class="metric-card metric-secondary">
            <div class="metric-label">Avg Steps</div>
            <div class="metric-value">${metrics.averageStepsPerSprint}</div>
          </div>
          <div class="metric-card metric-secondary">
            <div class="metric-label">Steps/Hour</div>
            <div class="metric-value">${metrics.averageStepsPerHour}</div>
            <div class="metric-context">efficiency rate</div>
          </div>
          <div class="metric-card metric-secondary">
            <div class="metric-label">Sprints/Day</div>
            <div class="metric-value">${metrics.categories.velocity.sprintsPerDay}</div>
            <div class="metric-context">velocity</div>
          </div>
        </div>
      </div>

      <!-- Workflows Category -->
      <div class="metrics-category">
        <h3 class="category-title">Workflows</h3>
        <div class="metrics-grid workflow-grid">
          ${metrics.mostCommonWorkflow ? `
          <div class="metric-card metric-secondary">
            <div class="metric-label">Most Used</div>
            <div class="metric-value workflow-name">${escapeHtml(metrics.mostCommonWorkflow)}</div>
            ${metrics.workflowStats.length > 0 ? `<div class="metric-context">${metrics.workflowStats[0].percentage}% of sprints</div>` : ''}
          </div>
          ` : ''}
          ${generateWorkflowDistribution(metrics.workflowStats)}
        </div>
      </div>

      <!-- Trends Category -->
      <div class="metrics-category">
        <h3 class="category-title">Activity Trend</h3>
        <div class="metrics-grid trend-grid">
          ${recentTrend ? `
          <div class="metric-card metric-secondary">
            <div class="metric-label">Today (${recentTrend.dateKey})</div>
            <div class="metric-value">${recentTrend.count} sprints</div>
            <div class="metric-context">${recentTrend.successRate}% success rate</div>
          </div>
          ` : '<div class="metric-card metric-secondary"><div class="metric-label">Today</div><div class="metric-value">No activity</div></div>'}
          ${metrics.comparison.successRateChange !== 0 ? `
          <div class="metric-card metric-secondary">
            <div class="metric-label">Trend</div>
            <div class="metric-value ${metrics.comparison.successRateChange > 0 ? 'success' : 'danger'}">
              ${metrics.comparison.successRateChange > 0 ? '+' : ''}${metrics.comparison.successRateChange}%
            </div>
            <div class="metric-context">success rate change</div>
          </div>
          ` : ''}
          ${generateTrendSparkline(metrics.dailyTrend)}
        </div>
      </div>
    </section>`;
}

/**
 * Generate alerts section for critical/warning issues
 */
function generateAlertsSection(alerts: AggregateMetrics['alerts']): string {
  if (!alerts || alerts.length === 0) return '';

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  if (criticalAlerts.length === 0 && warningAlerts.length === 0) return '';

  const alertItems = [...criticalAlerts, ...warningAlerts].map(alert => `
    <div class="alert-item alert-${alert.severity}">
      <span class="alert-icon">${alert.severity === 'critical' ? '⚠' : '!'}</span>
      <span class="alert-message">${escapeHtml(alert.message)}</span>
    </div>
  `).join('');

  return `
    <div class="alerts-banner ${criticalAlerts.length > 0 ? 'has-critical' : 'has-warning'}">
      ${alertItems}
    </div>`;
}

/**
 * Generate insights section with actionable recommendations
 */
function generateInsightsSection(insights: AggregateMetrics['insights']): string {
  if (!insights || insights.length === 0) return '';

  // Only show success and warning insights prominently
  const relevantInsights = insights.filter(i => i.type === 'success' || i.type === 'warning' || i.type === 'recommendation');

  if (relevantInsights.length === 0) return '';

  const insightItems = relevantInsights.slice(0, 3).map(insight => `
    <div class="insight-item insight-${insight.type}">
      <span class="insight-icon">${insight.type === 'success' ? '✓' : insight.type === 'warning' ? '!' : '→'}</span>
      <span class="insight-message">${escapeHtml(insight.message)}</span>
    </div>
  `).join('');

  return `
    <div class="insights-section">
      ${insightItems}
    </div>`;
}

/**
 * Generate workflow distribution display
 */
function generateWorkflowDistribution(workflowStats: AggregateMetrics['workflowStats']): string {
  if (workflowStats.length <= 1) return '';

  const bars = workflowStats.slice(0, 5).map(w => `
    <div class="workflow-bar-item">
      <div class="workflow-bar-label">${escapeHtml(w.workflow)}</div>
      <div class="workflow-bar-container">
        <div class="workflow-bar" style="width: ${w.percentage}%"></div>
        <span class="workflow-bar-value">${w.percentage}%</span>
      </div>
    </div>
  `).join('');

  return `
    <div class="metric-card metric-secondary metric-wide workflow-distribution">
      <div class="metric-label">Workflow Distribution</div>
      <div class="workflow-bars">${bars}</div>
    </div>`;
}

/**
 * Generate a simple text-based trend sparkline
 */
function generateTrendSparkline(dailyTrend: AggregateMetrics['dailyTrend']): string {
  if (dailyTrend.length < 2) return '';

  const recentDays = dailyTrend.slice(-7);
  const maxCount = Math.max(...recentDays.map(d => d.count), 1);

  const bars = recentDays.map(d => {
    const height = Math.round((d.count / maxCount) * 100);
    const successRate = d.count > 0 ? Math.round((d.completed / d.count) * 100) : 0;
    return `<div class="sparkline-bar" style="height: ${height}%" title="${d.dateKey}: ${d.count} sprints, ${successRate}% success"></div>`;
  }).join('');

  return `
    <div class="metric-card metric-secondary trend-chart">
      <div class="metric-label">7-Day Trend</div>
      <div class="sparkline">${bars}</div>
    </div>`;
}

/**
 * Generate the sprint list table
 */
function generateSprintTable(sprints: SprintSummary[]): string {
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
function generateSprintRow(sprint: SprintSummary): string {
  const statusClass = getStatusClass(sprint.status);
  const statusLabel = getStatusLabel(sprint.status);
  const startedDisplay = sprint.startedAt
    ? formatDate(sprint.startedAt)
    : '<span class="not-started">Not started</span>';
  const durationDisplay = sprint.elapsed || '--';

  // Use worktree name from sprint data (properly normalized by sprint-scanner)
  // Falls back to path extraction only if worktree info is not available
  const worktreeName = sprint.worktree?.name ?? extractWorktreeName(sprint.path);

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

// ============================================================================
// Utility Functions (Server-Side)
// ============================================================================
// NOTE: These functions have client-side counterparts in getDashboardScript().
// The client-side versions are needed for dynamically loaded sprint rows.
// When modifying these, ensure the client-side versions stay consistent.
// Key differences:
// - escapeHtml: Server uses string replacement, client uses DOM textContent
// - formatDate/formatStartDate: Client handles null input with HTML fallback
// ============================================================================

/**
 * Extract worktree name from sprint path
 * Defaults to 'main' if cannot determine
 */
function extractWorktreeName(sprintPath: string): string {
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
function getStatusClass(status: string): string {
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
function getStatusLabel(status: string): string {
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
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch {
    return isoString;
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
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
function getDashboardStyles(): string {
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

    /* Metrics Section - Categorized Layout */
    .metrics-section {
      margin-bottom: 24px;
    }

    .metrics-category {
      margin-bottom: 20px;
    }

    .metrics-category:last-child {
      margin-bottom: 0;
    }

    .category-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-color);
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .status-grid {
      grid-template-columns: repeat(5, 1fr);
    }

    .performance-grid {
      grid-template-columns: repeat(4, 1fr);
    }

    .workflow-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .trend-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .metric-card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px 16px;
      text-align: center;
    }

    /* Visual hierarchy - Primary metrics are larger/more prominent */
    .metric-primary {
      padding: 16px 20px;
      border-width: 2px;
    }

    .metric-primary .metric-value {
      font-size: 32px;
    }

    .metric-secondary {
      padding: 10px 14px;
    }

    .metric-secondary .metric-value {
      font-size: 20px;
    }

    .metric-wide {
      grid-column: span 2;
    }

    .metric-label {
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
      margin-bottom: 6px;
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

    .metric-context {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .metric-context.success {
      color: var(--accent-green);
    }

    .metric-context.warning {
      color: var(--accent-yellow);
    }

    .metric-context.danger {
      color: var(--accent-red);
    }

    /* Alerts Banner */
    .alerts-banner {
      background-color: rgba(248, 81, 73, 0.1);
      border: 1px solid rgba(248, 81, 73, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }

    .alerts-banner.has-warning:not(.has-critical) {
      background-color: rgba(210, 153, 34, 0.1);
      border-color: rgba(210, 153, 34, 0.3);
    }

    .alert-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 13px;
    }

    .alert-icon {
      font-weight: 600;
    }

    .alert-item.alert-critical {
      color: var(--accent-red);
    }

    .alert-item.alert-warning {
      color: var(--accent-yellow);
    }

    /* Insights Section */
    .insights-section {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }

    .insight-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .insight-icon {
      font-weight: 600;
      width: 16px;
      text-align: center;
    }

    .insight-item.insight-success .insight-icon {
      color: var(--accent-green);
    }

    .insight-item.insight-warning .insight-icon {
      color: var(--accent-yellow);
    }

    .insight-item.insight-recommendation .insight-icon {
      color: var(--accent-blue);
    }

    /* Health Status Card */
    .health-grid {
      grid-template-columns: 2fr 1fr 1fr 1fr;
    }

    .health-status-card {
      text-align: left;
    }

    .health-status-card.success {
      border-color: rgba(63, 185, 80, 0.3);
      background-color: rgba(63, 185, 80, 0.05);
    }

    .health-status-card.warning {
      border-color: rgba(210, 153, 34, 0.3);
      background-color: rgba(210, 153, 34, 0.05);
    }

    .health-status-card.danger {
      border-color: rgba(248, 81, 73, 0.3);
      background-color: rgba(248, 81, 73, 0.05);
    }

    .health-icon {
      margin-right: 8px;
    }

    .trend-indicator {
      margin-left: 8px;
      font-weight: 600;
    }

    .trend-indicator.success {
      color: var(--accent-green);
    }

    .trend-indicator.danger {
      color: var(--accent-red);
    }

    /* Workflow distribution bars */
    .workflow-distribution {
      text-align: left;
    }

    .workflow-bars {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .workflow-bar-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .workflow-bar-label {
      font-size: 11px;
      color: var(--text-secondary);
      min-width: 80px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }

    .workflow-bar-container {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .workflow-bar {
      height: 6px;
      background-color: var(--accent-blue);
      border-radius: 3px;
      min-width: 4px;
    }

    .workflow-bar-value {
      font-size: 10px;
      color: var(--text-muted);
      min-width: 30px;
    }

    /* Trend sparkline */
    .trend-chart {
      text-align: left;
    }

    .sparkline {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 40px;
      padding-top: 8px;
    }

    .sparkline-bar {
      flex: 1;
      background-color: var(--accent-blue);
      border-radius: 2px;
      min-height: 4px;
      transition: background-color 0.15s;
    }

    .sparkline-bar:hover {
      background-color: var(--accent-green);
    }

    .metric-value.workflow-name {
      font-size: 16px;
      color: var(--accent-purple);
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

      .status-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .health-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .performance-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .trend-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .metric-wide {
        grid-column: span 2;
      }

      .health-status-card {
        grid-column: span 2;
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
      .metrics-grid,
      .status-grid,
      .health-grid,
      .performance-grid,
      .workflow-grid,
      .trend-grid {
        grid-template-columns: 1fr;
      }

      .metric-wide,
      .health-status-card {
        grid-column: span 1;
      }
    }
  `;
}

/**
 * Generate the JavaScript for the dashboard
 */
function getDashboardScript(): string {
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

          // Use worktree name from sprint data (properly normalized by server)
          const worktreeName = (sprint.worktree && sprint.worktree.name) || extractWorktreeName(sprint.path || '');
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

      // ================================================================
      // Utility Functions (Client-Side)
      // ================================================================
      // NOTE: These mirror server-side functions for dynamically
      // loaded sprint rows. See comments near line 335 for details.
      // ================================================================

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
