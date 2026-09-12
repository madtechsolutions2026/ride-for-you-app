/**
 * Module: Collections ladder (COL-001 .. COL-024)
 *
 * Rent falls due at midnight; the rider is chased every 2 hours for 2 days,
 * warned once on the final day, and the bike is queued for recovery when the
 * grace window closes. Paying stops all of it.
 *
 * The sweep is driven by an injectable `now`, so each rung is tested by moving
 * the clock rather than by waiting — and, more importantly, by asserting that
 * a sweep which runs late still lands on the correct rung instead of
 * restarting the ladder.
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, bearer, makeActiveRental } from '../helpers/factories';
import {
  runCollectionsSweep,
  runNightlyBilling,
  settleDunning,
  markRiderRecovered,
  stageFor,
  midnightAfter,
  GRACE_MS,
  CHASE_INTERVAL_MS,
} from '../../src/services/collections';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** An active rental whose week-1 invoice fell due `hoursAgo` hours ago. */
async function rentalDueHoursAgo(hoursAgo: number) {
  const ctx = await makeActiveRental();
  const dueAt = new Date(Date.now() - hoursAgo * HOUR_MS);

  await prisma.weeklyInvoice.update({
    where: { id: ctx.invoice.id },
    data: {
      dueAt,
      graceEndsAt: new Date(dueAt.getTime() + GRACE_MS),
      status: 'OVERDUE',
      periodEnd: dueAt,
    },
  });

  return ctx;
}

const reload = (id: string) => prisma.weeklyInvoice.findUniqueOrThrow({ where: { id } });

describe('Stage derivation', () => {
  const dueAt = new Date('2026-09-10T18:30:00.000Z'); // 00:00 IST on the 11th
  const graceEndsAt = new Date(dueAt.getTime() + GRACE_MS);
  const inv = { dueAt, graceEndsAt };

  it('COL-001 is NOT_DUE before the due moment', () => {
    expect(stageFor(inv, dueAt.getTime() - 1)).toBe('NOT_DUE');
  });

  it('COL-002 is DUE_TODAY for the first chase interval', () => {
    expect(stageFor(inv, dueAt.getTime())).toBe('DUE_TODAY');
    expect(stageFor(inv, dueAt.getTime() + HOUR_MS)).toBe('DUE_TODAY');
  });

  it('COL-003 is CHASING once past the first interval', () => {
    expect(stageFor(inv, dueAt.getTime() + CHASE_INTERVAL_MS)).toBe('CHASING');
    expect(stageFor(inv, dueAt.getTime() + 20 * HOUR_MS)).toBe('CHASING');
  });

  it('COL-004 is FINAL_WARNING in the last 24h of grace', () => {
    expect(stageFor(inv, graceEndsAt.getTime() - DAY_MS)).toBe('FINAL_WARNING');
    expect(stageFor(inv, graceEndsAt.getTime() - HOUR_MS)).toBe('FINAL_WARNING');
  });

  it('COL-005 is RECOVERY_DUE once grace ends', () => {
    expect(stageFor(inv, graceEndsAt.getTime())).toBe('RECOVERY_DUE');
    expect(stageFor(inv, graceEndsAt.getTime() + 30 * DAY_MS)).toBe('RECOVERY_DUE');
  });

  it('COL-006 a sweep that misses days lands on the right rung, not the first', () => {
    // The process was down for a week. The bike is overdue for recovery —
    // the rider must not be chased from rung one all over again.
    expect(stageFor(inv, dueAt.getTime() + 7 * DAY_MS)).toBe('RECOVERY_DUE');
  });
});

