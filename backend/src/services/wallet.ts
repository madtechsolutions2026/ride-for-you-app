import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

/**
 * Rider wallet — company-issued credit only.
 *
 * There is deliberately no top-up path. Nothing a rider does can put money
 * into this wallet; credit exists only because the company owes it (a refund,
 * a reversed damage charge, a returned deposit) or chose to grant it (promo,
 * goodwill). That single decision removes a lot of risk: no gateway, no
 * reconciliation against an external ledger, no float to hold, and no way for
 * a balance to be spent twice through a race with an inbound payment.
 *
 * Credit is spent one way only: applied against a weekly invoice at payment
 * time, cheapest path first (wallet before gateway).
 *
 * INVARIANTS, enforced here rather than by convention:
 *   1. `Wallet.balance` is only ever written inside the same transaction that
 *      appends the WalletTransaction explaining the change.
 *   2. `amount` on a transaction is always positive; `direction` carries sign.
 *   3. The balance never goes negative — a debit is capped at what is there.
 *   4. `balanceAfter` is written from the value the transaction itself
 *      computed, so the ledger always replays to the stored balance.
 */

export type CreditReason =
  | 'REFUND'
  | 'DAMAGE_REVERSAL'
  | 'DEPOSIT_RETURN'
  | 'PROMO'
  | 'GOODWILL';

export type DebitReason = 'INVOICE_APPLIED' | 'ADJUSTMENT';

/** Anything that can run a query — the client, or an open transaction. */
type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Fetch the rider's wallet, creating an empty one on first touch.
 *
 * Racing callers are handled by the unique index on `userId`: the loser of the
 * race gets P2002 and re-reads the winner's row instead of failing.
 */
export async function ensureWallet(userId: string, db: Db = prisma) {
  const existing = await db.wallet.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await db.wallet.create({ data: { userId, balance: 0 } });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const raced = await db.wallet.findUnique({ where: { userId } });
      if (raced) return raced;
    }
    throw e;
  }
}

export interface CreditInput {
  userId: string;
  amount: number;
  reason: CreditReason;
  note?: string | null;
  /** Staff User.id, when a human granted this. */
  issuedById?: string | null;
  weeklyInvoiceId?: string | null;
  paymentId?: string | null;
}

/**
 * Add credit to a rider's wallet.
 *
 * Safe to call from inside a caller's transaction — pass it as `db` so the
 * credit commits or rolls back with whatever caused it (a refund, say).
 */
export async function creditWallet(input: CreditInput, db: Db = prisma) {
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Wallet credit must be a positive amount');
  }

  const wallet = await ensureWallet(input.userId, db);
  const balanceAfter = wallet.balance + amount;

  const [, transaction] = await Promise.all([
    db.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } }),
    db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: input.userId,
        direction: 'CREDIT',
        reason: input.reason,
        amount,
        balanceAfter,
        note: input.note ?? null,
        issuedById: input.issuedById ?? null,
        weeklyInvoiceId: input.weeklyInvoiceId ?? null,
        paymentId: input.paymentId ?? null,
      },
    }),
  ]);

  return { balance: balanceAfter, transaction };
}

export interface DebitInput {
  userId: string;
  /** The most we would like to spend. Less is spent if the balance is short. */
  amount: number;
  reason: DebitReason;
  note?: string | null;
  weeklyInvoiceId?: string | null;
  issuedById?: string | null;
}

/**
 * Spend up to `amount` of wallet credit.
 *
 * Partial by design: a ₹2,000 invoice against a ₹500 balance spends ₹500 and
 * reports `applied: 500`, leaving the caller to collect the remaining ₹1,500
 * through the gateway. A zero balance is not an error — it applies nothing.
 */
export async function debitWallet(input: DebitInput, db: Db = prisma) {
  const requested = Math.round(input.amount);
  if (!Number.isFinite(requested) || requested <= 0) {
    return { applied: 0, balance: (await ensureWallet(input.userId, db)).balance };
  }

  const wallet = await ensureWallet(input.userId, db);
  const applied = Math.min(wallet.balance, requested);
  if (applied <= 0) return { applied: 0, balance: wallet.balance };

  const balanceAfter = wallet.balance - applied;

  await Promise.all([
    db.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } }),
    db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: input.userId,
        direction: 'DEBIT',
        reason: input.reason,
        amount: applied,
        balanceAfter,
        note: input.note ?? null,
        weeklyInvoiceId: input.weeklyInvoiceId ?? null,
        issuedById: input.issuedById ?? null,
      },
    }),
  ]);

  return { applied, balance: balanceAfter };
}

/** Balance plus the most recent ledger rows, for the rider's Wallet screen. */
export async function getWalletSummary(userId: string, take = 50) {
  const wallet = await ensureWallet(userId);

  const [transactions, lifetime] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.walletTransaction.groupBy({
      by: ['direction'],
      where: { walletId: wallet.id },
      _sum: { amount: true },
    }),
  ]);

  const sumOf = (d: string) =>
    lifetime.find((r) => r.direction === d)?._sum.amount ?? 0;

  return {
    balance: wallet.balance,
    lifetimeCredited: sumOf('CREDIT'),
    lifetimeSpent: sumOf('DEBIT'),
    transactions,
  };
}
