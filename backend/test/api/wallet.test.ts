/**
 * Module: Rider wallet — company-issued credit (WAL-001 .. WAL-014)
 * Endpoints: GET /rental/wallet, POST /rental/invoices/:id/pay,
 *            GET/POST /admin/api/wallet[...]
 *
 * The wallet holds money the company owes or granted. There is no top-up path,
 * so the risk here is not fraud on the way in — it is the ledger disagreeing
 * with the balance, or credit being spent twice. These tests target exactly
 * that.
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, bearer, makeActiveRental, makeUser } from '../helpers/factories';
import { creditWallet, debitWallet, getWalletSummary } from '../../src/services/wallet';

describe('Wallet — service invariants', () => {
  it('WAL-001 creates the wallet on first touch and records the credit', async () => {
    const rider = await makeUser({ role: 'RIDER' });

    const { balance, transaction } = await creditWallet({
      userId: rider.id,
      amount: 500,
      reason: 'PROMO',
      note: 'Launch offer',
    });

    expect(balance).toBe(500);
    expect(transaction.direction).toBe('CREDIT');
    expect(transaction.amount).toBe(500);
    expect(transaction.balanceAfter).toBe(500);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: rider.id } });
    expect(wallet.balance).toBe(500);
  });

  it('WAL-002 rejects a zero or negative credit', async () => {
    const rider = await makeUser({ role: 'RIDER' });

    await expect(
      creditWallet({ userId: rider.id, amount: 0, reason: 'GOODWILL' }),
    ).rejects.toThrow(/positive/i);
    await expect(
      creditWallet({ userId: rider.id, amount: -250, reason: 'GOODWILL' }),
    ).rejects.toThrow(/positive/i);
  });

  it('WAL-003 the ledger always replays to the stored balance', async () => {
    const rider = await makeUser({ role: 'RIDER' });

    await creditWallet({ userId: rider.id, amount: 1000, reason: 'REFUND' });
    await creditWallet({ userId: rider.id, amount: 250, reason: 'PROMO' });
    await debitWallet({ userId: rider.id, amount: 400, reason: 'INVOICE_APPLIED' });
    await creditWallet({ userId: rider.id, amount: 75, reason: 'GOODWILL' });

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: rider.id } });
    const rows = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'asc' },
    });

    const replayed = rows.reduce(
      (sum, r) => (r.direction === 'CREDIT' ? sum + r.amount : sum - r.amount),
      0,
    );

    expect(replayed).toBe(wallet.balance);
    expect(wallet.balance).toBe(925);
    // Every row's balanceAfter must agree with the running total at that point.
    let running = 0;
    for (const r of rows) {
      running += r.direction === 'CREDIT' ? r.amount : -r.amount;
      expect(r.balanceAfter).toBe(running);
    }
  });

  it('WAL-004 a debit is capped at the balance and never goes negative', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    await creditWallet({ userId: rider.id, amount: 300, reason: 'PROMO' });

    const spend = await debitWallet({
      userId: rider.id,
      amount: 2000,
      reason: 'INVOICE_APPLIED',
    });

    expect(spend.applied).toBe(300);
    expect(spend.balance).toBe(0);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: rider.id } });
    expect(wallet.balance).toBe(0);
  });

  it('WAL-005 spending against an empty wallet applies nothing and writes no row', async () => {
    const rider = await makeUser({ role: 'RIDER' });

    const spend = await debitWallet({
      userId: rider.id,
      amount: 1000,
      reason: 'INVOICE_APPLIED',
    });

    expect(spend.applied).toBe(0);
    const rows = await prisma.walletTransaction.count({ where: { userId: rider.id } });
    expect(rows).toBe(0);
  });

  it('WAL-006 summarises lifetime credited and spent', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    await creditWallet({ userId: rider.id, amount: 800, reason: 'REFUND' });
    await debitWallet({ userId: rider.id, amount: 300, reason: 'INVOICE_APPLIED' });

    const summary = await getWalletSummary(rider.id);
    expect(summary.balance).toBe(500);
    expect(summary.lifetimeCredited).toBe(800);
    expect(summary.lifetimeSpent).toBe(300);
    expect(summary.transactions).toHaveLength(2);
  });
});

describe('Wallet — rider API', () => {
  it('WAL-007 returns an empty wallet for a rider who has never had credit', async () => {
    const { headers } = await actingAs('RIDER');

    const res = await api().get('/rental/wallet').set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(0);
    expect(res.body.data.transactions).toEqual([]);
  });

  it('WAL-008 shows what the credit will be applied to next', async () => {
    const { rider, invoice } = await makeActiveRental();
    await creditWallet({ userId: rider.id, amount: 500, reason: 'PROMO' });

    const res = await api().get('/rental/wallet').set(bearer(rider.id, 'RIDER'));

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(500);
    expect(res.body.data.nextInvoice.id).toBe(invoice.id);
    expect(res.body.data.appliedToNextInvoice).toBe(500);
  });

  it('WAL-009 requires authentication', async () => {
    const res = await api().get('/rental/wallet');
    expect(res.status).toBe(401);
  });
});

describe('Wallet — settling a weekly invoice', () => {
  it('WAL-010 credit covering the full week pays it with no Payment row', async () => {
    const { rider, invoice } = await makeActiveRental();
    await creditWallet({ userId: rider.id, amount: invoice.amount, reason: 'REFUND' });

    const res = await api()
      .post(`/rental/invoices/${invoice.id}/pay`)
      .set(bearer(rider.id, 'RIDER'))
      .send({ method: 'UPI' });

    expect(res.status).toBe(200);
    expect(res.body.walletApplied).toBe(invoice.amount);
    expect(res.body.charged).toBe(0);

    const row = await prisma.weeklyInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(row.status).toBe('PAID');

    // No money moved, so nothing may be booked as collected revenue.
    const payments = await prisma.payment.count({ where: { weeklyInvoiceId: invoice.id } });
    expect(payments).toBe(0);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: rider.id } });
    expect(wallet.balance).toBe(0);
  });

  it('WAL-011 partial credit is spent first and only the remainder is charged', async () => {
    const { rider, invoice } = await makeActiveRental();
    await creditWallet({ userId: rider.id, amount: 500, reason: 'DAMAGE_REVERSAL' });

    const res = await api()
      .post(`/rental/invoices/${invoice.id}/pay`)
      .set(bearer(rider.id, 'RIDER'))
      .send({ method: 'UPI' });

    expect(res.status).toBe(200);
    expect(res.body.walletApplied).toBe(500);
    expect(res.body.charged).toBe(invoice.amount - 500);

    const payment = await prisma.payment.findFirstOrThrow({
      where: { weeklyInvoiceId: invoice.id },
    });
    expect(payment.amount).toBe(invoice.amount - 500);

    const debit = await prisma.walletTransaction.findFirstOrThrow({
      where: { userId: rider.id, direction: 'DEBIT' },
    });
    expect(debit.weeklyInvoiceId).toBe(invoice.id);
    expect(debit.reason).toBe('INVOICE_APPLIED');
  });

  it('WAL-012 an already-paid week does not spend credit again', async () => {
    const { rider, invoice } = await makeActiveRental();
    await creditWallet({ userId: rider.id, amount: 5000, reason: 'PROMO' });

    const auth = bearer(rider.id, 'RIDER');

    await api().post(`/rental/invoices/${invoice.id}/pay`).set(auth).send({ method: 'UPI' });
    const second = await api()
      .post(`/rental/invoices/${invoice.id}/pay`)
      .set(auth)
      .send({ method: 'UPI' });

    expect(second.status).toBe(409);

    const debits = await prisma.walletTransaction.count({
      where: { userId: rider.id, direction: 'DEBIT' },
    });
    expect(debits).toBe(1);
  });
});

describe('Wallet — admin', () => {
  it('WAL-013 an admin grants credit and it shows in the outstanding total', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });

    const res = await api()
      .post(`/admin/api/wallet/${rider.id}/credit`)
      .set(headers)
      .send({ amount: 750, reason: 'GOODWILL', note: 'Late handover' });

    expect(res.status).toBe(201);
    expect(res.body.data.balance).toBe(750);

    const list = await api().get('/admin/api/wallet').set(headers);
    expect(list.status).toBe(200);
    const mine = list.body.data.wallets.find((w: any) => w.user.id === rider.id);
    expect(mine.balance).toBe(750);
    expect(list.body.data.totalOutstanding).toBeGreaterThanOrEqual(750);
  });

  it('WAL-014 rejects an unknown reason or a non-positive amount', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });

    const badReason = await api()
      .post(`/admin/api/wallet/${rider.id}/credit`)
      .set(headers)
      .send({ amount: 100, reason: 'TOP_UP' });
    expect(badReason.status).toBe(400);

    const badAmount = await api()
      .post(`/admin/api/wallet/${rider.id}/credit`)
      .set(headers)
      .send({ amount: -5, reason: 'PROMO' });
    expect(badAmount.status).toBe(400);

    const wallet = await prisma.wallet.findUnique({ where: { userId: rider.id } });
    expect(wallet?.balance ?? 0).toBe(0);
  });

  it('WAL-015 a non-admin staff member cannot grant credit', async () => {
    const { headers } = await actingAs('SUPPORT');
    const rider = await makeUser({ role: 'RIDER' });

    const res = await api()
      .post(`/admin/api/wallet/${rider.id}/credit`)
      .set(headers)
      .send({ amount: 100, reason: 'PROMO' });

    expect(res.status).toBe(403);
  });
});
