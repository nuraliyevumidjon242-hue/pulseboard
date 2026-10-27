import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import type { Language } from '../types';
import { de } from './translations/de';
import { uz } from './translations/uz';

/**
 * Lightweight, dependency-free i18n layer.
 *
 * English source strings are used as keys, so a missing translation always
 * falls back to readable copy instead of a raw key. Components call `t()` at
 * render time and the whole route tree is keyed by the active language, which
 * keeps re-renders predictable without threading a hook through every file.
 */
const DICTIONARIES: Record<Exclude<Language, 'en'>, Record<string, string>> = { de, uz };

export const LANGUAGES: Array<{ code: Language; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'uz', label: 'Uzbek', native: "O'zbekcha" },
];

let currentLanguage: Language = 'en';
const listeners = new Set<() => void>();

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'de' || value === 'uz';
}

export function setLanguage(language: Language | string | null | undefined): void {
  const next = isLanguage(language) ? language : 'en';
  if (next === currentLanguage) return;
  currentLanguage = next;
  for (const listener of listeners) listener();
}

/**
 * Alias used by the UI store. Keeping the store action name distinct from the
 * module function makes the intent obvious at the call site.
 */
export const applyLanguage = setLanguage;

export function getLanguage(): Language {
  return currentLanguage;
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en');
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

/** Returns the localized string for an English source key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  if (currentLanguage === 'en') return interpolate(key, vars);
  const dictionary = DICTIONARIES[currentLanguage];
  const translated = dictionary[key];
  return interpolate(translated ?? key, vars);
}

/**
 * Zod's built-in messages are English. Translating them centrally keeps every
 * form localized without repeating messages in dozens of schemas.
 */
z.config({
  customError: (issue) => {
    switch (issue.code) {
      case 'invalid_type':
        return {
          message:
            issue.input === undefined || issue.input === null
              ? t('This field is required.')
              : t('Enter a valid value.'),
        };
      case 'too_small': {
        const minimum = Number(issue.minimum);
        if (issue.origin === 'string') {
          return {
            message:
              minimum <= 1
                ? t('This field is required.')
                : t('Must be at least {{minimum}} characters.', { minimum }),
          };
        }
        if (issue.origin === 'array' || issue.origin === 'set') {
          return { message: t('Choose at least {{minimum}} items.', { minimum }) };
        }
        if (issue.origin === 'number' || issue.origin === 'int') {
          return { message: t('Must be at least {{minimum}}.', { minimum }) };
        }
        return undefined;
      }
      case 'too_big': {
        const maximum = Number(issue.maximum);
        if (issue.origin === 'string') {
          return { message: t('Must be at most {{maximum}} characters.', { maximum }) };
        }
        if (issue.origin === 'array' || issue.origin === 'set') {
          return { message: t('Choose at most {{maximum}} items.', { maximum }) };
        }
        if (issue.origin === 'number' || issue.origin === 'int') {
          return { message: t('Must be at most {{maximum}}.', { maximum }) };
        }
        return undefined;
      }
      case 'invalid_format':
        if (issue.format === 'email') return { message: t('Enter a valid email address') };
        if (issue.format === 'url' || issue.format === 'http_url') {
          return { message: t('Enter a valid URL') };
        }
        return undefined;
      case 'invalid_value':
        return { message: t('Choose a valid option.') };
      case 'not_multiple_of':
        return { message: t('Enter a valid number.') };
      case 'unrecognized_keys':
        return { message: t('Remove unknown fields.') };
      case 'invalid_union':
        return { message: t('Enter a valid value.') };
      default:
        return undefined;
    }
  },
});

/** Locale tag used by Intl formatters. */
export function intlLocale(language: Language = currentLanguage): string {
  if (language === 'de') return 'de-DE';
  if (language === 'uz') return 'uz-UZ';
  return 'en-US';
}

/** BCP-47 tag used on <html lang>. */
export function htmlLang(language: Language = currentLanguage): string {
  if (language === 'uz') return 'uz-Latn';
  return language;
}

/**
 * First-visit fallback: derive the interface language from the browser. Only
 * applies when nothing is persisted yet, so returning users keep their choice.
 */
export function detectLanguage(): void {
  if (currentLanguage !== 'en') return;
  if (typeof navigator === 'undefined') return;
  const tags = [...(navigator.languages ?? []), navigator.language];
  for (const tag of tags) {
    if (/^uz/i.test(tag)) {
      setLanguage('uz');
      return;
    }
    if (/^de/i.test(tag)) {
      setLanguage('de');
      return;
    }
  }
}
