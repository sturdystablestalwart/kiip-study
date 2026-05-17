/**
 * Regression for issue #46:
 * Bare `new Date(x).toLocaleDateString()` honours the BROWSER locale,
 * not the app's i18n language.  formatDate must accept a language tag
 * so every call site threads `i18n.resolvedLanguage` through.
 */
import { formatDate } from '../utils/dateFormat';

describe('formatDate (#46)', () => {
  const sample = new Date('2026-03-14T10:00:00Z');

  it('uses the supplied language tag, not the OS default', () => {
    const ru = formatDate(sample, 'ru');
    const ko = formatDate(sample, 'ko');
    expect(ru).not.toBe(ko);
    expect(ru).toBe(sample.toLocaleDateString('ru'));
    expect(ko).toBe(sample.toLocaleDateString('ko'));
  });

  it('matches the native API with full options', () => {
    const opts = { year: 'numeric', month: 'short', day: 'numeric' };
    expect(formatDate(sample, 'es', opts)).toBe(sample.toLocaleDateString('es', opts));
  });

  it('defaults to English when language is omitted or empty', () => {
    expect(formatDate(sample)).toBe(sample.toLocaleDateString('en'));
    expect(formatDate(sample, '')).toBe(sample.toLocaleDateString('en'));
    expect(formatDate(sample, null)).toBe(sample.toLocaleDateString('en'));
  });

  it('returns empty string for null/undefined/invalid input', () => {
    expect(formatDate(null, 'en')).toBe('');
    expect(formatDate(undefined, 'en')).toBe('');
    expect(formatDate('not-a-date', 'en')).toBe('');
  });

  it('accepts an ISO string as well as a Date', () => {
    expect(formatDate('2026-03-14T10:00:00Z', 'en')).toBe(formatDate(sample, 'en'));
  });
});
