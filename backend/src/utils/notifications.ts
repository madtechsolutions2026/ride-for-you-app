import { prisma } from './prisma';

/**
 * Expo push notifications.
 *
 * The app registers an Expo push token after login (POST /user/push-token);
 * everything here fans that token out through Expo's public push API. No SDK,
 * no credentials — Expo authenticates by the token itself.
 *
 * Design rules, matching the notification matrix in the ops runbook:
 *   push  = the nudge ("rent due tomorrow")
 *   whatsapp = the receipt (see utils/whatsapp.ts)
 * Never send the same event on both unless the rider genuinely must act.
 *
 * Every function here is best-effort. A push that fails must never roll back
 * a payment or block a sweep, so nothing throws — failures are logged and
 * reported as `false`.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo tokens look like ExponentPushToken[xxxxxxxx] or ExpoPushToken[...]. */
function isExpoToken(t?: string | null): t is string {
  return !!t && /^Expo(nent)?PushToken\[.+\]$/.test(t);
}

export type PushMessage = {
  title: string;
  body: string;
  /** Deep-link payload the app reads from the notification response. */
  data?: Record<string, unknown>;
  /** Android channel — lets the rider mute marketing but keep payment alerts. */
  channelId?: 'payments' | 'rides' | 'account';
  badge?: number;
};

/** Send to one raw token. Returns false rather than throwing. */
export async function sendPush(token: string | null | undefined, msg: PushMessage): Promise<boolean> {
  if (!isExpoToken(token)) return false;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: msg.title,
        body: msg.body,
        data: msg.data ?? {},
        sound: 'default',
        priority: 'high',
        channelId: msg.channelId ?? 'rides',
        ...(msg.badge != null ? { badge: msg.badge } : {}),
      }),
    });

    const json: any = await res.json().catch(() => ({}));
    const ticket = json?.data;

    // Expo replies 200 with a per-message ticket; an error there is still a failure.
    if (!res.ok || ticket?.status === 'error') {
      const detail = ticket?.details?.error || ticket?.message || `${res.status}`;
      console.warn(`[PUSH] not delivered: ${detail}`);

      // The device uninstalled or reset — drop the token so we stop trying.
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        await prisma.user
          .updateMany({ where: { pushToken: token }, data: { pushToken: null } })
          .catch(() => {});
      }
      return false;
    }

    return true;
  } catch (e: any) {
    console.warn('[PUSH] request failed:', e?.message);
    return false;
  }
}

/** Look the rider's token up by id and send. The common case. */
export async function pushToUser(userId: string, msg: PushMessage): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });
    return await sendPush(user?.pushToken, msg);
  } catch (e: any) {
    console.warn('[PUSH] lookup failed:', e?.message);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Named events — one function per row of the notification matrix, so call     */
/* sites read as intent rather than as string assembly.                        */
/* -------------------------------------------------------------------------- */

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export const notify = {
  kycApproved: (userId: string) =>
    pushToUser(userId, {
      title: 'KYC approved',
      body: 'You can book a bike now. Pick a hub to get started.',
      channelId: 'account',
      data: { screen: 'Home' },
    }),

  kycRejected: (userId: string, reason?: string | null) =>
    pushToUser(userId, {
      title: 'KYC needs another look',
      body: reason ? `${reason} — re-submit from your profile.` : 'Please re-submit your documents.',
      channelId: 'account',
      data: { screen: 'Profile' },
    }),

  bookingConfirmed: (userId: string, reference: string, hubName: string) =>
    pushToUser(userId, {
      title: 'Booking confirmed',
      body: `${reference} — collect your bike at ${hubName}.`,
      channelId: 'rides',
      data: { screen: 'MyBookings' },
    }),

  bookingExpiring: (userId: string, bookingId: string, minutesLeft: number) =>
    pushToUser(userId, {
      title: 'Your booking is about to expire',
      body: `Pay within ${minutesLeft} minutes to keep your bike reserved.`,
      channelId: 'payments',
      data: { screen: 'BookingPayment', bookingId },
    }),

  bookingExpired: (userId: string) =>
    pushToUser(userId, {
      title: 'Booking expired',
      body: 'Your hold was released. Book again any time — bikes are still available.',
      channelId: 'rides',
      data: { screen: 'Home' },
    }),

  handedOver: (userId: string, plate: string, dueBack: string) =>
    pushToUser(userId, {
      title: 'Enjoy your ride',
      body: `${plate} is yours. Due back ${dueBack}.`,
      channelId: 'rides',
      data: { screen: 'MyRental' },
    }),

  rentDue: (userId: string, amount: number, weekNumber: number) =>
    pushToUser(userId, {
      title: 'Rent due tomorrow',
      body: `${rupee(amount)} for week ${weekNumber}. Tap to pay.`,
      channelId: 'payments',
      data: { screen: 'MyRental' },
    }),

  rentOverdue: (userId: string, amount: number, daysLate: number) =>
    pushToUser(userId, {
      title: 'Rent overdue',
      body: `${rupee(amount)} is ${daysLate} day${daysLate === 1 ? '' : 's'} late. Pay now to avoid a late fee.`,
      channelId: 'payments',
      data: { screen: 'MyRental' },
    }),

  paymentReceived: (userId: string, amount: number, covers: string) =>
    pushToUser(userId, {
      title: 'Payment received',
      body: `${rupee(amount)} — ${covers}.`,
      channelId: 'payments',
      data: { screen: 'MyRental' },
    }),

  depositRefunded: (userId: string, amount: number) =>
    pushToUser(userId, {
      title: 'Deposit refunded',
      body: `${rupee(amount)} is on its way back to you. Thanks for riding with us.`,
      channelId: 'payments',
      data: { screen: 'MyBookings' },
    }),

  damageCharged: (userId: string, amount: number) =>
    pushToUser(userId, {
      title: 'Damage charge raised',
      body: `${rupee(amount)} for damage found at return. Contact support if this looks wrong.`,
      channelId: 'payments',
      data: { screen: 'MyRental' },
    }),
};
