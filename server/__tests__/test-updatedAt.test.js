// Issue #492 — Test schema must enable mongoose timestamps (updatedAt
// only) so the admin Audit UI can show "last edited" independently
// of createdAt.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'models', 'Test.js'), 'utf8');

describe('Issue #492 — Test schema updatedAt timestamp', () => {
    it('declares timestamps option enabling updatedAt', () => {
        expect(src).toMatch(/timestamps:\s*\{\s*createdAt:\s*false,\s*updatedAt:\s*true\s*\}/);
    });

    it('still retains the manual createdAt default for back-compat', () => {
        expect(src).toMatch(/createdAt:\s*\{\s*type:\s*Date,\s*default:\s*Date\.now\s*\}/);
    });
});
