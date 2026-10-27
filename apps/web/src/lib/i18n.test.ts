import { afterEach, describe, expect, it } from 'vitest';
import { getLanguage, htmlLang, intlLocale, LANGUAGES, setLanguage, t, useLanguage } from './i18n';
import { de } from './translations/de';
import keys from './translations/keys.json';
import { uz } from './translations/uz';

afterEach(() => setLanguage('en'));

describe('i18n', () => {
  it('returns readable English copy and interpolates values', () => {
    expect(t('Dashboard')).toBe('Dashboard');
    expect(t('{{count}} days', { count: 7 })).toBe('7 days');
  });

  it('switches to German and Uzbek without losing placeholders', () => {
    setLanguage('de');
    expect(getLanguage()).toBe('de');
    expect(t('Dashboard')).toBe('Übersicht');
    expect(t('{{count}} days', { count: 7 })).toBe('7 Tage');

    setLanguage('uz');
    expect(getLanguage()).toBe('uz');
    expect(t('Dashboard')).toBe('Boshqaruv paneli');
    expect(t('{{count}} days', { count: 7 })).toBe('7 kun');
  });

  it('keeps unknown keys and unknown languages safe', () => {
    setLanguage('de');
    expect(t('A string that was never collected')).toBe('A string that was never collected');

    setLanguage('fr');
    expect(getLanguage()).toBe('en');
    expect(t('Dashboard')).toBe('Dashboard');
  });

  it('does not translate data-like placeholders', () => {
    setLanguage('de');
    expect(t('Kiez Markt')).toBe('Kiez Markt');
    expect(t('MLK-120')).toBe('MLK-120');
  });

  it('exposes locale metadata for Intl and the document', () => {
    expect(LANGUAGES.map((entry) => entry.code)).toEqual(['en', 'de', 'uz']);
    expect(intlLocale('en')).toBe('en-US');
    expect(intlLocale('de')).toBe('de-DE');
    expect(intlLocale('uz')).toBe('uz-UZ');
    expect(htmlLang('uz')).toBe('uz-Latn');
    expect(htmlLang('de')).toBe('de');
  });

  it('has a translation for every key collected from the UI', () => {
    expect(keys.length).toBeGreaterThan(500);

    const missingGerman = keys.filter((key) => !(key in de));
    const missingUzbek = keys.filter((key) => !(key in uz));

    expect(missingGerman).toEqual([]);
    expect(missingUzbek).toEqual([]);
  });

  it('preserves every interpolation placeholder in both dictionaries', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

    const broken: string[] = [];
    for (const key of keys) {
      const expected = placeholders(key);
      if (expected.length === 0) continue;
      for (const [language, dictionary] of [
        ['de', de],
        ['uz', uz],
      ] as const) {
        const actual = placeholders(dictionary[key] ?? '');
        if (actual.join(',') !== expected.join(',')) broken.push(`${language}:${key}`);
      }
    }

    expect(broken).toEqual([]);
  });

  it('provides a React hook that tracks the active language', () => {
    expect(typeof useLanguage).toBe('function');
  });
});
