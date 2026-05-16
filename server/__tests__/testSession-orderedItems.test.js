import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// Regression test for issue #106 — TestSession.orderedItems schema must use
// `[Number]` (the same type Attempt.answers and the scoring contract expect).
//
// Background: SessionAnswerSchema.orderedItems was originally declared as
// `[{ type: String }]`. Mongoose cast the numeric indices submitted by the
// client to strings on save. When server/utils/scoring.js then compared each
// element with strict `===` against question.correctOrder (`[Number]`), the
// comparison was always false — so every ordering question submitted via the
// resumable-session flow was marked wrong.
//
// We exercise this at the model boundary (Mongoose schema cast on subdoc
// instantiation) plus the scoring util. No DB connection is required: Mongoose
// applies SchemaType casting as soon as a Document is constructed. This keeps
// the test fast and works without mongodb-memory-server (which is not in this
// repo's devDependencies).

// JWT_SECRET must be set before requiring server modules that read env at
// load time (middleware/auth.js hard-throws otherwise).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-32chars-minimum-length!!';
process.env.NODE_ENV = 'test';

const require = createRequire(import.meta.url);
const TestSession = require('../models/TestSession');
const { scoreQuestion } = require('../utils/scoring');

describe('TestSession.answers.orderedItems schema (issue #106)', () => {
    it('preserves numeric type for orderedItems through schema cast', () => {
        // Build a session-resume answer the way the submit route receives it:
        // numeric indices into the question's items array.
        const session = new TestSession({
            userId: '507f1f77bcf86cd799439011',
            testId: '507f1f77bcf86cd799439012',
            mode: 'Practice',
            answers: [
                {
                    questionIndex: 0,
                    orderedItems: [0, 1, 2, 3]
                }
            ],
            remainingTime: 1800
        });

        const stored = session.answers[0].orderedItems;
        // All elements must remain numbers. If the schema declares the field
        // as `[String]` Mongoose casts each entry to "0","1","2","3" and this
        // assertion fails — that's the bug the issue describes.
        for (const v of stored) {
            expect(typeof v).toBe('number');
        }
        expect(stored).toEqual([0, 1, 2, 3]);
    });

    it('scores an ordering question correctly when answer flows through the TestSession schema', () => {
        // This is the end-to-end path of the bug: client submits numeric
        // indices → schema casts → scoreQuestion compares with strict ===.
        const session = new TestSession({
            userId: '507f1f77bcf86cd799439011',
            testId: '507f1f77bcf86cd799439012',
            mode: 'Practice',
            answers: [
                {
                    questionIndex: 0,
                    orderedItems: [0, 1, 2, 3]
                }
            ],
            remainingTime: 1800
        });

        const question = {
            type: 'ordering',
            text: 'Put these in order',
            correctOrder: [0, 1, 2, 3]
        };

        // .toObject() is what the submit route effectively reads when it
        // hands an answer subdoc to scoreQuestion via .find(). We use it
        // here to mirror the cast that's already been applied.
        const answer = session.answers[0].toObject();
        const isCorrect = scoreQuestion(question, answer);

        // With the bug present (orderedItems: [String]) every element is a
        // string and `"0" === 0` is false → isCorrect is false.
        expect(isCorrect).toBe(true);
    });
});
