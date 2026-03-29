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
  });

export default i18n;
