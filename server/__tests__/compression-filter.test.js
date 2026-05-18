// Issue #443 — global compression() must skip /api/auth/* responses
// (defense-in-depth against BREACH-style adaptive compression attacks
// on bodies that may reflect token-shaped material).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverIndex = readFileSync(resolve(__dirname, '..', 'index.js'), 'utf8');

describe('Issue #443 — compression filter skips /api/auth/*', () => {
    it('does not call compression() with no options anywhere', () => {
        expect(serverIndex).not.toMatch(/app\.use\(compression\(\)\)/);
    });

    it('declares an explicit filter that mentions /api/auth', () => {
        expect(serverIndex).toMatch(/compression\(\s*\{[\s\S]*filter\s*:/);
        expect(serverIndex).toMatch(/\/api\/auth/);
    });

    it('preserves the default compression.filter chain for non-auth paths', () => {
        expect(serverIndex).toMatch(/compression\.filter/);
    });
});
