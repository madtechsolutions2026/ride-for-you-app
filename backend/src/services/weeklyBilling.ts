import { prisma } from '../utils/prisma';
import { sendRentDueWhatsApp, sendRentOverdueWhatsApp } from '../utils/whatsapp';
import { notify } from '../utils/notifications';

/**
 * Weekly rental billing — the recurring cycle behind every active rental.
 *
 * Runs on an interval (wired in app.ts). Four jobs, in order:
 *   1. Promote PENDING invoices past their due date to OVERDUE.
 *   2. For every ACTIVE rental whose latest week is ending, raise next week's
 *      invoice so the rider always has a live due amount.
 *   3. Nudge riders whose rent falls due in the next ~24h.
 *   4. Chase riders whose rent is already late, on an escalation ladder.
 *
 * Reminder throttling uses the two fields already on WeeklyInvoice:
 *   reminderCount   how many notices have gone out for this week
 *   lastReminderAt  when the last one went, so a 6-hourly sweep can't spam
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/** Don't send twice inside this window, whatever the sweep cadence is. */
const REMINDER_COOLDOWN_MS = 20 * HOUR_MS;
/** Raise the next invoice once the current week is this close to ending. */
const RAISE_LEAD_MS = DAY_MS;
/** Warn about an upcoming due date once it's inside this window. */
const DUE_SOON_WINDOW_MS = 30 * HOUR_MS;
/** Stop chasing after this many notices — ops takes it from there. */
const MAX_OVERDUE_NOTICES = 4;

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

type SweepResult = { overdue: number; raised: number; dueNotices: number; lateNotices: number };

export async function runWeeklyBillingSweep(): Promise<SweepResult> {
  const now = new Date();
  const nowMs = now.getTime();

  /* -- 1. anything past its due date is overdue -------------------------- */
  const overdue = await prisma.weeklyInvoice.updateMany({
    where: { status: 'PENDING', dueAt: { lt: now } },
    data: { status: 'OVERDUE' },
  });

  /* -- 2. raise next week for every live rental -------------------------- */
  const activeRentals = await prisma.rental.findMany({
    where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
    include: {
      booking: { select: { rentAmount: true } },
      weeklyInvoices: { orderBy: { weekNumber: 'desc' }, take: 1 },
    },
  });

  let raised = 0;
  for (const rental of activeRentals) {
    const last = rental.weeklyInvoices[0];
    if (!last) continue;
    if (last.periodEnd.getTime() - nowMs > RAISE_LEAD_MS) continue;

    const periodStart = last.periodEnd;
    const periodEnd = new Date(periodStart.getTime() + WEEK_MS);

    try {
      await prisma.weeklyInvoice.create({
        data: {
          rentalId: rental.id,
          weekNumber: last.weekNumber + 1,
          periodStart,
          periodEnd,
          amount: rental.booking.rentAmount,
          dueAt: periodEnd,
        },
      });
      raised++;
    } catch (e: any) {
      // unique(rentalId, weekNumber) — already raised, ignore
      if (e.code !== 'P2002') console.error('[billing] raise failed:', e);
    }

    // Keep the rental's own status in step with its ledger.
    const stillOverdue = await prisma.weeklyInvoice.count({
      where: { rentalId: rental.id, status: 'OVERDUE' },
    });
    const target = stillOverdue > 0 ? 'OVERDUE' : 'ACTIVE';
    if (rental.status !== target && ['ACTIVE', 'OVERDUE'].includes(rental.status)) {
      await prisma.rental.update({ where: { id: rental.id }, data: { status: target } });
    }
  }

  /* -- 3 & 4. reminders -------------------------------------------------- */
  const { dueNotices, lateNotices } = await dispatchReminders(nowMs);

  return { overdue: overdue.count, raised, dueNotices, lateNotices };
}

/**
 * Send the two rider-facing notices. Everything here is best-effort: a failed
 * WhatsApp send must never roll back or block the ledger work above, so each
 * send is guarded and the counter only advances when the send succeeded.
 */
