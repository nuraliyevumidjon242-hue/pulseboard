import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (input) => {
    counter += 1;
    const id = `toast-${counter}-${Date.now()}`;
    const duration = input.duration ?? (input.variant === 'error' ? 6_000 : 4_000);
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { ...input, id, duration }],
    }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, duration);
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

type ToastInput = { description?: string; duration?: number };

export const toast = {
  success(title: string, descriptionOrOptions?: string | ToastInput): string {
    const options =
      typeof descriptionOrOptions === 'string'
        ? { description: descriptionOrOptions }
        : descriptionOrOptions;
    return useToastStore.getState().push({ title, variant: 'success', ...options });
  },
  error(title: string, descriptionOrOptions?: string | ToastInput): string {
    const options =
      typeof descriptionOrOptions === 'string'
        ? { description: descriptionOrOptions }
        : descriptionOrOptions;
    return useToastStore.getState().push({ title, variant: 'error', ...options });
  },
  info(title: string, descriptionOrOptions?: string | ToastInput): string {
    const options =
      typeof descriptionOrOptions === 'string'
        ? { description: descriptionOrOptions }
        : descriptionOrOptions;
    return useToastStore.getState().push({ title, variant: 'info', ...options });
  },
  warning(title: string, descriptionOrOptions?: string | ToastInput): string {
    const options =
      typeof descriptionOrOptions === 'string'
        ? { description: descriptionOrOptions }
        : descriptionOrOptions;
    return useToastStore.getState().push({ title, variant: 'warning', ...options });
  },
};
