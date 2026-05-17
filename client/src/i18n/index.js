import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en/common.json';
import ko from './locales/ko/common.json';
import ru from './locales/ru/common.json';
import es from './locales/es/common.json';

// Suppress i18next promo message in production
if (import.meta.env.PROD) {
  const origInfo = console.info;
  console.info = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('i18next is maintained')) return;
    origInfo.apply(console, args);
  };
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
      ru: { translation: ru },
      es: { translation: es },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    // Issue #34 — surface missing-key drift loudly in dev so a
    // KO/RU/ES user reading an English fallback isn't the first
    // signal we have.  CI gate is enforced by client/scripts/i18n-coverage.cjs.
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (lngs, _ns, key) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing key "${key}" for ${lngs.join(',')}`);
      }
    },
  });

// Keep <html lang> in sync with the active UI language (WCAG 3.1.1 / 3.1.2):
// static `lang="en"` in index.html misleads screen readers, fonts, and
// hyphenation engines once the user switches to KO/RU/ES.
function syncDocumentLang(lng) {
  if (typeof document === 'undefined') return;
  const next = (lng && lng.split('-')[0]) || i18n.resolvedLanguage || i18n.language || 'en';
  document.documentElement.lang = next;
}
i18n.on('languageChanged', syncDocumentLang);
i18n.on('initialized', () => syncDocumentLang());
if (i18n.isInitialized) syncDocumentLang();

export default i18n;
