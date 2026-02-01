/**
 * Backlog Module - BACKLOG.yaml Management
 *
 * This module handles:
 * - Reading BACKLOG.yaml from sprint directory
 * - Writing BACKLOG.yaml with new items
 * - Adding individual backlog items
 * - Updating existing backlog items
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
// ============================================================================
// Constants
// ============================================================================
const BACKLOG_FILENAME = 'BACKLOG.yaml';
// ============================================================================
// Functions
// ============================================================================
/**
 * Read backlog from BACKLOG.yaml
 *
 * @param sprintDir - Sprint directory path
 * @returns BacklogFile with items (empty array if file doesn't exist)
 */
export function readBacklog(sprintDir) {
    const backlogPath = path.join(sprintDir, BACKLOG_FILENAME);
    if (!fs.existsSync(backlogPath)) {
        return { items: [] };
    }
    const content = fs.readFileSync(backlogPath, 'utf8');
    const parsed = yaml.load(content);
    if (!parsed || !Array.isArray(parsed.items)) {
        return { items: [] };
    }
    return parsed;
}
/**
 * Write backlog to BACKLOG.yaml
 *
 * @param sprintDir - Sprint directory path
 * @param backlog - Backlog file to write
 */
export function writeBacklog(sprintDir, backlog) {
    const backlogPath = path.join(sprintDir, BACKLOG_FILENAME);
    const content = yaml.dump(backlog, { lineWidth: -1, noRefs: true, quotingType: '"' });
    fs.writeFileSync(backlogPath, content, 'utf8');
}
/**
 * Add a single item to the backlog
 *
 * @param sprintDir - Sprint directory path
 * @param item - Item to add
 */
export function addBacklogItem(sprintDir, item) {
    const backlog = readBacklog(sprintDir);
    // Ensure defaults
    const itemWithDefaults = {
        ...item,
        'created-at': item['created-at'] || new Date().toISOString(),
        status: item.status || 'pending-review',
    };
    backlog.items.push(itemWithDefaults);
    writeBacklog(sprintDir, backlog);
}
/**
 * Update an existing backlog item by ID
 *
 * @param sprintDir - Sprint directory path
 * @param itemId - ID of item to update
 * @param updates - Partial updates to apply
 * @throws Error if item not found
 */
export function updateBacklogItem(sprintDir, itemId, updates) {
    const backlog = readBacklog(sprintDir);
    const itemIndex = backlog.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
        throw new Error(`Backlog item not found: ${itemId}`);
    }
    backlog.items[itemIndex] = {
        ...backlog.items[itemIndex],
        ...updates,
    };
    writeBacklog(sprintDir, backlog);
}
//# sourceMappingURL=backlog.js.map