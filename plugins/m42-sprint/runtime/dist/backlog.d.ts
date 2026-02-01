/**
 * Backlog Module - BACKLOG.yaml Management
 *
 * This module handles:
 * - Reading BACKLOG.yaml from sprint directory
 * - Writing BACKLOG.yaml with new items
 * - Adding individual backlog items
 * - Updating existing backlog items
 */
/**
 * Source information for a backlog item
 */
export interface BacklogItemSource {
    /** Original request ID */
    'request-id': string;
    /** Phase where discovered */
    'discovered-in': string;
    /** When discovered */
    'discovered-at': string;
}
/**
 * A single backlog item
 */
export interface BacklogItem {
    /** Unique identifier (same as original request ID) */
    id: string;
    /** Short description */
    title: string;
    /** Full description */
    description: string;
    /** Category (e.g., 'tech-debt', 'feature', 'investigation') */
    category: string;
    /** Suggested priority for human review */
    'suggested-priority': 'high' | 'medium' | 'low';
    /** Operator's notes explaining the decision */
    'operator-notes': string;
    /** Provenance information */
    source: BacklogItemSource;
    /** When added to backlog */
    'created-at': string;
    /** Review status */
    status: 'pending-review' | 'acknowledged' | 'converted-to-issue';
}
/**
 * BACKLOG.yaml file structure
 */
export interface BacklogFile {
    /** List of backlog items */
    items: BacklogItem[];
}
/**
 * Read backlog from BACKLOG.yaml
 *
 * @param sprintDir - Sprint directory path
 * @returns BacklogFile with items (empty array if file doesn't exist)
 */
export declare function readBacklog(sprintDir: string): BacklogFile;
/**
 * Write backlog to BACKLOG.yaml
 *
 * @param sprintDir - Sprint directory path
 * @param backlog - Backlog file to write
 */
export declare function writeBacklog(sprintDir: string, backlog: BacklogFile): void;
/**
 * Add a single item to the backlog
 *
 * @param sprintDir - Sprint directory path
 * @param item - Item to add
 */
export declare function addBacklogItem(sprintDir: string, item: BacklogItem): void;
/**
 * Update an existing backlog item by ID
 *
 * @param sprintDir - Sprint directory path
 * @param itemId - ID of item to update
 * @param updates - Partial updates to apply
 * @throws Error if item not found
 */
export declare function updateBacklogItem(sprintDir: string, itemId: string, updates: Partial<BacklogItem>): void;
//# sourceMappingURL=backlog.d.ts.map