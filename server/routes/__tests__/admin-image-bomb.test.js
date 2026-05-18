// Issue #448 — admin sharp() pipeline must pass an explicit
// `limitInputPixels` so a decompression-bomb image can't cause OOM.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'admin.js'), 'utf8');

describe('Issue #448 — sharp() decompression-bomb guard', () => {
    it('does not call bare sharp(originalPath) without limit option', () => {
        expect(src).not.toMatch(/sharp\(originalPath\)\s*\.resize/);
    });

    it('does not call bare sharp(file.path) without limit option', () => {
        expect(src).not.toMatch(/sharp\(file\.path\)\s*\.resize/);
    });

    it('passes limitInputPixels at every sharp() call site', () => {
        const calls = src.match(/sharp\([^)]*\)/g) || [];
        expect(calls.length).toBeGreaterThan(0);
        for (const call of calls) {
            expect(call).toMatch(/limitInputPixels/);
        }
    });
});
