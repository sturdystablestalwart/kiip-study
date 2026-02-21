'use strict';

/**
 * pdfGenerator.js
 * Generates styled PDFs using pdfkit with Japandi design tokens matching the web app.
 */

// ---------------------------------------------------------------------------
// Design Tokens (matching client/src/theme/tokens.js)
// ---------------------------------------------------------------------------
const TOKENS = {
    canvas:       '#F7F2E8',
    surface:      '#FFFFFF',
    textPrimary:  '#1F2328',
    textMuted:    '#5B5F64',
    textFaint:    '#7B8086',
    clay:         '#A0634A',
    moss:         '#657655',
    indigo:       '#2A536D',
    success:      '#2F6B4F',
    danger:       '#B43A3A',
    borderSubtle: '#E2DDD4',
    correctBg:    '#EDF5E9',
    wrongBg:      '#FAEDED',
    warning:      '#B07A2A',
};

// Option labels for MCQ
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Margin and layout constants
const MARGIN = 50;
const PAGE_WIDTH  = 595.28; // A4 width in points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Draw a thin horizontal rule at the current y position.
 */
function drawRule(doc, y) {
    doc.save()
       .strokeColor(TOKENS.borderSubtle)
       .lineWidth(0.5)
       .moveTo(MARGIN, y)
       .lineTo(PAGE_WIDTH - MARGIN, y)
       .stroke()
       .restore();
}

/**
 * Render a small coloured pill / badge (used for "correct" / "wrong" labels).
 * Returns the height of the badge.
 */
function drawBadge(doc, x, y, label, color) {
    const BADGE_H = 14;
    const BADGE_PAD = 6;
    const textW = doc.widthOfString(label, { fontSize: 8 });
    const badgeW = textW + BADGE_PAD * 2;

    doc.save()
       .roundedRect(x, y - 1, badgeW, BADGE_H, 3)
       .fill(color)
       .fillColor('#FFFFFF')
       .fontSize(8)
       .text(label, x + BADGE_PAD, y + 2, { lineBreak: false })
       .restore();

    return BADGE_H;
}

/**
 * Safely get a safe y-position, accounting for remaining page space.
 * If less than minSpace points remain, add a new page.
 */
function ensureSpace(doc, minSpace) {
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 30;
    if (doc.y + minSpace > bottomLimit) {
        doc.addPage();
    }
}

// ---------------------------------------------------------------------------
// Question-type renderers
// ---------------------------------------------------------------------------

/**
 * Render MCQ-single question.
 * Options are shown as A / B / C / D.
 * If showAnswers=true, correct option gets a green marker.
 * If userSelectedIdx is provided, it's marked green (correct) or red (wrong).
 */
