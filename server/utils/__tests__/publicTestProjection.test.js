import { describe, it, expect } from 'vitest';
import publicTestProjection from '../publicTestProjection.js';

// Synthetic fixtures — minimal shape mirroring server/models/Test.js.
function mcqSingleQ() {
    return {
        text: 'Which is the capital of Korea?',
        type: 'mcq-single',
        explanation: 'Seoul is the capital.',
        options: [
            { text: 'Seoul', isCorrect: true },
            { text: 'Busan', isCorrect: false },
            { text: 'Incheon', isCorrect: false },
            { text: 'Daegu', isCorrect: false },
        ],
    };
}

function mcqMultipleQ() {
    return {
        text: 'Which are Korean cities?',
        type: 'mcq-multiple',
        options: [
            { text: 'Seoul', isCorrect: true },
            { text: 'Busan', isCorrect: true },
            { text: 'Tokyo', isCorrect: false },
        ],
    };
}

function shortAnswerQ() {
    return {
        text: 'What is the capital of Korea?',
        type: 'short-answer',
        acceptedAnswers: ['Seoul', 'Seoul-City', 'seoul'],
    };
}

function orderingQ() {
    return {
        text: 'Order the months chronologically',
        type: 'ordering',
        options: [
            { text: 'February' },
            { text: 'January' },
            { text: 'March' },
        ],
        correctOrder: [1, 0, 2],
    };
}

function fillInTheBlankQ() {
    return {
        text: 'The capital of ___ is ___.',
        type: 'fill-in-the-blank',
        blanks: [
            { acceptedAnswers: ['Korea', 'South Korea'] },
            { acceptedAnswers: ['Seoul'] },
        ],
    };
}

describe('publicTestProjection — bare questions array', () => {
    it('strips isCorrect from every option in mcq-single', () => {
        const projected = publicTestProjection([mcqSingleQ()]);
        for (const opt of projected[0].options) {
            expect(opt).not.toHaveProperty('isCorrect');
            expect(opt.text).toBeTypeOf('string'); // text preserved
        }
    });

    it('strips isCorrect from every option in mcq-multiple', () => {
        const projected = publicTestProjection([mcqMultipleQ()]);
        expect(projected[0].options.every(o => !('isCorrect' in o))).toBe(true);
    });

    it('strips acceptedAnswers from short-answer', () => {
        const projected = publicTestProjection([shortAnswerQ()]);
        expect(projected[0]).not.toHaveProperty('acceptedAnswers');
        expect(projected[0].text).toBe('What is the capital of Korea?');
    });

    it('strips correctOrder from ordering', () => {
        const projected = publicTestProjection([orderingQ()]);
        expect(projected[0]).not.toHaveProperty('correctOrder');
        // Options preserved so the client can still render the items to drag/drop
        expect(projected[0].options).toHaveLength(3);
    });

    it('strips acceptedAnswers from every blank in fill-in-the-blank', () => {
        const projected = publicTestProjection([fillInTheBlankQ()]);
        for (const blank of projected[0].blanks) {
            expect(blank).not.toHaveProperty('acceptedAnswers');
        }
    });

    it('preserves the explanation field', () => {
        const projected = publicTestProjection([mcqSingleQ()]);
        expect(projected[0].explanation).toBe('Seoul is the capital.');
    });

    it('handles a mixed array of all question types in one call', () => {
        const projected = publicTestProjection([
            mcqSingleQ(),
            mcqMultipleQ(),
            shortAnswerQ(),
            orderingQ(),
            fillInTheBlankQ(),
        ]);
        expect(projected).toHaveLength(5);
        expect(projected[0].options.every(o => !('isCorrect' in o))).toBe(true);
        expect(projected[1].options.every(o => !('isCorrect' in o))).toBe(true);
        expect(projected[2]).not.toHaveProperty('acceptedAnswers');
        expect(projected[3]).not.toHaveProperty('correctOrder');
        expect(projected[4].blanks.every(b => !('acceptedAnswers' in b))).toBe(true);
    });

    it('returns an empty array when given an empty array', () => {
        expect(publicTestProjection([])).toEqual([]);
    });
});

describe('publicTestProjection — full Test object', () => {
    it('strips answer keys from .questions while preserving top-level fields', () => {
        const test = {
            _id: 'abc123',
            title: 'KIIP Level 2 Mock Exam',
            level: '2',
            unitNumber: 5,
            description: 'A practice exam',
            createdAt: new Date('2026-01-15T00:00:00.000Z'),
            questions: [mcqSingleQ(), shortAnswerQ()],
        };
        const projected = publicTestProjection(test);
        expect(projected.title).toBe('KIIP Level 2 Mock Exam');
        expect(projected.level).toBe('2');
        expect(projected.unitNumber).toBe(5);
        expect(projected.description).toBe('A practice exam');
        expect(projected.questions[0].options.every(o => !('isCorrect' in o))).toBe(true);
        expect(projected.questions[1]).not.toHaveProperty('acceptedAnswers');
    });

    it('returns same shape (object → object, array → array)', () => {
        expect(Array.isArray(publicTestProjection([mcqSingleQ()]))).toBe(true);
        const obj = publicTestProjection({ questions: [mcqSingleQ()] });
        expect(Array.isArray(obj)).toBe(false);
        expect(obj).toHaveProperty('questions');
    });

    it('returns the input untouched when there is no .questions array', () => {
        const projected = publicTestProjection({ title: 'no-questions' });
        expect(projected).toEqual({ title: 'no-questions' });
    });
});

describe('publicTestProjection — purity & edge cases', () => {
    it('does not mutate the caller input', () => {
        const original = {
            questions: [mcqSingleQ(), shortAnswerQ()],
        };
        const snapshot = JSON.parse(JSON.stringify(original));
        publicTestProjection(original);
        expect(original).toEqual(snapshot);
    });

    it('returns null/undefined inputs untouched', () => {
        expect(publicTestProjection(null)).toBeNull();
        expect(publicTestProjection(undefined)).toBeUndefined();
    });

    it('handles malformed question entries gracefully (null / non-object)', () => {
        const projected = publicTestProjection([null, 'not-a-question', mcqSingleQ()]);
        expect(projected[0]).toBeNull();
        expect(projected[1]).toBe('not-a-question');
        expect(projected[2].options.every(o => !('isCorrect' in o))).toBe(true);
    });

    it('handles a question with options that are not objects', () => {
        const projected = publicTestProjection([{ options: [null, 'foo'] }]);
        expect(projected[0].options).toEqual([null, 'foo']);
    });
});
