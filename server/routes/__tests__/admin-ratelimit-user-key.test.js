// Issue #449 — admin apiLimiter must key by req.user._id with an
// ipKeyGenerator() fallback. Otherwise two admins on the same NAT IP
// share the 10/min bucket and an IPv6 attacker can prefix-rotate.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'admin.js'), 'utf8');

describe('Issue #449 — admin apiLimiter user-keyed with IPv6-safe fallback', () => {
    it('apiLimiter declares a keyGenerator', () => {
        const m = src.match(/const\s+apiLimiter\s*=\s*rateLimit\(\s*\{[\s\S]*?\}\s*\)/);
        expect(m).toBeTruthy();
        expect(m[0]).toMatch(/keyGenerator\s*:/);
    });

    it('keyGenerator falls back through ipKeyGenerator()', () => {
        expect(src).toMatch(/ipKeyGenerator\(req\.ip\)/);
    });

    it('imports ipKeyGenerator from express-rate-limit', () => {
        expect(src).toMatch(/require\(['"]express-rate-limit['"]\)/);
        expect(src).toMatch(/ipKeyGenerator/);
    });
});
