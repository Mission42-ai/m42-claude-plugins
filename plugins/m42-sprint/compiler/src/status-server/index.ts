#!/usr/bin/env node
/**
 * Sprint Status Server CLI
 *
 * Serves a live web status page that displays sprint progress in real-time.
 * Watches PROGRESS.yaml for changes and streams updates via SSE.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { StatusServer } from './server.js';
import { openBrowser } from './browser.js';

const program = new Command();

program
  .name('sprint-status-server')
  .description('Serve a live web status page for sprint progress')
  .version('1.0.0');

program
  .argument('<sprint-dir>', 'Path to the sprint directory containing PROGRESS.yaml')
  .option('-p, --port <number>', 'Port to listen on', '3100')
  .option('-H, --host <host>', 'Host to bind to', 'localhost')
  .option('--no-browser', 'Disable automatic browser opening')
  .action(async (sprintDir: string, options: { port: string; host: string; browser: boolean }) => {
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
      const server = new StatusServer({
        sprintDir: absoluteSprintDir,
        port,
        host,
      });

      // Handle graceful shutdown
      const shutdown = async (signal: string) => {
        console.log(`\n${signal} received, shutting down...`); // intentional

        // Delete port file
        try {
          if (fs.existsSync(portFilePath)) {
            fs.unlinkSync(portFilePath);
          }
        } catch (error) {
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
        openBrowser(url);
      }

      console.log(''); // intentional
      console.log('Press Ctrl+C to stop'); // intentional
    } catch (error) {
      console.error(
        'Failed to start server:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

program.parse();
