// Issue #485 — JWT_SECRET length check must fire in every non-test
// environment, not only production.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'middleware', 'auth.js'), 'utf8');

describe('Issue #485 — JWT_SECRET length floor universal', () => {
    it('production still hard-throws on short secret', () => {
        expect(src).toMatch(/production[\s\S]{0,200}throw\s+new\s+Error\(['"]JWT_SECRET must be at least 32 characters/);
    });

    it('non-production environments emit a warn (was silently allowed)', () => {
        expect(src).toMatch(/logger\.warn\([\s\S]{0,300}JWT_SECRET is shorter/);
    });

    it("NODE_ENV=test is exempt so unit specs with short secrets don't spam warn", () => {
        expect(src).toMatch(/NODE_ENV\s*!==\s*['"]test['"]/);
    });

    it('does not still use the production-only guard pattern', () => {
        expect(src).not.toMatch(/NODE_ENV\s*===\s*['"]production['"]\s*&&\s*JWT_SECRET\.length\s*<\s*32/);
    });
});
