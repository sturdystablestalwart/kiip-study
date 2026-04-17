import { describe, test, expect } from 'vitest';
import { validateLLMOutput } from '../llmValidator.js';

// ── helpers ────────────────────────────────────────────────────────────────

function validOutput(overrides = {}) {
    return {
        title: 'KIIP Level 2 — Unit 1 Practice Test',
        questions: [
            {
                text: '다음 중 올바른 것을 고르세요.',
                type: 'mcq-single',
                explanation: 'This is the correct answer because…',
                options: [
                    { text: '보기 1', isCorrect: false },
                    { text: '보기 2', isCorrect: true },
                    { text: '보기 3', isCorrect: false },
                    { text: '보기 4', isCorrect: false },
                ],
            },
        ],
        ...overrides,
    };
}

function repeat(char, n) {
    return char.repeat(n);
}

// ── 1. accepts valid output ────────────────────────────────────────────────

describe('valid output', () => {
    test('accepts a well-formed object', () => {
        expect(() => validateLLMOutput(validOutput())).not.toThrow();
    });

    test('accepts output without optional explanation', () => {
        const o = validOutput();
        delete o.questions[0].explanation;
        expect(() => validateLLMOutput(o)).not.toThrow();
    });

    test('accepts output without optional image', () => {
        expect(() => validateLLMOutput(validOutput())).not.toThrow();
    });

    test('accepts output with optional image within limits', () => {
        const o = validOutput();
        o.questions[0].image = 'q1.jpg';
        expect(() => validateLLMOutput(o)).not.toThrow();
    });
});

// ── 2. title validation ───────────────────────────────────────────────────

describe('title validation', () => {
    test('rejects missing title', () => {
        const o = validOutput();
        delete o.title;
        expect(() => validateLLMOutput(o)).toThrow(/title must be a non-empty string/);
    });

    test('rejects non-string title', () => {
        expect(() => validateLLMOutput(validOutput({ title: 42 }))).toThrow(/title/);
    });

    test('rejects empty string title', () => {
        expect(() => validateLLMOutput(validOutput({ title: '' }))).toThrow(/title/);
    });

    test('rejects title over 200 characters', () => {
        expect(() =>
            validateLLMOutput(validOutput({ title: repeat('A', 201) }))
        ).toThrow(/title exceeds 200 characters/);
    });

    test('accepts title of exactly 200 characters', () => {
        expect(() =>
            validateLLMOutput(validOutput({ title: repeat('A', 200) }))
        ).not.toThrow();
    });

    test('rejects HTML in title', () => {
        expect(() =>
            validateLLMOutput(validOutput({ title: '<b>Bold</b>' }))
        ).toThrow(/title contains HTML tags/);
    });
});

// ── 3. questions array validation ────────────────────────────────────────

describe('questions array', () => {
    test('rejects non-array questions', () => {
        expect(() =>
            validateLLMOutput(validOutput({ questions: 'not an array' }))
        ).toThrow(/questions must be an array/);
    });

    test('rejects questions as null', () => {
        expect(() =>
            validateLLMOutput(validOutput({ questions: null }))
        ).toThrow(/questions must be an array/);
    });

    test('rejects empty questions array', () => {
        expect(() =>
            validateLLMOutput(validOutput({ questions: [] }))
        ).toThrow(/questions array must not be empty/);
    });

    test('rejects more than 50 questions', () => {
        const questions = Array.from({ length: 51 }, (_, i) => ({
            text: `Question ${i + 1}`,
            type: 'mcq-single',
            options: [{ text: 'A', isCorrect: true }],
        }));
        expect(() =>
            validateLLMOutput(validOutput({ questions }))
        ).toThrow(/questions array exceeds 50 items/);
    });

    test('accepts exactly 50 questions', () => {
        const questions = Array.from({ length: 50 }, (_, i) => ({
            text: `Question ${i + 1}`,
            type: 'mcq-single',
            options: [{ text: 'A', isCorrect: true }],
        }));
        expect(() =>
            validateLLMOutput(validOutput({ questions }))
        ).not.toThrow();
    });
});

// ── 4. question text validation ───────────────────────────────────────────

describe('question text', () => {
    test('rejects question text over 2000 characters', () => {
        const o = validOutput();
        o.questions[0].text = repeat('가', 2001);
        expect(() => validateLLMOutput(o)).toThrow(/text exceeds 2000 characters/);
    });

    test('accepts question text of exactly 2000 characters', () => {
        const o = validOutput();
        o.questions[0].text = repeat('A', 2000);
        expect(() => validateLLMOutput(o)).not.toThrow();
    });

    test('rejects HTML in question text', () => {
        const o = validOutput();
        o.questions[0].text = '<script>alert(1)</script>';
        expect(() => validateLLMOutput(o)).toThrow(/text contains HTML tags/);
    });

    test('rejects self-closing HTML in question text', () => {
        const o = validOutput();
        o.questions[0].text = 'Choose: <br/> option';
        expect(() => validateLLMOutput(o)).toThrow(/text contains HTML tags/);
    });

    test('rejects missing question text', () => {
        const o = validOutput();
        delete o.questions[0].text;
        expect(() => validateLLMOutput(o)).toThrow(/text must be a non-empty string/);
    });
});

