import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  Info,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { cn, relativeTime } from '../../lib/utils';
import { useNotifications, useUnreadCount } from '../../hooks/api';
import { toast } from '../../stores/toast-store';
import type { NotificationItem } from '../../types';
import { Button } from '../ui/button';
import { Dropdown } from '../ui/dropdown';

const icons = {
  low_stock: AlertTriangle,
  high_sales: ShoppingBag,
  system: Info,
  alert: Sparkles,
};

const tones = {
  low_stock: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  high_sales: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  system: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400',
  alert: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
};

export function NotificationsMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useNotifications(12);
  const { data: unread } = useUnreadCount();
  const items = data?.data ?? [];
  const unreadCount = unread?.count ?? 0;

  const markRead = useMutation({
    mutationFn: (ids: string[]) => api.patch('/notifications/read', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });

  const openNotification = (item: NotificationItem) => {
    if (!item.isRead) markRead.mutate([item.id]);
    if (item.actionUrl) navigate(item.actionUrl);
  };

  return (
    <Dropdown
      label="Notifications"
      align="right"
      panelClassName="w-[22rem] max-w-[calc(100vw-1.5rem)] p-0"
      trigger={
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800">
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </span>
      }
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
            <div>
              <p className="text-sm font-semibold text-ink-900 dark:text-white">Notifications</p>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </p>
            </div>
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                loading={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
                leftIcon={<CheckCheck className="h-3.5 w-3.5" />}
              >
                Mark all
              </Button>
            ) : null}
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <BellOff className="h-7 w-7 text-ink-300 dark:text-ink-600" />
                <p className="text-xs font-medium text-ink-500 dark:text-ink-400">
                  No notifications yet.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const Icon = icons[item.type] ?? Info;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      openNotification(item);
                      close();
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-ink-100 px-4 py-3 text-left transition hover:bg-ink-50 dark:border-ink-800/70 dark:hover:bg-ink-800/40',
                      !item.isRead && 'bg-brand-50/40 dark:bg-brand-500/[0.06]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                        tones[item.type] ?? tones.system,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                          {item.title}
                        </span>
                        {!item.isRead ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                        ) : null}
                      </span>
                      {item.message ? (
                        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
                          {item.message}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-[10px] font-medium text-ink-400">
                        {relativeTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              close();
              void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
              toast.info('Live notifications', 'New alerts appear here in realtime.');
            }}
            className="w-full px-4 py-2.5 text-center text-[11px] font-semibold text-brand-600 hover:bg-ink-50 dark:text-brand-400 dark:hover:bg-ink-800/50"
          >
            Realtime alerts enabled
          </button>
        </>
      )}
    </Dropdown>
  );
}
