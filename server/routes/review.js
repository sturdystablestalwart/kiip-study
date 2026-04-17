const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Attempt = require('../models/Attempt');
const Test = require('../models/Test');
const mongoose = require('mongoose');
const { safeError } = require('../utils/safeError');

// GET /api/review/failed — Questions the user got wrong recently
router.get('/failed', requireAuth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user._id);
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);

        const attempts = await Attempt.find({ userId, testId: { $ne: null } })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        const failedRefs = [];
        for (const attempt of attempts) {
            for (const ans of attempt.answers) {
                if (!ans.isCorrect) {
                    failedRefs.push({ testId: attempt.testId, questionIndex: ans.questionIndex });
                }
            }
        }

        const seen = new Set();
        const uniqueRefs = failedRefs.filter(r => {
            const key = `${r.testId}_${r.questionIndex}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, limit);

        const testIds = [...new Set(uniqueRefs.map(r => r.testId.toString()))];
        const tests = await Test.find({ _id: { $in: testIds } }).lean();
        const testMap = Object.fromEntries(tests.map(t => [t._id.toString(), t]));

        const questions = uniqueRefs.map(ref => {
            const test = testMap[ref.testId.toString()];
            if (!test || !test.questions[ref.questionIndex]) return null;
            const q = test.questions[ref.questionIndex];
            return {
                ...q,
                _sourceTestId: ref.testId,
                _sourceIndex: ref.questionIndex,
                _sourceTestTitle: test.title,
                _sourceKey: `${ref.testId}_${ref.questionIndex}`,
            };
        }).filter(Boolean);

        res.json({ questions, total: questions.length });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to load review questions', err) });
    }
});

// GET /api/review/difficulty — Average accuracy per test
router.get('/difficulty', requireAuth, async (req, res) => {
    try {
        const result = await Attempt.aggregate([
            { $match: { testId: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: '$testId',
                    avgScore: { $avg: { $multiply: [{ $divide: ['$score', '$totalQuestions'] }, 100] } },
                    attempts: { $sum: 1 },
                },
            },
            { $project: { testId: '$_id', _id: 0, avgScore: { $round: ['$avgScore', 0] }, attempts: 1 } },
        ]);

        const difficultyMap = Object.fromEntries(result.map(r => [r.testId.toString(), r]));
        res.json({ difficulty: difficultyMap });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to load difficulty data', err) });
    }
});

module.exports = router;
