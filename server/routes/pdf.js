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
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const router  = express.Router();
const safeError = require('../utils/safeError');
const Test    = require('../models/Test');
const Attempt = require('../models/Attempt');
const { requireAuth } = require('../middleware/auth');
const {
    generateTestPdfWithTimeout,
    DEFAULT_PDF_TIMEOUT_MS,
} = require('../utils/pdfGenerator');
const logger = require('../utils/logger');

// Hard cap on questions per PDF. Anything beyond this is rejected before
// streaming starts so a malformed/oversized test cannot hold a worker.
const MAX_QUESTIONS_PER_PDF = 500;

// All PDF routes require a logged-in user
router.use(requireAuth);

// Issue #477 — PDF generation is CPU-bound (pdfkit + sharp). The
// global /api limiter (100/min/IP) doesn't stop one logged-in user
// from monopolising the worker pool by looping requests. Per-user
// 6/min limit is plenty for the legitimate 'print a few practice
// PDFs' flow. No-op in NODE_ENV=test so existing pdf-smoke tests
// don't 429.
const pdfLimiter = process.env.NODE_ENV === 'test'
    ? (req, _res, next) => next()
    : rateLimit({
        windowMs: 60 * 1000,
        max: 6,
        keyGenerator: (req) => req.user?._id ? String(req.user._id) : ipKeyGenerator(req.ip),
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Too many PDF downloads. Please wait a minute before retrying.' },
    });
router.use(pdfLimiter);

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
// Helper: open a pdfkit document, attach response headers, pipe to res, and
// run the bounded generator. Translates timeout / error rejections into HTTP
// status codes when headers have not yet been flushed.
// ---------------------------------------------------------------------------
async function streamTestPdf(res, filename, test, options, logCtx) {
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
        await generateTestPdfWithTimeout(doc, res, test, options, DEFAULT_PDF_TIMEOUT_MS);
    } catch (err) {
        if (err && err.code === 'PDF_TIMEOUT') {
            logger.warn(logCtx, 'pdf generation timed out');
            if (!res.headersSent) {
                res.status(504).json({ message: 'PDF generation timed out' });
            } else {
                // Headers already flushed — best we can do is terminate the body.
                try { res.end(); } catch (_) { /* noop */ }
            }
            return;
        }

        logger.error({ ...logCtx, err }, 'pdf generation failed');
        if (!res.headersSent) {
            res.status(500).json({ message: safeError('pdf generation', err) });
        } else {
            try { res.end(); } catch (_) { /* noop */ }
        }
    }
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

        // Issue #476 — restrict answer-key variant to admins. The PDF
        // route was a parallel exfiltration channel that bypassed the
        // /api/tests/:id projection guard from closed #108/#107.
        if (variant === 'answerKey' && !req.user?.isAdmin) {
            return res.status(403).json({ message: 'Admin access required for answer-key variant' });
        }

        const test = await Test.findById(id).lean();
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        // Cap input size BEFORE we start the stream, so a malformed/oversized
        // test cannot tie up a worker on pdfkit rendering.
        if ((test.questions?.length ?? 0) > MAX_QUESTIONS_PER_PDF) {
            return res.status(413).json({
                error: `Test too large for PDF (max ${MAX_QUESTIONS_PER_PDF} questions)`,
            });
        }

        const showAnswers      = (variant === 'answerKey');
        const showExplanations = (variant === 'answerKey');

        const filename = `${safeFilename(test.title)}_${variant}`;

        await streamTestPdf(
            res,
            filename,
            test,
            {
                showAnswers,
                showExplanations,
                userAnswers: [],
                attempt: null,
                showReportSummary: false,
            },
            { testId: id, variant }
        );
    } catch (err) {
        logger.error({ err }, '[PDF] /test/:id error');
        if (!res.headersSent) {
            res.status(500).json({ message: safeError('pdf generation', err) });
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

        // Ownership check — users may only download their own attempts (admins bypass)
        if (!req.user.isAdmin) {
            if (!attempt.userId || attempt.userId.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        const test = await Test.findById(attempt.testId).lean();
        if (!test) {
            return res.status(404).json({ message: 'Associated test not found' });
        }

        // Same hard cap as /test/:id — protect workers from oversized renders.
        if ((test.questions?.length ?? 0) > MAX_QUESTIONS_PER_PDF) {
            return res.status(413).json({
                error: `Test too large for PDF (max ${MAX_QUESTIONS_PER_PDF} questions)`,
            });
        }

        const showAnswers      = true;                    // always show answers on attempt PDFs
        const showExplanations = (variant === 'report');  // explanations only on full report
        const showReportSummary = (variant === 'report');

        const filename = `${safeFilename(test.title)}_${variant}_${attemptId.slice(-6)}`;

        await streamTestPdf(
            res,
            filename,
            test,
            {
                showAnswers,
                showExplanations,
                userAnswers: attempt.answers || [],
                attempt,
                showReportSummary,
            },
            { attemptId, testId: attempt.testId, variant }
        );
    } catch (err) {
        logger.error({ err }, '[PDF] /attempt/:attemptId error');
        if (!res.headersSent) {
            res.status(500).json({ message: safeError('pdf generation', err) });
        }
    }
});

module.exports = router;
