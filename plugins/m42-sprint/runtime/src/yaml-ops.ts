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
// Type Definitions (minimal subset for yaml-ops)
// ============================================================================

export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

export interface CurrentPointer {
  phase: number;
  step: number | null;
  'sub-phase': number | null;
}

export interface SprintStats {
  'started-at': string | null;
  'completed-at'?: string | null;
  'total-phases': number;
  'completed-phases': number;
  elapsed?: string;
}

/**
 * Minimal CompiledProgress interface for yaml-ops.
 * Uses index signature to allow all fields from full interface.
 */
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  current: CurrentPointer;
  stats: SprintStats;
  phases?: unknown[];
  [key: string]: unknown;
}

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
function getChecksumPath(filePath: string): string {
  return `${filePath}.checksum`;
}

/**
 * Get the backup file path for a given progress file.
 */
function getBackupPath(filePath: string): string {
  return `${filePath}.backup`;
}

/**
 * Get the checksum backup path for a given progress file.
 */
function getChecksumBackupPath(filePath: string): string {
  return `${filePath}.checksum.backup`;
}

/**
 * Get the temp file path for atomic writes.
 * Uses process.pid for uniqueness.
 */
function getTempPath(filePath: string): string {
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
export function calculateChecksum(content: string): string {
  return crypto.createHash(CHECKSUM_ALGORITHM).update(content, 'utf8').digest('hex');
}

/**
 * Write progress to file atomically with checksum.
 * Uses temp file + rename pattern for atomicity on POSIX systems.
 *
 * @param filePath - Path to the progress file
 * @param progress - Progress object to write
 */
export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void> {
  const content = yaml.dump(progress, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  const tempPath = getTempPath(filePath);
  const checksumPath = getChecksumPath(filePath);

  try {
    // Write to temp file first
    fs.writeFileSync(tempPath, content, 'utf8');

    // Atomic rename (atomic on POSIX)
    fs.renameSync(tempPath, filePath);

    // Calculate and write checksum
    const checksum = calculateChecksum(content);
    fs.writeFileSync(checksumPath, checksum, 'utf8');
  } finally {
    // Clean up temp file if it still exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
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
export function readProgress(filePath: string): CompiledProgress {
  // Read the file content (throws ENOENT if not found)
  const content = fs.readFileSync(filePath, 'utf8');

  // Check for checksum file
  const checksumPath = getChecksumPath(filePath);
  if (fs.existsSync(checksumPath)) {
    const storedChecksum = fs.readFileSync(checksumPath, 'utf8').trim();
    const actualChecksum = calculateChecksum(content);

    if (storedChecksum !== actualChecksum) {
      throw new Error(
        `checksum mismatch: expected ${storedChecksum}, got ${actualChecksum}`
      );
    }
  }

  // Parse YAML (throws on invalid syntax)
  const parsed = yaml.load(content) as CompiledProgress;
  return parsed;
}

/**
 * Create backup of progress file before critical operations.
 * Also backs up checksum file if it exists.
 *
 * @param filePath - Path to the progress file to backup
 */
export function backupProgress(filePath: string): void {
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
export function restoreProgress(filePath: string): boolean {
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
export function cleanupBackup(filePath: string): void {
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
