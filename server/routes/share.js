const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Test = require('../models/Test');
const { requireAuth } = require('../middleware/auth');

// Rate limit public share endpoint to prevent brute-force enumeration
const shareLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

// POST /api/tests/:id/share — generate share ID (requires auth)
router.post('/:id/share', requireAuth, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });

    if (!test.shareId) {
      const { nanoid } = await import('nanoid');
      test.shareId = nanoid(10);
      await test.save();
    }

    const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/shared/${test.shareId}`;
    res.json({ shareId: test.shareId, shareUrl });
  } catch (err) {
    console.error('Error generating share link:', err);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

// GET /api/shared/:shareId — public test view (no auth required)
router.get('/:shareId', shareLimiter, async (req, res) => {
  try {
    const test = await Test.findOne({ shareId: req.params.shareId });
    if (!test) return res.status(404).json({ error: 'Test not found' });

    res.json({
      _id: test._id,
      title: test.title,
      description: test.description,
      level: test.level,
      unit: test.unit,
      questionCount: test.questions.length,
      shareId: test.shareId,
    });
  } catch (err) {
    console.error('Error fetching shared test:', err);
    res.status(500).json({ error: 'Failed to fetch shared test' });
  }
});

module.exports = router;
