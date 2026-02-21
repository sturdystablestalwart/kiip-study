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

  for (let i = 0; i < questions.length; i++) {
    if (seen.has(i)) continue;
    const cluster = [{ index: i, question: questions[i] }];

    for (let j = i + 1; j < questions.length; j++) {
      if (seen.has(j)) continue;
      const score = stringSimilarity.compareTwoStrings(
        normalize(questions[i].text),
        normalize(questions[j].text)
      );
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
  return newQuestions.map((nq, idx) => {
    const normalizedNew = normalize(nq.text);
    const matches = [];
    for (const eq of existingQuestions) {
      const score = stringSimilarity.compareTwoStrings(normalizedNew, normalize(eq.text));
      if (score >= threshold) {
        matches.push({ question: eq, score: Math.round(score * 100) });
      }
    }
    return { index: idx, question: nq, duplicates: matches.sort((a, b) => b.score - a.score) };
  }).filter(r => r.duplicates.length > 0);
}

module.exports = { findDuplicates, checkAgainstExisting, normalize };
