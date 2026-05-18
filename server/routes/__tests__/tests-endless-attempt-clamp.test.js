// Issue #434 — POST /api/tests/endless/attempt must:
//   (a) clamp client-supplied duration into [0, MAX_SECONDS]
//   (b) cap answers.length at 200 to prevent storage abuse
//   (c) gate per-user with an endlessAttemptLimiter
//
// Source-level assertions (route wiring) keep this test independent of
// the mongoose / supertest harness needed for full route exercise — the
// inline-call asserts catch the regressions the issue describes.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testsRoutePath = resolve(__dirname, '..', 'tests.js');
const src = readFileSync(testsRoutePath, 'utf8');

describe('Issue #434 — endless attempt clamp + cap + limiter wiring', () => {
    it('imports shared clampSecs and uses it for duration on endless attempt', () => {
        expect(src).toMatch(/require\(['"]\.\.\/utils\/clampSecs['"]\)/);
        // Old unsafe pattern should be gone for endless route's duration field.
        expect(src).not.toMatch(/duration:\s*duration\s*\|\|\s*0/);
    });

    it('caps answers.length at 200 on endless route', () => {
        // Either literal 200 or a named constant assigned to 200.
        const cap200 = /(answers\.length\s*>\s*(200|ENDLESS_MAX_ANSWERS|MAX_ANSWERS))/;
        const constDef = /ENDLESS_MAX_ANSWERS\s*=\s*200|MAX_ANSWERS\s*=\s*200/;
        expect(src).toMatch(cap200);
        expect(src).toMatch(constDef);
    });

    it('declares an endlessAttemptLimiter and mounts it on POST /endless/attempt', () => {
        expect(src).toMatch(/endlessAttemptLimiter/);
        expect(src).toMatch(/router\.post\(['"]\/endless\/attempt['"],\s*requireAuth,\s*endlessAttemptLimiter/);
    });

    it('endlessAttemptLimiter follows the no-op-in-test pattern (env=test bypass)', () => {
        expect(src).toMatch(/NODE_ENV\s*===\s*['"]test['"]|process\.env\.NODE_ENV/);
    });

    it('does not still keep the old inline clampSecs definition', () => {
        const inlineClampDefs = src.match(/const\s+clampSecs\s*=\s*\(v\)\s*=>/g) || [];
        expect(inlineClampDefs.length).toBe(0);
    });
});