// ── 5. question type validation ───────────────────────────────────────────

describe('question type', () => {
    test('rejects unknown question type "true-false"', () => {
        const o = validOutput();
        o.questions[0].type = 'true-false';
        expect(() => validateLLMOutput(o)).toThrow(/not a recognised question type/);
    });

    test('rejects unknown question type "essay"', () => {
        const o = validOutput();
        o.questions[0].type = 'essay';
        expect(() => validateLLMOutput(o)).toThrow(/not a recognised question type/);
    });

    test('defaults to mcq-single when type is missing', () => {
        const o = validOutput();
        delete o.questions[0].type;
        expect(() => validateLLMOutput(o)).not.toThrow();
        expect(o.questions[0].type).toBe('mcq-single');
    });

    test('defaults to mcq-single when type is null', () => {
        const o = validOutput();
        o.questions[0].type = null;
        expect(() => validateLLMOutput(o)).not.toThrow();
        expect(o.questions[0].type).toBe('mcq-single');
    });

    const validTypes = [
        'mcq-single',
        'mcq-multiple',
        'short-answer',
        'ordering',
        'fill-in-the-blank',
    ];

    validTypes.forEach((type) => {
        test(`accepts question type "${type}"`, () => {
            const o = validOutput();
            o.questions[0].type = type;
            expect(() => validateLLMOutput(o)).not.toThrow();
        });
    });
});

// ── 6. explanation validation ─────────────────────────────────────────────

describe('explanation', () => {
    test('rejects explanation over 5000 characters', () => {
        const o = validOutput();
        o.questions[0].explanation = repeat('X', 5001);
        expect(() => validateLLMOutput(o)).toThrow(/explanation exceeds 5000 characters/);
    });

    test('accepts explanation of exactly 5000 characters', () => {
        const o = validOutput();
        o.questions[0].explanation = repeat('X', 5000);
        expect(() => validateLLMOutput(o)).not.toThrow();
    });

    test('rejects HTML in explanation', () => {
        const o = validOutput();
        o.questions[0].explanation = 'See <a href="#">here</a>';
        expect(() => validateLLMOutput(o)).toThrow(/explanation contains HTML tags/);
    });
});

// ── 7. options validation ─────────────────────────────────────────────────

describe('options', () => {
    test('rejects option text over 500 characters', () => {
        const o = validOutput();
        o.questions[0].options[0].text = repeat('O', 501);
        expect(() => validateLLMOutput(o)).toThrow(/text exceeds 500 characters/);
    });

    test('accepts option text of exactly 500 characters', () => {
        const o = validOutput();
        o.questions[0].options[0].text = repeat('O', 500);
        expect(() => validateLLMOutput(o)).not.toThrow();
    });

    test('rejects non-boolean isCorrect — string "true"', () => {
        const o = validOutput();
        o.questions[0].options[0].isCorrect = 'true';
        expect(() => validateLLMOutput(o)).toThrow(/isCorrect must be a boolean/);
    });

    test('rejects non-boolean isCorrect — number 1', () => {
        const o = validOutput();
        o.questions[0].options[0].isCorrect = 1;
        expect(() => validateLLMOutput(o)).toThrow(/isCorrect must be a boolean/);
    });

    test('rejects non-boolean isCorrect — string "false"', () => {
        const o = validOutput();
        o.questions[0].options[1].isCorrect = 'false';
        expect(() => validateLLMOutput(o)).toThrow(/isCorrect must be a boolean/);
    });

    test('rejects HTML in option text', () => {
        const o = validOutput();
        o.questions[0].options[0].text = '<em>Option A</em>';
        expect(() => validateLLMOutput(o)).toThrow(/text contains HTML tags/);
    });

    test('rejects more than 10 options', () => {
        const o = validOutput();
        o.questions[0].options = Array.from({ length: 11 }, (_, i) => ({
            text: `Option ${i + 1}`,
            isCorrect: i === 0,
        }));
        expect(() => validateLLMOutput(o)).toThrow(/options exceeds 10 items/);
    });

    test('accepts exactly 10 options', () => {
        const o = validOutput();
        o.questions[0].options = Array.from({ length: 10 }, (_, i) => ({
            text: `Option ${i + 1}`,
            isCorrect: i === 0,
        }));
        expect(() => validateLLMOutput(o)).not.toThrow();
    });
});

// ── 8. top-level shape guards ─────────────────────────────────────────────

describe('top-level shape', () => {
    test('rejects null input', () => {
        expect(() => validateLLMOutput(null)).toThrow(/must be a JSON object/);
    });

    test('rejects array input', () => {
        expect(() => validateLLMOutput([])).toThrow(/must be a JSON object/);
    });

    test('rejects string input', () => {
        expect(() => validateLLMOutput('{"title":"x"}')).toThrow(/must be a JSON object/);
    });
});