function renderMcqSingle(doc, question, options) {
    const { showAnswers, userSelectedIdx } = options;
    const correctIdx = question.options.findIndex(o => o.isCorrect);

    question.options.forEach((opt, i) => {
        ensureSpace(doc, 28);

        const label  = OPTION_LABELS[i] || String(i + 1);
        const isCorrect = opt.isCorrect;
        const isUserChoice = (userSelectedIdx != null && userSelectedIdx === i);
        const isUserCorrect = isUserChoice && isCorrect;
        const isUserWrong   = isUserChoice && !isCorrect;

        // Determine row background
        let rowColor = null;
        if (showAnswers && isCorrect) rowColor = TOKENS.correctBg;
        if (isUserWrong)              rowColor = TOKENS.wrongBg;

        const rowY = doc.y;
        const rowH = Math.max(
            doc.heightOfString(opt.text, { width: CONTENT_WIDTH - 60, fontSize: 11 }) + 10,
            24
        );

        // Background highlight
        if (rowColor) {
            doc.save()
               .rect(MARGIN, rowY - 2, CONTENT_WIDTH, rowH + 4)
               .fill(rowColor)
               .restore();
        }

        // Circle with letter
        const circleX = MARGIN + 11;
        const circleY = rowY + 8;
        let circleColor = TOKENS.borderSubtle;
        let letterColor = TOKENS.textMuted;
        if (showAnswers && isCorrect) { circleColor = TOKENS.success; letterColor = '#FFFFFF'; }
        if (isUserCorrect)            { circleColor = TOKENS.success; letterColor = '#FFFFFF'; }
        if (isUserWrong)              { circleColor = TOKENS.danger;  letterColor = '#FFFFFF'; }

        doc.save()
           .circle(circleX, circleY, 10)
           .fill(circleColor)
           .fillColor(letterColor)
           .fontSize(9)
           .text(label, circleX - 4, circleY - 5, { lineBreak: false })
           .restore();

        // Option text
        const textColor = (showAnswers && isCorrect) ? TOKENS.success
                        : isUserWrong                ? TOKENS.danger
                        : TOKENS.textPrimary;

        doc.fillColor(textColor)
           .fontSize(11)
           .text(opt.text, MARGIN + 28, rowY, {
               width: CONTENT_WIDTH - 60,
               lineBreak: true
           });

        // User selection marker (checkmark / cross)
        if (isUserChoice) {
            const marker = isUserCorrect ? '✓' : '✗';
            const markerColor = isUserCorrect ? TOKENS.success : TOKENS.danger;
            doc.save()
               .fillColor(markerColor)
               .fontSize(12)
               .text(marker, PAGE_WIDTH - MARGIN - 18, rowY, { lineBreak: false })
               .restore();
        }

        doc.moveDown(0.35);
    });
}

/**
 * Render MCQ-multiple question (checkboxes).
 */
function renderMcqMultiple(doc, question, options) {
    const { showAnswers, userSelectedOptions } = options;
    const userSet = new Set(userSelectedOptions || []);

    question.options.forEach((opt, i) => {
        ensureSpace(doc, 28);

        const label      = OPTION_LABELS[i] || String(i + 1);
        const isCorrect  = opt.isCorrect;
        const isUserPick = userSet.has(i);
        const isUserRight = isUserPick && isCorrect;
        const isUserWrong = isUserPick && !isCorrect;

        let rowColor = null;
        if (showAnswers && isCorrect) rowColor = TOKENS.correctBg;
        if (isUserWrong)              rowColor = TOKENS.wrongBg;

        const rowY = doc.y;
        const rowH = Math.max(
            doc.heightOfString(opt.text, { width: CONTENT_WIDTH - 60, fontSize: 11 }) + 10,
            24
        );

        if (rowColor) {
            doc.save()
               .rect(MARGIN, rowY - 2, CONTENT_WIDTH, rowH + 4)
               .fill(rowColor)
               .restore();
        }

        // Checkbox square
        const boxX = MARGIN + 1;
        const boxY = rowY + 3;
        let boxStroke = TOKENS.borderSubtle;
        let boxFill   = TOKENS.surface;
        if (showAnswers && isCorrect) { boxStroke = TOKENS.success; boxFill = TOKENS.success; }
        if (isUserRight)              { boxStroke = TOKENS.success; boxFill = TOKENS.success; }
        if (isUserWrong)              { boxStroke = TOKENS.danger;  boxFill = TOKENS.danger; }

        doc.save()
           .rect(boxX, boxY, 16, 16)
           .fillAndStroke(boxFill, boxStroke)
           .restore();

        // Checkmark inside box if selected/correct
        if ((showAnswers && isCorrect) || isUserPick) {
            doc.save()
               .fillColor('#FFFFFF')
               .fontSize(10)
               .text('✓', boxX + 2, boxY + 2, { lineBreak: false })
               .restore();
        }

        // Label
        doc.save()
           .fillColor(TOKENS.textMuted)
           .fontSize(9)
           .text(label, MARGIN + 21, rowY + 5, { lineBreak: false })
           .restore();

        // Option text
        const textColor = (showAnswers && isCorrect) ? TOKENS.success
                        : isUserWrong                ? TOKENS.danger
                        : TOKENS.textPrimary;

        doc.fillColor(textColor)
           .fontSize(11)
           .text(opt.text, MARGIN + 36, rowY, {
               width: CONTENT_WIDTH - 60,
               lineBreak: true
           });

        doc.moveDown(0.35);
    });
}

