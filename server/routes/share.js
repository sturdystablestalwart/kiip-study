const express = require('express');
const rateLimit = require('express-rate-limit');
const Test = require('../models/Test');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

// Issue #135 — share routes are split into two routers so the caller cannot
// accidentally dual-mount and expose the public no-auth GET handler under a
// path it doesn't belong on (previously `app.use('/api/tests', shareRoutes)`
// was mounted alongside `app.use('/api/shared', shareRoutes)`, silently
// creating `GET /api/tests/:shareId` shadowed by tests.js `GET /:id`).
//
// Mount these in server/index.js as:
//     app.use('/api/shared', publicRouter);   // public GET
//     app.use('/api/tests',  adminRouter);    // admin POST :id/share

const publicRouter = express.Router();
const adminRouter = express.Router();

// Rate limit public share endpoint to prevent brute-force enumeration
const shareLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

// ─── Admin: POST /api/tests/:id/share — generate share ID (requires auth + admin) ───
adminRouter.post('/:id/share', requireAuth, requireAdmin, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });

    if (!test.shareId) {
      const { nanoid } = await import('nanoid');
      // 21 chars of the default URL-safe alphabet = ~126 entropy bits,
      // far above what the 30 req/min public rate-limit can practically enumerate.
      // Older 10-char shareIds keep working because the schema accepts any string.
      test.shareId = nanoid(21);
      await test.save();
    }

    const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/shared/${test.shareId}`;
    res.json({ shareId: test.shareId, shareUrl });
  } catch (err) {
    logger.error({ err }, 'Error generating share link');
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

// ─── Public: GET /api/shared/:shareId — public test view (no auth required) ───
publicRouter.get('/:shareId', shareLimiter, async (req, res) => {
  try {
    const results = await Test.aggregate([
      { $match: { shareId: req.params.shareId } },
      { $limit: 1 },
      { $project: {
        title: 1, description: 1, level: 1, unitNumber: 1, section: 1, contentType: 1, shareId: 1,
        questionCount: { $size: '$questions' }
      }},
    ]);
    const test = results[0];
    if (!test) return res.status(404).json({ error: 'Test not found' });

    res.set('Cache-Control', 'public, max-age=300');
    res.json(test);
  } catch (err) {
    logger.error({ err }, 'Error fetching shared test');
    res.status(500).json({ error: 'Failed to fetch shared test' });
  }
});

module.exports = { publicRouter, adminRouter };
