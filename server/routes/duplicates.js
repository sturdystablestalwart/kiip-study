const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Test = require('../models/Test');
const { findDuplicates } = require('../utils/dedup');
const safeError = require('../utils/safeError');
const logger = require('../utils/logger');

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  // Issue #59 — wrap handler in try/catch so a Mongo/dedup failure
  // returns the project-standard `{ message: safeError(...) }` shape
  // instead of the bare 500 the global error middleware emits.
  try {
    const { level } = req.query;
    let threshold = parseFloat(req.query.threshold);
    if (isNaN(threshold) || threshold < 0.5) threshold = 0.5;
    if (threshold > 1.0) threshold = 1.0;

    const filter = (level && typeof level === 'string') ? { level } : {};
    const tests = await Test.find(filter, { title: 1, 'questions.text': 1 }).lean();

    const allQuestions = [];
    for (const test of tests) {
      for (let i = 0; i < test.questions.length; i++) {
        allQuestions.push({
          ...test.questions[i],
          testId: test._id,
          testTitle: test.title,
          questionIndex: i,
        });
      }
    }

    // Safety cap: refuse if too many questions (prevent event loop blocking).
    // Issue #134 — was 5000, lowered to 2000 because the O(n²) sweep still
    // burns ~5-10s of CPU even with the new setImmediate yields.  Admins
    // hitting this cap can filter by level to scope the run.
    if (allQuestions.length > 2000) {
      return res.status(400).json({
        error: `Too many questions (${allQuestions.length}). Filter by level to reduce scope (max 2000).`
      });
    }

    const clusters = await findDuplicates(allQuestions, threshold);
    res.json({ totalQuestions: allQuestions.length, clusters });
  } catch (err) {
    logger.error({ err }, 'GET /api/duplicates failed');
    res.status(500).json({ message: safeError('Failed to scan duplicates', err) });
  }
});

module.exports = router;
