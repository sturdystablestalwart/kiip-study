const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const TestSession = require('../models/TestSession');
const Attempt = require('../models/Attempt');
const Test = require('../models/Test');
const { requireAuth } = require('../middleware/auth');
const { scoreQuestion } = require('../utils/scoring');
const { clampSecs } = require('../utils/clampSecs');
const safeError = require('../utils/safeError');

// Issue #36 — per-user rate limits.  The 100 req/min global limiter
// is too coarse for these authenticated user-facing paths.  All
// limiters are no-ops in NODE_ENV=test so existing session-flow
// integration tests don't 429.
// Issue #23 — v8 IPv6-safe IP fallback via ipKeyGenerator.
const userKey = (req) => req.user?._id ? String(req.user._id) : ipKeyGenerator(req.ip);
const noOpLimiter = (req, res, next) => next();
const isTest = process.env.NODE_ENV === 'test';
const mkLimiter = (opts) => isTest ? noOpLimiter : rateLimit({
    ...opts,
    keyGenerator: userKey,
    standardHeaders: true,
    legacyHeaders: false,
});

const sessionStartLimiter = mkLimiter({ windowMs: 10 * 60 * 1000, max: 20 });
const sessionSaveLimiter = mkLimiter({ windowMs: 60 * 1000, max: 30 });
const sessionSubmitLimiter = mkLimiter({ windowMs: 60 * 1000, max: 10 });

// Issue #435 — short-circuit on invalid ObjectId in req.params so a
// drive-by scanner hitting /api/sessions/foobar returns 404 instead of
// triggering a CastError → 500 + stack-trace in the prod log.
function requireObjectId(paramName = 'id') {
    return (req, res, next) => {
        if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
            return res.status(404).json({ message: 'Active session not found' });
        }
        next();
    };
}

// Issue #60 — bounds for the PATCH /:id auto-save body.  Without these
// a doctored client can ship remainingTime: -999999 or currentQuestion:
// 999999 which poisons the auto-save state and can leak into the
// scoring path on /submit.
const MAX_ANSWERS = 200;        // far above any real test
const MAX_QUESTION_INDEX = 500;  // ~5x our largest current test
const MAX_REMAINING_SECONDS = 24 * 3600;

const patchSessionValidators = [
    body('answers').optional().isArray({ max: MAX_ANSWERS }),
    body('answers.*.questionIndex').optional().isInt({ min: 0, max: MAX_QUESTION_INDEX }),
    body('answers.*.textAnswer').optional().isString().isLength({ max: 4000 }),
    body('answers.*.selectedOptions').optional().isArray({ max: 50 }),
    body('answers.*.orderedItems').optional().isArray({ max: 100 }),
    body('answers.*.blankAnswers').optional().isArray({ max: 50 }),
    body('currentQuestion').optional().isInt({ min: 0, max: MAX_QUESTION_INDEX }),
    body('remainingTime').optional().isInt({ min: 0, max: MAX_REMAINING_SECONDS }),
    body('expectedLastSavedAt').optional({ nullable: true }).isISO8601(),
];

// POST /api/sessions/start
// Body: { testId, mode }
// Returns existing active session (resumed: true) or creates a new one (resumed: false)
router.post('/start', requireAuth, sessionStartLimiter, async (req, res) => {
    try {
        const { testId, mode } = req.body;

        if (!testId || !mode) {
            return res.status(400).json({ message: 'testId and mode are required' });
        }

        if (!mongoose.Types.ObjectId.isValid(testId)) {
            return res.status(400).json({ message: 'Invalid testId' });
        }

        if (!['Test', 'Practice'].includes(mode)) {
            return res.status(400).json({ message: 'mode must be "Test" or "Practice"' });
        }

        // Check for an existing active session for this user + test
        const existing = await TestSession.findOne({
            userId: req.user._id,
            testId,
            status: 'active'
        });

        if (existing) {
            return res.status(200).json({ session: existing, resumed: true });
        }

        // Verify the test exists before creating a session
        const test = await Test.findById(testId).select('_id').lean();
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        const session = await TestSession.create({
            userId: req.user._id,
            testId,
            mode,
            answers: [],
            currentQuestion: 0,
            remainingTime: 30 * 60, // 30 minutes in seconds
            status: 'active'
        });

        return res.status(201).json({ session, resumed: false });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to start session', err) });
    }
});

