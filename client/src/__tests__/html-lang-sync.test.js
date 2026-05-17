/**
 * Regression test for issue #74:
 * `document.documentElement.lang` MUST follow the active i18n language so
 * screen readers, fonts, and hyphenation engines pick the right locale
 * (WCAG 3.1.1 / 3.1.2). The static `lang="en"` in index.html is never
 * updated when the user switches UI language.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import i18n from '../i18n/index.js';

describe('document.documentElement.lang sync with i18n (#74)', () => {
  beforeAll(async () => {
    // Make sure the i18n module's init promise resolves before assertions.
    if (i18n.isInitialized !== true) {
      await new Promise(resolve => i18n.on('initialized', resolve));
    }
  });

  it('mirrors the resolved language on init', () => {
    const lang = i18n.resolvedLanguage || i18n.language || 'en';
    expect(document.documentElement.lang).toBe(lang);
  });

  it('updates when changeLanguage is called', async () => {
    await i18n.changeLanguage('ko');
    expect(document.documentElement.lang).toBe('ko');

    await i18n.changeLanguage('ru');
    expect(document.documentElement.lang).toBe('ru');

    await i18n.changeLanguage('es');
    expect(document.documentElement.lang).toBe('es');

    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
