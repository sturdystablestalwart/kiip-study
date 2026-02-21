'use strict';

/**
 * pdf.js — PDF export routes
 *
 * GET /api/pdf/test/:id?variant=blank|answerKey
 *   blank     — Questions only, no answers marked
 *   answerKey — Questions with correct answers highlighted + explanations
 *
 * GET /api/pdf/attempt/:attemptId?variant=student|report
 *   student — Questions with user's answers marked (correct/incorrect)
 *   report  — Full report: score summary, timing, user answers + explanations
 *
 * All routes require authentication (requireAuth).
 */

const express   = require('express');
const PDFDocument = require('pdfkit');
const mongoose  = require('mongoose');

const router  = express.Router();
const Test    = require('../models/Test');
const Attempt = require('../models/Attempt');
const { requireAuth } = require('../middleware/auth');
const { generateTestPdf } = require('../utils/pdfGenerator');

// All PDF routes require a logged-in user
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Helper: build a sanitised filename from a string
// ---------------------------------------------------------------------------
function safeFilename(str) {
    return (str || 'document')
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .substring(0, 80) || 'document';
}

// ---------------------------------------------------------------------------
// Helper: create a PDFDocument, set response headers, stream, and finalise.
// Calls contentFn(doc) to write content, then flushes page numbers and ends.
// ---------------------------------------------------------------------------
function streamPdf(res, filename, contentFn) {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true,
        autoFirstPage: true,
        info: {
            Title:    filename,
            Creator:  'KIIP Study',
            Producer: 'pdfkit',
        }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.pdf"`
    );

    doc.pipe(res);

    try {
        contentFn(doc);
    } catch (err) {
        // If content generation throws, end the stream cleanly and propagate
        doc.end();
        throw err;
    }

    doc.end();
}

// ---------------------------------------------------------------------------
// GET /api/pdf/test/:id?variant=blank|answerKey
// ---------------------------------------------------------------------------
router.get('/test/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const variant = req.query.variant || 'blank';

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid test ID' });
        }

        if (!['blank', 'answerKey'].includes(variant)) {
            return res.status(400).json({ message: 'variant must be "blank" or "answerKey"' });
        }

        const test = await Test.findById(id).lean();
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        const showAnswers      = (variant === 'answerKey');
        const showExplanations = (variant === 'answerKey');

        const filename = `${safeFilename(test.title)}_${variant}`;

        streamPdf(res, filename, (doc) => {
            generateTestPdf(doc, test, {
                showAnswers,
                showExplanations,
                userAnswers: [],
                attempt: null,
                showReportSummary: false,
            });
        });
    } catch (err) {
        console.error('[PDF] /test/:id error:', err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate PDF: ' + err.message });
        }
    }
});

// ---------------------------------------------------------------------------
// GET /api/pdf/attempt/:attemptId?variant=student|report
// ---------------------------------------------------------------------------
router.get('/attempt/:attemptId', async (req, res) => {
    try {
        const { attemptId } = req.params;
        const variant = req.query.variant || 'student';

        if (!mongoose.Types.ObjectId.isValid(attemptId)) {
            return res.status(400).json({ message: 'Invalid attempt ID' });
        }

        if (!['student', 'report'].includes(variant)) {
            return res.status(400).json({ message: 'variant must be "student" or "report"' });
        }

        const attempt = await Attempt.findById(attemptId).lean();
        if (!attempt) {
            return res.status(404).json({ message: 'Attempt not found' });
        }

        // Ownership check — users may only download their own attempts
        // (admins bypass this check because req.user.isAdmin is set)
        if (!req.user.isAdmin) {
            const attemptUserId = attempt.userId ? attempt.userId.toString() : null;
            const requestUserId = req.user._id ? req.user._id.toString() : null;
            if (attemptUserId && requestUserId && attemptUserId !== requestUserId) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        const test = await Test.findById(attempt.testId).lean();
        if (!test) {
            return res.status(404).json({ message: 'Associated test not found' });
        }

        const showAnswers      = true;                    // always show answers on attempt PDFs
        const showExplanations = (variant === 'report');  // explanations only on full report
        const showReportSummary = (variant === 'report');

        const filename = `${safeFilename(test.title)}_${variant}_${attemptId.slice(-6)}`;

        streamPdf(res, filename, (doc) => {
            generateTestPdf(doc, test, {
                showAnswers,
                showExplanations,
                userAnswers: attempt.answers || [],
                attempt,
                showReportSummary,
            });
        });
    } catch (err) {
        console.error('[PDF] /attempt/:attemptId error:', err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate PDF: ' + err.message });
        }
    }
});

module.exports = router;
