// Issue #440 — approximateSendDelay is dead scaffolding from before
// padToConstantTime was the chosen approach. Verify it's gone.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const authPath = resolve(__dirname, '..', 'auth.js');
const src = readFileSync(authPath, 'utf8');

describe('Issue #440 — dead approximateSendDelay removed', () => {
    it('does not declare approximateSendDelay anywhere', () => {
        expect(src).not.toMatch(/approximateSendDelay/);
    });

    it('still declares padToConstantTime (active replacement)', () => {
        expect(src).toMatch(/async function padToConstantTime\(/);
    });

    it('still references the timing constants that padToConstantTime uses', () => {
        expect(src).toMatch(/MAGIC_LINK_PAD_MIN_MS/);
        expect(src).toMatch(/MAGIC_LINK_PAD_JITTER_MS/);
    });
});
