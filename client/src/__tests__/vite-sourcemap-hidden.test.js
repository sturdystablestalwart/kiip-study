// Issue #478 — vite production build must emit hidden sourcemaps
// so ops can resolve minified client-error stacks without exposing
// the maps via the browser's auto-fetch sourceMappingURL footer.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cfg = readFileSync(resolve(__dirname, '..', '..', 'vite.config.js'), 'utf8');

describe('Issue #478 — vite sourcemap mode is hidden', () => {
    it('build.sourcemap is "hidden" (not false or true)', () => {
        expect(cfg).toMatch(/sourcemap:\s*['"]hidden['"]/);
    });

    it('does not still set sourcemap: false', () => {
        expect(cfg).not.toMatch(/sourcemap:\s*false\b/);
    });
});
