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
export declare function generateDashboardPage(sprints: SprintSummary[], metrics: AggregateMetrics, activeSprint: string | null): string;
//# sourceMappingURL=dashboard-page.d.ts.map