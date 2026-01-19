"use strict";
/**
 * Worktree Detection - Identify git worktrees for parallel sprint execution
 *
 * When running multiple sprints in parallel (each in their own worktree),
 * we need to track which worktree each sprint belongs to.
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
exports.detectWorktree = detectWorktree;
exports.listWorktrees = listWorktrees;
exports.findSprintsAcrossWorktrees = findSprintsAcrossWorktrees;
exports.getWorktreeLabel = getWorktreeLabel;
exports.isInWorktree = isInWorktree;
exports.getWorktreeName = getWorktreeName;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
// ============================================================================
// Core Functions
// ============================================================================
/**
 * Detect the worktree containing a given path
 *
 * @param targetPath Any path within a git repository (file or directory)
 * @returns WorktreeInfo for the containing worktree, or null if not in a git repo
 */
function detectWorktree(targetPath) {
    try {
        const absPath = path.resolve(targetPath);
        // Get the worktree root (git toplevel)
        const root = (0, child_process_1.execSync)('git rev-parse --show-toplevel', {
            cwd: fs.statSync(absPath).isDirectory() ? absPath : path.dirname(absPath),
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        // Get branch name
        let branch;
        try {
            branch = (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', {
                cwd: root,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            }).trim();
        }
        catch {
            branch = 'detached';
        }
        // Get abbreviated commit
        const commit = (0, child_process_1.execSync)('git rev-parse --short HEAD', {
            cwd: root,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        // Determine if this is the main worktree
        // Main worktree has a .git directory, linked worktrees have a .git file
        const gitPath = path.join(root, '.git');
        const isMain = fs.statSync(gitPath).isDirectory();
        return {
            root,
            name: path.basename(root),
            branch,
            commit,
            isMain,
        };
    }
    catch {
        return null;
    }
}
/**
 * List all worktrees in the repository containing the given path
 *
 * @param targetPath Any path within a git repository
 * @returns WorktreeList with all worktrees, or null if not in a git repo
 */
function listWorktrees(targetPath) {
    try {
        const absPath = path.resolve(targetPath);
        const cwd = fs.statSync(absPath).isDirectory() ? absPath : path.dirname(absPath);
        // git worktree list outputs: <path> <commit> [<branch>] or [<annotation>]
        const output = (0, child_process_1.execSync)('git worktree list --porcelain', {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const worktrees = [];
        let currentWorktree = {};
        // Parse porcelain output
        // Format:
        // worktree <path>
        // HEAD <sha>
        // branch refs/heads/<name>
        // <blank line>
        for (const line of output.split('\n')) {
            if (line.startsWith('worktree ')) {
                currentWorktree.root = line.slice(9);
                currentWorktree.name = path.basename(currentWorktree.root);
            }
            else if (line.startsWith('HEAD ')) {
                currentWorktree.commit = line.slice(5, 12); // Abbreviated to 7 chars
            }
            else if (line.startsWith('branch ')) {
                // refs/heads/branch-name -> branch-name
                currentWorktree.branch = line.slice(7).replace('refs/heads/', '');
            }
            else if (line.startsWith('detached')) {
                currentWorktree.branch = 'detached';
            }
            else if (line === '' && currentWorktree.root) {
                // Determine if main worktree
                const gitPath = path.join(currentWorktree.root, '.git');
                try {
                    currentWorktree.isMain = fs.statSync(gitPath).isDirectory();
                }
                catch {
                    currentWorktree.isMain = false;
                }
                worktrees.push(currentWorktree);
                currentWorktree = {};
            }
        }
        // Handle last entry if no trailing newline
        if (currentWorktree.root) {
            const gitPath = path.join(currentWorktree.root, '.git');
            try {
                currentWorktree.isMain = fs.statSync(gitPath).isDirectory();
            }
            catch {
                currentWorktree.isMain = false;
            }
            worktrees.push(currentWorktree);
        }
        const main = worktrees.find(w => w.isMain) || null;
        return { worktrees, main };
    }
    catch {
        return null;
    }
}
/**
 * Find all sprint directories across all worktrees
 *
 * @param targetPath Any path within a git repository
 * @param sprintsRelativePath Relative path to sprints directory (default: .claude/sprints)
 * @returns Map of worktree name to list of sprint directory paths
 */
function findSprintsAcrossWorktrees(targetPath, sprintsRelativePath = '.claude/sprints') {
    const worktreeList = listWorktrees(targetPath);
    if (!worktreeList)
        return null;
    const result = new Map();
    for (const worktree of worktreeList.worktrees) {
        const sprintsDir = path.join(worktree.root, sprintsRelativePath);
        try {
            if (fs.existsSync(sprintsDir) && fs.statSync(sprintsDir).isDirectory()) {
                const entries = fs.readdirSync(sprintsDir, { withFileTypes: true });
                const sprintDirs = entries
                    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
                    .map(e => path.join(sprintsDir, e.name));
                if (sprintDirs.length > 0) {
                    result.set(worktree.name, sprintDirs);
                }
            }
        }
        catch {
            // Skip inaccessible directories
        }
    }
    return result;
}
/**
 * Get a display label for a worktree (combines name and branch)
 *
 * @param worktree The worktree info
 * @returns Human-readable label like "main (feature-branch)" or "parallel-1 (feature-x)"
 */
function getWorktreeLabel(worktree) {
    if (worktree.isMain) {
        return `main (${worktree.branch})`;
    }
    return `${worktree.name} (${worktree.branch})`;
}
// ============================================================================
// Convenience Functions
// ============================================================================
/**
 * Check if a path is in a git worktree (vs main repo)
 *
 * @param targetPath Any path within a git repository
 * @returns true if in a linked worktree, false if in main repo or not in git
 */
function isInWorktree(targetPath) {
    const worktree = detectWorktree(targetPath);
    return worktree !== null && !worktree.isMain;
}
/**
 * Get the worktree name for a sprint directory
 * Returns "main" for the main worktree, or the worktree directory name otherwise
 *
 * @param sprintDir Path to the sprint directory
 * @returns Worktree name or null if not in a git repo
 */
function getWorktreeName(sprintDir) {
    const worktree = detectWorktree(sprintDir);
    if (!worktree)
        return null;
    return worktree.isMain ? 'main' : worktree.name;
}
//# sourceMappingURL=worktree.js.map