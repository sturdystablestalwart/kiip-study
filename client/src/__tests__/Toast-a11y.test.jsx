// Issue #483 — Toast aria-label must be i18n'd (was hardcoded
// "Dismiss") and error toasts must use role="alert"/aria-live=
// "assertive" so screen readers interrupt for high-urgency messages.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'components', 'Toast.jsx'), 'utf8');

describe('Issue #483 — Toast dismiss aria-label is i18n', () => {
    it('imports useTranslation', () => {
        expect(src).toMatch(/from\s+['"]react-i18next['"]/);
        expect(src).toMatch(/useTranslation\(/);
    });

    it('no longer hardcodes aria-label="Dismiss"', () => {
        expect(src).not.toMatch(/aria-label=\{?\s*['"]Dismiss['"]\s*\}?/);
    });

    it('uses t("common.dismissToast", ...) for the aria-label', () => {
        expect(src).toMatch(/t\(\s*['"]common\.dismissToast['"]/);
    });
});

describe('Issue #483 — error toasts use assertive aria-live', () => {
    it('renders an aria-live="assertive" container for error toasts', () => {
        expect(src).toMatch(/role="alert"\s+aria-live="assertive"/);
    });

    it('still renders an aria-live="polite" container for non-error toasts', () => {
        expect(src).toMatch(/role="status"\s+aria-live="polite"/);
    });
});

describe('Issue #483 — all 4 locales declare common.dismissToast', () => {
    const root = resolve(__dirname, '..', 'i18n', 'locales');
    for (const lng of ['en', 'ko', 'ru', 'es']) {
        it(`${lng}/common.json declares common.dismissToast`, () => {
            const json = JSON.parse(readFileSync(resolve(root, lng, 'common.json'), 'utf8'));
            expect(json.common?.dismissToast).toBeTruthy();
        });
    }
});
