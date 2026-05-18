// Issue #452 — Test.OptionSchema, Test.QuestionSchema, Test.BlankSchema,
// and Attempt.AnswerSchema must opt out of auto-generated _id since no
// caller uses these IDs and they waste ~12 bytes per subdoc.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readSrc(rel) {
    return readFileSync(resolve(__dirname, '..', rel), 'utf8');
}

const testSrc = readSrc('models/Test.js');
const attemptSrc = readSrc('models/Attempt.js');

describe('Issue #452 — subdoc schemas disable auto _id', () => {
    it('Test.OptionSchema declares _id: false', () => {
        expect(testSrc).toMatch(/OptionSchema[\s\S]*?\{\s*_id:\s*false\s*\}/);
    });

    it('Test.QuestionSchema declares _id: false', () => {
        expect(testSrc).toMatch(/QuestionSchema[\s\S]*?\{\s*_id:\s*false\s*\}/);
    });

    it('Attempt.AnswerSchema declares _id: false', () => {
        expect(attemptSrc).toMatch(/AnswerSchema[\s\S]*?\{\s*_id:\s*false\s*\}/);
    });
});
