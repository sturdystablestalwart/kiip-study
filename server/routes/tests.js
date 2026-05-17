const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const Test = require('../models/Test');
const Attempt = require('../models/Attempt');
const { scoreQuestion } = require('../utils/scoring');
const { parseTextWithLLM } = require('../utils/llm');
const { requireAuth } = require('../middleware/auth');
const safeError = require('../utils/safeError');
const logger = require('../utils/logger');
const publicTestProjection = require('../utils/publicTestProjection');

// Issue #36 — POST /attempts/migrate ships up to 50 attempts.  A
// scripted client could replay this all day and balloon the Attempt
// collection.  Cap at 3 calls / 24h per user (normal migration runs
// exactly once on first login from a device).  Disabled in
// NODE_ENV=test so the existing migrate-batch test (#109) which
// fires multiple requests doesn't 429.
const attemptMigrateLimiter = process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 24 * 60 * 60 * 1000,
        max: 3,
        // Issue #23 — v8 IPv6-safe IP fallback via ipKeyGenerator.
        keyGenerator: (req) => req.user?._id ? String(req.user._id) : ipKeyGenerator(req.ip),
        standardHeaders: true,
        legacyHeaders: false,
    });

// ============================================
// ROUTES
// ============================================

// GET all tests with last attempt (aggregation + cursor pagination + search)
router.get('/', async (req, res) => {
    try {
        const { q, level, unit, contentType, cursor, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);

        // Build match stage
        const match = {};
        if (q && q.trim()) {
            match.$text = { $search: q.trim() };
        }
        if (level && typeof level === 'string') match.level = level;
        if (unit && !isNaN(parseInt(unit))) match.unitNumber = parseInt(unit);
        if (contentType && typeof contentType === 'string') match.contentType = contentType;

        // Cursor pagination: fetch items older than cursor
        if (cursor) {
            if (mongoose.Types.ObjectId.isValid(cursor)) {
                match._id = { $lt: new mongoose.Types.ObjectId(cursor) };
            }
        }

        // Build aggregation pipeline
        const pipeline = [
            { $match: match },
            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: limit + 1 },
            // Exclude questions array from list response (save bandwidth)
            { $project: {
                title: 1, contentType: 1, source: 1, description: 1, level: 1, unitNumber: 1, section: 1,
                createdAt: 1, questionCount: { $size: '$questions' }
            }},
            // Join last attempt per test
            { $lookup: {
                from: 'attempts',
                let: { testId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$testId', '$$testId'] } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 1 },
                    { $project: { score: 1, totalQuestions: 1, mode: 1, createdAt: 1 } }
                ],
                as: 'attempts'
            }},
            { $addFields: {
                lastAttempt: { $arrayElemAt: ['$attempts', 0] }
            }},
            { $project: { attempts: 0 } }
        ];

        const results = await Test.aggregate(pipeline);

        // Determine if there are more results
        const hasMore = results.length > limit;
        const tests = hasMore ? results.slice(0, limit) : results;
        const nextCursor = hasMore ? tests[tests.length - 1]._id : null;

        // Get total count (without cursor filter)
        const countMatch = { ...match };
        delete countMatch._id;
        const countResult = await Test.aggregate([
            { $match: countMatch },
            { $count: 'total' }
        ]);
        const total = countResult[0]?.total || 0;

        res.json({ tests, nextCursor, total });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to fetch tests', err) });
    }
});

// GET paginated attempt history
router.get('/attempts', requireAuth, async (req, res) => {
    try {
        const { cursor, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 10, 1), 50);

        const match = { userId: req.user._id };
        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            match._id = { $lt: new mongoose.Types.ObjectId(cursor) };
        }

        const attempts = await Attempt.find(match, {
            score: 1, totalQuestions: 1, mode: 1, createdAt: 1, testId: 1, userId: 1, duration: 1
        })
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore = attempts.length > limit;
        const page = hasMore ? attempts.slice(0, limit) : attempts;
        const nextCursor = hasMore ? page[page.length - 1]._id : null;

        const testIds = [...new Set(page.filter(a => a.testId).map(a => a.testId.toString()))];
        const tests = await Test.find({ _id: { $in: testIds } }, { title: 1, level: 1, unitNumber: 1, section: 1, contentType: 1 }).lean();
        const testMap = Object.fromEntries(tests.map(t => [t._id.toString(), t]));

        const enriched = page.map(a => ({
            ...a,
            test: a.testId ? (testMap[a.testId.toString()] || { title: 'Deleted test' }) : { title: 'Endless Mode' }
        }));

        res.json({ attempts: enriched, nextCursor });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to fetch attempts', err) });
    }
});

