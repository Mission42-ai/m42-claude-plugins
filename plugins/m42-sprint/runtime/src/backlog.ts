/**
 * Backlog Module - BACKLOG.yaml Management
 *
 * RED PHASE STUB: This file contains type definitions and function stubs.
 * The implementation will be added in the GREEN phase.
 *
 * This module handles:
 * - Reading BACKLOG.yaml from sprint directory
 * - Writing BACKLOG.yaml with new items
 * - Adding individual backlog items
 * - Updating existing backlog items
 */

// ============================================================================
// Types - Backlog Item
// ============================================================================

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

// ============================================================================
// Function Stubs (RED Phase - Not Implemented)
// ============================================================================

/**
 * Read backlog from BACKLOG.yaml
 *
 * @param sprintDir - Sprint directory path
 * @returns BacklogFile with items (empty array if file doesn't exist)
 * @throws Error - Not implemented (RED phase)
 */
export function readBacklog(_sprintDir: string): BacklogFile {
  throw new Error('Not implemented: readBacklog (RED phase)');
}

/**
 * Write backlog to BACKLOG.yaml
 *
 * @param sprintDir - Sprint directory path
 * @param backlog - Backlog file to write
 * @throws Error - Not implemented (RED phase)
 */
export function writeBacklog(_sprintDir: string, _backlog: BacklogFile): void {
  throw new Error('Not implemented: writeBacklog (RED phase)');
}

/**
 * Add a single item to the backlog
 *
 * @param sprintDir - Sprint directory path
 * @param item - Item to add
 * @throws Error - Not implemented (RED phase)
 */
export function addBacklogItem(_sprintDir: string, _item: BacklogItem): void {
  throw new Error('Not implemented: addBacklogItem (RED phase)');
}

/**
 * Update an existing backlog item by ID
 *
 * @param sprintDir - Sprint directory path
 * @param itemId - ID of item to update
 * @param updates - Partial updates to apply
 * @throws Error - Not implemented (RED phase)
 */
export function updateBacklogItem(
  _sprintDir: string,
  _itemId: string,
  _updates: Partial<BacklogItem>
): void {
  throw new Error('Not implemented: updateBacklogItem (RED phase)');
}
