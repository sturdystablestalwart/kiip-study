const stringSimilarity = require('string-similarity');

function normalize(text) {
  // Strip only punctuation. Keep every Unicode letter (\p{L}) and number
  // (\p{N}) \u2014 including Hangul, CJK, fullwidth digits \u2014 and whitespace.
  // The pre-#144 ASCII-only `\w` class quietly dropped fullwidth digits,
  // making "1\uACFC" and "2\uACFC" collapse to the same string.
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

function findDuplicates(questions, threshold = 0.75) {
  const clusters = [];
  const seen = new Set();

  // Pre-compute normalized text to avoid O(n^2) redundant normalize() calls
  const normalized = questions.map(q => normalize(q.text));

  for (let i = 0; i < questions.length; i++) {
    if (seen.has(i)) continue;
    const cluster = [{ index: i, question: questions[i] }];

    for (let j = i + 1; j < questions.length; j++) {
      if (seen.has(j)) continue;
      // Skip comparing a question with itself (same test, same index).
      // Only gate on testId when both questions have one defined — otherwise we
      // would skip every comparison in tests/data without testId fields.
      if (questions[i].testId != null
          && questions[j].testId != null
          && String(questions[i].testId) === String(questions[j].testId)
          && questions[i].questionIndex === questions[j].questionIndex) continue;
      const score = stringSimilarity.compareTwoStrings(normalized[i], normalized[j]);
      if (score >= threshold) {
        cluster.push({ index: j, question: questions[j], score: Math.round(score * 100) });
        seen.add(j);
      }
    }

    if (cluster.length > 1) {
      seen.add(i);
      // Compute max similarity score across all pairs in the cluster
      const maxScore = Math.max(...cluster.slice(1).map(c => c.score || 0));
      clusters.push({
        similarity: maxScore / 100,
        questions: cluster.map(c => ({
          text: c.question.text,
          testId: c.question.testId,
          testTitle: c.question.testTitle,
          questionIndex: c.question.questionIndex,
        })),
      });
    }
  }

  return clusters;
}

function checkAgainstExisting(newQuestions, existingQuestions, threshold = 0.75) {
  // Pre-compute normalized text for existing questions
  const normalizedExisting = existingQuestions.map(eq => normalize(eq.text));

  return newQuestions.map((nq, idx) => {
    const normalizedNew = normalize(nq.text);
    const matches = [];
    for (let i = 0; i < existingQuestions.length; i++) {
      const score = stringSimilarity.compareTwoStrings(normalizedNew, normalizedExisting[i]);
      if (score >= threshold) {
        matches.push({ question: existingQuestions[i], score: Math.round(score * 100) });
      }
    }
    return { index: idx, question: nq, duplicates: matches.sort((a, b) => b.score - a.score) };
  }).filter(r => r.duplicates.length > 0);
}

module.exports = { findDuplicates, checkAgainstExisting };