/**
 * Render short-answer question.
 */
function renderShortAnswer(doc, question, options) {
    const { showAnswers, userTextAnswer } = options;

    ensureSpace(doc, 40);

    if (userTextAnswer) {
        // Show user's submitted answer
        const isMatch = (question.acceptedAnswers || []).some(
            a => a.trim().toLowerCase() === userTextAnswer.trim().toLowerCase()
        );
        const color = isMatch ? TOKENS.success : TOKENS.danger;
        doc.fillColor(TOKENS.textMuted).fontSize(10).text('Your answer:', MARGIN);
        doc.fillColor(color).fontSize(11).text(userTextAnswer, MARGIN + 10).moveDown(0.3);
    } else {
        // Blank line for writing
        const lineY = doc.y + 14;
        doc.save()
           .strokeColor(TOKENS.textMuted)
           .lineWidth(0.75)
           .moveTo(MARGIN, lineY)
           .lineTo(PAGE_WIDTH - MARGIN, lineY)
           .stroke()
           .restore();
        doc.moveDown(1.2);
    }

    if (showAnswers && question.acceptedAnswers && question.acceptedAnswers.length > 0) {
        ensureSpace(doc, 24);
        doc.fillColor(TOKENS.textMuted).fontSize(10).text('Accepted answers:', MARGIN);
        doc.fillColor(TOKENS.success)
           .fontSize(11)
           .text(question.acceptedAnswers.join(' / '), MARGIN + 10)
           .moveDown(0.3);
    }
}

/**
 * Render ordering question.
 */
function renderOrdering(doc, question, options) {
    const { showAnswers, userOrderedItems } = options;

    // Display the items in their stored (shuffled) order
    question.options.forEach((opt, i) => {
        ensureSpace(doc, 22);
        doc.save()
           .fillColor(TOKENS.textMuted)
           .fontSize(10)
           .text(`${i + 1}.`, MARGIN, doc.y, { lineBreak: false, width: 20 })
           .restore();
        doc.fillColor(TOKENS.textPrimary)
           .fontSize(11)
           .text(opt.text, MARGIN + 24, doc.y - doc.currentLineHeight(), {
               width: CONTENT_WIDTH - 30,
               lineBreak: true
           });
        doc.moveDown(0.3);
    });

    if (showAnswers && question.correctOrder && question.correctOrder.length > 0) {
        ensureSpace(doc, 24);
        doc.moveDown(0.4);
        doc.fillColor(TOKENS.textMuted).fontSize(10).text('Correct order:', MARGIN);
        const orderedLabels = question.correctOrder
            .map(idx => question.options[idx]?.text || `Item ${idx + 1}`)
            .map((text, i) => `${i + 1}. ${text}`)
            .join('\n');
        doc.fillColor(TOKENS.success).fontSize(11).text(orderedLabels, MARGIN + 10).moveDown(0.3);
    }

    if (userOrderedItems && userOrderedItems.length > 0) {
        ensureSpace(doc, 24);
        doc.fillColor(TOKENS.textMuted).fontSize(10).text('Your order:', MARGIN);
        const userLabels = userOrderedItems
            .map(idx => question.options[idx]?.text || `Item ${idx + 1}`)
            .map((text, i) => `${i + 1}. ${text}`)
            .join('\n');

        const isCorrect = (
            question.correctOrder &&
            userOrderedItems.length === question.correctOrder.length &&
            userOrderedItems.every((val, i) => val === question.correctOrder[i])
        );
        doc.fillColor(isCorrect ? TOKENS.success : TOKENS.danger)
           .fontSize(11)
           .text(userLabels, MARGIN + 10)
           .moveDown(0.3);
    }
}

