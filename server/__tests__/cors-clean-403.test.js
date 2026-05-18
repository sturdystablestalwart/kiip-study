// Issue #496 — CORS origin callback must use cb(null, false) for
// disallowed origins instead of cb(new Error(...)).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'index.js'), 'utf8');

describe('Issue #496 — CORS quiet-reject', () => {
    it('cors origin callback no longer cb(new Error(...))', () => {
        const corsBlock = src.match(/cors\(\{[\s\S]*?\}\)/);
        expect(corsBlock).toBeTruthy();
        expect(corsBlock[0]).not.toMatch(/cb\(\s*new\s+Error/);
    });

    it('uses cb(null, false) for disallowed origins', () => {
        const corsBlock = src.match(/cors\(\{[\s\S]*?\}\)/);
        expect(corsBlock[0]).toMatch(/cb\(\s*null\s*,\s*false\s*\)/);
    });
});
