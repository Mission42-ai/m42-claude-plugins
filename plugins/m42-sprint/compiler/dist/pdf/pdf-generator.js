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
exports.createPdfDocument = createPdfDocument;
const pdfkit_1 = __importDefault(require("pdfkit"));
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
function renderStats(doc, stats) {
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
function renderPhase(doc, phase) {
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
function renderStep(doc, step) {
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
function renderSubPhase(doc, phase) {
    doc.fontSize(9).text(`    ${phase.id} [${phase.status}]`, { indent: 40 });
    doc.fontSize(8).text(phase.prompt, { indent: 60 });
    if (phase.summary) {
        doc.fillColor('gray').text(`Summary: ${phase.summary}`, { indent: 60 });
        doc.fillColor('black');
    }
}
//# sourceMappingURL=pdf-generator.js.map