/**
 * Render fill-in-the-blank question.
 */
function renderFillInTheBlank(doc, question, options) {
    const { showAnswers, userBlankAnswers } = options;
    const blanks = question.blanks || [];

    blanks.forEach((blank, i) => {
        ensureSpace(doc, 30);

        const blankNum = i + 1;
        const userAns  = userBlankAnswers ? userBlankAnswers[i] : null;
        const accepted = blank.acceptedAnswers || [];
        const isCorrect = userAns
            ? accepted.some(a => a.trim().toLowerCase() === (userAns || '').trim().toLowerCase())
            : null;

        doc.fillColor(TOKENS.textMuted)
           .fontSize(10)
           .text(`Blank ${blankNum}:`, MARGIN, doc.y, { lineBreak: false });

        if (userAns) {
            const color = isCorrect ? TOKENS.success : TOKENS.danger;
            doc.fillColor(color)
               .fontSize(11)
               .text(`  ${userAns}`, { lineBreak: false });
            if (!isCorrect && showAnswers && accepted.length > 0) {
                doc.fillColor(TOKENS.textFaint)
                   .fontSize(10)
                   .text(`  (Accepted: ${accepted.join(' / ')})`, { lineBreak: false });
            }
        } else if (showAnswers && accepted.length > 0) {
            doc.fillColor(TOKENS.success)
               .fontSize(11)
               .text(`  ${accepted.join(' / ')}`, { lineBreak: false });
        } else {
            // Blank underline
            const lineX = MARGIN + 60;
            const lineY = doc.y + 5;
            doc.save()
               .strokeColor(TOKENS.textMuted)
               .lineWidth(0.75)
               .moveTo(lineX, lineY)
               .lineTo(lineX + 160, lineY)
               .stroke()
               .restore();
        }

        doc.moveDown(0.6);
    });
}

// ---------------------------------------------------------------------------
// Explanation renderer
// ---------------------------------------------------------------------------

function renderExplanation(doc, question) {
    if (!question.explanation) return;

    ensureSpace(doc, 36);
    doc.moveDown(0.3);

    doc.save()
       .rect(MARGIN, doc.y, CONTENT_WIDTH, 1)
       .fill(TOKENS.borderSubtle)
       .restore();
    doc.moveDown(0.2);

    doc.fillColor(TOKENS.indigo)
       .fontSize(10)
       .text('Explanation', MARGIN);

    doc.fillColor(TOKENS.textMuted)
       .fontSize(10)
       .text(question.explanation, MARGIN, doc.y, {
           width: CONTENT_WIDTH,
           lineBreak: true
       });

    doc.moveDown(0.5);
}

// ---------------------------------------------------------------------------
// Header / cover block
// ---------------------------------------------------------------------------

function renderTestHeader(doc, test) {
    // Title
    doc.fillColor(TOKENS.clay)
       .fontSize(22)
       .text(test.title || 'Untitled Test', MARGIN, MARGIN, {
           width: CONTENT_WIDTH,
           align: 'center'
       });

    const subtitleParts = [];
    if (test.category) subtitleParts.push(test.category);
    if (test.level)    subtitleParts.push(`Level ${test.level}`);
    if (test.unit)     subtitleParts.push(`Unit ${test.unit}`);

    if (subtitleParts.length > 0) {
        doc.fillColor(TOKENS.textMuted)
           .fontSize(11)
           .text(subtitleParts.join('  •  '), MARGIN, doc.y + 2, {
               width: CONTENT_WIDTH,
               align: 'center'
           });
    }

    if (test.description) {
        doc.moveDown(0.5);
        doc.fillColor(TOKENS.textMuted)
           .fontSize(10)
           .text(test.description, MARGIN, doc.y, {
               width: CONTENT_WIDTH,
               align: 'center'
           });
    }

    doc.moveDown(0.8);
    drawRule(doc, doc.y);
    doc.moveDown(0.8);
}