describe('Midnight anchoring', () => {
  it('COL-007 midnightAfter lands on 00:00 Asia/Kolkata', () => {
    // 14:00 IST on 12 Sep -> 00:00 IST on 13 Sep (= 18:30 UTC on the 12th).
    const midday = new Date('2026-09-12T08:30:00.000Z');
    expect(midnightAfter(midday).toISOString()).toBe('2026-09-12T18:30:00.000Z');
  });

  it('COL-008 is always strictly in the future, even called at midnight', () => {
    const exactlyMidnight = new Date('2026-09-12T18:30:00.000Z');
    expect(midnightAfter(exactlyMidnight).getTime()).toBeGreaterThan(exactlyMidnight.getTime());
  });
});

describe('Chasing', () => {
  it('COL-009 chases an overdue week and stamps the reminder time', async () => {
    const { invoice } = await rentalDueHoursAgo(3);

    const result = await runCollectionsSweep();

    expect(result.chased).toBeGreaterThanOrEqual(1);
    const row = await reload(invoice.id);
    expect(row.reminderCount).toBe(1);
    expect(row.lastReminderAt).toBeInstanceOf(Date);
  });

  it('COL-010 does not chase twice inside the 2-hour window', async () => {
    const { invoice } = await rentalDueHoursAgo(3);

    await runCollectionsSweep();
    await runCollectionsSweep();

    const row = await reload(invoice.id);
    expect(row.reminderCount).toBe(1);
  });

  it('COL-011 chases again once 2 hours have passed', async () => {
    const { invoice } = await rentalDueHoursAgo(3);
    await runCollectionsSweep();

    // Rewind the last reminder past the interval rather than sleeping.
    await prisma.weeklyInvoice.update({
      where: { id: invoice.id },
      data: { lastReminderAt: new Date(Date.now() - CHASE_INTERVAL_MS - 1000) },
    });
    await runCollectionsSweep();

    const row = await reload(invoice.id);
    expect(row.reminderCount).toBe(2);
  });

  it('COL-012 never chases a week that is not due yet', async () => {
    const ctx = await makeActiveRental();
    await prisma.weeklyInvoice.update({
      where: { id: ctx.invoice.id },
      data: { dueAt: new Date(Date.now() + 3 * DAY_MS), status: 'PENDING' },
    });

    await runCollectionsSweep();

    const row = await reload(ctx.invoice.id);
    expect(row.reminderCount).toBe(0);
    expect(row.status).toBe('PENDING');
  });

  it('COL-013 flips a due PENDING invoice to OVERDUE', async () => {
    const ctx = await makeActiveRental();
    await prisma.weeklyInvoice.update({
      where: { id: ctx.invoice.id },
      data: { dueAt: new Date(Date.now() - HOUR_MS), status: 'PENDING' },
    });

    await runCollectionsSweep();

    expect((await reload(ctx.invoice.id)).status).toBe('OVERDUE');
  });

  it('COL-014 backfills graceEndsAt on invoices raised before this shipped', async () => {
    const ctx = await makeActiveRental();
    const dueAt = new Date(Date.now() - 2 * HOUR_MS);
    await prisma.weeklyInvoice.update({
      where: { id: ctx.invoice.id },
      data: { dueAt, status: 'OVERDUE', graceEndsAt: null },
    });

    await runCollectionsSweep();

    const row = await reload(ctx.invoice.id);
    expect(row.graceEndsAt?.getTime()).toBe(dueAt.getTime() + GRACE_MS);
  });
});

describe('Final warning', () => {
  it('COL-015 sends exactly one warning in the last 24h', async () => {
    const { invoice } = await rentalDueHoursAgo(30); // 18h of grace left

    const first = await runCollectionsSweep();
    expect(first.finalWarnings).toBe(1);

    const row = await reload(invoice.id);
    expect(row.finalWarningAt).toBeInstanceOf(Date);

    // A second sweep must not warn again, even hours later.
    await prisma.weeklyInvoice.update({
      where: { id: invoice.id },
      data: { lastReminderAt: new Date(Date.now() - 3 * HOUR_MS) },
    });
    const second = await runCollectionsSweep();
    expect(second.finalWarnings).toBe(0);
  });

  it('COL-016 does not warn while more than a day of grace remains', async () => {
    await rentalDueHoursAgo(3);

    const result = await runCollectionsSweep();

    expect(result.finalWarnings).toBe(0);
  });
});

