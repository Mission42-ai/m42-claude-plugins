"use strict";
/**
 * Cross-platform browser opener utility
 * Opens URLs in the system's default browser on macOS, Windows, and Linux
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.openBrowser = openBrowser;
const child_process_1 = require("child_process");
/**
 * Open a URL in the system's default browser
 *
 * Uses platform-specific commands:
 * - darwin (macOS): `open`
 * - win32 (Windows): `cmd /c start`
 * - linux: `xdg-open`
 *
 * @param url - The URL to open in the browser
 * @returns Promise that resolves when the browser command is spawned
 */
async function openBrowser(url) {
    const platform = process.platform;
    let command;
    let args;
    if (platform === 'darwin') {
        // macOS: use 'open' command
        command = 'open';
        args = [url];
    }
    else if (platform === 'win32') {
        // Windows: 'start' is a shell built-in, must invoke via cmd.exe
        // Empty string after 'start' is required for URLs with special characters
        command = 'cmd';
        args = ['/c', 'start', '', url];
    }
    else if (platform === 'linux') {
        // Linux: use xdg-open for freedesktop-compliant systems
        command = 'xdg-open';
        args = [url];
    }
    else {
        // Unsupported platform - fallback to console message
        console.log(`[Browser] Cannot auto-open browser on platform '${platform}'`);
        console.log(`[Browser] Please open manually: ${url}`);
        return;
    }
    try {
        const child = (0, child_process_1.spawn)(command, args, {
            detached: true,
            stdio: 'ignore',
        });
        // Don't wait for the browser to close
        child.unref();
        // Handle spawn errors
        child.on('error', (error) => {
            console.error(`[Browser] Failed to open browser: ${error.message}`);
            console.log(`[Browser] Please open manually: ${url}`);
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[Browser] Failed to spawn browser command: ${message}`);
        console.log(`[Browser] Please open manually: ${url}`);
    }
}
//# sourceMappingURL=browser.js.map