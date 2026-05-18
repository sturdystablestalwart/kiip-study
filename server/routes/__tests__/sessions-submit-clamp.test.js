// Issue #433 — POST /api/sessions/:id/submit must clamp client-supplied
// overdueTime into [0, 14400] like POST /api/tests/:id/attempt (#132).
// We cover the shared helper directly (red-to-green), and also assert
// the helper is imported by the session-submit route.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const requireCJS = createRequire(import.meta.url);
const { clampSecs, MAX_SECONDS } = requireCJS('../../utils/clampSecs.js');

describe('Issue #433 — clampSecs helper', () => {
    it('clamps absurdly large numbers down to MAX_SECONDS (4h)', () => {
        expect(clampSecs(9999999999)).toBe(MAX_SECONDS);
        expect(clampSecs(Number.MAX_SAFE_INTEGER)).toBe(MAX_SECONDS);
    });

    it('coerces negative values to 0', () => {
        expect(clampSecs(-1)).toBe(0);
        expect(clampSecs(-99999)).toBe(0);
    });

    it('coerces NaN / strings / null / undefined to 0', () => {
        expect(clampSecs('abc')).toBe(0);
        expect(clampSecs(NaN)).toBe(0);
        expect(clampSecs(null)).toBe(0);
        expect(clampSecs(undefined)).toBe(0);
    });

    it('passes through valid values inside the window', () => {
        expect(clampSecs(0)).toBe(0);
        expect(clampSecs(1)).toBe(1);
        expect(clampSecs(3600)).toBe(3600);
        expect(clampSecs(MAX_SECONDS)).toBe(MAX_SECONDS);
    });
});

describe('Issue #433 — sessions.js wiring', () => {
    it('imports clampSecs and uses it for overdueTime', () => {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const sessionsPath = resolve(__dirname, '..', 'sessions.js');
        const src = readFileSync(sessionsPath, 'utf8');

        expect(src).toMatch(/require\(['"]\.\.\/utils\/clampSecs['"]\)/);
        expect(src).toMatch(/overdueTime:\s*clampSecs\(req\.body\.overdueTime\)/);
        // Ensure the old unsafe pattern is gone.
        expect(src).not.toMatch(/overdueTime:\s*overdueTime\s*\|\|\s*0/);
    });
});
