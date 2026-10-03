import { prisma } from '../utils/prisma';
import { notify } from '../utils/notifications';
import { runCollectionsSweep, runNightlyBilling, midnightAfter } from './collections';

/**
 * The scheduler.
 *
 * Three clocks, because the three jobs have genuinely different cadences and
 * running them together would make each one wrong:
 *
 *   nightly billing   00:00 IST exactly. The rider is promised a bill at
 *                     midnight; "some time in the next six hours" is not that.
 *   collections       every 10 minutes. The ladder itself is timestamp-driven,
 *                     so this only needs to be finer than the 2-hour chase
 *                     interval — 10 minutes keeps each reminder within a few
 *                     minutes of its slot.
 *   booking holds     every 2 minutes. A 30-minute hold parks a real bike, so
 *                     it needs minute-level policing.
 *
 * The ladder itself lives in collections.ts.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export function startWeeklyBilling() {
  const COLLECTIONS_INTERVAL = 10 * MINUTE_MS;
  const HOLDS_INTERVAL = 2 * MINUTE_MS;

  const collectionsTick = () =>
    runCollectionsSweep()
      .then((r) => {
        if (r.chased || r.finalWarnings || r.recoveriesRaised) {
          console.log(
            `[collections] ${r.chased} chased · ${r.finalWarnings} final warning(s) · ` +
              `${r.recoveriesRaised} queued for recovery`,
          );
        }
      })
      .catch((e) => console.error('[collections] sweep error:', e));

  const holdsTick = () =>
    runBookingExpirySweep()
      .then((h) => {
        if (h.expired || h.warned) {
          console.log(`[holds] ${h.expired} expired · ${h.warned} warned`);
        }
      })
      .catch((e) => console.error('[holds] sweep error:', e));

  const billingTick = () =>
    runNightlyBilling()
      .then((r) => {
        if (r.raised || r.notified) {
          console.log(`[billing] ${r.raised} week(s) raised · ${r.notified} notice(s) sent`);
        }
      })
      .catch((e) => console.error('[billing] nightly error:', e));

  collectionsTick();
  holdsTick();
  // Catch up on boot: if the process was down at midnight, the bill still
  // goes out. `billedNoticeAt` makes the repeat harmless.
  billingTick();

  const collectionsTimer = setInterval(collectionsTick, COLLECTIONS_INTERVAL);
  const holdsTimer = setInterval(holdsTick, HOLDS_INTERVAL);
  const billingTimer = scheduleNightly(billingTick);

  return { collectionsTimer, holdsTimer, billingTimer };
}

/**
 * Run `job` at the next 00:00 IST, then every 24 hours.
 *
 * setInterval alone would drift off midnight over weeks and after any restart,
 * so the first fire is aimed at the real next midnight and the daily interval
 * is only set up once that lands.
 */
function scheduleNightly(job: () => void): { handle: NodeJS.Timeout } {
  const DAY_MS = 24 * HOUR_MS;
  const msUntilMidnight = midnightAfter(new Date()).getTime() - Date.now();

  const holder: { handle: NodeJS.Timeout } = {
    handle: setTimeout(() => {
      job();
      holder.handle = setInterval(job, DAY_MS);
    }, msUntilMidnight),
  };

  console.log(
    `[billing] next nightly run in ${Math.round(msUntilMidnight / MINUTE_MS)} minutes (00:00 IST)`,
  );
  return holder;
}

/* -------------------------------------------------------------------------- */
/* Booking holds                                                               */
/*                                                                            */
/* A PENDING booking parks a real bike. If the rider never pays, that bike is  */
/* invisible to everyone else forever — so the hold has to expire and put the  */
/* unit back.                                                                  */
/* -------------------------------------------------------------------------- */

/** Warn the rider once when this little of the hold is left. */
const EXPIRY_WARN_MS = 10 * MINUTE_MS;

export async function runBookingExpirySweep(): Promise<{ expired: number; warned: number }> {
  const now = new Date();

  const stale = await prisma.booking.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    select: { id: true, userId: true, reservedBikeId: true, reference: true },
  });

  let expired = 0;
  for (const b of stale) {
    try {
      await prisma.$transaction([
        prisma.booking.update({
          where: { id: b.id },
          data: {
            status: 'EXPIRED',
            cancelledAt: now,
            cancelReason: 'Hold expired — not paid in time',
            reservedBikeId: null,
          },
        }),
        // Only ever flip a bike we actually still hold.
        prisma.bike.updateMany({
          where: { id: b.reservedBikeId ?? '__none__', status: 'RESERVED' },
          data: { status: 'AVAILABLE' },
        }),
      ]);
      expired++;
      void notify.bookingExpired(b.userId);
    } catch (e: any) {
      console.error('[holds] expiry failed for', b.reference, e?.message);
    }
  }

  // One nudge each, shortly before the hold lapses.
  const expiringSoon = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { gt: now, lt: new Date(now.getTime() + EXPIRY_WARN_MS) },
    },
    select: { id: true, userId: true, expiresAt: true },
  });

  let warned = 0;
  for (const b of expiringSoon) {
    const minsLeft = Math.max(1, Math.round((b.expiresAt!.getTime() - now.getTime()) / 60000));
    if (await notify.bookingExpiring(b.userId, b.id, minsLeft)) warned++;
  }

  return { expired, warned };
}

/** Re-exported so callers keep one import for the billing subsystem. */
export { runCollectionsSweep, runNightlyBilling } from './collections';
