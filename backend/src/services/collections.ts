import { prisma } from '../utils/prisma';
import { notify } from '../utils/notifications';
import { sendRentDueWhatsApp, sendRentOverdueWhatsApp } from '../utils/whatsapp';
import { buildRentPaymentHandles } from './upi';

/**
 * Collections — what happens between rent falling due and a bike coming back.
 *
 * The ladder, in absolute times so a missed tick never restarts it:
 *
 *   00:00 IST      invoice becomes due. One notice with the QR + payment link.
 *   +0 to +48h     chased every 2 hours while it stays unpaid.
 *   +24h           one final warning: the bike will be collected tomorrow.
 *   +48h           grace ends. A NON_PAYMENT recovery job is raised, the desk
 *                  sees it on the dashboard and assigns an agent.
 *   on recovery    the rider's profile carries the mark permanently.
 *
 * Paying at any point stops the ladder dead and cancels an unstarted recovery.
 *
 * Everything is driven off timestamps on WeeklyInvoice rather than a counter,
 * because the process restarts and the sweep can miss ticks. Asking "what
 * stage is this invoice in, given the clock" is always correct; "how many
 * reminders have I sent" is not.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** How long after the due date before the bike is recovered. */
export const GRACE_MS = 2 * DAY_MS;
/** Chase cadence inside the grace window. */
export const CHASE_INTERVAL_MS = 2 * HOUR_MS;
/** Final warning goes out this long before grace ends. */
export const FINAL_WARNING_LEAD_MS = DAY_MS;

/**
 * Slack on the cadence check.
 *
 * A sweep that fires at 09:59:58 must not skip a reminder due at 10:00:00 and
 * then wait a further two hours. Anything within a minute of due counts.
 */
const CADENCE_SLACK_MS = MINUTE_MS;

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/** Collections stage for one invoice, derived from the clock. */
export type DunningStage =
  | 'NOT_DUE'
  | 'DUE_TODAY'
  | 'CHASING'
  | 'FINAL_WARNING'
  | 'RECOVERY_DUE';

export function stageFor(invoice: { dueAt: Date; graceEndsAt: Date | null }, nowMs: number): DunningStage {
  const dueMs = invoice.dueAt.getTime();
  const graceMs = invoice.graceEndsAt?.getTime() ?? dueMs + GRACE_MS;

  if (nowMs < dueMs) return 'NOT_DUE';
  if (nowMs >= graceMs) return 'RECOVERY_DUE';
  if (nowMs >= graceMs - FINAL_WARNING_LEAD_MS) return 'FINAL_WARNING';
  if (nowMs >= dueMs) return nowMs < dueMs + CHASE_INTERVAL_MS ? 'DUE_TODAY' : 'CHASING';
  return 'NOT_DUE';
}

export interface CollectionsResult {
  billed: number;
  chased: number;
  finalWarnings: number;
  recoveriesRaised: number;
}

/**
 * One pass of the collections ladder over every unpaid week.
 *
 * Safe to run as often as you like — every action is guarded by a timestamp,
 * so a 5-minute sweep and an hourly sweep produce identical rider experience.
 */
export async function runCollectionsSweep(now = new Date()): Promise<CollectionsResult> {
  const nowMs = now.getTime();
  const result: CollectionsResult = {
    billed: 0,
    chased: 0,
    finalWarnings: 0,
    recoveriesRaised: 0,
  };

  const invoices = await prisma.weeklyInvoice.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
      rental: { status: { in: ['ACTIVE', 'OVERDUE'] } },
    },
    include: {
      recoveryJobs: { select: { id: true, status: true } },
      rental: {
        select: {
          id: true,
          userId: true,
          bikeId: true,
          hubId: true,
          status: true,
          bike: { select: { registrationNumber: true } },
          hub: { select: { name: true } },
          user: { select: { id: true, phone: true, fullName: true } },
        },
      },
    },
  });

  for (const inv of invoices) {
    try {
      const stage = stageFor(inv, nowMs);

      // Backfill the grace deadline on invoices raised before this shipped.
      if (!inv.graceEndsAt) {
        const graceEndsAt = new Date(inv.dueAt.getTime() + GRACE_MS);
        await prisma.weeklyInvoice.update({ where: { id: inv.id }, data: { graceEndsAt } });
        inv.graceEndsAt = graceEndsAt;
      }

      if (stage === 'NOT_DUE') continue;

      // Anything past its due date is OVERDUE, whatever else happens below.
      if (inv.status === 'PENDING') {
        await prisma.weeklyInvoice.update({
          where: { id: inv.id },
          data: { status: 'OVERDUE' },
        });
        inv.status = 'OVERDUE';
      }

      if (stage === 'RECOVERY_DUE') {
        if (await raiseRecovery(inv, now)) result.recoveriesRaised += 1;
        continue;
      }

      if (stage === 'FINAL_WARNING' && !inv.finalWarningAt) {
        await sendFinalWarning(inv, now);
        result.finalWarnings += 1;
        continue;
      }

      // Chase on the 2-hour cadence.
      const sinceLast = inv.lastReminderAt ? nowMs - inv.lastReminderAt.getTime() : Infinity;
      if (sinceLast + CADENCE_SLACK_MS >= CHASE_INTERVAL_MS) {
        await chase(inv, now);
        result.chased += 1;
      }
    } catch (e: any) {
      // One bad invoice must never stop the sweep for everyone else.
      console.error(`[collections] invoice ${inv.id} failed:`, e?.message);
    }
  }

  // Keep every rental's status in step with its ledger in one query pair
  // rather than per-invoice inside the loop.
  await reconcileRentalStatuses();

  return result;
}

