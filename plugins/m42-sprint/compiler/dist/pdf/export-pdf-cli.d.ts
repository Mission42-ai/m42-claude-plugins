/**
 * Export PDF CLI Module
 *
 * CLI for exporting sprint progress to PDF format.
 * Accepts sprint path, output options, and chart flags.
 */
export declare const CLI_VERSION = "1.0.0";
/**
 * Options for PDF export
 */
export interface ExportPdfOptions {
    /** Whether to include visual charts in the PDF */
    includeCharts: boolean;
    /** Custom output path (overrides default artifacts directory) */
    outputPath?: string;
}
/**
 * Result of parsing command-line arguments
 */
export interface ParsedArgs {
    /** Path to the sprint directory */
    sprintPath?: string;
    /** Export options */
    options: ExportPdfOptions;
    /** Whether to show help */
    showHelp?: boolean;
    /** Whether to show version */
    showVersion?: boolean;
    /** Error message if parsing failed */
    error?: string;
}
/**
 * Result of running the export command
 */
export interface ExportPdfResult {
    /** Whether the export succeeded */
    success: boolean;
    /** Path to the generated PDF file */
    outputPath?: string;
    /** Success message */
    message?: string;
    /** Error message if export failed */
    error?: string;
    /** Exit code for CLI */
    exitCode: number;
}
/**
 * Parses command-line arguments for the export-pdf CLI.
 *
 * @param args - The command-line arguments (process.argv)
 * @returns Parsed arguments with options and flags
 */
export declare function parseExportArgs(args: string[]): ParsedArgs;
/**
 * Runs the PDF export command.
 *
 * @param sprintPath - Path to the sprint directory
 * @param options - Export options
 * @returns Result of the export operation
 */
export declare function runExportCommand(sprintPath: string, options: ExportPdfOptions): Promise<ExportPdfResult>;
//# sourceMappingURL=export-pdf-cli.d.ts.map