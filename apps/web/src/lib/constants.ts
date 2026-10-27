/**
 * Shared option lists for forms that configure a store. Keeping them in one
 * place avoids drift between onboarding, store creation and settings.
 */
export const TIMEZONES = [
  'Europe/Berlin',
  'Europe/London',
  'Europe/Amsterdam',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Warsaw',
  'Europe/Istanbul',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Tashkent',
  'Asia/Almaty',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
] as const;

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'UZS', 'KZT', 'JPY', 'AED'] as const;

export const CURRENCY_LABELS: Record<string, string> = {
  EUR: 'Euro (EUR)',
  USD: 'US dollar (USD)',
  GBP: 'British pound (GBP)',
  CHF: 'Swiss franc (CHF)',
  UZS: 'Uzbek som (UZS)',
  KZT: 'Kazakh tenge (KZT)',
  JPY: 'Japanese yen (JPY)',
  AED: 'UAE dirham (AED)',
};

export const REFRESH_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 15, label: 'Every 15 seconds' },
  { value: 30, label: 'Every 30 seconds' },
  { value: 60, label: 'Every minute' },
  { value: 300, label: 'Every 5 minutes' },
] as const;
