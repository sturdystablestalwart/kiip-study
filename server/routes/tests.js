const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Test = require('../models/Test');
const Attempt = require('../models/Attempt');
const { scoreQuestion } = require('../utils/scoring');
const { parseTextWithLLM } = require('../utils/llm');
const { requireAuth } = require('../middleware/auth');

// ============================================
// ROUTES
// ============================================

// GET all tests with last attempt (aggregation + cursor pagination + search)
router.get('/', async (req, res) => {
    try {
        const { q, level, unit, cursor, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);

        // Build match stage
        const match = {};
        if (q && q.trim()) {
            match.$text = { $search: q.trim() };
        }
        if (level) match.level = level;
        if (unit) match.unit = unit;

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
                title: 1, category: 1, description: 1, level: 1, unit: 1,
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
        res.status(500).json({ message: 'Failed to fetch tests: ' + err.message });
    }
});

// GET recent attempts for dashboard
router.get('/recent-attempts', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 5, 20);
        const attempts = await Attempt.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Attach test title to each attempt (skip null testIds from endless mode)
        const testIds = [...new Set(
            attempts.filter(a => a.testId).map(a => a.testId.toString())
        )];
        const tests = await Test.find(
            { _id: { $in: testIds } },
            { title: 1, level: 1, unit: 1 }
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
        res.status(500).json({ message: 'Failed to fetch recent attempts: ' + err.message });
    }
});

// GET random questions for endless mode
router.get('/endless', requireAuth, async (req, res) => {
    try {
        const { level, unit, exclude, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 10, 1), 20);

        // Parse excluded question identifiers (format: "testId:qIdx,testId:qIdx")
        const excludeSet = new Set((exclude || '').split(',').filter(Boolean));

        // Build match for tests
        const match = {};
        if (level) match.level = level;
        if (unit) match.unit = unit;

        // Fetch matching tests with their questions
        const tests = await Test.find(match, { questions: 1, title: 1 }).lean();

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

        res.json({
            questions: selected,
            remaining: pool.length - selected.length
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch endless questions: ' + err.message });
    }
});

// POST save endless mode chunk attempt
router.post('/endless/attempt', requireAuth, async (req, res) => {
    try {
        const { answers, duration, sourceQuestions } = req.body;
        if (!answers || !answers.length) {
            return res.status(400).json({ message: 'No answers provided' });
        }

        let score = 0;
        const verifiedAnswers = answers.map(ans => {
            if (ans.isCorrect) score++;
            return ans;
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
        res.status(400).json({ message: 'Failed to save endless attempt: ' + err.message });
    }
});

// GET specific test
router.get('/:id', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Test not found' });
        res.json(test);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ message: 'Test not found' });
        }
        res.status(500).json({ message: 'Failed to fetch test: ' + err.message });
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

        const attempt = new Attempt({
            testId: req.params.id,
            userId: req.user._id,
            score: serverScore,
            totalQuestions: test.questions.length,
            duration: req.body.duration,
            overdueTime: req.body.overdueTime || 0,
            answers: verifiedAnswers,
            mode: req.body.mode || 'Test'
        });
        const savedAttempt = await attempt.save();
        res.status(201).json(savedAttempt);
    } catch (err) {
        res.status(400).json({ message: 'Failed to save attempt: ' + err.message });
    }
});

module.exports = { router, parseTextWithLLM };
