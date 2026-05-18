// Issue #458 — llm.js declares the Gemini model once at module load
// (parallel to closed #145 in classifier.js), not on every call.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'llm.js'), 'utf8');

describe('Issue #458 — shared Gemini model instance', () => {
    it('declares a module-level sharedModel via getGenerativeModel', () => {
        expect(src).toMatch(/const\s+sharedModel\s*=\s*genAI\.getGenerativeModel\(/);
    });

    it('parseTextWithLLM uses the shared instance, not a fresh getGenerativeModel call', () => {
        const fnStart = src.indexOf('parseTextWithLLM = async');
        expect(fnStart).toBeGreaterThan(0);
        const fnBody = src.slice(fnStart).split('module.exports')[0];
        expect(fnBody).not.toMatch(/genAI\.getGenerativeModel\(/);
    });
});
