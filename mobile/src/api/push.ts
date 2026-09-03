/**
 * push.ts
 * -------
 * Expo push registration, kept behind a lazy require.
 *
 * expo-notifications is a NATIVE module. Importing it at module scope crashes
 * any standalone build compiled before the dependency existed — and an OTA
 * update can't add native code. So everything here loads it on demand and
 * degrades to a no-op rather than taking the app down.
 *
 * Call registerForPush() once after a successful login.
 */

import { Platform } from 'react-native';
import { apiClient } from './client';

type NotificationsModule = typeof import('expo-notifications');

function loadNotifications(): NotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications');
  } catch {
    return null;
  }
}

/** Android needs channels declared before anything routes to them. */
async function ensureAndroidChannels(N: NotificationsModule) {
  if (Platform.OS !== 'android') return;

  const channels: { id: string; name: string; description: string }[] = [
    { id: 'payments', name: 'Payments & rent', description: 'Rent due, overdue and receipts' },
    { id: 'rides', name: 'Your rides', description: 'Bookings, handover and returns' },
    { id: 'account', name: 'Account', description: 'KYC and account updates' },
  ];

  for (const c of channels) {
    await N.setNotificationChannelAsync(c.id, {
      name: c.name,
      description: c.description,
      importance: N.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 100, 200],
      lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
    });
  }
}

export type PushResult = 'registered' | 'denied' | 'unsupported' | 'failed';

/**
 * Ask for permission, get the Expo token, hand it to the backend.
 * Safe to call repeatedly — the token is stable per install.
 */
export async function registerForPush(): Promise<PushResult> {
  const N = loadNotifications();
  if (!N) return 'unsupported';

  try {
    let Device: typeof import('expo-device') | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Device = require('expo-device');
    } catch {
      /* optional — only used to skip simulators */
    }
    if (Device && !Device.isDevice) return 'unsupported';

    await ensureAndroidChannels(N);

    const existing = await N.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const asked = await N.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return 'denied';

    // projectId comes from app.json → extra.eas.projectId; required on SDK 49+.
    const projectId =
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      (require('expo-constants').default?.expoConfig?.extra?.eas?.projectId as string) || undefined;

    const { data: token } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token) return 'failed';

    await apiClient.post('/user/push-token', { token });
    return 'registered';
  } catch (e) {
    // Never let a notification problem break login.
    return 'failed';
  }
}

/** Tell the backend to stop pushing — used on logout. */
export async function unregisterPush(): Promise<void> {
  try {
    await apiClient.post('/user/push-token', { token: null });
  } catch {
    /* logging out anyway */
  }
}

/**
 * Foreground behaviour + tap handling. Returns a cleanup function.
 * `onOpen` receives the `data` payload the backend attached, e.g.
 * `{ screen: 'MyRental' }`, so the caller can navigate.
 */
export function attachPushHandlers(onOpen: (data: Record<string, any>) => void): () => void {
  const N = loadNotifications();
  if (!N) return () => {};

  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const sub = N.addNotificationResponseReceivedListener((response) => {
      const data = (response?.notification?.request?.content?.data ?? {}) as Record<string, any>;
      onOpen(data);
    });

    return () => sub.remove();
  } catch {
    return () => {};
  }
}
