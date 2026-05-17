/**
 * Format a date using the supplied BCP-47 language tag so the rendered
 * string matches the app's active UI language, not the browser's OS
 * locale (which is what bare `.toLocaleDateString()` falls back to).
 *
 * Callers usually pass `i18n.resolvedLanguage || i18n.language` from
 * `useTranslation()`.  Language defaults to 'en' if omitted.
 */
export function formatDate(input, language = 'en', options) {
  if (input == null) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(language || 'en', options);
}
