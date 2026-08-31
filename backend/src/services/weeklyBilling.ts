import { prisma } from '../utils/prisma';

/**
 * Weekly rental billing — the recurring cycle from the legacy dashboard.
 *
 * Runs on an interval (wired in app.ts). Two jobs:
 *   1. Promote PENDING invoices past their due date to OVERDUE.
 *   2. For every ACTIVE rental whose latest week is ending, raise next week's
 *      invoice so the rider always has a live due amount.
 *
 * Sending the actual WhatsApp/SMS reminder is a separate slice — this only
 * keeps the ledger correct. `sendInvoiceReminder` bumps the counter for now.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function runWeeklyBillingSweep(): Promise<{ overdue: number; raised: number }> {
  const now = new Date();

  const overdue = await prisma.weeklyInvoice.updateMany({
    where: { status: 'PENDING', dueAt: { lt: now } },
    data: { status: 'OVERDUE' },
  });

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
    // Raise next week within 24h of the current period ending.
    if (last.periodEnd.getTime() - now.getTime() > 24 * 60 * 60 * 1000) continue;

    const nextWeek = last.weekNumber + 1;
    const periodStart = last.periodEnd;
    const periodEnd = new Date(periodStart.getTime() + WEEK_MS);

    try {
      await prisma.weeklyInvoice.create({
        data: {
          rentalId: rental.id,
          weekNumber: nextWeek,
          periodStart,
          periodEnd,
          amount: rental.booking.rentAmount,
          dueAt: periodEnd,
        },
      });
      raised++;
    } catch (e: any) {
      // unique(rentalId, weekNumber) — already raised, ignore
      if (e.code !== 'P2002') console.error('weeklyBilling raise failed:', e);
    }

    // Keep the rental's own status in step with its ledger.
    const stillOverdue = await prisma.weeklyInvoice.count({
      where: { rentalId: rental.id, status: 'OVERDUE' },
    });
    const targetStatus = stillOverdue > 0 ? 'OVERDUE' : 'ACTIVE';
    if (rental.status !== targetStatus && ['ACTIVE', 'OVERDUE'].includes(rental.status)) {
      await prisma.rental.update({ where: { id: rental.id }, data: { status: targetStatus } });
    }
  }

  return { overdue: overdue.count, raised };
}

/** Start the sweep loop. Every 6h is plenty for weekly cadence. */
export function startWeeklyBilling() {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const tick = () =>
    runWeeklyBillingSweep()
      .then((r) => {
        if (r.overdue || r.raised)
          console.log(`[billing] ${r.overdue} -> OVERDUE, ${r.raised} new weekly invoice(s)`);
      })
      .catch((e) => console.error('[billing] sweep error:', e));

  tick();
  return setInterval(tick, SIX_HOURS);
}
