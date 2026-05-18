// Issue #491 — geminiQuota must reap entries from prior days so the
// in-memory Map doesn't grow unbounded over multi-month uptime.
// The reaper already exists (#66 / pre-fix); this test makes the
// contract explicit so future refactors don't accidentally drop it.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'geminiQuota.js'), 'utf8');
const requireCJS = createRequire(import.meta.url);
const quota = requireCJS('../geminiQuota.js');

beforeEach(() => {
    quota._reset();
});

describe('Issue #491 — geminiQuota retention', () => {
    it('source declares a setInterval-based reaper that filters by day', () => {
        expect(src).toMatch(/setInterval\([\s\S]*?counts\.delete/);
    });

    it('unref()s the reaper so vitest can exit cleanly', () => {
        expect(src).toMatch(/reaper\.unref/);
    });

    it('skips reaper installation in NODE_ENV=test', () => {
        expect(src).toMatch(/NODE_ENV\s*!==\s*['"]test['"]/);
    });

    it('consume() charges 1 against the budget on success', () => {
        const userId = 'admin-1';
        const first = quota.consume(userId);
        expect(first.allowed).toBe(true);
        expect(quota._peek(userId)).toBe(1);
    });
});
