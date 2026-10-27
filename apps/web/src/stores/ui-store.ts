import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyLanguage, detectLanguage } from '../lib/i18n';
import type { Language, Theme } from '../types';

interface UiState {
  theme: Theme;
  language: Language;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  notificationsOpen: boolean;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'en',
      sidebarCollapsed: false,
      mobileNavOpen: false,
      notificationsOpen: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => {
        applyLanguage(language);
        set({ language });
      },
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
    }),
    {
      name: 'pulseboard.ui',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply the persisted language before the first render so reloads never
        // flash English copy for German or Uzbek users.
        const persisted =
          typeof window !== 'undefined' ? window.localStorage.getItem('pulseboard.ui') : null;
        if (state && persisted) applyLanguage(state.language);
        else detectLanguage();
      },
    },
  ),
);
