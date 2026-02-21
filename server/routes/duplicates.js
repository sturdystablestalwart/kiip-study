const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Test = require('../models/Test');
const { findDuplicates } = require('../utils/dedup');

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { level, threshold = 0.75 } = req.query;
  const filter = level ? { level } : {};
  const tests = await Test.find(filter).lean();

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

  const clusters = findDuplicates(allQuestions, parseFloat(threshold));
  res.json({ totalQuestions: allQuestions.length, clusters });
});

module.exports = router;
