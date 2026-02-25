const express = require('express');
const router = express.Router();
const Flag = require('../models/Flag');
const { requireAuth } = require('../middleware/auth');
const safeError = require('../utils/safeError');

// POST /api/flags — Submit or update a flag
router.post('/', requireAuth, async (req, res) => {
    try {
        const { testId, questionIndex, reason, note } = req.body;

        if (!testId || !reason) {
            return res.status(400).json({ message: 'testId and reason are required' });
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
