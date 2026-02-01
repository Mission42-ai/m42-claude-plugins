/**
 * Atomic YAML Operations with Checksum Validation
 *
 * Provides atomic read/write operations for PROGRESS.yaml files
 * with checksum validation for corruption detection.
 */
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
// ============================================================================
// Constants
// ============================================================================
const CHECKSUM_ALGORITHM = 'sha256';
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Get the checksum file path for a given progress file.
 */
function getChecksumPath(filePath) {
    return `${filePath}.checksum`;
}
/**
 * Get the backup file path for a given progress file.
 */
function getBackupPath(filePath) {
    return `${filePath}.backup`;
}
/**
 * Get the checksum backup path for a given progress file.
 */
function getChecksumBackupPath(filePath) {
    return `${filePath}.checksum.backup`;
}
/**
 * Get the temp file path for atomic writes.
 * Uses process.pid for uniqueness.
 */
function getTempPath(filePath) {
    return `${filePath}.tmp.${process.pid}`;
}
// ============================================================================
// Core Functions
// ============================================================================
/**
 * Calculate SHA256 checksum of content string.
 *
 * @param content - String content to hash
 * @returns SHA256 hex string (64 characters)
 */
export function calculateChecksum(content) {
    return crypto.createHash(CHECKSUM_ALGORITHM).update(content, 'utf8').digest('hex');
}
/**
 * Write progress to file atomically with checksum.
 * Uses temp file + rename pattern for atomicity on POSIX systems.
 *
 * @param filePath - Path to the progress file
 * @param progress - Progress object to write
 */
export async function writeProgressAtomic(filePath, progress) {
    const content = yaml.dump(progress, {
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
    });
    const tempPath = getTempPath(filePath);
    const checksumPath = getChecksumPath(filePath);
    try {
        // Write to temp file first
        await fs.promises.writeFile(tempPath, content, 'utf8');
        // Atomic rename (atomic on POSIX)
        await fs.promises.rename(tempPath, filePath);
        // Calculate and write checksum
        const checksum = calculateChecksum(content);
        await fs.promises.writeFile(checksumPath, checksum, 'utf8');
    }
    finally {
        // Clean up temp file if it still exists
        try {
            await fs.promises.access(tempPath);
            await fs.promises.unlink(tempPath);
        }
        catch {
            // Ignore cleanup errors (file doesn't exist or other issues)
        }
    }
}
/**
 * Read progress from file with optional checksum validation.
 * Throws on checksum mismatch if checksum file exists.
 *
 * @param filePath - Path to the progress file
 * @returns Parsed CompiledProgress object
 * @throws Error if file not found, invalid YAML, or checksum mismatch
 */
export function readProgress(filePath) {
    // Read the file content (throws ENOENT if not found)
    const content = fs.readFileSync(filePath, 'utf8');
    // Check for checksum file
    const checksumPath = getChecksumPath(filePath);
    if (fs.existsSync(checksumPath)) {
        const storedChecksum = fs.readFileSync(checksumPath, 'utf8').trim();
        const actualChecksum = calculateChecksum(content);
        if (storedChecksum !== actualChecksum) {
            throw new Error(`checksum mismatch: expected ${storedChecksum}, got ${actualChecksum}`);
        }
    }
    // Parse YAML (throws on invalid syntax)
    return yaml.load(content);
}
/**
 * Create backup of progress file before critical operations.
 * Also backs up checksum file if it exists.
 *
 * @param filePath - Path to the progress file to backup
 */
export function backupProgress(filePath) {
    const backupPath = getBackupPath(filePath);
    const checksumPath = getChecksumPath(filePath);
    const checksumBackupPath = getChecksumBackupPath(filePath);
    // Copy main file to backup
    fs.copyFileSync(filePath, backupPath);
    // Copy checksum file if it exists
    if (fs.existsSync(checksumPath)) {
        fs.copyFileSync(checksumPath, checksumBackupPath);
    }
}
/**
 * Restore progress from backup file.
 * Uses rename for atomic restore. Also restores checksum backup if present.
 *
 * @param filePath - Path to the progress file to restore
 * @returns true if backup existed and was restored, false otherwise
 */
export function restoreProgress(filePath) {
    const backupPath = getBackupPath(filePath);
    const checksumBackupPath = getChecksumBackupPath(filePath);
    const checksumPath = getChecksumPath(filePath);
    // Check if backup exists
    if (!fs.existsSync(backupPath)) {
        return false;
    }
    // Atomic rename backup to main file
    fs.renameSync(backupPath, filePath);
    // Restore checksum backup if it exists
    if (fs.existsSync(checksumBackupPath)) {
        fs.renameSync(checksumBackupPath, checksumPath);
    }
    return true;
}
/**
 * Remove backup files. Idempotent - no error if backups don't exist.
 *
 * @param filePath - Path to the progress file whose backups should be removed
 */
export function cleanupBackup(filePath) {
    const backupPath = getBackupPath(filePath);
    const checksumBackupPath = getChecksumBackupPath(filePath);
    // Remove backup file if it exists
    if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
    }
    // Remove checksum backup if it exists
    if (fs.existsSync(checksumBackupPath)) {
        fs.unlinkSync(checksumBackupPath);
    }
}
//# sourceMappingURL=yaml-ops.js.map