/* -------------------------------------------------------------------------- */
/* The rungs                                                                   */
/* -------------------------------------------------------------------------- */

type LoadedInvoice = Awaited<ReturnType<typeof loadInvoices>>[number];
async function loadInvoices() {
  return prisma.weeklyInvoice.findMany({
    include: {
      recoveryJobs: { select: { id: true, status: true } },
      rental: {
        select: {
          id: true,
          userId: true,
          bikeId: true,
          hubId: true,
          status: true,
          bike: { select: { registrationNumber: true } },
          hub: { select: { name: true } },
          user: { select: { id: true, phone: true, fullName: true } },
        },
      },
    },
  });
}

/** The 2-hourly nudge, with the payment handles attached. */
async function chase(inv: LoadedInvoice, now: Date) {
  const hoursLate = Math.max(0, Math.floor((now.getTime() - inv.dueAt.getTime()) / HOUR_MS));
  const hoursLeft = Math.max(
    0,
    Math.ceil(((inv.graceEndsAt?.getTime() ?? 0) - now.getTime()) / HOUR_MS),
  );

  void notify.rentChase(inv.rental.userId, {
    invoiceId: inv.id,
    amount: inv.amount,
    weekNumber: inv.weekNumber,
    hoursLate,
    hoursLeft,
  });

  const phone = inv.rental.user?.phone;
  if (phone && hoursLate >= 12) {
    // WhatsApp is the receipt channel, not the nudge channel — only reach for
    // it once this is genuinely late, so a rider paying by lunchtime is
    // chased in-app and nowhere else.
    await safe(() =>
      sendRentOverdueWhatsApp(
        phone,
        inv.rental.user?.fullName || 'Rider',
        inv.amount,
        Math.max(1, Math.floor(hoursLate / 24)),
      ),
    );
  }

  await prisma.weeklyInvoice.update({
    where: { id: inv.id },
    data: { reminderCount: { increment: 1 }, lastReminderAt: now },
  });
}

/** The one notice that says the bike will be collected. */
async function sendFinalWarning(inv: LoadedInvoice, now: Date) {
  const collectOn = inv.graceEndsAt ?? new Date(inv.dueAt.getTime() + GRACE_MS);

  void notify.rentFinalWarning(inv.rental.userId, {
    invoiceId: inv.id,
    amount: inv.amount,
    weekNumber: inv.weekNumber,
    collectOn: fmtDate(collectOn),
    plate: inv.rental.bike?.registrationNumber ?? 'your bike',
  });

  const phone = inv.rental.user?.phone;
  if (phone) {
    await safe(() =>
      sendRentOverdueWhatsApp(
        phone,
        inv.rental.user?.fullName || 'Rider',
        inv.amount,
        Math.max(1, Math.floor((now.getTime() - inv.dueAt.getTime()) / DAY_MS)),
      ),
    );
  }

  await prisma.weeklyInvoice.update({
    where: { id: inv.id },
    data: { finalWarningAt: now, reminderCount: { increment: 1 }, lastReminderAt: now },
  });
}

/**
 * Grace has run out. Queue the bike for recovery.
 *
 * Returns false when a job already exists — the guard that stops a sweep
 * running every few minutes from raising a job per tick.
 */
