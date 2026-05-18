// Issue #461 — axios interceptor must surface a translated 'timed out'
// toast when error.code === 'ECONNABORTED'. Previously the network-error
// branch explicitly excluded ECONNABORTED, so timeouts were silent.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'api.js'), 'utf8');

describe('Issue #461 — api.js ECONNABORTED branch + i18n key', () => {
    it('interceptor checks error.code === ECONNABORTED and toasts requestTimeout', () => {
        expect(src).toMatch(/error\.code\s*===\s*['"]ECONNABORTED['"]/);
        expect(src).toMatch(/common\.requestTimeout/);
    });

    it('does not still suppress the network-error branch for ECONNABORTED', () => {
        expect(src).not.toMatch(/error\.code\s*!==\s*['"]ECONNABORTED['"]/);
    });
});

describe('Issue #461 — i18n key present in all 4 locales', () => {
    const root = resolve(__dirname, '..', '..', 'i18n', 'locales');
    for (const lng of ['en', 'ko', 'ru', 'es']) {
        it(`${lng}/common.json declares common.requestTimeout`, () => {
            const json = JSON.parse(readFileSync(resolve(root, lng, 'common.json'), 'utf8'));
            expect(json.common?.requestTimeout).toBeTruthy();
        });
    }
});
