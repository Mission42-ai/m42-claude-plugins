/**
 * PDF Generator Module for Sprint Summaries
 *
 * Creates PDF documents from CompiledProgress data using PDFKit.
 */
import type { CompiledProgress, PhaseStatus } from '../types.js';
/**
 * Options for PDF document generation
 */
export interface PdfOptions {
    /** Document title shown in header */
    title?: string;
    /** Whether to include visual charts (Phase 2 feature) */
    includeCharts?: boolean;
    /** Output page size */
    pageSize?: 'A4' | 'Letter';
    /** Custom margins in points */
    margins?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
    };
}
/**
 * Sprint data wrapper for PDF generation
 * Extends CompiledProgress with any PDF-specific metadata
 */
export interface SprintPdfData extends CompiledProgress {
    /** Optional override for document title */
    documentTitle?: string;
}
/**
 * Layout configuration for PDF generation
 */
export interface PdfLayoutConfig {
    titleFontSize: number;
    sectionFontSize: number;
    phaseFontSize: number;
    stepFontSize: number;
    bodyFontSize: number;
    metaFontSize: number;
    sectionSpacing: number;
    phaseSpacing: number;
    stepIndent: number;
    subPhaseIndent: number;
}
/**
 * Default layout configuration
 */
export declare const DEFAULT_LAYOUT_CONFIG: PdfLayoutConfig;
/**
 * Returns a visual status indicator character for the given phase status.
 *
 * @param status - The phase status
 * @returns Unicode character representing the status
 */
export declare function getStatusIndicator(status: PhaseStatus): string;
/**
 * Returns a hex color code for the given phase status.
 *
 * @param status - The phase status
 * @returns Hex color code string
 */
export declare function getStatusColor(status: PhaseStatus): string;
/**
 * Formats a completion percentage string from completed and total counts.
 *
 * @param completed - Number of completed items
 * @param total - Total number of items
 * @returns Formatted percentage string (e.g., "75%")
 */
export declare function formatCompletionPercentage(completed: number, total: number): string;
/**
 * Creates a PDF document from sprint progress data.
 *
 * @param progress - The compiled sprint progress data
 * @param options - PDF generation options
 * @returns Promise that resolves to a Buffer containing the PDF
 */
export declare function createPdfDocument(progress: CompiledProgress, options?: PdfOptions): Promise<Buffer>;
//# sourceMappingURL=pdf-generator.d.ts.map