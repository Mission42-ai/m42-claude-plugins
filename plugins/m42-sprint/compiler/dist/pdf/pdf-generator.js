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
        // Progress Chart (when includeCharts is true)
        if (options.includeCharts) {
            renderProgressChart(doc, progress);
            doc.moveDown();
        }
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
 * Renders a progress chart using PDFKit native drawing
 */
function renderProgressChart(doc, progress) {
    doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.phaseFontSize).text('Progress Chart', { underline: true });
    doc.moveDown(0.5);
    // Calculate status counts from phases
    const chartData = calculateChartData(progress);
    const total = chartData.total;
    if (total === 0) {
        doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.bodyFontSize).text('No data available');
        return;
    }
    // Draw segments
    const segments = [
        { count: chartData.completed, color: '#2E7D32', label: 'Completed' },
        { count: chartData.inProgress, color: '#1565C0', label: 'In Progress' },
        { count: chartData.pending, color: '#757575', label: 'Pending' },
        { count: chartData.failed, color: '#C62828', label: 'Failed' },
        { count: chartData.blocked, color: '#E65100', label: 'Blocked' },
        { count: chartData.skipped, color: '#9E9E9E', label: 'Skipped' },
    ];
    // Draw pie chart
    const pieX = 130;
    const pieY = doc.y + 50;
    const pieRadius = 45;
    renderPieChartNative(doc, segments, total, pieX, pieY, pieRadius);
    // Draw progress bar next to pie chart
    const barX = 200;
    const barY = pieY - 10;
    const barWidth = 280;
    const barHeight = 20;
    renderProgressBarNative(doc, segments, total, barX, barY, barWidth, barHeight);
    // Move below the charts
    doc.y = pieY + pieRadius + 20;
    // Draw legend
    let legendX = 50;
    let legendY = doc.y;
    for (const segment of segments) {
        if (segment.count > 0) {
            doc.rect(legendX, legendY, 10, 10).fill(segment.color);
            doc.fillColor('black').fontSize(8).text(`${segment.label}: ${segment.count}`, legendX + 14, legendY, { continued: false });
            legendX += 100;
            if (legendX > 350) {
                legendX = 50;
                legendY += 15;
            }
        }
    }
    doc.y = legendY + 20;
    doc.fillColor('black');
    // Add completion summary text
    const completedPct = total > 0 ? Math.round((chartData.completed / total) * 100) : 0;
    const failedPct = total > 0 ? Math.round((chartData.failed / total) * 100) : 0;
    const pendingPct = total > 0 ? Math.round((chartData.pending / total) * 100) : 0;
    doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.bodyFontSize).text(`Overall Progress: ${completedPct}% completed (${chartData.completed} of ${total} phases)`, { align: 'left' });
    if (chartData.failed > 0) {
        doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.metaFontSize).fillColor('#C62828').text(`Warning: ${failedPct}% failed (${chartData.failed} phases require attention)`, { align: 'left' });
        doc.fillColor('black');
    }
    if (chartData.pending > 0) {
        doc.fontSize(exports.DEFAULT_LAYOUT_CONFIG.metaFontSize).fillColor('#757575').text(`Remaining: ${pendingPct}% pending (${chartData.pending} phases)`, { align: 'left' });
        doc.fillColor('black');
    }
    doc.moveDown();
}
/**
 * Renders a pie chart segment using PDFKit native drawing
 */
function renderPieChartNative(doc, segments, total, cx, cy, radius) {
    let startAngle = -Math.PI / 2; // Start from top
    for (const segment of segments) {
        if (segment.count > 0) {
            const sweepAngle = (segment.count / total) * 2 * Math.PI;
            const endAngle = startAngle + sweepAngle;
            // Draw pie slice
            const x1 = cx + radius * Math.cos(startAngle);
            const y1 = cy + radius * Math.sin(startAngle);
            const x2 = cx + radius * Math.cos(endAngle);
            const y2 = cy + radius * Math.sin(endAngle);
            const largeArc = sweepAngle > Math.PI;
            doc.save();
            doc.moveTo(cx, cy);
            doc.lineTo(x1, y1);
            // Use arc approximation with bezier curves for PDFKit
            if (sweepAngle < 2 * Math.PI - 0.01) {
                // For segments less than full circle, draw arc path
                const midAngle = startAngle + sweepAngle / 2;
                const mx = cx + radius * Math.cos(midAngle);
                const my = cy + radius * Math.sin(midAngle);
                // Simple arc approximation
                doc.quadraticCurveTo(cx + radius * 1.2 * Math.cos(midAngle), cy + radius * 1.2 * Math.sin(midAngle), x2, y2);
            }
            else {
                // Full circle
                doc.circle(cx, cy, radius);
            }
            doc.lineTo(cx, cy);
            doc.fill(segment.color);
            doc.restore();
            startAngle = endAngle;
        }
    }
}
/**
 * Renders a horizontal progress bar using PDFKit native drawing
 */
function renderProgressBarNative(doc, segments, total, startX, startY, barWidth, barHeight) {
    let currentX = startX;
    for (const segment of segments) {
        if (segment.count > 0) {
            const segmentWidth = (segment.count / total) * barWidth;
            doc.rect(currentX, startY, segmentWidth, barHeight).fill(segment.color);
            currentX += segmentWidth;
        }
    }
}
/**
 * Calculates chart data from compiled progress
 */
function calculateChartData(progress) {
    let completed = 0;
    let pending = 0;
    let failed = 0;
    let inProgress = 0;
    let blocked = 0;
    let skipped = 0;
    if (progress.phases) {
        for (const phase of progress.phases) {
            switch (phase.status) {
                case 'completed':
                    completed++;
                    break;
                case 'pending':
                    pending++;
                    break;
                case 'failed':
                    failed++;
                    break;
                case 'in-progress':
                    inProgress++;
                    break;
                case 'blocked':
                    blocked++;
                    break;
                case 'skipped':
                    skipped++;
                    break;
            }
        }
    }
    const total = completed + pending + failed + inProgress + blocked + skipped;
    return { completed, pending, failed, inProgress, blocked, skipped, total };
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