// ---------------------------------------------------------------------------
// Report summary block (for attempt "report" variant)
// ---------------------------------------------------------------------------

function renderReportSummary(doc, attempt, test) {
    const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
    const durationMin = Math.floor(attempt.duration / 60);
    const durationSec = attempt.duration % 60;
    const durationStr = `${durationMin}m ${durationSec}s`;

    const passed = percentage >= 60;
    const scoreColor = passed ? TOKENS.success : TOKENS.danger;

    // Summary box
    const boxY = doc.y;
    const boxH = 80;
    doc.save()
       .rect(MARGIN, boxY, CONTENT_WIDTH, boxH)
       .fill(TOKENS.canvas)
       .restore();

    // Score (large)
    doc.fillColor(scoreColor)
       .fontSize(36)
       .text(`${attempt.score} / ${attempt.totalQuestions}`, MARGIN + 12, boxY + 10, {
           lineBreak: false,
           width: 160,
           align: 'left'
       });

    doc.fillColor(scoreColor)
       .fontSize(14)
       .text(`${percentage}%`, MARGIN + 12, boxY + 50, { lineBreak: false });

    // Details column
    const detailX = MARGIN + 180;
    const detailItems = [
        ['Mode',     attempt.mode || 'Test'],
        ['Duration', durationStr],
        ['Date',     new Date(attempt.createdAt).toLocaleDateString()],
    ];

    detailItems.forEach(([label, value], i) => {
        const itemY = boxY + 10 + i * 22;
        doc.fillColor(TOKENS.textMuted).fontSize(10).text(`${label}:`, detailX, itemY, { lineBreak: false, width: 60 });
        doc.fillColor(TOKENS.textPrimary).fontSize(10).text(value, detailX + 65, itemY, { lineBreak: false });
    });

    doc.moveDown(0.4);
    doc.y = boxY + boxH + 12;

    drawRule(doc, doc.y);
    doc.moveDown(0.8);
}

// ---------------------------------------------------------------------------
// Page number footer pass (call after all content, before doc.end())
// ---------------------------------------------------------------------------

