/**
 * PDF Generator Module for Sprint Summaries
 *
 * Creates PDF documents from CompiledProgress data using PDFKit.
 */

import PDFDocument from 'pdfkit';
import type {
  CompiledProgress,
  CompiledTopPhase,
  CompiledStep,
  CompiledPhase,
  PhaseStatus,
} from '../types.js';

// ============================================================================
// Types/Interfaces
// ============================================================================

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
  titleFontSize: number;      // 24pt - Document title (H1)
  sectionFontSize: number;    // 16pt - Section headers (H2)
  phaseFontSize: number;      // 14pt - Phase headers (H3)
  stepFontSize: number;       // 12pt - Step headers
  bodyFontSize: number;       // 10pt - Body text
  metaFontSize: number;       // 9pt - Metadata/timing
  sectionSpacing: number;     // 1.5 - Line breaks between sections
  phaseSpacing: number;       // 1 - Line break between phases
  stepIndent: number;         // 20pt - Step indentation
  subPhaseIndent: number;     // 40pt - Sub-phase indentation
}

/**
 * Default layout configuration
 */
export const DEFAULT_LAYOUT_CONFIG: PdfLayoutConfig = {
  titleFontSize: 24,
  sectionFontSize: 16,
  phaseFontSize: 14,
  stepFontSize: 12,
  bodyFontSize: 10,
  metaFontSize: 9,
  sectionSpacing: 1.5,
  phaseSpacing: 1,
  stepIndent: 20,
  subPhaseIndent: 40,
};

// ============================================================================
// Status Helper Functions
// ============================================================================

/**
 * Returns a visual status indicator character for the given phase status.
 *
 * @param status - The phase status
 * @returns Unicode character representing the status
 */
export function getStatusIndicator(status: PhaseStatus): string {
  const indicators: Record<PhaseStatus, string> = {
    'completed': '\u2713',    // ✓ checkmark
    'in-progress': '\u25C9',  // ◉ filled circle
    'pending': '\u25CB',      // ○ empty circle
    'failed': '\u2717',       // ✗ x mark
    'blocked': '\u2298',      // ⊘ blocked symbol
    'skipped': '\u229D',      // ⊝ skipped symbol
  };
  return indicators[status] || '?';
}

/**
 * Returns a hex color code for the given phase status.
 *
 * @param status - The phase status
 * @returns Hex color code string
 */
export function getStatusColor(status: PhaseStatus): string {
  const colors: Record<PhaseStatus, string> = {
    'completed': '#2E7D32',   // Green
    'in-progress': '#1565C0', // Blue
    'pending': '#757575',     // Gray
    'failed': '#C62828',      // Red
    'blocked': '#E65100',     // Orange
    'skipped': '#9E9E9E',     // Light gray
  };
  return colors[status] || '#000000';
}

/**
 * Formats a completion percentage string from completed and total counts.
 *
 * @param completed - Number of completed items
 * @param total - Total number of items
 * @returns Formatted percentage string (e.g., "75%")
 */
export function formatCompletionPercentage(completed: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((completed / total) * 100)}%`;
}

// ============================================================================
// PDF Generation
// ============================================================================

/**
 * Creates a PDF document from sprint progress data.
 *
 * @param progress - The compiled sprint progress data
 * @param options - PDF generation options
 * @returns Promise that resolves to a Buffer containing the PDF
 */
export async function createPdfDocument(
  progress: CompiledProgress,
  options: PdfOptions = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: options.pageSize || 'A4',
      margin: 50,
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    const title = options.title || 'Sprint Summary';
    doc.fontSize(24).text(title, { align: 'center' });
    doc.moveDown();

    // Sprint ID and Status
    doc.fontSize(14).text(`Sprint ID: ${progress['sprint-id']}`);
    doc.fontSize(12).text(`Status: ${progress.status}`);
    doc.moveDown();

    // Statistics
    renderStats(doc, progress.stats);
    doc.moveDown();

    // Phases
    if (progress.phases && progress.phases.length > 0) {
      doc.fontSize(16).text('Phases', { underline: true });
      doc.moveDown(0.5);

      for (const phase of progress.phases) {
        renderPhase(doc, phase);
      }
    }

    doc.end();
  });
}

/**
 * Renders sprint statistics section
 */
function renderStats(doc: PDFKit.PDFDocument, stats: CompiledProgress['stats']): void {
  doc.fontSize(14).text('Statistics', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);

  if (stats['started-at']) {
    doc.text(`Started: ${stats['started-at']}`);
  }
  if (stats['completed-at']) {
    doc.text(`Completed: ${stats['completed-at']}`);
  }
  if (stats.elapsed) {
    doc.text(`Elapsed: ${stats.elapsed}`);
  }
  doc.text(`Phases: ${stats['completed-phases']}/${stats['total-phases']}`);
  if (stats['total-steps'] !== undefined) {
    doc.text(`Steps: ${stats['completed-steps'] || 0}/${stats['total-steps']}`);
  }
}

/**
 * Renders a top-level phase
 */
function renderPhase(doc: PDFKit.PDFDocument, phase: CompiledTopPhase): void {
  doc.fontSize(12).text(`${phase.id} [${phase.status}]`, { continued: false });

  if (phase.prompt) {
    doc.fontSize(10).text(phase.prompt, { indent: 20 });
  }

  if (phase.summary) {
    doc.fontSize(9).fillColor('gray').text(`Summary: ${phase.summary}`, { indent: 20 });
    doc.fillColor('black');
  }

  if (phase.elapsed) {
    doc.fontSize(9).fillColor('gray').text(`Elapsed: ${phase.elapsed}`, { indent: 20 });
    doc.fillColor('black');
  }

  // Render steps if present
  if (phase.steps && phase.steps.length > 0) {
    for (const step of phase.steps) {
      renderStep(doc, step);
    }
  }

  doc.moveDown(0.5);
}

/**
 * Renders a step within a phase
 */
function renderStep(doc: PDFKit.PDFDocument, step: CompiledStep): void {
  doc.fontSize(11).text(`  ${step.id} [${step.status}]`, { indent: 20 });
  doc.fontSize(9).text(step.prompt, { indent: 40 });

  if (step.elapsed) {
    doc.fontSize(8).fillColor('gray').text(`Elapsed: ${step.elapsed}`, { indent: 40 });
    doc.fillColor('black');
  }

  // Render sub-phases if present
  if (step.phases && step.phases.length > 0) {
    for (const subPhase of step.phases) {
      renderSubPhase(doc, subPhase);
    }
  }
}

/**
 * Renders a sub-phase within a step
 */
function renderSubPhase(doc: PDFKit.PDFDocument, phase: CompiledPhase): void {
  doc.fontSize(9).text(`    ${phase.id} [${phase.status}]`, { indent: 40 });
  doc.fontSize(8).text(phase.prompt, { indent: 60 });

  if (phase.summary) {
    doc.fillColor('gray').text(`Summary: ${phase.summary}`, { indent: 60 });
    doc.fillColor('black');
  }
}
