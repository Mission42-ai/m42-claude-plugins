/**
 * PDF Generator Module for Sprint Summaries
 *
 * Creates PDF documents from CompiledProgress data using PDFKit.
 */
import type { CompiledProgress } from '../types.js';
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
 * Creates a PDF document from sprint progress data.
 *
 * @param progress - The compiled sprint progress data
 * @param options - PDF generation options
 * @returns Promise that resolves to a Buffer containing the PDF
 */
export declare function createPdfDocument(progress: CompiledProgress, options?: PdfOptions): Promise<Buffer>;
//# sourceMappingURL=pdf-generator.d.ts.map