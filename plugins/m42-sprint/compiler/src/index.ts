#!/usr/bin/env node
/**
 * Sprint Workflow Compiler CLI
 *
 * Compiles SPRINT.yaml + workflow definitions into PROGRESS.yaml
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { compile } from './compile.js';
import type { CompilerConfig, CompiledProgress } from './types.js';

const program = new Command();

program
  .name('sprint-compile')
  .description('Compile sprint workflow definitions into PROGRESS.yaml')
  .version('1.0.0');

program
  .argument('<sprint-dir>', 'Path to the sprint directory containing SPRINT.yaml')
  .option('-w, --workflows <dir>', 'Path to workflows directory', '.claude/workflows')
  .option('-o, --output <file>', 'Output file path (default: <sprint-dir>/PROGRESS.yaml)')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--dry-run', 'Validate and show result without writing')
  .action(async (sprintDir: string, options: {
    workflows: string;
    output?: string;
    verbose?: boolean;
    dryRun?: boolean;
  }) => {
    try {
      // Resolve paths
      const absoluteSprintDir = path.resolve(sprintDir);
      const absoluteWorkflowsDir = path.resolve(options.workflows);
      const outputPath = options.output
        ? path.resolve(options.output)
        : path.join(absoluteSprintDir, 'PROGRESS.yaml');

      // Validate sprint directory exists
      if (!fs.existsSync(absoluteSprintDir)) {
        console.error(`Error: Sprint directory not found: ${absoluteSprintDir}`);
        process.exit(1);
      }

      // Validate SPRINT.yaml exists
      const sprintYamlPath = path.join(absoluteSprintDir, 'SPRINT.yaml');
      if (!fs.existsSync(sprintYamlPath)) {
        console.error(`Error: SPRINT.yaml not found in ${absoluteSprintDir}`);
        process.exit(1);
      }

      // Validate workflows directory exists
      if (!fs.existsSync(absoluteWorkflowsDir)) {
        console.error(`Error: Workflows directory not found: ${absoluteWorkflowsDir}`);
        console.error('Create it with: mkdir -p .claude/workflows');
        process.exit(1);
      }

      if (options.verbose) {
        console.log('Sprint Compiler Configuration:');
        console.log(`  Sprint dir: ${absoluteSprintDir}`);
        console.log(`  Workflows dir: ${absoluteWorkflowsDir}`);
        console.log(`  Output: ${outputPath}`);
        console.log('');
      }

      // Compile
      const config: CompilerConfig = {
        workflowsDir: absoluteWorkflowsDir,
        sprintDir: absoluteSprintDir,
        verbose: options.verbose
      };

      const result = await compile(config);

      // Report warnings
      if (result.warnings.length > 0) {
        console.warn('\nWarnings:');
        result.warnings.forEach(w => console.warn(`  - ${w}`));
      }

      // Report errors
      if (!result.success || result.errors.length > 0) {
        console.error('\nErrors:');
        result.errors.forEach(e => {
          console.error(`  [${e.code}] ${e.message}`);
          if (e.path) console.error(`    at: ${e.path}`);
        });
        process.exit(1);
      }

      // Output result
      if (result.progress) {
        const yamlOutput = yaml.dump(result.progress, {
          indent: 2,
          lineWidth: 120,
          noRefs: true,
          sortKeys: false
        });

        if (options.dryRun) {
          console.log('\n--- Compiled PROGRESS.yaml (dry-run) ---\n');
          console.log(yamlOutput);
        } else {
          fs.writeFileSync(outputPath, yamlOutput, 'utf8');
          console.log(`\nCompiled successfully: ${outputPath}`);

          // Summary
          const p = result.progress;
          console.log(`\nSummary:`);
          console.log(`  Phases: ${p.phases.length}`);
          const totalSteps = p.phases.reduce((acc, phase) =>
            acc + (phase.steps?.length || 0), 0);
          if (totalSteps > 0) {
            console.log(`  Steps: ${totalSteps}`);
          }
          const totalSubPhases = p.phases.reduce((acc, phase) =>
            acc + (phase.steps?.reduce((a, s) => a + s.phases.length, 0) || 0), 0);
          if (totalSubPhases > 0) {
            console.log(`  Sub-phases: ${totalSubPhases}`);
          }
        }
      }

    } catch (error) {
      console.error('Compilation failed:', error instanceof Error ? error.message : error);
      if (options.verbose && error instanceof Error) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
