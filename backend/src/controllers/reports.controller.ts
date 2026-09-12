import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { getCache, setCache } from '../utils/cache';

/**
 * Reporting.
 *
 * The Reports screen shipped as a placeholder listing five figures it could
 * not compute, blocked on "GET /admin/api/reports/mrr". This is that endpoint.
 *
 * Everything is derived from rows that already exist — Rental, WeeklyInvoice,
 * Payment — so nothing here needs new writes anywhere else. Where a figure
 * cannot be computed honestly it is returned as null and the screen shows a
 * dash, rather than a zero that reads like a real measurement.
 */

const CACHE_KEY = 'admin:reports:mrr';
const TTL_SECONDS = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Month key like 2026-09, in the server's timezone. */
const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
  });
};

/** GET /admin/api/reports/mrr */
export async function getMrrReport(_req: Request, res: Response) {
  try {
    const cached = await getCache<any>(CACHE_KEY);
    if (cached) return res.json(cached);

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [activeRentals, invoices, payments, bikeCounts, closedRentals] = await Promise.all([
      // MRR runs off live rentals and the weekly rate each one is on.
      prisma.rental.findMany({
        where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
        select: {
          id: true,
          hubId: true,
          hub: { select: { name: true } },
          bike: { select: { model: { select: { id: true, name: true } } } },
          booking: { select: { rentAmount: true } },
        },
      }),

      prisma.weeklyInvoice.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { amount: true, status: true, dueAt: true, paidAt: true, createdAt: true },
      }),

      prisma.payment.findMany({
        where: { status: 'SUCCESS', createdAt: { gte: sixMonthsAgo } },
        select: { amount: true, purpose: true, createdAt: true },
      }),

      prisma.bike.groupBy({ by: ['status'], _count: { _all: true } }),

      prisma.rental.findMany({
        where: { status: { in: ['COMPLETED', 'RECOVERED'] }, closedAt: { gte: sixMonthsAgo } },
        select: { closedAt: true, status: true },
      }),
    ]);

    /* ---- MRR: weekly rent annualised to a month (52/12 weeks) ---- */
    const WEEKS_PER_MONTH = 52 / 12;

    const mrr = activeRentals.reduce(
      (sum, r) => sum + (r.booking?.rentAmount ?? 0) * WEEKS_PER_MONTH,
      0,
    );

    const byModel = new Map<string, { name: string; rentals: number; mrr: number }>();
    const byHub = new Map<string, { name: string; rentals: number; mrr: number }>();

    for (const r of activeRentals) {
      const monthly = (r.booking?.rentAmount ?? 0) * WEEKS_PER_MONTH;

      const modelId = r.bike?.model?.id ?? 'unknown';
      const model = byModel.get(modelId) ?? {
        name: r.bike?.model?.name ?? 'Unknown model',
        rentals: 0,
        mrr: 0,
      };
      model.rentals += 1;
      model.mrr += monthly;
      byModel.set(modelId, model);

      const hub = byHub.get(r.hubId) ?? { name: r.hub?.name ?? 'Unknown hub', rentals: 0, mrr: 0 };
      hub.rentals += 1;
      hub.mrr += monthly;
      byHub.set(r.hubId, hub);
    }

    /* ---- Collection: invoices raised vs settled, by month ---- */
    const months: string[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }

    const collection = months.map((key) => {
      const raisedRows = invoices.filter((inv) => monthKey(new Date(inv.createdAt)) === key);
      const raised = raisedRows.reduce((s, inv) => s + inv.amount, 0);
      const settled = raisedRows
        .filter((inv) => inv.status === 'PAID')
        .reduce((s, inv) => s + inv.amount, 0);

      const collected = payments
        .filter((p) => monthKey(new Date(p.createdAt)) === key && p.amount > 0)
        .reduce((s, p) => s + p.amount, 0);

      return {
        month: key,
        label: monthLabel(key),
        raised,
        settled,
        collected,
        rate: raised > 0 ? Math.round((settled / raised) * 100) : null,
      };
    });

    /* ---- Overdue ageing ---- */
    const overdue = invoices.filter(
      (inv) =>
        (inv.status === 'OVERDUE' || inv.status === 'PENDING') &&
        new Date(inv.dueAt).getTime() < now.getTime(),
    );

    const bucket = (days: number) => {
      const rows = overdue.filter((inv) => {
        const late = (now.getTime() - new Date(inv.dueAt).getTime()) / DAY_MS;
        if (days === 7) return late <= 7;
        if (days === 30) return late > 7 && late <= 30;
        return late > 30;
      });
      return { count: rows.length, amount: rows.reduce((s, inv) => s + inv.amount, 0) };
    };

    const ageing = {
      upTo7Days: bucket(7),
      upTo30Days: bucket(30),
      over30Days: bucket(31),
      total: { count: overdue.length, amount: overdue.reduce((s, i) => s + i.amount, 0) },
    };

    /* ---- Fleet utilisation ---- */
    const countOf = (status: string) =>
      bikeCounts.find((b) => b.status === status)?._count._all ?? 0;

    const totalBikes = bikeCounts.reduce((s, b) => s + b._count._all, 0);
    const utilisation = {
      total: totalBikes,
      rented: countOf('RENTED'),
      available: countOf('AVAILABLE'),
      reserved: countOf('RESERVED'),
      maintenance: countOf('MAINTENANCE'),
      rentedShare: totalBikes > 0 ? Math.round((countOf('RENTED') / totalBikes) * 100) : null,
    };

    /* ---- Churn: rentals closed per month ---- */
    const churn = months.map((key) => {
      const rows = closedRentals.filter(
        (r) => r.closedAt && monthKey(new Date(r.closedAt)) === key,
      );
      return {
        month: key,
        label: monthLabel(key),
        closed: rows.length,
        recovered: rows.filter((r) => r.status === 'RECOVERED').length,
      };
    });

    const payload = {
      mrr: {
        value: Math.round(mrr),
        activeRentals: activeRentals.length,
        arpu: activeRentals.length > 0 ? Math.round(mrr / activeRentals.length) : null,
        note: 'Weekly rent on live rentals, scaled by 52/12 weeks per month.',
      },
      byModel: [...byModel.values()]
        .map((m) => ({ ...m, mrr: Math.round(m.mrr) }))
        .sort((a, b) => b.mrr - a.mrr),
      byHub: [...byHub.values()]
        .map((h) => ({ ...h, mrr: Math.round(h.mrr) }))
        .sort((a, b) => b.mrr - a.mrr),
      collection,
      ageing,
      utilisation,
      churn,
      generatedAt: now.toISOString(),
    };

    await setCache(CACHE_KEY, payload, TTL_SECONDS);
    return res.json(payload);
  } catch (error: any) {
    console.error('Error in getMrrReport:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /admin/api/settings/integrations
 *
 * Which third-party services this deployment actually has credentials for.
 * The Settings screen previously listed five integrations and showed every one
 * as "Not reported" with a note that the endpoint did not exist.
 *
 * Reports configuration only — presence of the environment variables. It never
 * returns a key, and it deliberately does not call out to the providers: a
 * dashboard page load is the wrong place to spend a network round trip on
 * each vendor.
 */
export async function getIntegrationStatus(_req: Request, res: Response) {
  const has = (...names: string[]) => names.every((n) => Boolean(process.env[n]));

  return res.json({
    paymentsMode: (process.env.PAYMENTS_MODE || 'stub').toLowerCase(),
    integrations: [
      {
        name: 'PhonePe',
        purpose: 'Primary payment gateway',
        env: 'PHONEPE_*',
        configured: has('PHONEPE_MERCHANT_ID', 'PHONEPE_SALT_KEY'),
      },
      {
        name: 'Razorpay',
        purpose: 'Fallback payment gateway',
        env: 'RAZORPAY_*',
        configured: has('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'),
      },
      {
        name: 'Way2Chats',
        purpose: 'WhatsApp OTP and rent reminders',
        env: 'WAY2CHATS_API_KEY',
        configured: has('WAY2CHATS_API_KEY'),
      },
      {
        name: 'Cloudflare R2',
        purpose: 'KYC document and image storage',
        env: 'R2_*',
        configured: has('R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'),
      },
      {
        name: 'Redis',
        purpose: 'Stats and session caching',
        env: 'REDIS_URL',
        configured: has('REDIS_URL'),
      },
      {
        name: 'Expo Push',
        purpose: 'Rider mobile notifications',
        env: '—',
        // Expo authenticates by the device token itself, so there is nothing
        // to configure server-side; it is available whenever riders register.
        configured: true,
      },
    ],
  });
}