describe('Recovery escalation', () => {
  it('COL-017 raises a NON_PAYMENT job once grace has run out', async () => {
    const { invoice, rental, bike, rider } = await rentalDueHoursAgo(50);

    const result = await runCollectionsSweep();

    expect(result.recoveriesRaised).toBe(1);

    const job = await prisma.recoveryJob.findFirstOrThrow({
      where: { weeklyInvoiceId: invoice.id },
    });
    expect(job.type).toBe('NON_PAYMENT');
    expect(job.status).toBe('OPEN');
    expect(job.priority).toBe('HIGH');
    expect(job.rentalId).toBe(rental.id);
    expect(job.bikeId).toBe(bike.id);
    expect(job.description).toContain(String(invoice.amount));
    void rider;
  });

  it('COL-018 raises only one job however often the sweep runs', async () => {
    const { invoice } = await rentalDueHoursAgo(50);

    await runCollectionsSweep();
    await runCollectionsSweep();
    await runCollectionsSweep();

    const count = await prisma.recoveryJob.count({ where: { weeklyInvoiceId: invoice.id } });
    expect(count).toBe(1);
  });

  it('COL-019 stops chasing once the bike is in recovery', async () => {
    const { invoice } = await rentalDueHoursAgo(50);
    await runCollectionsSweep();
    const afterRaise = await reload(invoice.id);

    await prisma.weeklyInvoice.update({
      where: { id: invoice.id },
      data: { lastReminderAt: new Date(Date.now() - 5 * HOUR_MS) },
    });
    await runCollectionsSweep();

    // No further reminders — the conversation has moved to the recovery desk.
    expect((await reload(invoice.id)).reminderCount).toBe(afterRaise.reminderCount);
  });

  it('COL-020 marks the rental OVERDUE while rent is late', async () => {
    const { rental } = await rentalDueHoursAgo(5);

    await runCollectionsSweep();

    expect((await prisma.rental.findUniqueOrThrow({ where: { id: rental.id } })).status).toBe(
      'OVERDUE',
    );
  });
});

describe('Paying stops the ladder', () => {
  it('COL-021 an in-app payment cancels an undispatched recovery', async () => {
    const { invoice, rider } = await rentalDueHoursAgo(50);
    await runCollectionsSweep();

    const res = await api()
      .post(`/rental/invoices/${invoice.id}/pay`)
      .set(bearer(rider.id, 'RIDER'))
      .send({ method: 'UPI' });

    expect(res.status).toBe(200);
    expect(res.body.recoveryCancelled).toBe(true);

    const job = await prisma.recoveryJob.findFirstOrThrow({
      where: { weeklyInvoiceId: invoice.id },
    });
    expect(job.status).toBe('CLOSED');
    expect(job.resolutionNote).toMatch(/paid before dispatch/i);
  });

  it('COL-022 a payment after dispatch does NOT silently cancel the job', async () => {
    const { invoice } = await rentalDueHoursAgo(50);
    await runCollectionsSweep();

    const job = await prisma.recoveryJob.findFirstOrThrow({
      where: { weeklyInvoiceId: invoice.id },
    });
    await prisma.recoveryJob.update({
      where: { id: job.id },
      data: { status: 'DISPATCHED', dispatchedAt: new Date() },
    });

    const { recoveryCancelled } = await settleDunning(invoice.id);

    expect(recoveryCancelled).toBe(false);
    const after = await prisma.recoveryJob.findUniqueOrThrow({ where: { id: job.id } });
    // An agent may already be at the door — the desk is told, not overruled.
    expect(after.status).toBe('DISPATCHED');
    expect(after.description).toContain('[PAID]');
  });

  it('COL-023 staff marking an invoice paid stands the ladder down too', async () => {
    const { invoice } = await rentalDueHoursAgo(50);
    await runCollectionsSweep();
    const { headers } = await actingAs('ADMIN');

    const res = await api()
      .post(`/admin/api/invoices/${invoice.id}/mark-paid`)
      .set(headers)
      .send({ provider: 'CASH' });

    expect(res.status).toBe(200);
    expect(res.body.recoveryCancelled).toBe(true);
  });

  it('COL-024 paying returns the rental to ACTIVE', async () => {
    const { invoice, rental, rider } = await rentalDueHoursAgo(5);
    await runCollectionsSweep();

    await api()
      .post(`/rental/invoices/${invoice.id}/pay`)
      .set(bearer(rider.id, 'RIDER'))
      .send({ method: 'UPI' });

    expect((await prisma.rental.findUniqueOrThrow({ where: { id: rental.id } })).status).toBe(
      'ACTIVE',
    );
  });
});

