const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Attempt = require('../models/Attempt');
const mongoose = require('mongoose');

// GET /api/stats — KPIs + accuracy trend + unit breakdown
router.get('/', requireAuth, async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const { period, level } = req.query;

    // Date filter
    let dateFilter = {};
    if (period === '7d') dateFilter = { createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } };
    else if (period === '30d') dateFilter = { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } };
    else if (period === '90d') dateFilter = { createdAt: { $gte: new Date(Date.now() - 90 * 86400000) } };

    const matchStage = { userId, ...dateFilter };

    // KPIs
    const [kpiResult] = await Attempt.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalAttempts: { $sum: 1 },
                totalCorrect: { $sum: '$score' },
                totalQuestions: { $sum: '$totalQuestions' },
            },
        },
    ]);

    const kpis = kpiResult
        ? {
            totalAttempts: kpiResult.totalAttempts,
            averageScore: kpiResult.totalQuestions > 0
                ? Math.round((kpiResult.totalCorrect / kpiResult.totalQuestions) * 1000) / 10
                : 0,
        }
        : { totalAttempts: 0, averageScore: 0 };

    // Streak — consecutive days with attempts
    const dayBuckets = await Attempt.aggregate([
        { $match: { userId } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } } },
        { $sort: { _id: -1 } },
    ]);

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < dayBuckets.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        const expectedStr = expected.toISOString().slice(0, 10);
        if (dayBuckets[i]._id === expectedStr) streak++;
        else break;
    }
    kpis.currentStreak = streak;

    // Accuracy trend (by day)
    const accuracyTrend = await Attempt.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                totalCorrect: { $sum: '$score' },
                totalQuestions: { $sum: '$totalQuestions' },
                attempts: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
        {
            $project: {
                date: '$_id', _id: 0,
                score: { $round: [{ $multiply: [{ $divide: ['$totalCorrect', '$totalQuestions'] }, 100] }, 1] },
                attempts: 1,
            },
        },
    ]);

    // Unit breakdown
    const unitBreakdown = await Attempt.aggregate([
        { $match: { ...matchStage, testId: { $exists: true, $ne: null } } },
        { $lookup: {
            from: 'tests', localField: 'testId', foreignField: '_id', as: 'test',
            pipeline: [{ $project: { unit: 1, level: 1 } }]
        } },
        { $unwind: '$test' },
        ...(level ? [{ $match: { 'test.level': level } }] : []),
        {
            $group: {
                _id: '$test.unit',
                totalCorrect: { $sum: '$score' },
                totalQuestions: { $sum: '$totalQuestions' },
                attempts: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
        {
            $project: {
                unit: '$_id', _id: 0,
                avgScore: { $round: [{ $multiply: [{ $divide: ['$totalCorrect', '$totalQuestions'] }, 100] }, 1] },
                attempts: 1,
            },
        },
    ]);

    const weakest = unitBreakdown.length > 0
        ? unitBreakdown.reduce((min, u) => (u.avgScore < min.avgScore ? u : min))
        : null;
    kpis.weakestUnit = weakest ? { unit: weakest.unit, avgScore: weakest.avgScore } : null;

    res.json({ kpis, accuracyTrend, unitBreakdown });
});

// GET /api/stats/question-types
router.get('/question-types', requireAuth, async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const result = await Attempt.aggregate([
        { $match: { userId } },
        { $unwind: '$answers' },
        { $lookup: { from: 'tests', localField: 'testId', foreignField: '_id', as: 'test' } },
        { $unwind: { path: '$test', preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                questionType: {
                    $ifNull: [
                        { $arrayElemAt: ['$test.questions.type', '$answers.questionIndex'] },
                        'mcq-single',
                    ],
                },
            },
        },
        {
            $group: {
                _id: '$questionType',
                correct: { $sum: { $cond: ['$answers.isCorrect', 1, 0] } },
                total: { $sum: 1 },
            },
        },
        {
            $project: {
                type: '$_id', _id: 0,
                correct: 1, total: 1,
                accuracy: { $round: [{ $multiply: [{ $divide: ['$correct', '$total'] }, 100] }, 1] },
            },
        },
        { $sort: { type: 1 } },
    ]);

    res.json({ types: result });
});

module.exports = router;
