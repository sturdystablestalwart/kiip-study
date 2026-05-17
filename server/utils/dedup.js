// Issue #4 — `string-similarity` is deprecated (repo archived, no
// updates since 2021).  We only used one function from it
// (compareTwoStrings → Sørensen–Dice coefficient on character
// bigrams).  Inlining the ~12-line algorithm removes a dead-codeball
// dependency while preserving the exact same scoring distribution, so
// the existing 0.75 / 0.5 thresholds in findDuplicates and the
// /api/duplicates route don't need re-tuning.
function diceCoefficient(rawA, rawB) {
    // Match the original string-similarity behaviour byte-for-byte:
    // strip all internal whitespace before bigramming so the score
    // distribution stays identical and the 0.75 / 0.5 thresholds in
    // findDuplicates + /api/duplicates don't need re-tuning.
    const a = rawA.replace(/\s+/g, '');
    const b = rawB.replace(/\s+/g, '');
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const aBigrams = new Map();
    for (let i = 0; i < a.length - 1; i++) {
        const bg = a.slice(i, i + 2);
        aBigrams.set(bg, (aBigrams.get(bg) || 0) + 1);
    }
    // Walk b's bigrams; decrement the multiset on each match so
    // duplicate bigrams aren't double-counted (reference algorithm).
    let intersection = 0;
    for (let i = 0; i < b.length - 1; i++) {
        const bg = b.slice(i, i + 2);
        const count = aBigrams.get(bg);
        if (count > 0) {
            intersection += 1;
            aBigrams.set(bg, count - 1);
        }
    }
    return (2 * intersection) / (a.length + b.length - 2);
}

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

// Issue #134 — yield to the event loop every N outer iterations so the
// O(n²) compareTwoStrings sweep doesn't stall other requests for
// multi-second windows.  setImmediate gives microtask-flush time +
// network IO a fair shot between batches.
const YIELD_EVERY = 50;
function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function findDuplicates(questions, threshold = 0.75) {
  const clusters = [];
  const seen = new Set();

  // Pre-compute normalized text to avoid O(n^2) redundant normalize() calls
  const normalized = questions.map(q => normalize(q.text));

  for (let i = 0; i < questions.length; i++) {
    if (seen.has(i)) continue;
    const cluster = [{ index: i, question: questions[i] }];

    for (let j = i + 1; j < questions.length; j++) {
      if (seen.has(j)) continue;
      if (questions[i].testId != null
          && questions[j].testId != null
          && String(questions[i].testId) === String(questions[j].testId)
          && questions[i].questionIndex === questions[j].questionIndex) continue;
      const score = diceCoefficient(normalized[i], normalized[j]);
      if (score >= threshold) {
        cluster.push({ index: j, question: questions[j], score: Math.round(score * 100) });
        seen.add(j);
      }
    }

    if (cluster.length > 1) {
      seen.add(i);
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

    if ((i + 1) % YIELD_EVERY === 0) {
      await yieldEventLoop();
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
      const score = diceCoefficient(normalizedNew, normalizedExisting[i]);
      if (score >= threshold) {
        matches.push({ question: existingQuestions[i], score: Math.round(score * 100) });
      }
    }
    return { index: idx, question: nq, duplicates: matches.sort((a, b) => b.score - a.score) };
  }).filter(r => r.duplicates.length > 0);
}

module.exports = { findDuplicates, checkAgainstExisting };
