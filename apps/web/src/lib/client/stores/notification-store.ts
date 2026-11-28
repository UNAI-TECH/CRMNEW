'use client';

import { getScopedKey } from '@/lib/client/tenant-context';

export interface DealershipNotification {
  id: string;
  title: string;
  message: string;
  category: 'lead' | 'test_drive' | 'deal' | 'inventory' | 'customer' | 'leave_request' | 'leave_status';
  timestamp: string;
  createdAt?: string;
  isRead: boolean;
  linkHref?: string;
  priority?: 'normal' | 'high' | 'urgent';
  recipientRole?: 'admin' | 'employee' | 'all';
  recipientEmployeeId?: string | null;
  metadata?: Record<string, any>;
}

const BASE_NOTIFICATIONS_KEY = 'crm_dealership_notifications_v1';

function getNotificationsKey(): string {
  return getScopedKey(BASE_NOTIFICATIONS_KEY);
}

export function getNotifications(): DealershipNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const scopedRaw = localStorage.getItem(getNotificationsKey());
    if (scopedRaw) {
      const parsed = JSON.parse(scopedRaw);
      if (Array.isArray(parsed)) return parsed;
    }
    const legacyRaw = localStorage.getItem(BASE_NOTIFICATIONS_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveNotifications(items: DealershipNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(items);
    localStorage.setItem(getNotificationsKey(), serialized);
    localStorage.setItem(BASE_NOTIFICATIONS_KEY, serialized);
    window.dispatchEvent(new Event('crm-notifications-changed'));
  } catch (err) {
    console.warn('[NotificationStore] Failed to persist local notifications:', err);
  }
}

export function pushLocalNotification(item: DealershipNotification): DealershipNotification[] {
  const existing = getNotifications();
  const next = [item, ...existing.filter((n) => n.id !== item.id)].slice(0, 100);
  saveNotifications(next);
  return next;
}

export function updateLocalNotifications(
  updater: (prev: DealershipNotification[]) => DealershipNotification[]
): DealershipNotification[] {
  const next = updater(getNotifications());
  saveNotifications(next);
  return next;
}

export async function fetchNotifications(): Promise<DealershipNotification[] | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/notifications', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    if (Array.isArray(json.data)) {
      saveNotifications(json.data);
      return json.data;
    }
  } catch (err) {
    console.warn('[NotificationStore] Fetch error:', err);
  }
  return null;
}

export async function markNotificationReadRemote(id: string): Promise<DealershipNotification[] | null> {
  updateLocalNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isRead: true }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      if (Array.isArray(json.data)) {
        saveNotifications(json.data);
        return json.data;
      }
    }
  } catch {}
  return null;
}

export async function markAllNotificationsReadRemote(): Promise<DealershipNotification[] | null> {
  updateLocalNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      if (Array.isArray(json.data)) {
        saveNotifications(json.data);
        return json.data;
      }
    }
  } catch {}
  return null;
}

export async function deleteNotificationRemote(id: string): Promise<DealershipNotification[] | null> {
  updateLocalNotifications((prev) => prev.filter((n) => n.id !== id));
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      if (Array.isArray(json.data)) {
        saveNotifications(json.data);
        return json.data;
      }
    }
  } catch {}
  return null;
}

export async function clearAllNotificationsRemote(): Promise<DealershipNotification[] | null> {
  saveNotifications([]);
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/notifications?clearAll=true', {
      method: 'DELETE',
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      if (Array.isArray(json.data)) {
        saveNotifications(json.data);
        return json.data;
      }
    }
  } catch {}
  return null;
}

