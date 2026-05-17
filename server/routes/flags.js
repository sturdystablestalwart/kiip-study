const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const Flag = require('../models/Flag');
const { requireAuth } = require('../middleware/auth');
const safeError = require('../utils/safeError');

// Issue #36 — per-user limit on POST /api/flags so a single
// authenticated user can't flood the moderation queue.  No-op in
// NODE_ENV=test.
const flagSubmitLimiter = process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 60 * 1000,
        max: 10,
        keyGenerator: (req) => String(req.user?._id || req.ip),
        standardHeaders: true,
        legacyHeaders: false,
    });

// POST /api/flags — Submit or update a flag
router.post('/', requireAuth, flagSubmitLimiter, async (req, res) => {
    try {
        const { testId, questionIndex, reason, note } = req.body;

        if (!testId || !reason) {
            return res.status(400).json({ message: 'testId and reason are required' });
        }

        if (!mongoose.Types.ObjectId.isValid(testId)) {
            return res.status(400).json({ message: 'Invalid testId' });
        }

        const validReasons = ['incorrect-answer', 'unclear-question', 'typo', 'other'];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ message: 'Invalid reason' });
        }

        const flag = await Flag.findOneAndUpdate(
            {
                userId: req.user._id,
                testId,
                questionIndex: questionIndex ?? null
            },
            {
                userId: req.user._id,
                testId,
                questionIndex: questionIndex ?? null,
                reason,
                note: note?.slice(0, 500) || '',
                status: 'open'
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(201).json(flag);
    } catch (err) {
        res.status(400).json({ message: safeError('Failed to submit flag', err) });
    }
});

module.exports = router;
