// Issue #460 — single-source scoring. Verify both thin shims re-export
// from shared/scoring.cjs, and that the shared module returns boolean
// for every question type.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..', '..');
const requireCJS = createRequire(import.meta.url);

const clientShim = readFileSync(resolve(repoRoot, 'client', 'src', 'utils', 'scoring.js'), 'utf8');
const serverShim = readFileSync(resolve(repoRoot, 'server', 'utils', 'scoring.js'), 'utf8');
const { scoreQuestion } = requireCJS(resolve(repoRoot, 'shared', 'scoring.cjs'));

describe('Issue #460 — shared scoring source of truth', () => {
    it('client shim re-exports from shared/scoring.cjs', () => {
        expect(clientShim).toMatch(/shared\/scoring\.cjs/);
        expect(clientShim).toMatch(/export\s+const\s+scoreQuestion/);
    });

    it('server shim re-exports from shared/scoring.cjs', () => {
        expect(serverShim).toMatch(/shared\/scoring\.cjs/);
        expect(serverShim).toMatch(/module\.exports\s*=\s*require/);
    });

    it('scoreQuestion: mcq-single returns true when selected option isCorrect', () => {
        const q = { type: 'mcq-single', options: [{ isCorrect: false }, { isCorrect: true }] };
        expect(scoreQuestion(q, { selectedOptions: [1] })).toBe(true);
        expect(scoreQuestion(q, { selectedOptions: [0] })).toBe(false);
    });

    it('scoreQuestion: mcq-multiple requires exact set match', () => {
        const q = { type: 'mcq-multiple', options: [{ isCorrect: true }, { isCorrect: true }, { isCorrect: false }] };
        expect(scoreQuestion(q, { selectedOptions: [0, 1] })).toBe(true);
        expect(scoreQuestion(q, { selectedOptions: [0] })).toBe(false);
        expect(scoreQuestion(q, { selectedOptions: [0, 1, 2] })).toBe(false);
    });

    it('scoreQuestion: short-answer trims + lowercases', () => {
        const q = { type: 'short-answer', acceptedAnswers: ['hello'] };
        expect(scoreQuestion(q, { textAnswer: ' Hello ' })).toBe(true);
        expect(scoreQuestion(q, { textAnswer: 'goodbye' })).toBe(false);
    });

    it('scoreQuestion: ordering requires exact index match', () => {
        const q = { type: 'ordering', correctOrder: [0, 1, 2] };
        expect(scoreQuestion(q, { orderedItems: [0, 1, 2] })).toBe(true);
        expect(scoreQuestion(q, { orderedItems: [0, 2, 1] })).toBe(false);
    });

    it('scoreQuestion: fill-in-the-blank checks each blank', () => {
        const q = { type: 'fill-in-the-blank', blanks: [
            { acceptedAnswers: ['a', 'A'] },
            { acceptedAnswers: ['b'] },
        ] };
        expect(scoreQuestion(q, { blankAnswers: ['A', 'b'] })).toBe(true);
        expect(scoreQuestion(q, { blankAnswers: ['x', 'b'] })).toBe(false);
    });

    it('scoreQuestion: unknown type returns false', () => {
        expect(scoreQuestion({ type: 'novel-type' }, {})).toBe(false);
    });
});
