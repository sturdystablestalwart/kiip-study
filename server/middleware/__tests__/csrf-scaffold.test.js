// Issue #498 — CSRF middleware scaffold ready for enforcement.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-of-32-chars-or-more-please-thanks';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'csrf.js'), 'utf8');

describe('Issue #498 — CSRF middleware scaffold', () => {
    it('module exports the csrf-csrf piece names', () => {
        const csrf = requireCJS('../csrf.js');
        expect(typeof csrf.doubleCsrfProtection).toBe('function');
        expect(typeof csrf.generateCsrfToken || csrf.generateToken).toBe('function');
    });

    it('configures double-submit cookie + header path', () => {
        expect(src).toMatch(/cookieName:[\s\S]*?__Host-csrf/);
        expect(src).toMatch(/x-csrf-token/i);
    });

    it('uses csrf-csrf doubleCsrf', () => {
        expect(src).toMatch(/require\(['"]csrf-csrf['"]\)/);
        expect(src).toMatch(/doubleCsrf\(/);
    });

    it('falls back to JWT_SECRET when CSRF_SECRET is unset', () => {
        expect(src).toMatch(/loadSecret\(['"]CSRF_SECRET['"]\)/);
        expect(src).toMatch(/loadSecret\(['"]JWT_SECRET['"]\)/);
    });
});
