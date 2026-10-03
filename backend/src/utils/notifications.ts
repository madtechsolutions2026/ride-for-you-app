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
/* In-app inbox                                                                */
/*                                                                            */
/* Push is the nudge and it is lossy — the rider may have denied permission,   */
/* the device may be offline, the token may be stale. The inbox is the durable */
/* record, so every event writes a row here whether or not the push lands.     */
/* -------------------------------------------------------------------------- */

export type NotificationCategory =
  | 'BOOKING'
  | 'PAYMENT'
  | 'KYC'
  | 'RENTAL'
  | 'SUPPORT'
  | 'SWAP'
  | 'PROMO'
  | 'SYSTEM';

/** Append to the rider's inbox. Best-effort, like the push itself. */
export async function recordNotification(
  userId: string,
  category: NotificationCategory,
  msg: PushMessage,
): Promise<void> {
  try {
    const { screen, ...params } = (msg.data ?? {}) as Record<string, unknown>;
    await prisma.notification.create({
      data: {
        userId,
        category,
        title: msg.title,
        body: msg.body,
        screen: typeof screen === 'string' ? screen : null,
        params: Object.keys(params).length ? (params as any) : undefined,
      },
    });
  } catch (e: any) {
    console.warn('[INBOX] write failed:', e?.message);
  }
}

/**
 * Write the inbox row, then attempt the push. The inbox write is the part that
 * must not be lost, so it is not gated on delivery; the return value reports
 * only whether the push itself reached Expo.
 */
async function deliver(
  userId: string,
  category: NotificationCategory,
  msg: PushMessage,
): Promise<boolean> {
  await recordNotification(userId, category, msg);
  return pushToUser(userId, msg);
}