function addPageNumbers(doc) {
    const range = doc.bufferedPageRange();
    const total = range.count;

    for (let i = range.start; i < range.start + total; i++) {
        doc.switchToPage(i);
        doc.save()
           .fontSize(9)
           .fillColor(TOKENS.textFaint)
           .text(
               `${i - range.start + 1} / ${total}`,
               MARGIN,
               doc.page.height - 36,
               { align: 'center', width: CONTENT_WIDTH, lineBreak: false }
           )
           .restore();
    }
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * generateTestPdf(doc, test, options)
 *
 * Writes question content into a pdfkit Document.
 * Caller is responsible for:
 *   - Creating the doc with { size: 'A4', margin: MARGIN, bufferPages: true }
 *   - Piping doc to a writable stream (response)
 *   - Calling doc.end() after this function returns
 *
 * @param {PDFDocument} doc      - A pdfkit document instance (bufferPages: true)
 * @param {Object}      test     - Mongoose Test document (plain object or lean)
 * @param {Object}      options  - Rendering options:
 *   @param {boolean}  options.showAnswers       - Mark correct answers
 *   @param {boolean}  options.showExplanations  - Show explanations
 *   @param {Array}    options.userAnswers        - Array of Attempt answer objects indexed by questionIndex
 *   @param {Object}   options.attempt           - Full attempt document (for report summary)
 *   @param {boolean}  options.showReportSummary - Render score/timing summary block
 */
function generateTestPdf(doc, test, options = {}) {
    const {
        showAnswers      = false,
        showExplanations = false,
        userAnswers      = [],      // indexed by questionIndex
        attempt          = null,
        showReportSummary = false,
    } = options;

    // Build a lookup: questionIndex -> answer object
    const answerMap = {};
    userAnswers.forEach(ans => {
        answerMap[ans.questionIndex] = ans;
    });

    // --- Test header ---
    renderTestHeader(doc, test);

    // --- Report summary (for "report" variant) ---
    if (showReportSummary && attempt) {
        renderReportSummary(doc, attempt, test);
    }

    // --- Questions ---
    const questions = test.questions || [];

    questions.forEach((question, qIdx) => {
        ensureSpace(doc, 60);

        const userAnswer = answerMap[qIdx] || null;
        const qType = question.type || 'mcq-single';

        // Question number + type badge
        const qNumY = doc.y;
        doc.fillColor(TOKENS.clay)
           .fontSize(12)
           .text(`Q${qIdx + 1}`, MARGIN, qNumY, { lineBreak: false, width: 30 });

        // Small type label
        const typeLabels = {
            'mcq-single':      'MCQ',
            'mcq-multiple':    'MCQ Multi',
            'short-answer':    'Short Answer',
            'ordering':        'Ordering',
            'fill-in-the-blank': 'Fill Blank',
        };
        const typeLabel = typeLabels[qType] || qType;
        doc.save()
           .fillColor(TOKENS.textFaint)
           .fontSize(8)
           .text(typeLabel, MARGIN + 32, qNumY + 3, { lineBreak: false })
           .restore();

        // Correct/wrong badge (if user answered)
        if (userAnswer) {
            const badgeLabel = userAnswer.isCorrect ? 'Correct' : 'Wrong';
            const badgeColor = userAnswer.isCorrect ? TOKENS.success : TOKENS.danger;
            drawBadge(doc, PAGE_WIDTH - MARGIN - 60, qNumY, badgeLabel, badgeColor);
        }

        doc.moveDown(0.3);

        // Question text
        doc.fillColor(TOKENS.textPrimary)
           .fontSize(13)
           .text(question.text, MARGIN, doc.y, {
               width: CONTENT_WIDTH,
               lineBreak: true
           });

        doc.moveDown(0.6);

        // --- Per-type rendering ---
        const renderOptions = {
            showAnswers,
            userSelectedIdx:      (userAnswer && qType === 'mcq-single')   ? (userAnswer.selectedOptions?.[0] ?? null) : null,
            userSelectedOptions:  (userAnswer && qType === 'mcq-multiple') ? (userAnswer.selectedOptions || [])        : [],
            userTextAnswer:       (userAnswer && qType === 'short-answer') ? (userAnswer.textAnswer || '')              : null,
            userOrderedItems:     (userAnswer && qType === 'ordering')     ? (userAnswer.orderedItems || [])            : null,
            userBlankAnswers:     (userAnswer && qType === 'fill-in-the-blank') ? (userAnswer.blankAnswers || [])        : null,
        };

        switch (qType) {
            case 'mcq-single':
            case 'multiple-choice':
                renderMcqSingle(doc, question, renderOptions);
                break;
            case 'mcq-multiple':
                renderMcqMultiple(doc, question, renderOptions);
                break;
            case 'short-answer':
                renderShortAnswer(doc, question, renderOptions);
                break;
            case 'ordering':
                renderOrdering(doc, question, renderOptions);
                break;
            case 'fill-in-the-blank':
                renderFillInTheBlank(doc, question, renderOptions);
                break;
            default:
                renderMcqSingle(doc, question, renderOptions);
        }

        // Explanation
        if (showExplanations) {
            renderExplanation(doc, question);
        }

        doc.moveDown(0.6);
        drawRule(doc, doc.y);
        doc.moveDown(0.8);
    });

    // --- Page numbers ---
    addPageNumbers(doc);
}

module.exports = { generateTestPdf };
