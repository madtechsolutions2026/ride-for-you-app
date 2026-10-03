import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { creditWallet, getWalletSummary, CreditReason } from '../services/wallet';
import { notify } from '../utils/notifications';

/* =========================================================================
   RIDER
   ========================================================================= */

/**
 * GET /rental/wallet
 *
 * Balance, lifetime totals and the ledger. There is no top-up endpoint and
 * there never will be one — see services/wallet.ts for why.
 */
export async function getMyWallet(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const summary = await getWalletSummary(userId);

    // What the credit would actually be spent on next, so the screen can say
    // "₹500 will come off your next invoice" instead of just showing a number.
    const nextInvoice = await prisma.weeklyInvoice.findFirst({
      where: { rental: { userId }, status: { in: ['PENDING', 'OVERDUE'] } },
      orderBy: { dueAt: 'asc' },
      select: { id: true, weekNumber: true, amount: true, dueAt: true, status: true },
    });

    return res.json({
      success: true,
      data: {
        ...summary,
        nextInvoice,
        appliedToNextInvoice: nextInvoice
          ? Math.min(summary.balance, nextInvoice.amount)
          : 0,
      },
    });
  } catch (error: any) {
    console.error('getMyWallet error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load wallet' });
  }
}

/* =========================================================================
   ADMIN
   ========================================================================= */

const GRANTABLE: CreditReason[] = ['PROMO', 'GOODWILL', 'REFUND', 'DAMAGE_REVERSAL', 'DEPOSIT_RETURN'];

/**
 * POST /admin/api/wallet/:userId/credit
 *
 * Grant credit to a rider. Staff-issued only; the rider has no path to add
 * money themselves. Deliberately has no matching debit endpoint — credit is
 * spent by the billing code, not clawed back by hand, so the ledger always
 * explains where it went.
 */
export async function adminCreditWallet(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { amount, reason, note } = req.body ?? {};

    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ success: false, message: 'A positive amount is required' });
    }
    if (!GRANTABLE.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `reason must be one of: ${GRANTABLE.join(', ')}`,
      });
    }

    const rider = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    });
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const { balance, transaction } = await creditWallet({
      userId,
      amount: value,
      reason,
      note: note || null,
      issuedById: req.user?.id ?? null,
    });

    await notify.walletCredited(userId, value, reason);

    return res.status(201).json({
      success: true,
      data: { balance, transaction },
      message: `₹${value.toLocaleString('en-IN')} credited to ${rider.fullName || 'rider'}`,
    });
  } catch (error: any) {
    console.error('adminCreditWallet error:', error);
    return res.status(500).json({ success: false, message: 'Failed to credit wallet' });
  }
}

/** GET /admin/api/wallet/:userId — one rider's balance and full ledger. */
export async function adminGetWallet(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.params;
    const summary = await getWalletSummary(userId, 200);
    return res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('adminGetWallet error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load wallet' });
  }
}

/**
 * GET /admin/api/wallet — every rider holding credit, plus the outstanding
 * total. Finance needs this figure: unspent credit is a real liability.
 */
export async function adminListWallets(req: AuthRequest, res: Response) {
  try {
    const wallets = await prisma.wallet.findMany({
      where: { balance: { gt: 0 } },
      orderBy: { balance: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
      },
    });

    const totalOutstanding = wallets.reduce((sum, w) => sum + w.balance, 0);

    return res.json({ success: true, data: { wallets, totalOutstanding } });
  } catch (error: any) {
    console.error('adminListWallets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list wallets' });
  }
}