/* -------------------------------------------------------------------------- */
/* Named events — one function per row of the notification matrix, so call     */
/* sites read as intent rather than as string assembly.                        */
/* -------------------------------------------------------------------------- */

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export const notify = {
  kycApproved: (userId: string) =>
    deliver(userId, 'KYC', {
      title: 'KYC approved',
      body: 'You can book a bike now. Pick a hub to get started.',
      channelId: 'account',
      data: { screen: 'Home' },
    }),

  kycRejected: (userId: string, reason?: string | null) =>
    deliver(userId, 'KYC', {
      title: 'KYC needs another look',
      body: reason ? `${reason} — re-submit from your profile.` : 'Please re-submit your documents.',
      channelId: 'account',
      data: { screen: 'Profile' },
    }),

  bookingConfirmed: (userId: string, reference: string, hubName: string) =>
    deliver(userId, 'BOOKING', {
      title: 'Booking confirmed',
      body: `${reference} — collect your bike at ${hubName}.`,
      channelId: 'rides',
      data: { screen: 'MyBookings' },
    }),

  bookingExpiring: (userId: string, bookingId: string, minutesLeft: number) =>
    deliver(userId, 'BOOKING', {
      title: 'Your booking is about to expire',
      body: `Pay within ${minutesLeft} minutes to keep your bike reserved.`,
      channelId: 'payments',
      data: { screen: 'BookingPayment', bookingId },
    }),

  bookingExpired: (userId: string) =>
    deliver(userId, 'BOOKING', {
      title: 'Booking expired',
      body: 'Your hold was released. Book again any time — bikes are still available.',
      channelId: 'rides',
      data: { screen: 'Home' },
    }),

  handedOver: (userId: string, plate: string, dueBack: string) =>
    deliver(userId, 'RENTAL', {
      title: 'Enjoy your ride',
      body: `${plate} is yours. Due back ${dueBack}.`,
      channelId: 'rides',
      data: { screen: 'MyRental' },
    }),

  rentDue: (userId: string, amount: number, weekNumber: number) =>
    deliver(userId, 'PAYMENT', {
      title: 'Rent due tomorrow',
      body: `${rupee(amount)} for week ${weekNumber}. Tap to pay.`,
      channelId: 'payments',
      data: { screen: 'MyRental' },
    }),

  rentOverdue: (userId: string, amount: number, daysLate: number) =>
    deliver(userId, 'PAYMENT', {
      title: 'Rent overdue',
      body: `${rupee(amount)} is ${daysLate} day${daysLate === 1 ? '' : 's'} late. Pay now to avoid a late fee.`,
      channelId: 'payments',
      data: { screen: 'MyRental' },
    }),

  paymentReceived: (userId: string, amount: number, covers: string) =>
    deliver(userId, 'PAYMENT', {
      title: 'Payment received',
      body: `${rupee(amount)} — ${covers}.`,
      channelId: 'payments',
      data: { screen: 'MyRental' },
    }),

  depositRefunded: (userId: string, amount: number) =>
    deliver(userId, 'PAYMENT', {
      title: 'Deposit refunded',
      body: `${rupee(amount)} is on its way back to you. Thanks for riding with us.`,
      channelId: 'payments',
      data: { screen: 'MyBookings' },
    }),

  damageCharged: (userId: string, amount: number) =>
    deliver(userId, 'PAYMENT', {
      title: 'Damage charge raised',
      body: `${rupee(amount)} for damage found at return. Contact support if this looks wrong.`,
      channelId: 'payments',
      data: { screen: 'MyRental' },
    }),

  walletCredited: (userId: string, amount: number, reason: string) =>
    deliver(userId, 'PAYMENT', {
      title: 'Wallet credited',
      body: `${rupee(amount)} added to your wallet. It comes off your next rent automatically.`,
      channelId: 'payments',
      data: { screen: 'Wallet', reason },
    }),

  walletApplied: (userId: string, amount: number, weekNumber: number) =>
    deliver(userId, 'PAYMENT', {
      title: 'Wallet credit used',
      body: `${rupee(amount)} of your wallet credit went towards week ${weekNumber}.`,
      channelId: 'payments',
      data: { screen: 'Wallet' },
    }),

  supportReplied: (userId: string, ticketId: string, ticketNumber: string) =>
    deliver(userId, 'SUPPORT', {
      title: `Reply on ${ticketNumber}`,
      body: 'Our helpdesk has responded to your ticket. Tap to read it.',
      channelId: 'account',
      data: { screen: 'TicketDetail', ticketId },
    }),

  ticketResolved: (userId: string, ticketId: string, ticketNumber: string) =>
    deliver(userId, 'SUPPORT', {
      title: `${ticketNumber} resolved`,
      body: 'Your ticket is closed. Reopen it by replying if the issue is still there.',
      channelId: 'account',
      data: { screen: 'TicketDetail', ticketId },
    }),

  batterySwapped: (userId: string, percent: number, stationName: string) =>
    deliver(userId, 'SWAP', {
      title: 'Battery swapped',
      body: `Fresh battery at ${percent}% from ${stationName}. Ride safe.`,
      channelId: 'rides',
      data: { screen: 'BatterySwap' },
    }),

  /* ---- Collections ladder (services/collections.ts) ---- */

  /** Midnight: this week's rent is due, here is the QR. */
  rentDueWithQr: (
    userId: string,
    a: { invoiceId: string; amount: number; weekNumber: number; hasQr: boolean },
  ) =>
    deliver(userId, 'PAYMENT', {
      title: `Week ${a.weekNumber} rent — ${rupee(a.amount)}`,
      body: a.hasQr
        ? 'Scan the QR or tap to pay. Paid in 30 seconds from any UPI app.'
        : 'Tap to pay this week’s rent.',
      channelId: 'payments',
      data: { screen: 'MyRental', payInvoiceId: a.invoiceId },
    }),

  /** Every two hours while it stays unpaid. */
  rentChase: (
    userId: string,
    a: {
      invoiceId: string;
      amount: number;
      weekNumber: number;
      hoursLate: number;
      hoursLeft: number;
    },
  ) =>
    deliver(userId, 'PAYMENT', {
      title: `${rupee(a.amount)} still due`,
      body:
        a.hoursLeft > 24
          ? `Week ${a.weekNumber} rent is ${a.hoursLate}h late. Pay now to avoid collection.`
          : `Week ${a.weekNumber} rent is ${a.hoursLate}h late. ${a.hoursLeft}h left before your bike is collected.`,
      channelId: 'payments',
      data: { screen: 'MyRental', payInvoiceId: a.invoiceId },
    }),

  /** The one notice that names the consequence and the date. */
  rentFinalWarning: (
    userId: string,
    a: {
      invoiceId: string;
      amount: number;
      weekNumber: number;
      collectOn: string;
      plate: string;
    },
  ) =>
    deliver(userId, 'PAYMENT', {
      title: 'Final notice — bike collection tomorrow',
      body: `${a.plate} will be collected on ${a.collectOn} unless ${rupee(a.amount)} for week ${a.weekNumber} is paid. Pay now to keep riding.`,
      channelId: 'payments',
      data: { screen: 'MyRental', payInvoiceId: a.invoiceId },
    }),

  /** Grace has run out and the job is on the recovery desk. */
  bikeQueuedForRecovery: (
    userId: string,
    a: { amount: number; weekNumber: number; plate: string; reference: string },
  ) =>
    deliver(userId, 'RENTAL', {
      title: 'Bike scheduled for collection',
      body: `${a.plate} is scheduled for collection (${a.reference}) — week ${a.weekNumber} rent of ${rupee(a.amount)} is unpaid. Pay now or call support to stop it.`,
      channelId: 'payments',
      data: { screen: 'Support' },
    }),

  rentalRequestDecided: (
    userId: string,
    type: 'EXTENSION' | 'RETURN',
    approved: boolean,
    detail: string,
  ) =>
    deliver(userId, 'RENTAL', {
      title: approved
        ? type === 'EXTENSION'
          ? 'Extension approved'
          : 'Return slot confirmed'
        : type === 'EXTENSION'
          ? 'Extension declined'
          : 'Return slot declined',
      body: detail,
      channelId: 'rides',
      data: { screen: 'MyRental' },
    }),
};
