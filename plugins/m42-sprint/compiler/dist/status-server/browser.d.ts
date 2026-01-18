/**
 * Cross-platform browser opener utility
 * Opens URLs in the system's default browser on macOS, Windows, and Linux
 */
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
export declare function openBrowser(url: string): Promise<void>;
//# sourceMappingURL=browser.d.ts.map