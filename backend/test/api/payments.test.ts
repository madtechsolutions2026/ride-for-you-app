/**
 * Modules: Payments & Delays (PAY-001 .. PAY-011) and the refund half of
 * Bank Details & Refunds (BAN-004 .. BAN-015).
 *
 * NOTE: the schema has no bank-account entity, so BAN-001..003 (viewing /
 * validating customer bank details) have nothing to test. Refunds are modelled
 * as a negative ADJUSTMENT Payment created by ops.controller.refundPayment.
 *
 * Endpoints: GET /admin/api/payments, POST /admin/api/payments,
 *   POST /admin/api/payments/:id/refund, GET /admin/api/invoices,
 *   POST /admin/api/invoices/:id/mark-paid, POST /admin/api/invoices/:id/remind
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, makeUser, makeActiveRental } from '../helpers/factories';

async function payment(userId: string, over: Partial<{ amount: number; status: string; purpose: string; provider: string }> = {}) {
  return prisma.payment.create({
    data: {
      userId,
      amount: over.amount ?? 1000,
      purpose: over.purpose ?? 'RENT',
      provider: over.provider ?? 'PHONEPE',
      status: over.status ?? 'SUCCESS',
    },
  });
}

describe('Payments & Delays', () => {
  it('PAY-001/002/003 filters payments by status', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });
    await payment(rider.id, { status: 'SUCCESS' });
    await payment(rider.id, { status: 'INITIATED' });
    await payment(rider.id, { status: 'FAILED' });

    for (const [status, n] of [['SUCCESS', 1], ['INITIATED', 1], ['FAILED', 1]] as const) {
      const res = await api().get('/admin/api/payments').query({ status }).set(headers);
      expect(res.body.count).toBe(n);
    }
  });

  it('PAY totals sum settled vs pending', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });
    await payment(rider.id, { status: 'SUCCESS', amount: 1000 });
    await payment(rider.id, { status: 'INITIATED', amount: 250 });

    const res = await api().get('/admin/api/payments').set(headers);
    expect(res.body.totals).toEqual({ settled: 1000, pending: 250 });
  });

  it('PAY-004 an invoice past its due date is reported as OVERDUE', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental } = await makeActiveRental();
    await prisma.weeklyInvoice.updateMany({
      where: { rentalId: rental.id },
      data: { status: 'PENDING', dueAt: new Date(Date.now() - 86400_000) },
    });

    const res = await api().get('/admin/api/invoices').set(headers);
    expect(res.body.invoices[0].status).toBe('OVERDUE');
    expect(res.body.summary.overdue).toBeGreaterThan(0);
  });

  it('PAY-005 a SUPPORT manager can read payment-delay data', async () => {
    const { headers } = await actingAs('SUPPORT');
    expect((await api().get('/admin/api/invoices').set(headers)).status).toBe(200);
    expect((await api().get('/admin/api/payments').set(headers)).status).toBe(200);
  });

  it('PAY-006 marking an invoice paid records a matching WEEKLY_RENT payment', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental, invoice } = await makeActiveRental();

    const res = await api().post(`/admin/api/invoices/${invoice.id}/mark-paid`).set(headers).send({ provider: 'UPI_MANUAL' });
    expect(res.status).toBe(200);
    expect((await prisma.weeklyInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe('PAID');

    const pay = await prisma.payment.findFirstOrThrow({ where: { weeklyInvoiceId: invoice.id } });
    expect(pay).toMatchObject({ purpose: 'WEEKLY_RENT', amount: invoice.amount, status: 'SUCCESS', userId: rental.userId });
  });

  it('PAY marking an already-paid invoice is refused', async () => {
    const { headers } = await actingAs('ADMIN');
    const { invoice } = await makeActiveRental();
    await api().post(`/admin/api/invoices/${invoice.id}/mark-paid`).set(headers).send({});
    const again = await api().post(`/admin/api/invoices/${invoice.id}/mark-paid`).set(headers).send({});
    expect(again.status).toBe(409);
  });

  it('PAY-007 logging a reminder bumps the reminder counter', async () => {
    const { headers } = await actingAs('SUPPORT');
    const { invoice } = await makeActiveRental();

    await api().post(`/admin/api/invoices/${invoice.id}/remind`).set(headers).send({});
    const res = await api().post(`/admin/api/invoices/${invoice.id}/remind`).set(headers).send({});
    expect(res.status).toBe(200);
    expect((await prisma.weeklyInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).reminderCount).toBe(2);
  });

  it('PAY manual payment requires userId, purpose and a numeric amount', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });
    expect((await api().post('/admin/api/payments').set(headers).send({ userId: rider.id, purpose: 'RENT' })).status).toBe(400);
    const ok = await api().post('/admin/api/payments').set(headers).send({ userId: rider.id, purpose: 'RENT', amount: 500 });
    expect(ok.status).toBe(201);
    expect(ok.body.payment).toMatchObject({ status: 'SUCCESS', provider: 'CASH', amount: 500 });
  });

  it('PAY-011 booking finance reconciles paid vs refunded into a balance', async () => {
    const { headers } = await actingAs('ADMIN');
    const { booking, rider } = await makeActiveRental();
    await prisma.payment.create({ data: { userId: rider.id, bookingId: booking.id, purpose: 'RENT', amount: 1645, provider: 'PHONEPE', status: 'SUCCESS' } });
    await prisma.payment.create({ data: { userId: rider.id, bookingId: booking.id, purpose: 'REFUND', amount: -645, provider: 'ADJUSTMENT', status: 'SUCCESS' } });

    const res = await api().get(`/admin/api/bookings/${booking.id}`).set(headers);
    expect(res.body.finance.paid).toBe(1645);
    expect(res.body.finance.refunded).toBe(645);
    expect(res.body.finance.balance).toBe(booking.totalAmount - 1645 + 645);
  });

  /* ---------------- Refunds (BAN-004 .. BAN-015) ---------------- */

  it('BAN-004/006/010/014 ADMIN refunds a successful payment — original REFUNDED, negative ADJUSTMENT booked', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });
    const original = await payment(rider.id, { amount: 1500, status: 'SUCCESS', purpose: 'DEPOSIT' });

    const res = await api().post(`/admin/api/payments/${original.id}/refund`).set(headers).send({ note: 'Deposit return' });
    expect(res.status).toBe(200);

    expect((await prisma.payment.findUniqueOrThrow({ where: { id: original.id } })).status).toBe('REFUNDED');
    const refund = await prisma.payment.findFirstOrThrow({ where: { purpose: 'REFUND', userId: rider.id } });
    expect(refund).toMatchObject({ amount: -1500, provider: 'ADJUSTMENT', status: 'SUCCESS' });
  });

  it('BAN-004b a partial refund amount is honoured', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });
    const original = await payment(rider.id, { amount: 2000, status: 'SUCCESS' });

    await api().post(`/admin/api/payments/${original.id}/refund`).set(headers).send({ amount: 750, note: 'partial' });
    const refund = await prisma.payment.findFirstOrThrow({ where: { purpose: 'REFUND' } });
    expect(refund.amount).toBe(-750);
  });

  it('BAN-009 a non-ADMIN staff member cannot process a refund', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    const rider = await makeUser({ role: 'RIDER' });
    const original = await payment(rider.id, { status: 'SUCCESS' });
    const res = await api().post(`/admin/api/payments/${original.id}/refund`).set(headers).send({ note: 'x' });
    expect(res.status).toBe(403);
  });

  it('BAN-011 only a SUCCESS payment can be refunded', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });
    const failed = await payment(rider.id, { status: 'FAILED' });
    const res = await api().post(`/admin/api/payments/${failed.id}/refund`).set(headers).send({ note: 'x' });
    expect(res.status).toBe(409);
  });

  it('BAN-013 the same payment cannot be refunded twice', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });
    const original = await payment(rider.id, { status: 'SUCCESS' });
    await api().post(`/admin/api/payments/${original.id}/refund`).set(headers).send({ note: 'first' });
    const again = await api().post(`/admin/api/payments/${original.id}/refund`).set(headers).send({ note: 'second' });
    expect(again.status).toBe(409);
  });

  it('BAN-015 the refund shows up in the rider payment history', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });
    const original = await payment(rider.id, { status: 'SUCCESS', amount: 900 });
    await api().post(`/admin/api/payments/${original.id}/refund`).set(headers).send({ note: 'x' });

    const res = await api().get('/admin/api/payments').query({ purpose: 'REFUND' }).set(headers);
    expect(res.body.payments.some((p: any) => p.userId === rider.id && p.amount === -900)).toBe(true);
  });

  it.failing(
    'PAY-010 duplicate manual payments should be prevented (GAP: recordManualPayment has no idempotency / dedup)',
    async () => {
      const { headers } = await actingAs('ADMIN');
      const rider = await makeUser({ role: 'RIDER' });
      const body = { userId: rider.id, purpose: 'RENT', amount: 500, provider: 'CASH', note: 'ref-123' };
      await api().post('/admin/api/payments').set(headers).send(body);
      const dup = await api().post('/admin/api/payments').set(headers).send(body);
      expect(dup.status).toBeGreaterThanOrEqual(400);
    }
  );

  it.skip('BAN-001/002/003 view / validate / restrict customer bank details — no bank-account entity in the schema', () => {});
  it.skip('PAY-008 escalate payment issue — no escalation entity/endpoint', () => {});
  it.skip('PAY-009 payment-gateway synchronisation — no webhook ingestion endpoint in the admin API', () => {});
});
