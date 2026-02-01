"use strict";
/**
 * Sprint Scanner - Enumerate and parse sprints in .claude/sprints/
 * Provides sprint history for the dashboard view
 *
 * Supports worktree awareness for parallel sprint execution:
 * - Each sprint knows which worktree it belongs to
 * - Can scan across all worktrees in a repository
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SprintScanner = void 0;
exports.scanSprints = scanSprints;
exports.scanSprintsAcrossWorktrees = scanSprintsAcrossWorktrees;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const worktree_js_1 = require("./worktree.js");
/**
 * Maximum number of sprints to return for performance
 */
const MAX_SPRINTS = 50;
/**
 * SprintScanner enumerates and parses all sprints in a sprints directory
 */
class SprintScanner {
    sprintsDir;
    options;
    worktreeCache = undefined;
    /**
     * Create a new SprintScanner
     * @param sprintsDir Path to the .claude/sprints/ directory
     * @param options Scanner options
     */
    constructor(sprintsDir, options = {}) {
        this.sprintsDir = sprintsDir;
        this.options = options;
    }
    /**
     * Get worktree info for this sprints directory (cached)
     */
    getWorktreeInfo() {
        if (this.worktreeCache === undefined) {
            this.worktreeCache = (0, worktree_js_1.detectWorktree)(this.sprintsDir);
        }
        return this.worktreeCache;
    }
    /**
     * Scan the sprints directory and return summaries of all sprints
     * @returns Array of SprintSummary objects sorted by date (newest first)
     */
    scan() {
        const summaries = [];
        const sprintDirs = this.getSprintDirectories();
        for (const sprintDir of sprintDirs) {
            try {
                const summary = this.parseSprint(sprintDir);
                if (summary) {
                    summaries.push(summary);
                }
            }
            catch {
                // Skip corrupted sprint directories
                console.warn(`[SprintScanner] Skipping corrupted sprint: ${sprintDir}`);
            }
        }
        // Sort by sprint ID (date-based IDs sort correctly lexicographically)
        // Newest first (descending order)
        summaries.sort((a, b) => b.sprintId.localeCompare(a.sprintId));
        // Limit to MAX_SPRINTS for performance
        return summaries.slice(0, MAX_SPRINTS);
    }
    /**
     * Get a single sprint summary by ID
     * @param sprintId The sprint ID to find
     * @returns SprintSummary or null if not found
     */
    getById(sprintId) {
        const sprintDir = path.join(this.sprintsDir, sprintId);
        if (!fs.existsSync(sprintDir)) {
            return null;
        }
        try {
            return this.parseSprint(sprintDir);
        }
        catch {
            return null;
        }
    }
    // ============================================================================
    // Private Helpers
    // ============================================================================
    /**
     * Get list of sprint directories
     */
    getSprintDirectories() {
        try {
            const entries = fs.readdirSync(this.sprintsDir, { withFileTypes: true });
            return entries
                .filter(e => e.isDirectory() && !e.name.startsWith('.'))
                .map(e => path.join(this.sprintsDir, e.name));
        }
        catch {
            return [];
        }
    }
    /**
     * Parse a single sprint directory into a SprintSummary
     */
    parseSprint(sprintDir) {
        const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
        if (!fs.existsSync(progressPath)) {
            return null;
        }
        try {
            const content = fs.readFileSync(progressPath, 'utf-8');
            const progress = yaml.load(content);
            if (!this.isValidProgress(progress)) {
                return null;
            }
            const phases = progress.phases ?? [];
            const { totalSteps, completedSteps } = this.countSteps(phases);
            // Try to get workflow from SPRINT.yaml
            const workflow = this.getWorkflow(sprintDir);
            // Build summary
            const summary = {
                sprintId: progress['sprint-id'],
                status: progress.status,
                startedAt: progress.stats?.['started-at'] ?? null,
                completedAt: progress.stats?.['completed-at'],
                elapsed: progress.stats?.elapsed,
                totalSteps,
                completedSteps,
                totalPhases: progress.stats?.['total-phases'] ?? phases.length,
                completedPhases: progress.stats?.['completed-phases'] ?? 0,
                workflow,
                path: sprintDir,
            };
            // Add worktree info if requested
            if (this.options.includeWorktreeInfo) {
                const worktreeInfo = this.getWorktreeInfo();
                if (worktreeInfo) {
                    summary.worktree = {
                        name: worktreeInfo.isMain ? 'main' : worktreeInfo.name,
                        branch: worktreeInfo.branch,
                        isMain: worktreeInfo.isMain,
                    };
                }
            }
            return summary;
        }
        catch {
            return null;
        }
    }
    /**
     * Validate that an object is a valid CompiledProgress
     */
    isValidProgress(obj) {
        if (typeof obj !== 'object' || obj === null)
            return false;
        const progress = obj;
        return (typeof progress['sprint-id'] === 'string' &&
            typeof progress.status === 'string' &&
            Array.isArray(progress.phases));
    }
    /**
     * Count total and completed steps across all phases
     */
    countSteps(phases) {
        let totalSteps = 0;
        let completedSteps = 0;
        for (const phase of phases) {
            if (phase.steps) {
                // For-each phase with steps
                for (const step of phase.steps) {
                    totalSteps++;
                    if (step.status === 'completed') {
                        completedSteps++;
                    }
                }
            }
        }
        return { totalSteps, completedSteps };
    }
    /**
     * Try to get workflow name from SPRINT.yaml
     */
    getWorkflow(sprintDir) {
        const sprintYamlPath = path.join(sprintDir, 'SPRINT.yaml');
        try {
            if (!fs.existsSync(sprintYamlPath)) {
                return undefined;
            }
            const content = fs.readFileSync(sprintYamlPath, 'utf-8');
            const sprint = yaml.load(content);
            if (typeof sprint?.workflow === 'string') {
                return sprint.workflow;
            }
        }
        catch {
            // Ignore errors reading SPRINT.yaml
        }
        return undefined;
    }
}
exports.SprintScanner = SprintScanner;
// ============================================================================
// Exported Functions
// ============================================================================
/**
 * Convenience function to scan sprints directory
 * @param sprintsDir Path to .claude/sprints/ directory
 * @param options Scanner options
 * @returns Array of SprintSummary sorted by date (newest first)
 */
