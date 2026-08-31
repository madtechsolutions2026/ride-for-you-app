import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * Operational-layer admin controller: bookings, rentals, weekly billing,
 * payments, damage and recovery. Read + the state transitions staff perform
 * from the dashboard. Rider-facing booking creation lives elsewhere.
 */

const ref = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

/* ------------------------------- BOOKINGS -------------------------------- */

// GET /admin/api/bookings?status=&search=
export async function listBookings(req: Request, res: Response) {
  try {
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim();

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search } } },
      ];
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, fullName: true, phone: true, kycStatus: true } },
        model: { select: { name: true, category: true } },
        plan: { select: { duration: true, price: true } },
        hub: { select: { name: true, city: true } },
        rental: { select: { id: true, status: true } },
        payments: { select: { id: true, purpose: true, amount: true, status: true } },
      },
    });

    return res.json({ count: bookings.length, bookings });
  } catch (e: any) {
    console.error('listBookings:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/bookings/:id/confirm  — mark a PENDING booking as paid/confirmed
export async function confirmBooking(req: Request, res: Response) {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'PENDING')
      return res.status(409).json({ error: `Booking is already ${booking.status}` });

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CONFIRMED' },
    });
    return res.json({ message: 'Booking confirmed', booking: updated });
  } catch (e: any) {
    console.error('confirmBooking:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/bookings/:id/cancel  — Body: { reason }
export async function cancelBooking(req: Request, res: Response) {
  try {
    const { reason } = req.body ?? {};
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (['HANDED_OVER', 'CANCELLED', 'EXPIRED'].includes(booking.status))
      return res.status(409).json({ error: `Cannot cancel a ${booking.status} booking` });

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason || null },
    });
    return res.json({ message: 'Booking cancelled', booking: updated });
  } catch (e: any) {
    console.error('cancelBooking:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------- RENTALS -------------------------------- */

// POST /admin/api/bookings/:id/handover  — Body: { bikeId, odometerStart? }
// Executive at the hub assigns a physical bike and starts the rental clock.
export async function handoverBike(req: AuthRequest, res: Response) {
  try {
    const { bikeId, odometerStart } = req.body ?? {};
    if (!bikeId) return res.status(400).json({ error: 'bikeId is required' });

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { plan: true, rental: true },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.rental) return res.status(409).json({ error: 'Booking already handed over' });
    if (!['CONFIRMED', 'READY'].includes(booking.status))
      return res.status(409).json({ error: `Booking must be CONFIRMED/READY, is ${booking.status}` });

    const bike = await prisma.bike.findUnique({ where: { id: bikeId } });
    if (!bike) return res.status(404).json({ error: 'Bike not found' });
    if (bike.status !== 'AVAILABLE')
      return res.status(409).json({ error: `Bike is ${bike.status}, not AVAILABLE` });

    const days = booking.plan.duration === 'WEEK' ? 7 : booking.plan.duration === 'MONTH' ? 30 : 1;
    const expectedReturnAt = new Date(Date.now() + days * 86400_000);

    const [rental] = await prisma.$transaction([
      prisma.rental.create({
        data: {
          bookingId: booking.id,
          userId: booking.userId,
          bikeId: bike.id,
          hubId: booking.hubId,
          handoverById: req.user?.id ?? null,
          odometerStart: typeof odometerStart === 'number' ? odometerStart : bike.odometerKm,
          expectedReturnAt,
        },
      }),
      prisma.bike.update({ where: { id: bike.id }, data: { status: 'RENTED' } }),
      prisma.booking.update({ where: { id: booking.id }, data: { status: 'HANDED_OVER' } }),
    ]);

    // Week-1 weekly invoice, due 7 days out.
    await prisma.weeklyInvoice.create({
      data: {
        rentalId: rental.id,
        weekNumber: 1,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 7 * 86400_000),
        amount: booking.rentAmount,
        dueAt: new Date(Date.now() + 7 * 86400_000),
      },
    });

    return res.status(201).json({ message: 'Bike handed over, rental active', rental });
  } catch (e: any) {
    console.error('handoverBike:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /admin/api/rentals?status=
export async function listRentals(req: Request, res: Response) {
  try {
    const status = String(req.query.status || '').trim();
    const where: any = status ? { status } : {};

    const rentals = await prisma.rental.findMany({
      where,
      orderBy: { handoverAt: 'desc' },
      take: 200,
      include: {
        user: { select: { fullName: true, phone: true } },
        bike: { select: { registrationNumber: true, model: { select: { name: true } } } },
        hub: { select: { name: true } },
        weeklyInvoices: {
          select: { id: true, weekNumber: true, amount: true, status: true, dueAt: true },
          orderBy: { weekNumber: 'asc' },
        },
      },
    });

    // Flag overdue on the fly.
    const now = Date.now();
    const withOverdue = rentals.map((r) => ({
      ...r,
      isOverdue:
        r.status === 'ACTIVE' &&
        (r.expectedReturnAt.getTime() < now ||
          r.weeklyInvoices.some((w) => w.status === 'PENDING' && w.dueAt.getTime() < now)),
    }));

    return res.json({ count: withOverdue.length, rentals: withOverdue });
  } catch (e: any) {
    console.error('listRentals:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/rentals/:id/return  — Body: { odometerEnd?, condition? }
export async function returnRental(req: AuthRequest, res: Response) {
  try {
    const { odometerEnd } = req.body ?? {};
    const rental = await prisma.rental.findUnique({
      where: { id: req.params.id },
      include: { bike: true },
    });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });
    if (['RETURNED', 'COMPLETED', 'RECOVERED'].includes(rental.status))
      return res.status(409).json({ error: `Rental is already ${rental.status}` });

    const [updated] = await prisma.$transaction([
      prisma.rental.update({
        where: { id: rental.id },
        data: {
          status: 'RETURNED',
          returnedAt: new Date(),
          returnById: req.user?.id ?? null,
          odometerEnd: typeof odometerEnd === 'number' ? odometerEnd : rental.bike.odometerKm,
        },
      }),
      prisma.bike.update({
        where: { id: rental.bikeId },
        data: {
          status: 'AVAILABLE',
          ...(typeof odometerEnd === 'number' ? { odometerKm: odometerEnd } : {}),
        },
      }),
    ]);

    return res.json({ message: 'Bike returned. Log any damage, then close.', rental: updated });
  } catch (e: any) {
    console.error('returnRental:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/rentals/:id/close  — settle and finish
export async function closeRental(req: Request, res: Response) {
  try {
    const rental = await prisma.rental.findUnique({
      where: { id: req.params.id },
      include: { weeklyInvoices: true, damageReports: true, booking: true },
    });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });
    if (rental.status !== 'RETURNED')
      return res.status(409).json({ error: 'Rental must be RETURNED before closing' });

    const unpaid = rental.weeklyInvoices.filter((w) => w.status === 'PENDING' || w.status === 'OVERDUE');
    const unresolvedDamage = rental.damageReports.filter((d) => d.chargeStatus === 'PENDING');
    if (unpaid.length || unresolvedDamage.length) {
      return res.status(409).json({
        error: 'Settle outstanding invoices and damage charges first',
        unpaidInvoices: unpaid.length,
        pendingDamage: unresolvedDamage.length,
      });
    }

    const [updated] = await prisma.$transaction([
      prisma.rental.update({
        where: { id: rental.id },
        data: { status: 'COMPLETED', closedAt: new Date() },
      }),
      prisma.booking.update({ where: { id: rental.bookingId }, data: { status: 'HANDED_OVER' } }),
    ]);
    return res.json({ message: 'Rental completed', rental: updated });
  } catch (e: any) {
    console.error('closeRental:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* --------------------------- WEEKLY BILLING ----------------------------- */

// GET /admin/api/invoices?status=
export async function listInvoices(req: Request, res: Response) {
  try {
    const status = String(req.query.status || '').trim();
    const where: any = status ? { status } : {};

    const invoices = await prisma.weeklyInvoice.findMany({
      where,
      orderBy: { dueAt: 'asc' },
      take: 300,
      include: {
        rental: {
          select: {
            id: true,
            status: true,
            user: { select: { fullName: true, phone: true } },
            bike: { select: { registrationNumber: true } },
          },
        },
      },
    });

    // Promote to OVERDUE in-memory for display; the cron persists it.
    const now = Date.now();
    const rows = invoices.map((i) => ({
      ...i,
      status: i.status === 'PENDING' && i.dueAt.getTime() < now ? 'OVERDUE' : i.status,
    }));

    const summary = rows.reduce(
      (a, i) => {
        if (i.status === 'PAID') a.collected += i.amount;
        else if (i.status === 'OVERDUE') a.overdue += i.amount;
        else if (i.status === 'PENDING') a.pending += i.amount;
        return a;
      },
      { collected: 0, pending: 0, overdue: 0 }
    );

    return res.json({ count: rows.length, summary, invoices: rows });
  } catch (e: any) {
    console.error('listInvoices:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/invoices/:id/mark-paid  — Body: { provider?, note? }
export async function markInvoicePaid(req: AuthRequest, res: Response) {
  try {
    const { provider, note } = req.body ?? {};
    const invoice = await prisma.weeklyInvoice.findUnique({
      where: { id: req.params.id },
      include: { rental: true },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'PAID') return res.status(409).json({ error: 'Invoice already paid' });

    await prisma.$transaction([
      prisma.weeklyInvoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date() },
      }),
      prisma.payment.create({
        data: {
          userId: invoice.rental.userId,
          weeklyInvoiceId: invoice.id,
          purpose: 'WEEKLY_RENT',
          amount: invoice.amount,
          provider: provider || 'UPI_MANUAL',
          status: 'SUCCESS',
          note: note || null,
          recordedById: req.user?.id ?? null,
        },
      }),
    ]);

    return res.json({ message: 'Invoice marked paid and payment recorded' });
  } catch (e: any) {
    console.error('markInvoicePaid:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/invoices/:id/remind  — bump the reminder counter (WhatsApp send is a later slice)
export async function sendInvoiceReminder(req: Request, res: Response) {
  try {
    const invoice = await prisma.weeklyInvoice.update({
      where: { id: req.params.id },
      data: { reminderCount: { increment: 1 }, lastReminderAt: new Date() },
      include: { rental: { select: { user: { select: { phone: true } } } } },
    });
    // TODO: dispatch WhatsApp/SMS via the notifications service.
    return res.json({
      message: `Reminder logged (#${invoice.reminderCount}) for ${invoice.rental.user.phone}`,
      invoice,
    });
  } catch (e: any) {
    console.error('sendInvoiceReminder:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------- PAYMENTS ------------------------------- */

// GET /admin/api/payments?status=&purpose=
export async function listPayments(req: Request, res: Response) {
  try {
    const status = String(req.query.status || '').trim();
    const purpose = String(req.query.purpose || '').trim();
    const where: any = {};
    if (status) where.status = status;
    if (purpose) where.purpose = purpose;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        user: { select: { fullName: true, phone: true } },
        booking: { select: { reference: true } },
      },
    });

    const totals = payments.reduce(
      (a, p) => {
        if (p.status === 'SUCCESS') a.settled += p.amount;
        if (p.status === 'INITIATED') a.pending += p.amount;
        return a;
      },
      { settled: 0, pending: 0 }
    );

    return res.json({ count: payments.length, totals, payments });
  } catch (e: any) {
    console.error('listPayments:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/payments  — record a manual/offline payment (CASH etc.)
export async function recordManualPayment(req: AuthRequest, res: Response) {
  try {
    const { userId, bookingId, purpose, amount, provider, note } = req.body ?? {};
    if (!userId || !purpose || typeof amount !== 'number')
      return res.status(400).json({ error: 'userId, purpose and numeric amount are required' });

    const payment = await prisma.payment.create({
      data: {
        userId,
        bookingId: bookingId || null,
        purpose,
        amount,
        provider: provider || 'CASH',
        status: 'SUCCESS',
        note: note || null,
        recordedById: req.user?.id ?? null,
      },
    });
    return res.status(201).json({ message: 'Payment recorded', payment });
  } catch (e: any) {
    console.error('recordManualPayment:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/payments/:id/refund  — Body: { amount?, note }  (ADMIN only)
export async function refundPayment(req: AuthRequest, res: Response) {
  try {
    const { amount, note } = req.body ?? {};
    const original = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!original) return res.status(404).json({ error: 'Payment not found' });
    if (original.status !== 'SUCCESS')
      return res.status(409).json({ error: 'Only successful payments can be refunded' });

    const refundAmount = typeof amount === 'number' ? Math.abs(amount) : original.amount;

    await prisma.$transaction([
      prisma.payment.update({ where: { id: original.id }, data: { status: 'REFUNDED' } }),
      prisma.payment.create({
        data: {
          userId: original.userId,
          bookingId: original.bookingId,
          purpose: 'REFUND',
          amount: -refundAmount,
          provider: 'ADJUSTMENT',
          status: 'SUCCESS',
          note: note || `Refund of ${original.id}`,
          recordedById: req.user?.id ?? null,
        },
      }),
    ]);
    return res.json({ message: `Refunded ₹${refundAmount}` });
  } catch (e: any) {
    console.error('refundPayment:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* --------------------------------- DAMAGE ------------------------------- */

// GET /admin/api/damage?chargeStatus=
export async function listDamage(req: Request, res: Response) {
  try {
    const chargeStatus = String(req.query.chargeStatus || '').trim();
    const where: any = chargeStatus ? { chargeStatus } : {};
    const reports = await prisma.damageReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        bike: { select: { registrationNumber: true, model: { select: { name: true } } } },
        rental: { select: { id: true, user: { select: { fullName: true, phone: true } } } },
        reportedBy: { select: { fullName: true } },
      },
    });
    return res.json({ count: reports.length, reports });
  } catch (e: any) {
    console.error('listDamage:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/rentals/:id/damage  — Body: { severity, description, estimatedCost?, photoKeys? }
export async function logDamage(req: AuthRequest, res: Response) {
  try {
    const { severity, description, estimatedCost, photoKeys } = req.body ?? {};
    if (!severity || !description)
      return res.status(400).json({ error: 'severity and description are required' });

    const rental = await prisma.rental.findUnique({ where: { id: req.params.id } });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });

    const report = await prisma.damageReport.create({
      data: {
        rentalId: rental.id,
        bikeId: rental.bikeId,
        reportedById: req.user?.id ?? null,
        severity,
        description,
        estimatedCost: typeof estimatedCost === 'number' ? estimatedCost : 0,
        photoKeys: Array.isArray(photoKeys) ? photoKeys : [],
      },
    });
    return res.status(201).json({ message: 'Damage logged', report });
  } catch (e: any) {
    console.error('logDamage:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/damage/:id/resolve  — Body: { action: 'CHARGE'|'WAIVE', finalCost? }
export async function resolveDamage(req: AuthRequest, res: Response) {
  try {
    const { action, finalCost } = req.body ?? {};
    if (action !== 'CHARGE' && action !== 'WAIVE')
      return res.status(400).json({ error: "action must be 'CHARGE' or 'WAIVE'" });

    const report = await prisma.damageReport.findUnique({
      where: { id: req.params.id },
      include: { rental: true },
    });
    if (!report) return res.status(404).json({ error: 'Damage report not found' });
    if (report.chargeStatus !== 'PENDING')
      return res.status(409).json({ error: `Already ${report.chargeStatus}` });

    if (action === 'WAIVE') {
      await prisma.damageReport.update({
        where: { id: report.id },
        data: { chargeStatus: 'WAIVED' },
      });
      return res.json({ message: 'Damage charge waived' });
    }

    const cost = typeof finalCost === 'number' ? finalCost : report.estimatedCost;
    await prisma.$transaction([
      prisma.damageReport.update({
        where: { id: report.id },
        data: { chargeStatus: 'CHARGED', estimatedCost: cost },
      }),
      prisma.payment.create({
        data: {
          userId: report.rental.userId,
          purpose: 'DAMAGE',
          amount: cost,
          provider: 'UPI_MANUAL',
          status: 'INITIATED',
          note: `Damage charge — report ${report.id}`,
          recordedById: req.user?.id ?? null,
        },
      }),
    ]);
    return res.json({ message: `Damage charge of ₹${cost} raised` });
  } catch (e: any) {
    console.error('resolveDamage:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------- RECOVERY ----------------------------- */

// GET /admin/api/recovery?status=&type=
export async function listRecovery(req: Request, res: Response) {
  try {
    const status = String(req.query.status || '').trim();
    const type = String(req.query.type || '').trim();
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const jobs = await prisma.recoveryJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        bike: { select: { registrationNumber: true } },
        rental: { select: { user: { select: { fullName: true, phone: true } } } },
        assignedTo: { select: { fullName: true } },
      },
    });
    return res.json({ count: jobs.length, jobs });
  } catch (e: any) {
    console.error('listRecovery:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/recovery  — open a job
export async function createRecovery(req: AuthRequest, res: Response) {
  try {
    const { type, description, rentalId, bikeId, reportedByPhone, locationText, lat, lng, priority } =
      req.body ?? {};
    if (!type || !description)
      return res.status(400).json({ error: 'type and description are required' });

    let resolvedBikeId = bikeId || null;
    if (!resolvedBikeId && rentalId) {
      const r = await prisma.rental.findUnique({ where: { id: rentalId } });
      resolvedBikeId = r?.bikeId ?? null;
    }

    const job = await prisma.recoveryJob.create({
      data: {
        reference: ref('REC'),
        type,
        description,
        rentalId: rentalId || null,
        bikeId: resolvedBikeId,
        reportedByPhone: reportedByPhone || null,
        locationText: locationText || null,
        lat: typeof lat === 'number' ? lat : null,
        lng: typeof lng === 'number' ? lng : null,
        priority: priority || 'NORMAL',
      },
    });
    return res.status(201).json({ message: 'Recovery job opened', job });
  } catch (e: any) {
    console.error('createRecovery:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/recovery/:id/update  — Body: { status, assignedToId?, vanLabel?, resolutionNote?, policeStation?, firNumber? }
export async function updateRecovery(req: Request, res: Response) {
  try {
    const { status, assignedToId, vanLabel, resolutionNote, policeStation, firNumber } =
      req.body ?? {};
    const job = await prisma.recoveryJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: 'Recovery job not found' });

    const data: any = {};
    if (status) {
      data.status = status;
      if (status === 'DISPATCHED') data.dispatchedAt = new Date();
      if (status === 'RESOLVED' || status === 'CLOSED') data.resolvedAt = new Date();
    }
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (vanLabel !== undefined) data.vanLabel = vanLabel;
    if (resolutionNote !== undefined) data.resolutionNote = resolutionNote;
    if (policeStation !== undefined) data.policeStation = policeStation;
    if (firNumber !== undefined) data.firNumber = firNumber;

    // A resolved theft/police job flips the rental to RECOVERED.
    if ((status === 'RESOLVED' || status === 'CLOSED') && job.rentalId) {
      await prisma.rental.updateMany({
        where: { id: job.rentalId, status: { in: ['ACTIVE', 'OVERDUE'] } },
        data: { status: 'RECOVERED' },
      });
    }

    const updated = await prisma.recoveryJob.update({ where: { id: job.id }, data });
    return res.json({ message: 'Recovery job updated', job: updated });
  } catch (e: any) {
    console.error('updateRecovery:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
