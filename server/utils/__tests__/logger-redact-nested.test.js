// Issue #490 — logger.js redact paths must include wildcards.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'logger.js'), 'utf8');

describe('Issue #490 — pino redact wildcards', () => {
    const wildcardPaths = [
        '*.password',
        '*.*.password',
        '*.token',
        '*.*.token',
        '*.jwt',
        '*.*.jwt',
    ];

    for (const p of wildcardPaths) {
        it(`declares '${p}' in redact.paths`, () => {
            const re = new RegExp(`['"]${p.replace(/\./g, '\\.').replace(/\*/g, '\\*')}['"]`);
            expect(src).toMatch(re);
        });
    }

    it('still keeps the original root paths for back-compat', () => {
        expect(src).toMatch(/['"]req\.headers\.cookie['"]/);
        expect(src).toMatch(/['"]req\.headers\.authorization['"]/);
    });
});
