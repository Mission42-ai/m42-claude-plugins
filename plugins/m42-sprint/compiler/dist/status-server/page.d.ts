/**
 * HTML page generator for the Sprint Status Server
 * All CSS and JavaScript is embedded as template literals
 */
/**
 * Navigation context for sprint detail pages
 */
export interface SprintNavigation {
    /** Current sprint ID */
    currentSprintId: string;
    /** List of available sprints for switcher (max 10, newest first) */
    availableSprints: Array<{
        sprintId: string;
        status: string;
    }>;
}
/**
 * Generate the complete HTML page for the status dashboard
 * @param navigation Optional navigation context for sprint switching
 * @returns Complete HTML document as a string
 */
export declare function getPageHtml(navigation?: SprintNavigation): string;
//# sourceMappingURL=page.d.ts.map