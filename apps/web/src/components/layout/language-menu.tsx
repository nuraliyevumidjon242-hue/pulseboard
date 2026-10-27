import { Globe2 } from 'lucide-react';
import { api } from '../../lib/api';
import { LANGUAGES, t } from '../../lib/i18n';
import { useAuthStore } from '../../stores/auth-store';
import { useUiStore } from '../../stores/ui-store';
import { Dropdown, DropdownItem, DropdownLabel } from '../ui/dropdown';

/**
 * Language switcher used in the topbar and on the auth pages, where visitors
 * may want to change the interface language before signing in.
 */
export function LanguageMenu({ className }: { className?: string }) {
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);
  const setPreferences = useAuthStore((state) => state.setPreferences);
  const preferences = useAuthStore((state) => state.preferences);

  const changeLanguage = async (next: typeof language) => {
    setLanguage(next);
    if (!preferences) return;
    try {
      const response = await api.put<{ data: { preferences: typeof preferences } }>(
        '/user/preferences',
        { language: next },
      );
      setPreferences(response.data.data.preferences);
    } catch {
      // The local language still applies; the preference retries on the next save.
    }
  };

  return (
    <Dropdown
      label={t('Change language')}
      panelClassName="w-44"
      className={className}
      trigger={
        <span className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800">
          <Globe2 className="h-4 w-4" />
          <span className="uppercase">{language}</span>
        </span>
      }
    >
      {(close) => (
        <>
          <DropdownLabel>{t('Language')}</DropdownLabel>
          {LANGUAGES.map((entry) => (
            <DropdownItem
              key={entry.code}
              active={language === entry.code}
              onClick={() => {
                close();
                void changeLanguage(entry.code);
              }}
            >
              <span className="flex items-center justify-between gap-2">
                <span>{entry.native}</span>
                {language === entry.code ? (
                  <span className="text-[10px] font-bold uppercase text-brand-600 dark:text-brand-400">
                    {entry.code}
                  </span>
                ) : null}
              </span>
            </DropdownItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}