async function dispatchReminders(nowMs: number) {
  let dueNotices = 0;
  let lateNotices = 0;

  const candidates = await prisma.weeklyInvoice.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
      rental: { status: { in: ['ACTIVE', 'OVERDUE'] } },
    },
    include: {
      rental: { select: { user: { select: { phone: true, fullName: true } } } },
    },
  });

  for (const inv of candidates) {
    const phone = inv.rental?.user?.phone;
    if (!phone) continue;

    const name = inv.rental.user.fullName || 'Rider';
    const dueMs = inv.dueAt.getTime();
    const sinceLast = inv.lastReminderAt ? nowMs - inv.lastReminderAt.getTime() : Infinity;
    if (sinceLast < REMINDER_COOLDOWN_MS) continue;

    let sent = false;

    if (inv.status === 'PENDING') {
      // One heads-up only, and only once we're inside the window.
      const untilDue = dueMs - nowMs;
      if (inv.reminderCount === 0 && untilDue > 0 && untilDue <= DUE_SOON_WINDOW_MS) {
        sent = await safeSend(() =>
          sendRentDueWhatsApp(phone, name, inv.amount, inv.weekNumber, fmtDate(inv.dueAt))
        );
        if (sent) dueNotices++;
      }
    } else if (inv.status === 'OVERDUE' && inv.reminderCount < MAX_OVERDUE_NOTICES) {
      const daysLate = Math.max(1, Math.floor((nowMs - dueMs) / DAY_MS));
      sent = await safeSend(() => sendRentOverdueWhatsApp(phone, name, inv.amount, daysLate));
      if (sent) lateNotices++;
    }

    if (sent) {
      await prisma.weeklyInvoice.update({
        where: { id: inv.id },
        data: { reminderCount: { increment: 1 }, lastReminderAt: new Date() },
      });
    }
  }

  return { dueNotices, lateNotices };
}

async function safeSend(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn();
  } catch (e: any) {
    console.warn('[billing] reminder send failed:', e?.message);
    return false;
  }
}

/**
 * Two loops, because they run on completely different clocks.
 *
 *   billing   weekly cadence — 6h is plenty
 *   holds     a 30-minute booking hold needs minute-level policing, or a
 *             rider who abandons checkout parks a bike for hours
 */
export function startWeeklyBilling() {
  const SIX_HOURS = 6 * HOUR_MS;
  const TWO_MINUTES = 2 * 60 * 1000;

  const billingTick = () =>
    runWeeklyBillingSweep()
      .then((r) => {
        if (r.overdue || r.raised || r.dueNotices || r.lateNotices) {
          console.log(
            `[billing] ${r.overdue} -> OVERDUE · ${r.raised} raised · ` +
              `${r.dueNotices} due notice(s) · ${r.lateNotices} late notice(s)`
          );
        }
      })
      .catch((e) => console.error('[billing] sweep error:', e));

  const holdsTick = () =>
    runBookingExpirySweep()
      .then((h) => {
        if (h.expired || h.warned) {
          console.log(`[holds] ${h.expired} expired · ${h.warned} warned`);
        }
      })
      .catch((e) => console.error('[holds] sweep error:', e));

  billingTick();
  holdsTick();

  const billingTimer = setInterval(billingTick, SIX_HOURS);
  const holdsTimer = setInterval(holdsTick, TWO_MINUTES);
  return { billingTimer, holdsTimer };
}

/* -------------------------------------------------------------------------- */
/* Booking holds                                                               */
/*                                                                            */
/* A PENDING booking parks a real bike. If the rider never pays, that bike is  */
/* invisible to everyone else forever — so the hold has to expire and put the  */
/* unit back. Runs on the same interval as billing.                            */
/* -------------------------------------------------------------------------- */

/** Warn the rider once when this little of the hold is left. */
const EXPIRY_WARN_MS = 10 * 60 * 1000;

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
