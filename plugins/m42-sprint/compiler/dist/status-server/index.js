#!/usr/bin/env node
"use strict";
/**
 * Sprint Status Server CLI
 *
 * Serves a live web status page that displays sprint progress in real-time.
 * Watches PROGRESS.yaml for changes and streams updates via SSE.
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
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const server_js_1 = require("./server.js");
const browser_js_1 = require("./browser.js");
const program = new commander_1.Command();
program
    .name('sprint-status-server')
    .description('Serve a live web status page for sprint progress')
    .version('1.0.0');
program
    .argument('<sprint-dir>', 'Path to the sprint directory containing PROGRESS.yaml')
    .option('-p, --port <number>', 'Port to listen on', '3100')
    .option('-H, --host <host>', 'Host to bind to', 'localhost')
    .option('--no-browser', 'Disable automatic browser opening')
    .action(async (sprintDir, options) => {
    try {
        // Resolve paths
        const absoluteSprintDir = path.resolve(sprintDir);
        const port = parseInt(options.port, 10);
        const host = options.host;
        // Validate port
        if (isNaN(port) || port < 1 || port > 65535) {
            console.error(`Error: Invalid port number: ${options.port}`);
            process.exit(1);
        }
        // Validate sprint directory exists
        if (!fs.existsSync(absoluteSprintDir)) {
            console.error(`Error: Sprint directory not found: ${absoluteSprintDir}`);
            process.exit(1);
        }
        // Validate PROGRESS.yaml exists
        const progressYamlPath = path.join(absoluteSprintDir, 'PROGRESS.yaml');
        if (!fs.existsSync(progressYamlPath)) {
            console.error(`Error: PROGRESS.yaml not found in ${absoluteSprintDir}`);
            process.exit(1);
        }
        // Path for port discovery file
        const portFilePath = path.join(absoluteSprintDir, '.sprint-status.port');
        // Create and start server
        const server = new server_js_1.StatusServer({
            sprintDir: absoluteSprintDir,
            port,
            host,
        });
        // Handle graceful shutdown
        const shutdown = async (signal) => {
            console.log(`\n${signal} received, shutting down...`); // intentional
            // Delete port file
            try {
                if (fs.existsSync(portFilePath)) {
                    fs.unlinkSync(portFilePath);
                }
            }
            catch (error) {
                // Ignore errors deleting port file
            }
            await server.stop();
            process.exit(0);
        };
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        // Start server
        await server.start();
        await server.waitForReady();
        // Write port to discovery file
        fs.writeFileSync(portFilePath, port.toString(), 'utf-8');
        // Display server URL
        const url = server.getUrl();
        console.log(`Sprint Status Server started`); // intentional
        console.log(`  URL: ${url}`); // intentional
        console.log(`  Watching: ${progressYamlPath}`); // intentional
        console.log(`  Port file: ${portFilePath}`); // intentional
        // Open browser if not disabled
        if (options.browser) {
            (0, browser_js_1.openBrowser)(url);
        }
        console.log(''); // intentional
        console.log('Press Ctrl+C to stop'); // intentional
    }
    catch (error) {
        console.error('Failed to start server:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=index.js.map