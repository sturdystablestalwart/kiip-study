// Issue #456 — parseTextWithLLM must bound each Gemini call with a
// timeout so a stuck remote can't hold the admin request open.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'llm.js'), 'utf8');

describe('Issue #456 — Gemini call timeout', () => {
    it('declares LLM_CALL_TIMEOUT_MS constant', () => {
        expect(src).toMatch(/const\s+LLM_CALL_TIMEOUT_MS\s*=\s*\d/);
    });

    it('races model.generateContent against a setTimeout', () => {
        expect(src).toMatch(/Promise\.race\(\s*\[[\s\S]*?model\.generateContent\(/);
        expect(src).toMatch(/setTimeout\(\s*\(\)\s*=>\s*reject/);
    });

    it('rejects timeout with LLM_TIMEOUT prefix so callers can log it', () => {
        expect(src).toMatch(/LLM_TIMEOUT/);
    });
});
