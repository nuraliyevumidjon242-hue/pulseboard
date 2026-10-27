import { create } from 'zustand';
import { api, refreshSession } from '../lib/api';
import { queryClient } from '../lib/query-client';
import { disconnectSocket } from '../lib/socket';
import { tokenStore } from '../lib/token';
import { useUiStore } from './ui-store';
import type { MeResponse, Preferences, StoreSummary, User } from '../types';

const ACTIVE_STORE_KEY = 'pulseboard.active-store';

type AuthStatus = 'booting' | 'authenticated' | 'guest';

interface AuthState {
  user: User | null;
  stores: StoreSummary[];
  preferences: Preferences | null;
  status: AuthStatus;
  activeStoreId: string | null;
  authenticate: (accessToken: string) => Promise<User>;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
  expire: () => void;
  setActiveStore: (storeId: string) => void;
  setUser: (user: User) => void;
  setPreferences: (preferences: Preferences) => void;
  setStores: (stores: StoreSummary[]) => void;
  refreshMe: () => Promise<void>;
}

function resolveActiveStoreId(stores: StoreSummary[], preferred: string | null): string | null {
  if (preferred && stores.some((store) => store.id === preferred)) return preferred;
  const stored =
    typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_STORE_KEY) : null;
  if (stored && stores.some((store) => store.id === stored)) return stored;
  return stores[0]?.id ?? null;
}

function persistActiveStore(storeId: string | null): void {
  if (typeof window === 'undefined') return;
  if (storeId) window.localStorage.setItem(ACTIVE_STORE_KEY, storeId);
  else window.localStorage.removeItem(ACTIVE_STORE_KEY);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  stores: [],
  preferences: null,
  status: 'booting',
  activeStoreId: null,

  authenticate: async (accessToken: string) => {
    tokenStore.set(accessToken);
    const response = await api.get<{ data: MeResponse }>('/auth/me');
    const { user, stores, preferences } = response.data.data;
    const activeStoreId = resolveActiveStoreId(stores, get().activeStoreId);
    persistActiveStore(activeStoreId);
    useUiStore.getState().setTheme(preferences.theme);
    set({
      user,
      stores,
      preferences,
      activeStoreId,
      status: 'authenticated',
    });
    return user;
  },

  bootstrap: async () => {
    try {
      const session = await refreshSession();
      if (!session) {
        set({ status: 'guest', user: null, stores: [], preferences: null });
        return;
      }
      await get().authenticate(session.accessToken);
    } catch {
      tokenStore.clear();
      set({ status: 'guest', user: null, stores: [], preferences: null });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // The refresh cookie may already be gone; local state must still clear.
    }
    tokenStore.clear();
    disconnectSocket();
    queryClient.clear();
    persistActiveStore(null);
    set({
      user: null,
      stores: [],
      preferences: null,
      status: 'guest',
      activeStoreId: null,
    });
  },

  expire: () => {
    tokenStore.clear();
    disconnectSocket();
    queryClient.clear();
    set({ user: null, stores: [], preferences: null, status: 'guest', activeStoreId: null });
  },

  setActiveStore: (storeId: string) => {
    persistActiveStore(storeId);
    set({ activeStoreId: storeId });
  },

  setUser: (user: User) => set({ user }),

  setPreferences: (preferences: Preferences) => set({ preferences }),

  setStores: (stores: StoreSummary[]) => {
    const activeStoreId = resolveActiveStoreId(stores, get().activeStoreId);
    persistActiveStore(activeStoreId);
    set({ stores, activeStoreId });
  },

  refreshMe: async () => {
    const response = await api.get<{ data: MeResponse }>('/auth/me');
    const { user, stores, preferences } = response.data.data;
    const activeStoreId = resolveActiveStoreId(stores, get().activeStoreId);
    persistActiveStore(activeStoreId);
    useUiStore.getState().setTheme(preferences.theme);
    set({ user, stores, preferences, activeStoreId, status: 'authenticated' });
  },
}));

export function useActiveStore(): StoreSummary | null {
  return useAuthStore((state) => {
    if (state.activeStoreId) {
      return (
        state.stores.find((store) => store.id === state.activeStoreId) ?? state.stores[0] ?? null
      );
    }
    return state.stores[0] ?? null;
  });
}