// PATCH /api/sessions/:id
// Update answers, currentQuestion, remainingTime for an active session.
//
// Issue #143 — Optimistic concurrency:
// If the client supplies `expectedLastSavedAt` (ISO date string), the update
// only succeeds when the DB's current `lastSavedAt` matches. On mismatch we
// return 409 with `{ error: 'CONCURRENCY_CONFLICT', currentLastSavedAt }` so
// the client can reconcile (e.g. surface a "another tab saved newer state"
// prompt). When `expectedLastSavedAt` is absent we fall back to last-writer-
// wins for back-compat with pre-fix clients. The response always includes
// the new `lastSavedAt` so updated clients can roll it forward.
router.patch('/:id', requireAuth, requireObjectId(), sessionSaveLimiter, patchSessionValidators, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().slice(0, 10) });
        }
        const { answers, currentQuestion, remainingTime, expectedLastSavedAt } = req.body;

        const set = { lastSavedAt: new Date() };
        if (answers !== undefined) set.answers = answers;
        if (currentQuestion !== undefined) set.currentQuestion = currentQuestion;
        if (remainingTime !== undefined) set.remainingTime = remainingTime;

        const filter = {
            _id: req.params.id,
            userId: req.user._id,
            status: 'active'
        };

        if (expectedLastSavedAt !== undefined && expectedLastSavedAt !== null) {
            const parsed = new Date(expectedLastSavedAt);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ message: 'expectedLastSavedAt must be a valid date' });
            }
            filter.lastSavedAt = parsed;
        }

        const session = await TestSession.findOneAndUpdate(filter, { $set: set }, { new: true });

        if (!session) {
            // Either the session genuinely doesn't exist / is not active / not
            // owned by this user, or the lastSavedAt guard rejected the write.
            // Disambiguate by re-querying without the guard.
            if (expectedLastSavedAt !== undefined && expectedLastSavedAt !== null) {
                const current = await TestSession.findOne({
                    _id: req.params.id,
                    userId: req.user._id,
                    status: 'active'
                });
                if (current) {
                    return res.status(409).json({
                        error: 'CONCURRENCY_CONFLICT',
                        message: 'Session was updated by another client',
                        currentLastSavedAt: current.lastSavedAt
                    });
                }
            }
            return res.status(404).json({ message: 'Active session not found' });
        }

        return res.status(200).json({ session });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to update session', err) });
    }
});

// POST /api/sessions/:id/submit
// Score answers server-side, create an Attempt, mark session completed
router.post('/:id/submit', requireAuth, requireObjectId(), sessionSubmitLimiter, async (req, res) => {
    try {
        // Issue #436 — atomically claim the session (active → completed)
        // before doing any other work. Two concurrent submits race on this
        // single-document update; only the winner proceeds, the loser
        // finds no active session and returns 404. Prevents duplicate
        // Attempt rows from double-submits.
        const session = await TestSession.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id, status: 'active' },
            { $set: { status: 'completed' } },
            { new: false }
        );

        if (!session) {
            return res.status(404).json({ message: 'Active session not found' });
        }

        const test = await Test.findById(session.testId);
        if (!test) {
            // Roll the claim back so the user can retry once test exists.
            await TestSession.findOneAndUpdate(
                { _id: req.params.id, userId: req.user._id, status: 'completed' },
                { $set: { status: 'active' } }
            ).catch(() => {});
            return res.status(404).json({ message: 'Test not found' });
        }

        // Server-side scoring
        const scoredAnswers = test.questions.map((question, index) => {
            const answer = session.answers.find(a => a.questionIndex === index) || {
                questionIndex: index,
                selectedOptions: [],
                textAnswer: '',
                orderedItems: [],
                blankAnswers: []
            };

            const isCorrect = scoreQuestion(question, answer);

            return {
                questionIndex: index,
                selectedOptions: answer.selectedOptions || [],
                textAnswer: answer.textAnswer || '',
                orderedItems: answer.orderedItems || [],
                blankAnswers: answer.blankAnswers || [],
                isCorrect,
                isOverdue: false
            };
        });

        const score = scoredAnswers.filter(a => a.isCorrect).length;
        const total = test.questions.length;
        const duration = 30 * 60 - session.remainingTime; // seconds spent

        // Issue #433 — clamp client-supplied overdueTime into [0, 14400]
        // (mirrors #132 fix on POST /api/tests/:id/attempt). Without
        // this a doctored client can post 9_999_999_999 and poison stats.
        // Issue #436 — if Attempt.create throws after the session was
        // claimed, roll the session back to 'active' so the user can retry
        // without an orphaned 'completed' session.
        let attempt;
        try {
            attempt = await Attempt.create({
                testId: session.testId,
                userId: req.user._id,
                score,
                totalQuestions: total,
                duration,
                overdueTime: clampSecs(req.body.overdueTime),
                answers: scoredAnswers,
                mode: session.mode
            });
        } catch (createErr) {
            await TestSession.findOneAndUpdate(
                { _id: req.params.id, userId: req.user._id, status: 'completed' },
                { $set: { status: 'active' } }
            ).catch(() => {});
            throw createErr;
        }

        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

        return res.status(200).json({ attempt, score, total, percentage });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to submit session', err) });
    }
});

// GET /api/sessions/active
// Return user's active sessions, most recently saved first, limit 5
router.get('/active', requireAuth, async (req, res) => {
    try {
        const sessions = await TestSession.find({
            userId: req.user._id,
            status: 'active'
        })
            .populate('testId', 'title category level unit')
            .sort({ lastSavedAt: -1 })
            .limit(5)
            .lean();

        return res.status(200).json({ sessions });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to fetch active sessions', err) });
    }
});

// DELETE /api/sessions/:id
// Abandon an active session (soft delete — set status to 'abandoned')
router.delete('/:id', requireAuth, requireObjectId(), async (req, res) => {
    try {
        const session = await TestSession.findOneAndUpdate(
            {
                _id: req.params.id,
                userId: req.user._id,
                status: 'active'
            },
            { status: 'abandoned' },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({ message: 'Active session not found' });
        }

        return res.status(200).json({ message: 'Session abandoned' });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to abandon session', err) });
    }
});

module.exports = router;
