const express = require('express');
const router = express.Router();
const TestSession = require('../models/TestSession');
const Attempt = require('../models/Attempt');
const Test = require('../models/Test');
const { requireAuth } = require('../middleware/auth');
const { scoreQuestion } = require('../utils/scoring');
const safeError = require('../utils/safeError');

// POST /api/sessions/start
// Body: { testId, mode }
// Returns existing active session (resumed: true) or creates a new one (resumed: false)
router.post('/start', requireAuth, async (req, res) => {
    try {
        const { testId, mode } = req.body;

        if (!testId || !mode) {
            return res.status(400).json({ message: 'testId and mode are required' });
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
// Update answers, currentQuestion, remainingTime for an active session
router.patch('/:id', requireAuth, async (req, res) => {
    try {
        const { answers, currentQuestion, remainingTime } = req.body;

        const session = await TestSession.findOne({
            _id: req.params.id,
            userId: req.user._id,
            status: 'active'
        });

        if (!session) {
            return res.status(404).json({ message: 'Active session not found' });
        }

        if (answers !== undefined) session.answers = answers;
        if (currentQuestion !== undefined) session.currentQuestion = currentQuestion;
        if (remainingTime !== undefined) session.remainingTime = remainingTime;
        session.lastSavedAt = new Date();

        await session.save();

        return res.status(200).json({ session });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to update session', err) });
    }
});

// POST /api/sessions/:id/submit
// Score answers server-side, create an Attempt, mark session completed
router.post('/:id/submit', requireAuth, async (req, res) => {
    try {
        const session = await TestSession.findOne({
            _id: req.params.id,
            userId: req.user._id,
            status: 'active'
        });

        if (!session) {
            return res.status(404).json({ message: 'Active session not found' });
        }

        const test = await Test.findById(session.testId);
        if (!test) {
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

        const { overdueTime } = req.body;

        const attempt = await Attempt.create({
            testId: session.testId,
            userId: req.user._id,
            score,
            totalQuestions: total,
            duration,
            overdueTime: overdueTime || 0,
            answers: scoredAnswers,
            mode: session.mode
        });

        // Mark the session as completed
        session.status = 'completed';
        await session.save();

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
            .limit(5);

        return res.status(200).json({ sessions });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to fetch active sessions', err) });
    }
});

// DELETE /api/sessions/:id
// Abandon an active session (soft delete — set status to 'abandoned')
router.delete('/:id', requireAuth, async (req, res) => {
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