describe('The mark on the rider', () => {
  it('COL-025 a completed non-payment recovery marks the profile', async () => {
    const { invoice, rider } = await rentalDueHoursAgo(50);
    await runCollectionsSweep();
    const job = await prisma.recoveryJob.findFirstOrThrow({
      where: { weeklyInvoiceId: invoice.id },
    });

    await markRiderRecovered(job.id);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: rider.id } });
    expect(after.recoveryCount).toBe(1);
    expect(after.lastRecoveryAt).toBeInstanceOf(Date);
    expect(after.writtenOffAmount).toBe(invoice.amount);
  });

  it('COL-026 a breakdown recovery leaves no mark — it is not their fault', async () => {
    const { rental, rider } = await makeActiveRental();

    const job = await prisma.recoveryJob.create({
      data: {
        reference: `REC-${Date.now()}`,
        type: 'BREAKDOWN',
        description: 'Motor failed on the ORR',
        rentalId: rental.id,
      },
    });

    await markRiderRecovered(job.id);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: rider.id } });
    expect(after.recoveryCount).toBe(0);
  });

  it('COL-027 resolving the job through the admin API marks the rider', async () => {
    const { invoice, rider, bike } = await rentalDueHoursAgo(50);
    await runCollectionsSweep();
    const job = await prisma.recoveryJob.findFirstOrThrow({
      where: { weeklyInvoiceId: invoice.id },
    });
    const { headers } = await actingAs('ADMIN');

    const res = await api()
      .post(`/admin/api/recovery/${job.id}/update`)
      .set(headers)
      .send({ status: 'RESOLVED', resolutionNote: 'Collected from Madhapur' });

    expect(res.status).toBe(200);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: rider.id } });
    expect(after.recoveryCount).toBe(1);

    // The bike is physically back and goes for a check, not straight out again.
    expect((await prisma.bike.findUniqueOrThrow({ where: { id: bike.id } })).status).toBe(
      'MAINTENANCE',
    );
  });
});

