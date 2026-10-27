import { useEffect } from 'react';
import { queryClient } from '../lib/query-client';
import { disconnectSocket, getSocket } from '../lib/socket';
import { tokenStore } from '../lib/token';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../stores/auth-store';
import { toast } from '../stores/toast-store';
import { useStoreContext } from './use-store-context';

/**
 * Keeps the realtime socket in sync with the authenticated session and the
 * active store, and invalidates the right caches when events arrive.
 */
export function useSocketBridge(): void {
  const status = useAuthStore((state) => state.status);
  const storeId = useAuthStore((state) => state.activeStoreId);
  const { currency } = useStoreContext();

  useEffect(() => {
    if (status !== 'authenticated') {
      disconnectSocket();
      return;
    }

    const token = tokenStore.get();
    if (!token) return;

    const socket = getSocket(token);
    const joinStore = () => {
      if (storeId) socket.emit('join-store', storeId);
    };

    if (socket.connected) joinStore();
    socket.on('connect', joinStore);

    const unsubscribeToken = tokenStore.subscribe((nextToken) => {
      if (nextToken) socket.auth = { token: nextToken };
    });

    const onSaleCreated = (payload: {
      finalAmount: string;
      itemsCount: number;
      cashierName: string | null;
      paymentMethod: string;
    }) => {
      toast.success(
        'New sale recorded',
        `${formatCurrency(payload.finalAmount, currency)} · ${payload.itemsCount} item${
          payload.itemsCount === 1 ? '' : 's'
        }${payload.cashierName ? ` · ${payload.cashierName}` : ''}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    };

    const onInventoryUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const onNotification = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const onMilestone = (payload: { milestone: number; revenue: number }) => {
      toast.success(
        'Milestone reached 🎉',
        `${formatCurrency(payload.milestone, currency)} in sales — revenue is at ${formatCurrency(
          payload.revenue,
          currency,
        )}.`,
      );
    };

    socket.on('sale:created', onSaleCreated);
    socket.on('inventory:updated', onInventoryUpdated);
    socket.on('notification:new', onNotification);
    socket.on('milestone:reached', onMilestone);

    return () => {
      unsubscribeToken();
      socket.off('connect', joinStore);
      socket.off('sale:created', onSaleCreated);
      socket.off('inventory:updated', onInventoryUpdated);
      socket.off('notification:new', onNotification);
      socket.off('milestone:reached', onMilestone);
      if (storeId) socket.emit('leave-store', storeId);
    };
  }, [status, storeId, currency]);
}
