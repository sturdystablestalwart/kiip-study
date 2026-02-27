const stringSimilarity = require('string-similarity');

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\uAC00-\uD7AF\u3130-\u318F]/g, '')
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
      const score = stringSimilarity.compareTwoStrings(normalized[i], normalized[j]);
      if (score >= threshold) {
        cluster.push({ index: j, question: questions[j], score: Math.round(score * 100) });
        seen.add(j);
      }
    }

    if (cluster.length > 1) {
      seen.add(i);
      clusters.push(cluster);
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
