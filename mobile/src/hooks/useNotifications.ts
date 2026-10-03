import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { apiClient } from '../api/client';

/**
 * The rider's notification inbox.
 *
 * These used to be `SAMPLE_NOTIFICATIONS` — a hardcoded array in
 * NotificationSheet — and the bottom-bar badge was the literal string "2" on
 * both Home and Profile. Everything here is now the real inbox the backend
 * writes alongside every push.
 */

export type NotificationCategory =
  | 'BOOKING'
  | 'PAYMENT'
  | 'KYC'
  | 'RENTAL'
  | 'SUPPORT'
  | 'SWAP'
  | 'PROMO'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  screen?: string | null;
  params?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiClient.get('/user/notifications');
      setNotifications(res.data?.data?.notifications ?? []);
      setUnreadCount(res.data?.data?.unreadCount ?? 0);
      setError(null);
    } catch {
      // An inbox that cannot load is an empty inbox with a message — never a
      // crash, and never silently stale sample data.
      setError('Could not load your notifications. Pull to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic: the row greys out immediately, and a failed call simply
    // leaves the server copy unread to be picked up on the next refresh.
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      const res = await apiClient.post(`/user/notifications/${id}/read`);
      setUnreadCount(res.data?.data?.unreadCount ?? 0);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnreadCount(0);

    try {
      await apiClient.post('/user/notifications/read-all');
    } catch {
      void refresh();
    }
  }, [refresh]);

  return { notifications, unreadCount, loading, error, refresh, markRead, markAllRead };
}

/**
 * Just the badge number, refreshed whenever the screen regains focus.
 *
 * Deliberately its own hook: the bell appears on several screens and none of
 * them need the full list to draw it.
 */
export function useUnreadCount(): number {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      apiClient
        .get('/user/notifications/unread-count')
        .then((res) => {
          if (!cancelled) setCount(res.data?.data?.unreadCount ?? 0);
        })
        .catch(() => {
          // A badge is not worth an error state — show nothing.
          if (!cancelled) setCount(0);
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  return count;
}
