/**
 * publicTestProjection — strips all answer-key fields from a Test document
 * (or a bare questions array) before sending it to a non-admin client.
 *
 * Server-side scoring (`scoring.js`) always re-fetches the original Test
 * from the DB to compute correctness, so this projection is purely about
 * what we put on the wire. Stripping these fields prevents trivial DevTools
 * cheating (issue #107) and competitor scraping of the answer bank via
 * ObjectId enumeration on `GET /api/tests/:id` (issue #108).
 *
 * Fields stripped from each question:
 *   - options[].isCorrect         (mcq-single, mcq-multiple)
 *   - acceptedAnswers             (short-answer)
 *   - correctOrder                (ordering)
 *   - blanks[].acceptedAnswers    (fill-in-the-blank)
 *
 * Preserved:
 *   - explanation (the client only renders it post-submit; admins keep it
 *     via the explicit bypass for admin requests at the route layer).
 *
 * Accepts either a full Test object (with a `.questions` array) OR a bare
 * questions array; returns the same shape. Pure function, no DB access.
 */
function projectQuestion(q) {
    if (!q || typeof q !== 'object') return q;

    // Clone shallowly so we never mutate the caller's data
    const out = { ...q };

    if (Array.isArray(out.options)) {
        out.options = out.options.map(opt => {
            if (!opt || typeof opt !== 'object') return opt;
            // Strip isCorrect — keep all other fields (text, etc.)
            // eslint-disable-next-line no-unused-vars
            const { isCorrect, ...rest } = opt;
            return rest;
        });
    }

    if ('acceptedAnswers' in out) {
        delete out.acceptedAnswers;
    }

    if ('correctOrder' in out) {
        delete out.correctOrder;
    }

    if (Array.isArray(out.blanks)) {
        out.blanks = out.blanks.map(blank => {
            if (!blank || typeof blank !== 'object') return blank;
            // eslint-disable-next-line no-unused-vars
            const { acceptedAnswers, ...rest } = blank;
            return rest;
        });
    }

    return out;
}

function publicTestProjection(testOrQuestions) {
    if (testOrQuestions == null) return testOrQuestions;

    // Bare questions array
    if (Array.isArray(testOrQuestions)) {
        return testOrQuestions.map(projectQuestion);
    }

    // Full Test object (or any object with a .questions array)
    if (typeof testOrQuestions === 'object') {
        const out = { ...testOrQuestions };
        if (Array.isArray(out.questions)) {
            out.questions = out.questions.map(projectQuestion);
        }
        return out;
    }

    return testOrQuestions;
}

module.exports = publicTestProjection;
