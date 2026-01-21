"use strict";
/**
 * Export PDF CLI Module
 *
 * CLI for exporting sprint progress to PDF format.
 * Accepts sprint path, output options, and chart flags.
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
exports.CLI_VERSION = void 0;
exports.parseExportArgs = parseExportArgs;
exports.runExportCommand = runExportCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const pdf_generator_js_1 = require("./pdf-generator.js");
// ============================================================================
// Constants
// ============================================================================
exports.CLI_VERSION = '1.0.0';
// ============================================================================
// Argument Parsing
// ============================================================================
/**
 * Parses command-line arguments for the export-pdf CLI.
 *
 * @param args - The command-line arguments (process.argv)
 * @returns Parsed arguments with options and flags
 */
function parseExportArgs(args) {
    // Skip node and script name
    const cliArgs = args.slice(2);
    const result = {
        options: {
            includeCharts: false,
        },
    };
    let i = 0;
    while (i < cliArgs.length) {
        const arg = cliArgs[i];
        if (arg === '--help' || arg === '-h') {
            result.showHelp = true;
            i++;
        }
        else if (arg === '--version') {
            result.showVersion = true;
            i++;
        }
        else if (arg === '--charts' || arg === '-c') {
            result.options.includeCharts = true;
            i++;
        }
        else if (arg === '--output' || arg === '-o') {
            if (i + 1 < cliArgs.length) {
                result.options.outputPath = cliArgs[i + 1];
                i += 2;
            }
            else {
                result.error = 'Missing value for --output option';
                i++;
            }
        }
        else if (!arg.startsWith('-')) {
            // Positional argument - sprint path
            result.sprintPath = arg;
            i++;
        }
        else {
            // Unknown option
            i++;
        }
    }
    // Check for required sprint path (unless help or version is requested)
    if (!result.showHelp && !result.showVersion && !result.sprintPath) {
        result.error = 'Error: Sprint path is required';
    }
    return result;
}
// ============================================================================
// Export Command
// ============================================================================
/**
 * Runs the PDF export command.
 *
 * @param sprintPath - Path to the sprint directory
 * @param options - Export options
 * @returns Result of the export operation
 */
async function runExportCommand(sprintPath, options) {
    // Resolve to absolute path
    const absoluteSprintPath = path.resolve(sprintPath);
    // Check if sprint directory exists
    if (!fs.existsSync(absoluteSprintPath)) {
        return {
            success: false,
            error: `Sprint directory not found: ${absoluteSprintPath}`,
            exitCode: 1,
        };
    }
    // Check if PROGRESS.yaml exists
    const progressPath = path.join(absoluteSprintPath, 'PROGRESS.yaml');
    if (!fs.existsSync(progressPath)) {
        return {
            success: false,
            error: `PROGRESS.yaml not found. Run /run-sprint to compile the sprint first.`,
            exitCode: 1,
        };
    }
    // Read and parse PROGRESS.yaml
    let progress;
    try {
        const content = fs.readFileSync(progressPath, 'utf8');
        progress = yaml.load(content);
    }
    catch (err) {
        return {
            success: false,
            error: `Failed to parse PROGRESS.yaml: ${err}`,
            exitCode: 1,
        };
    }
    // Determine output path
    let outputPath;
    if (options.outputPath) {
        outputPath = path.resolve(options.outputPath);
        // Ensure parent directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    }
    else {
        // Default: artifacts/<sprint-id>.pdf
        const artifactsDir = path.join(absoluteSprintPath, 'artifacts');
        if (!fs.existsSync(artifactsDir)) {
            fs.mkdirSync(artifactsDir, { recursive: true });
        }
        const sprintId = progress['sprint-id'] || 'sprint';
        outputPath = path.join(artifactsDir, `${sprintId}.pdf`);
    }
    // Generate PDF
    try {
        const pdfOptions = {
            title: `Sprint Summary: ${progress['sprint-id']}`,
            includeCharts: options.includeCharts,
        };
        const pdfBuffer = await (0, pdf_generator_js_1.createPdfDocument)(progress, pdfOptions);
        fs.writeFileSync(outputPath, pdfBuffer);
        const message = `PDF exported successfully!\n\nOutput: ${outputPath}`;
        return {
            success: true,
            outputPath,
            message,
            exitCode: 0,
        };
    }
    catch (err) {
        return {
            success: false,
            error: `Failed to generate PDF: ${err}`,
            exitCode: 1,
        };
    }
}
// ============================================================================
// Help Text
// ============================================================================
/**
 * Returns the help text for the CLI.
 */
function getHelpText() {
    return `
Usage: export-pdf [options] <sprint-path>

Export sprint progress to PDF format.

Arguments:
  sprint-path              Path to the sprint directory containing PROGRESS.yaml

Options:
  -c, --charts             Include visual progress charts in the PDF
  -o, --output <path>      Custom output path for the PDF file
  -h, --help               Display this help message
  --version                Display version number

Examples:
  export-pdf .claude/sprints/2026-01-21_my-sprint
  export-pdf --charts ./my-sprint
  export-pdf -o ./report.pdf ./my-sprint
`.trim();
}
// ============================================================================
// CLI Entry Point
// ============================================================================
async function main() {
    const parsed = parseExportArgs(process.argv);
    // Handle help
    if (parsed.showHelp) {
        console.log(getHelpText());
        process.exit(0);
    }
    // Handle version
    if (parsed.showVersion) {
        console.log(`export-pdf version ${exports.CLI_VERSION}`);
        process.exit(0);
    }
    // Handle parsing errors
    if (parsed.error) {
        console.error(parsed.error);
        console.error('\nRun "export-pdf --help" for usage information.');
        process.exit(1);
    }
    // Run export
    const result = await runExportCommand(parsed.sprintPath, parsed.options);
    if (result.success) {
        console.log(result.message);
    }
    else {
        console.error(result.error);
    }
    process.exit(result.exitCode);
}
// Run if executed directly
const scriptName = path.basename(process.argv[1] || '');
if (scriptName === 'export-pdf-cli.js' || scriptName === 'export-pdf-cli.ts') {
    main().catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=export-pdf-cli.js.map