function scanSprints(sprintsDir, options) {
    const scanner = new SprintScanner(sprintsDir, options);
    return scanner.scan();
}
/**
 * Scan sprints across all worktrees in a repository
 *
 * @param targetPath Any path within a git repository
 * @param sprintsRelativePath Relative path to sprints directory (default: .claude/sprints)
 * @returns Array of SprintSummary from all worktrees, sorted by date (newest first)
 */
function scanSprintsAcrossWorktrees(targetPath, sprintsRelativePath = '.claude/sprints') {
    const worktreeList = (0, worktree_js_1.listWorktrees)(targetPath);
    if (!worktreeList) {
        // Fallback to single directory scan
        const sprintsDir = path.join(path.dirname(targetPath), sprintsRelativePath);
        return scanSprints(sprintsDir, { includeWorktreeInfo: true });
    }
    const allSprints = [];
    for (const worktree of worktreeList.worktrees) {
        const sprintsDir = path.join(worktree.root, sprintsRelativePath);
        try {
            if (fs.existsSync(sprintsDir) && fs.statSync(sprintsDir).isDirectory()) {
                const scanner = new SprintScanner(sprintsDir, { includeWorktreeInfo: true });
                const sprints = scanner.scan();
                allSprints.push(...sprints);
            }
        }
        catch {
            // Skip inaccessible directories
        }
    }
    // Sort all sprints by date (newest first)
    allSprints.sort((a, b) => b.sprintId.localeCompare(a.sprintId));
    // Limit to MAX_SPRINTS
    return allSprints.slice(0, MAX_SPRINTS);
}
//# sourceMappingURL=sprint-scanner.js.map