// GET recent attempts for dashboard
router.get('/recent-attempts', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 5, 20);
        const attempts = await Attempt.find(
            { userId: req.user._id },
            { score: 1, totalQuestions: 1, mode: 1, createdAt: 1, testId: 1, duration: 1 }
        )
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Attach test title to each attempt (skip null testIds from endless mode)
        const testIds = [...new Set(
            attempts.filter(a => a.testId).map(a => a.testId.toString())
        )];
        const tests = await Test.find(
            { _id: { $in: testIds } },
            { title: 1, level: 1, unitNumber: 1, section: 1, contentType: 1 }
        ).lean();
        const testMap = Object.fromEntries(tests.map(t => [t._id.toString(), t]));

        const enriched = attempts.map(a => ({
            ...a,
            test: a.testId
                ? (testMap[a.testId.toString()] || { title: 'Deleted test' })
                : { title: 'Endless Mode' }
        }));

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to fetch recent attempts', err) });
    }
});

// Issue #63 — cap the number of tests we hydrate per /endless request.
// Each test averages ~10-25 questions; the per-request pool is bounded
// to MAX_TESTS_FOR_ENDLESS * questions/test instead of growing linearly
// with the level's test count.  We use $sample so the cap is random
// across the library each request, not the same "first N inserted".
const MAX_TESTS_FOR_ENDLESS = 200;

// GET random questions for endless mode
router.get('/endless', requireAuth, async (req, res) => {
    try {
        const { level, unit, exclude, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 10, 1), 20);

        // Parse excluded question identifiers (format: "testId:qIdx,testId:qIdx")
        const excludeSet = new Set((exclude || '').split(',').filter(Boolean));

        // Build match for tests
        const match = {};
        if (level && typeof level === 'string') match.level = level;
        if (unit && !isNaN(parseInt(unit))) match.unitNumber = parseInt(unit);

        // Issue #63 — random sample with hard cap.  MongoDB's $sample is
        // O(N) but only streams MAX_TESTS_FOR_ENDLESS docs back, so even
        // a 10k-test library only pulls ~200 docs into Node memory.
        // Sampling at the DB layer also means each request explores a
        // different slice of the library, which is desirable for endless
        // mode's "always-fresh" semantics.
        const tests = await Test.aggregate([
            { $match: match },
            { $sample: { size: MAX_TESTS_FOR_ENDLESS } },
            { $project: { questions: 1, title: 1 } },
        ]);

        // Flatten all questions with source references
        let pool = [];
        for (const test of tests) {
            for (let i = 0; i < test.questions.length; i++) {
                const key = `${test._id}:${i}`;
                if (!excludeSet.has(key)) {
                    pool.push({
                        ...test.questions[i],
                        _sourceTestId: test._id,
                        _sourceIndex: i,
                        _sourceKey: key
                    });
                }
            }
        }

        // Shuffle and pick `limit` questions (Fisher-Yates)
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        const selected = pool.slice(0, limit);

        // Issue #107 — strip answer-key fields before sending to the client.
        // Server-side scoring (POST /endless/attempt) re-fetches the source
        // Test from the DB, so this projection is purely about the wire payload.
        // The internal `_sourceTestId` / `_sourceIndex` / `_sourceKey` markers
        // are NOT answer keys (the score endpoint needs them to look the
        // original question up again) and are preserved by the projection.
        const sanitized = publicTestProjection(selected);

        res.json({
            questions: sanitized,
            remaining: pool.length - selected.length
        });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to fetch endless questions', err) });
    }
});

// POST save endless mode chunk attempt (server-side score verification)
router.post('/endless/attempt', requireAuth, async (req, res) => {
    try {
        const { answers, duration, sourceQuestions } = req.body;
        if (!answers || !answers.length) {
            return res.status(400).json({ message: 'No answers provided' });
        }
        if (!sourceQuestions || sourceQuestions.length !== answers.length) {
            return res.status(400).json({ message: 'sourceQuestions must match answers length' });
        }

        // Collect unique test IDs and fetch actual questions from DB
        const testIds = [...new Set(sourceQuestions.map(sq => sq?._sourceTestId).filter(Boolean))];
        const tests = await Test.find({ _id: { $in: testIds } }).lean();
        const testMap = Object.fromEntries(tests.map(t => [t._id.toString(), t]));

        // Server-side score verification
        let score = 0;
        const verifiedAnswers = answers.map((ans, i) => {
            const sq = sourceQuestions[i];
            const test = testMap[sq?._sourceTestId?.toString()];
            const question = test?.questions?.[sq?._sourceIndex];
            const isCorrect = question ? scoreQuestion(question, ans) : false;
            if (isCorrect) score++;
            return { ...ans, isCorrect };
        });

        const attempt = new Attempt({
            testId: null,
            userId: req.user._id,
            score,
            totalQuestions: answers.length,
            duration: duration || 0,
            overdueTime: 0,
            answers: verifiedAnswers,
            sourceQuestions: sourceQuestions || [],
            mode: 'Endless'
        });
        const savedAttempt = await attempt.save();
        res.status(201).json(savedAttempt);
    } catch (err) {
        res.status(400).json({ message: safeError('Failed to save endless attempt', err) });
    }
});

// GET specific test
// Issue #108 — now requires authentication AND strips answer-key fields for
// non-admin users. Admins still receive the full document so the admin editor
// (client/src/pages/AdminTestEditor.jsx) can render existing answer keys.
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const test = await Test.findById(req.params.id).lean();
        if (!test) return res.status(404).json({ message: 'Test not found' });
        const payload = req.user?.isAdmin ? test : publicTestProjection(test);
        res.json(payload);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ message: 'Test not found' });
        }
        res.status(500).json({ message: safeError('Failed to fetch test', err) });
    }
});