async function raiseRecovery(inv: LoadedInvoice, now: Date): Promise<boolean> {
  const live = inv.recoveryJobs.find((j) => j.status !== 'CLOSED' && j.status !== 'RESOLVED');
  if (live) return false;

  const plate = inv.rental.bike?.registrationNumber ?? 'unknown';
  const rider = inv.rental.user?.fullName || 'Rider';
  const daysLate = Math.max(2, Math.floor((now.getTime() - inv.dueAt.getTime()) / DAY_MS));

  const job = await prisma.recoveryJob.create({
    data: {
      reference: `REC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      type: 'NON_PAYMENT',
      status: 'OPEN',
      // Money recovery is not an emergency, but it does age badly.
      priority: 'HIGH',
      rentalId: inv.rentalId,
      bikeId: inv.rental.bikeId,
      weeklyInvoiceId: inv.id,
      reportedByPhone: inv.rental.user?.phone ?? null,
      locationText: inv.rental.hub?.name ?? null,
      description:
        `Week ${inv.weekNumber} rent of ₹${inv.amount} unpaid ${daysLate} days past due. ` +
        `Rider ${rider} was warned before the grace period ended. Collect ${plate}.`,
    },
  });

  void notify.bikeQueuedForRecovery(inv.rental.userId, {
    amount: inv.amount,
    weekNumber: inv.weekNumber,
    plate,
    reference: job.reference,
  });

  console.log(
    `[collections] ${job.reference}: ${plate} queued for recovery — week ${inv.weekNumber} unpaid`,
  );
  return true;
}

/** ACTIVE <-> OVERDUE, driven entirely by whether anything is actually late. */
async function reconcileRentalStatuses() {
  const now = new Date();

  const lateRentalIds = await prisma.weeklyInvoice.findMany({
    where: {
      OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueAt: { lt: now } }],
      rental: { status: { in: ['ACTIVE', 'OVERDUE'] } },
    },
    select: { rentalId: true },
    distinct: ['rentalId'],
  });

  const lateIds = lateRentalIds.map((r) => r.rentalId);

  await prisma.rental.updateMany({
    where: { id: { in: lateIds }, status: 'ACTIVE' },
    data: { status: 'OVERDUE' },
  });

  await prisma.rental.updateMany({
    where: { id: { notIn: lateIds }, status: 'OVERDUE' },
    data: { status: 'ACTIVE' },
  });
}

async function safe(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn();
  } catch (e: any) {
    console.warn('[collections] send failed:', e?.message);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* The midnight bill                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Raise next week's invoice and send the rider their QR.
 *
 * Runs at 00:00 IST. Separate from the chase sweep because it is the one
 * thing that must happen on a schedule the rider can predict — the same
 * notification at the same time every week — rather than whenever a sweep
 * happens to notice something.
 *
 * `billedNoticeAt` makes it idempotent: two runs in one night raise nothing
 * twice and send nothing twice.
 */
export async function runNightlyBilling(now = new Date()): Promise<{ raised: number; notified: number }> {
  const nowMs = now.getTime();
  let raised = 0;
  let notified = 0;

  const rentals = await prisma.rental.findMany({
    where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
    include: {
      booking: { select: { rentAmount: true } },
      weeklyInvoices: { orderBy: { weekNumber: 'desc' }, take: 1 },
    },
  });

  for (const rental of rentals) {
    const last = rental.weeklyInvoices[0];
    if (!last) continue;

    // Raise the next week once the current one has ended (or ends today).
    const endsWithinToday = last.periodEnd.getTime() - nowMs <= DAY_MS;
    if (!endsWithinToday) continue;

    const periodStart = last.periodEnd;
    const periodEnd = new Date(periodStart.getTime() + 7 * DAY_MS);
    const dueAt = midnightAfter(periodEnd);

    try {
      await prisma.weeklyInvoice.create({
        data: {
          rentalId: rental.id,
          weekNumber: last.weekNumber + 1,
          periodStart,
          periodEnd,
          amount: rental.booking.rentAmount,
          dueAt,
          graceEndsAt: new Date(dueAt.getTime() + GRACE_MS),
        },
      });
      raised += 1;
    } catch (e: any) {
      // unique(rentalId, weekNumber): already raised tonight. Not an error.
      if (e.code !== 'P2002') console.error('[billing] raise failed:', e?.message);
    }
  }

  notified = await sendMidnightNotices(now);
  return { raised, notified };
}

/**
 * The midnight notice: every invoice falling due today, with its QR.
 *
 * Sent for invoices whose due date is today rather than at raise time,
 * because week 1 is created at handover — a rider who collected a bike on
 * Tuesday afternoon should still be billed at midnight like everyone else.
 */
async function sendMidnightNotices(now: Date): Promise<number> {
  const todayEnd = midnightAfter(now);
  const todayStart = new Date(todayEnd.getTime() - DAY_MS);

  const dueToday = await prisma.weeklyInvoice.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
      billedNoticeAt: null,
      dueAt: { gte: todayStart, lt: todayEnd },
      rental: { status: { in: ['ACTIVE', 'OVERDUE'] } },
    },
    include: {
      rental: { select: { userId: true, user: { select: { phone: true, fullName: true } } } },
    },
  });

  let sent = 0;
  for (const inv of dueToday) {
    try {
      const handles = await buildRentPaymentHandles({
        invoiceId: inv.id,
        amount: inv.amount,
        weekNumber: inv.weekNumber,
      });

      await prisma.weeklyInvoice.update({
        where: { id: inv.id },
        data: {
          billedNoticeAt: now,
          upiUri: handles.upiUri || null,
          paymentLinkUrl: handles.appLink,
          graceEndsAt: inv.graceEndsAt ?? new Date(inv.dueAt.getTime() + GRACE_MS),
        },
      });

      void notify.rentDueWithQr(inv.rental.userId, {
        invoiceId: inv.id,
        amount: inv.amount,
        weekNumber: inv.weekNumber,
        hasQr: Boolean(handles.qrDataUri),
      });

      const phone = inv.rental.user?.phone;
      if (phone) {
        await safe(() =>
          sendRentDueWhatsApp(
            phone,
            inv.rental.user?.fullName || 'Rider',
            inv.amount,
            inv.weekNumber,
            fmtDate(inv.dueAt),
          ),
        );
      }

      sent += 1;
    } catch (e: any) {
      console.error(`[billing] notice for ${inv.id} failed:`, e?.message);
    }
  }

  return sent;
}

/**
 * The next 00:00 Asia/Kolkata strictly after `d`, as a UTC instant.
 *
 * India is UTC+5:30 with no DST, so the offset is a constant — no timezone
 * library needed, and no risk of a DST jump moving billing by an hour.
 */
export function midnightAfter(d: Date): Date {
  const IST_OFFSET_MS = 5.5 * HOUR_MS;
  const istNow = d.getTime() + IST_OFFSET_MS;
  const istMidnight = Math.floor(istNow / DAY_MS) * DAY_MS + DAY_MS;
  return new Date(istMidnight - IST_OFFSET_MS);
}

/* -------------------------------------------------------------------------- */
/* Paying stops everything                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Called the moment an invoice is settled, by any path — in-app payment,
 * gateway webhook, or staff marking it paid.
 *
 * Clears the ladder and stands down a recovery that has not yet been
 * dispatched. A job already DISPATCHED or IN_PROGRESS is left alone: an agent
 * may be standing at the rider's door, and silently cancelling under them is
 * worse than one wasted trip. The desk is told to stand down instead.
 */
export async function settleDunning(invoiceId: string): Promise<{ recoveryCancelled: boolean }> {
  const invoice = await prisma.weeklyInvoice.findUnique({
    where: { id: invoiceId },
    include: { recoveryJobs: true, rental: { select: { id: true, userId: true } } },
  });
  if (!invoice) return { recoveryCancelled: false };

  await prisma.weeklyInvoice.update({
    where: { id: invoiceId },
    data: { finalWarningAt: null, lastReminderAt: null },
  });

  let recoveryCancelled = false;
  for (const job of invoice.recoveryJobs) {
    if (job.status === 'OPEN') {
      await prisma.recoveryJob.update({
        where: { id: job.id },
        data: {
          status: 'CLOSED',
          resolvedAt: new Date(),
          resolutionNote: 'Stood down automatically — rent was paid before dispatch.',
        },
      });
      recoveryCancelled = true;
    } else if (job.status === 'DISPATCHED' || job.status === 'IN_PROGRESS') {
      await prisma.recoveryJob.update({
        where: { id: job.id },
        data: {
          description:
            `${job.description}\n\n[PAID] Rent settled after dispatch — confirm with the agent ` +
            `before collecting the bike.`,
        },
      });
    }
  }

  await reconcileRentalStatuses();
  return { recoveryCancelled };
}

/**
 * Called when a recovery job is resolved — the bike is physically back.
 *
 * Writes the mark onto the rider's profile. This is the thing staff want at
 * the next booking, and re-deriving it from RecoveryJob at every lookup would
 * be both slower and easy to forget.
 */
export async function markRiderRecovered(jobId: string): Promise<void> {
  const job = await prisma.recoveryJob.findUnique({
    where: { id: jobId },
    include: {
      rental: { select: { userId: true } },
      weeklyInvoice: { select: { amount: true, status: true } },
    },
  });

  if (!job?.rental?.userId) return;
  // Only a money recovery marks the rider. A breakdown or an accident is not
  // their fault and must not read like a strike on their record.
  if (job.type !== 'NON_PAYMENT') return;

  const unpaid =
    job.weeklyInvoice && job.weeklyInvoice.status !== 'PAID' ? job.weeklyInvoice.amount : 0;

  await prisma.user.update({
    where: { id: job.rental.userId },
    data: {
      recoveryCount: { increment: 1 },
      lastRecoveryAt: new Date(),
      writtenOffAmount: { increment: unpaid },
    },
  });
}
