"use strict";
/**
 * PDF Generator Module for Sprint Summaries
 *
 * Creates PDF documents from CompiledProgress data using PDFKit.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LAYOUT_CONFIG = void 0;
exports.getStatusIndicator = getStatusIndicator;
exports.getStatusColor = getStatusColor;
exports.formatCompletionPercentage = formatCompletionPercentage;
exports.createPdfDocument = createPdfDocument;
const pdfkit_1 = __importDefault(require("pdfkit"));
/**
 * Default layout configuration
 */
exports.DEFAULT_LAYOUT_CONFIG = {
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
function getStatusIndicator(status) {
    const indicators = {
        'completed': '\u2713', // ✓ checkmark
        'in-progress': '\u25C9', // ◉ filled circle
        'pending': '\u25CB', // ○ empty circle
        'failed': '\u2717', // ✗ x mark
        'blocked': '\u2298', // ⊘ blocked symbol
        'skipped': '\u229D', // ⊝ skipped symbol
    };
    return indicators[status] || '?';
}
/**
 * Returns a hex color code for the given phase status.
 *
 * @param status - The phase status
 * @returns Hex color code string
 */
function getStatusColor(status) {
    const colors = {
        'completed': '#2E7D32', // Green
        'in-progress': '#1565C0', // Blue
        'pending': '#757575', // Gray
        'failed': '#C62828', // Red
        'blocked': '#E65100', // Orange
        'skipped': '#9E9E9E', // Light gray
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
function formatCompletionPercentage(completed, total) {
    if (total === 0)
        return '0%';
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
async function createPdfDocument(progress, options = {}) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({
            size: options.pageSize || 'A4',
            margin: 50,
        });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        // Title
        const title = options.title || 'Sprint Summary';
        doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.titleFontSize).text(title, { align: 'center' });
        doc.moveDown();
        // Sprint ID and Status
        doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.phaseFontSize).text(`Sprint ID: ${progress['sprint-id']}`);
        doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.stepFontSize).text(`Status: ${progress.status}`);
        doc.moveDown();
        // Statistics
        renderStats(doc, progress.stats);
        doc.moveDown();
        // Phases
        if (progress.phases && progress.phases.length > 0) {
            doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.sectionFontSize).text('Phases', { underline: true });
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
function renderStats(doc, stats) {
    doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.phaseFontSize).text('Statistics', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.bodyFontSize);
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
function renderPhase(doc, phase) {
    doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.stepFontSize).text(`${phase.id} [${phase.status}]`, { continued: false });
    if (phase.prompt) {
        doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.bodyFontSize).text(phase.prompt, { indent: exports.DEFAULT_LAYOUT_CONFIG.stepIndent });
    }
    if (phase.summary) {
        doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.metaFontSize).fillColor('gray').text(`Summary: ${phase.summary}`, { indent: exports.DEFAULT_LAYOUT_CONFIG.stepIndent });
        doc.fillColor('black');
    }
    if (phase.elapsed) {
        doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.metaFontSize).fillColor('gray').text(`Elapsed: ${phase.elapsed}`, { indent: exports.DEFAULT_LAYOUT_CONFIG.stepIndent });
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
function renderStep(doc, step) {
    // Step header with slight size reduction from phase header
    const stepHeaderSize = exports.DEFAULT_LAYOUT_CONFIG.stepFontSize - 1; // 11pt
    doc.fontSize(stepHeaderSize).text(`  ${step.id} [${step.status}]`, { indent: exports.DEFAULT_LAYOUT_CONFIG.stepIndent });
    doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.metaFontSize).text(step.prompt, { indent: exports.DEFAULT_LAYOUT_CONFIG.subPhaseIndent });
    if (step.elapsed) {
        const timingSize = exports.DEFAULT_LAYOUT_CONFIG.metaFontSize - 1; // 8pt for timing
        doc.fontSize(timingSize).fillColor('gray').text(`Elapsed: ${step.elapsed}`, { indent: exports.DEFAULT_LAYOUT_CONFIG.subPhaseIndent });
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
function renderSubPhase(doc, phase) {
    const subPhaseHeaderSize = exports.DEFAULT_LAYOUT_CONFIG.metaFontSize; // 9pt
    const subPhaseBodySize = exports.DEFAULT_LAYOUT_CONFIG.metaFontSize - 1; // 8pt
    const subPhaseDeepIndent = exports.DEFAULT_LAYOUT_CONFIG.subPhaseIndent + exports.DEFAULT_LAYOUT_CONFIG.stepIndent; // 60pt
    doc.fontSize(subPhaseHeaderSize).text(`    ${phase.id} [${phase.status}]`, { indent: exports.DEFAULT_LAYOUT_CONFIG.subPhaseIndent });
    doc.fontSize(subPhaseBodySize).text(phase.prompt, { indent: subPhaseDeepIndent });
    if (phase.summary) {
        doc.fillColor('gray').text(`Summary: ${phase.summary}`, { indent: subPhaseDeepIndent });
        doc.fillColor('black');
    }
}
//# sourceMappingURL=pdf-generator.js.map