// POST save attempt (server-side score verification)
router.post('/:id/attempt', requireAuth, async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Test not found' });

        // Server-side score verification
        let serverScore = 0;
        const verifiedAnswers = (req.body.answers || []).map((ans, idx) => {
            const question = test.questions[idx];
            if (!question) return { ...ans, isCorrect: false };
            const isCorrect = scoreQuestion(question, ans);
            if (isCorrect) serverScore++;
            return { ...ans, isCorrect };
        });

        // Issue #132 — clamp client-supplied timings into [0, 4h] and
        // reject Endless mode (it has its own /api/tests/endless route).
        // Without these, a doctored client can post negative or zero
        // duration "perfect runs" that poison stats / future leaderboards.
        const MAX_SECONDS = 4 * 3600;
        const clampSecs = (v) => Math.max(0, Math.min(Number(v) || 0, MAX_SECONDS));
        const mode = req.body.mode || 'Test';
        if (mode === 'Endless') {
            return res.status(400).json({ message: 'Endless mode attempts must use /api/tests/endless' });
        }

        const attempt = new Attempt({
            testId: req.params.id,
            userId: req.user._id,
            score: serverScore,
            totalQuestions: test.questions.length,
            duration: clampSecs(req.body.duration),
            overdueTime: clampSecs(req.body.overdueTime),
            answers: verifiedAnswers,
            mode,
        });
        const savedAttempt = await attempt.save();
        res.status(201).json(savedAttempt);
    } catch (err) {
        res.status(400).json({ message: safeError('Failed to save attempt', err) });
    }
});

// POST /api/attempts/migrate — migrate anonymous localStorage attempts to DB.
// Issue #109 — do NOT trust client-supplied score / totalQuestions / answers /
// createdAt. Re-score every answer server-side against the source Test,
// reject rows whose testId does not resolve to a real test, clamp createdAt
// to the [0, now] interval, and always take the userId from req.user.
router.post('/attempts/migrate', requireAuth, attemptMigrateLimiter, async (req, res) => {
    try {
        const { attempts } = req.body;
        if (!Array.isArray(attempts) || attempts.length === 0) {
            return res.status(400).json({ message: 'No attempts to migrate' });
        }

        const toMigrate = attempts.slice(0, 50);

        // Collect all unique testIds (string form) and fetch the source tests
        // in a single round-trip; ignore rows with no testId outright.
        const rawIds = toMigrate
            .map(a => a && a.testId)
            .filter(Boolean)
            .map(id => String(id));
        const uniqueIds = [...new Set(rawIds)];

        // Filter to valid-shape ObjectIds when possible; let the rest fall
        // through to .find which simply won't match them. We rely on the
        // model layer here rather than re-implementing ObjectId validation.
        const tests = uniqueIds.length > 0
            ? await Test.find({ _id: { $in: uniqueIds } }).lean()
            : [];
        const testMap = Object.fromEntries(tests.map(t => [String(t._id), t]));

        const now = Date.now();
        const docs = [];

        for (const att of toMigrate) {
            if (!att || !att.testId) continue;
            const test = testMap[String(att.testId)];
            if (!test) continue; // unresolved testId — skip silently

            // Re-score every answer against the actual test definition.
            const submittedAnswers = Array.isArray(att.answers) ? att.answers : [];
            let serverScore = 0;
            const verifiedAnswers = submittedAnswers.map((ans, idx) => {
                const question = test.questions?.[idx];
                if (!question) return { ...(ans || {}), isCorrect: false };
                const isCorrect = scoreQuestion(question, ans || {});
                if (isCorrect) serverScore++;
                return { ...(ans || {}), isCorrect };
            });

            // Clamp createdAt to [0, now]. Future-dated values are pulled
            // back to now; invalid / NaN dates default to now as well.
            const rawCreatedAt = att.createdAt ? +new Date(att.createdAt) : now;
            const safeCreatedAt = Number.isFinite(rawCreatedAt)
                ? new Date(Math.min(now, Math.max(0, rawCreatedAt)))
                : new Date(now);

            docs.push({
                testId: att.testId,
                userId: req.user._id,
                score: serverScore,
                totalQuestions: test.questions?.length || 0,
                duration: typeof att.duration === 'number' ? att.duration : 0,
                overdueTime: typeof att.overdueTime === 'number' ? att.overdueTime : 0,
                answers: verifiedAnswers,
                mode: ['Practice', 'Test', 'Endless'].includes(att.mode) ? att.mode : 'Test',
                createdAt: safeCreatedAt,
            });
        }

        if (docs.length > 0) {
            await Attempt.insertMany(docs, { ordered: false });
        }

        res.json({ migrated: docs.length });
    } catch (err) {
        logger.error({ err }, 'Attempt migration error');
        res.status(500).json({ message: 'Migration failed' });
    }
});

module.exports = { router, parseTextWithLLM };
