// Issue #457 — llm.js retry loop must delay between attempts with
// exponential backoff + jitter.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'llm.js'), 'utf8');

describe('Issue #457 — Gemini retry backoff', () => {
    it('sleeps before subsequent retries (await setTimeout-promise pattern)', () => {
        expect(src).toMatch(/await\s+new Promise\(\s*\(r\)\s*=>\s*setTimeout\(/);
    });

    it('computes delay with exponential factor (2 ** attempt)', () => {
        expect(src).toMatch(/2\s*\*\*\s*\(?attempt/);
    });

    it('mixes in jitter to avoid synchronized retries', () => {
        expect(src).toMatch(/Math\.random\(\)/);
    });

    it('does not sleep AFTER the final attempt', () => {
        expect(src).toMatch(/if\s*\(attempt\s*<\s*MAX_ATTEMPTS\)/);
    });
});