describe('Next cycle', () => {
  it('COL-028 the nightly job raises the following week with a midnight due date', async () => {
    const ctx = await makeActiveRental();
    // Week 1 ends today, so tonight's run raises week 2.
    await prisma.weeklyInvoice.update({
      where: { id: ctx.invoice.id },
      data: { periodEnd: new Date(Date.now() + HOUR_MS) },
    });

    const result = await runNightlyBilling();

    expect(result.raised).toBeGreaterThanOrEqual(1);
    const week2 = await prisma.weeklyInvoice.findFirstOrThrow({
      where: { rentalId: ctx.rental.id, weekNumber: 2 },
    });
    expect(week2.amount).toBe(ctx.booking.rentAmount);
    expect(week2.graceEndsAt?.getTime()).toBe(week2.dueAt.getTime() + GRACE_MS);
  });

  it('COL-029 raising is idempotent — two runs in one night raise one week', async () => {
    const ctx = await makeActiveRental();
    await prisma.weeklyInvoice.update({
      where: { id: ctx.invoice.id },
      data: { periodEnd: new Date(Date.now() + HOUR_MS) },
    });

    await runNightlyBilling();
    await runNightlyBilling();

    const count = await prisma.weeklyInvoice.count({ where: { rentalId: ctx.rental.id } });
    expect(count).toBe(2);
  });

  it('COL-030 the midnight notice goes out once and stores the payment link', async () => {
    const ctx = await makeActiveRental();
    const dueAt = new Date(Date.now() + HOUR_MS);
    await prisma.weeklyInvoice.update({
      where: { id: ctx.invoice.id },
      data: { dueAt, billedNoticeAt: null },
    });

    const first = await runNightlyBilling();
    expect(first.notified).toBeGreaterThanOrEqual(1);

    const row = await reload(ctx.invoice.id);
    expect(row.billedNoticeAt).toBeInstanceOf(Date);
    expect(row.paymentLinkUrl).toContain(ctx.invoice.id);

    const second = await runNightlyBilling();
    expect(second.notified).toBe(0);
  });

  it('COL-031 a re-booked rider starts a fresh cycle, not the old one', async () => {
    // The whole point of requirement "change the date for the next payment
    // cycle newly": invoices belong to a rental, and a new rental starts at
    // week 1 from its own handover.
    const first = await makeActiveRental();
    const second = await makeActiveRental();

    const firstWeeks = await prisma.weeklyInvoice.findMany({
      where: { rentalId: first.rental.id },
    });
    const secondWeeks = await prisma.weeklyInvoice.findMany({
      where: { rentalId: second.rental.id },
    });

    expect(firstWeeks).toHaveLength(1);
    expect(secondWeeks).toHaveLength(1);
    expect(secondWeeks[0].weekNumber).toBe(1);
    expect(secondWeeks[0].dueAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('Rider-facing payment handles', () => {
  it('COL-032 returns the QR payload for an unpaid week', async () => {
    process.env.UPI_VPA = 'rideforyou@okhdfcbank';
    const { invoice, rider } = await rentalDueHoursAgo(3);

    const res = await api()
      .get(`/rental/invoices/${invoice.id}/payment`)
      .set(bearer(rider.id, 'RIDER'));

    expect(res.status).toBe(200);
    expect(res.body.qrAvailable).toBe(true);
    expect(res.body.upiUri).toContain('upi://pay');
    expect(res.body.upiUri).toContain('rideforyou%40okhdfcbank');
    expect(res.body.qrDataUri).toContain('data:image/svg+xml');
    delete process.env.UPI_VPA;
  });

  it('COL-033 reports qrAvailable false when no company VPA is configured', async () => {
    delete process.env.UPI_VPA;
    const { invoice, rider } = await rentalDueHoursAgo(3);

    const res = await api()
      .get(`/rental/invoices/${invoice.id}/payment`)
      .set(bearer(rider.id, 'RIDER'));

    expect(res.status).toBe(200);
    expect(res.body.qrAvailable).toBe(false);
    expect(res.body.qrDataUri).toBe('');
  });

  it('COL-034 one rider cannot fetch another rider’s payment QR', async () => {
    const { invoice } = await rentalDueHoursAgo(3);
    const stranger = await actingAs('RIDER');

    const res = await api()
      .get(`/rental/invoices/${invoice.id}/payment`)
      .set(stranger.headers);

    expect(res.status).toBe(404);
  });

  it('COL-035 refuses to hand out a QR for a week already paid', async () => {
    const { invoice, rider } = await rentalDueHoursAgo(3);
    await prisma.weeklyInvoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    const res = await api()
      .get(`/rental/invoices/${invoice.id}/payment`)
      .set(bearer(rider.id, 'RIDER'));

    expect(res.status).toBe(409);
  });
});
