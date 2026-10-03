import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { notify } from '../utils/notifications';
import { putImage, UploadedFile } from '../utils/uploads';
import { presignGet } from '../utils/r2';

/**
 * Things a rider does *during* a live rental:
 *
 *   POST /rental/swaps                 log a battery swap from a dock QR
 *   GET  /rental/swaps                 my swap history
 *   POST /rental/requests              ask to extend, or book a return slot
 *   GET  /rental/requests              my requests and their decisions
 *   POST /rental/requests/:id/cancel   withdraw one still awaiting a decision
 *   POST /rental/damage                report damage with photos
 *
 * Every one of these is scoped to the rider's own active rental, resolved
 * server-side. The client never names a rental id, so it cannot act on
 * someone else's bike by guessing one.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const ref = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

/** The rider's live rental, or null. Shared by everything in this file. */
async function activeRentalFor(userId: string) {
  return prisma.rental.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'OVERDUE'] } },
    orderBy: { handoverAt: 'desc' },
    select: {
      id: true,
      bikeId: true,
      hubId: true,
      status: true,
      expectedReturnAt: true,
      bike: { select: { id: true, registrationNumber: true, batteryPercent: true } },
      booking: { select: { rentAmount: true, plan: { select: { duration: true } } } },
    },
  });
}

/* =========================================================================
   BATTERY SWAP
   ========================================================================= */

/**
 * POST /rental/swaps
 * Body: { code, batteryOutPercent?, batteryInPercent? }
 *
 * `code` is whatever the dock's QR encodes. We accept either a bare station
 * id or a `rfy:swap:<stationId>` URI so the printed codes can carry a scheme
 * without the app needing to know about it.
 */
export async function logBatterySwap(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const raw = String(req.body?.code || '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, message: 'Scan a dock QR code to swap' });
    }

    const rental = await activeRentalFor(userId);
    if (!rental) {
      return res.status(409).json({
        success: false,
        code: 'NO_ACTIVE_RENTAL',
        message: 'Battery swaps are only available while you have a bike on rent.',
      });
    }

    // rfy:swap:<id> | rfy:hub:<id> | <id>
    const match = /^rfy:(swap|hub):(.+)$/i.exec(raw);
    const kind = match ? match[1].toLowerCase() : null;
    const targetId = match ? match[2] : raw;

    const [station, hub] = await Promise.all([
      kind === 'hub' ? null : prisma.swapStation.findUnique({ where: { id: targetId } }),
      kind === 'swap' ? null : prisma.hub.findUnique({ where: { id: targetId } }),
    ]);

    if (!station && !hub) {
      return res.status(404).json({
        success: false,
        code: 'UNKNOWN_DOCK',
        message: "That code doesn't match any swap dock. Try scanning again.",
      });
    }
    if (station && station.status !== 'ACTIVE') {
      return res
        .status(409)
        .json({ success: false, message: `${station.name} is temporarily closed.` });
    }

    const outPercent = clampPercent(req.body?.batteryOutPercent, rental.bike.batteryPercent);
    const inPercent = clampPercent(req.body?.batteryInPercent, 100);

    const swap = await prisma.$transaction(async (tx) => {
      const created = await tx.batterySwap.create({
        data: {
          reference: ref('SWP'),
          rentalId: rental.id,
          userId,
          bikeId: rental.bikeId,
          stationId: station?.id ?? null,
          hubId: hub?.id ?? null,
          scannedCode: raw,
          batteryOutPercent: outPercent,
          batteryInPercent: inPercent,
        },
        include: {
          station: { select: { name: true, address: true } },
          hub: { select: { name: true, address: true } },
        },
      });

      // The bike now carries the battery the rider took away.
      await tx.bike.update({
        where: { id: rental.bikeId },
        data: { batteryPercent: inPercent },
      });

      return created;
    });

    const where = swap.station?.name || swap.hub?.name || 'the dock';
    void notify.batterySwapped(userId, inPercent, where);

    return res.status(201).json({ success: true, data: swap });
  } catch (error: any) {
    console.error('logBatterySwap error:', error);
    return res.status(500).json({ success: false, message: 'Failed to log the swap' });
  }
}

function clampPercent(value: unknown, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(fallback) || 0));
  return Math.max(0, Math.min(100, n));
}

/** GET /rental/swaps — the rider's swap history, newest first. */
export async function listMySwaps(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const swaps = await prisma.batterySwap.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        station: { select: { name: true, address: true } },
        hub: { select: { name: true, address: true } },
        bike: { select: { registrationNumber: true } },
      },
    });

    return res.json({
      success: true,
      data: {
        swaps,
        totalSwaps: swaps.length,
        lastSwapAt: swaps[0]?.createdAt ?? null,
      },
    });
  } catch (error: any) {
    console.error('listMySwaps error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load swap history' });
  }
}

/* =========================================================================
   EXTENSION / RETURN REQUESTS
   ========================================================================= */

/**
 * POST /rental/requests
 * Body (EXTENSION): { type: 'EXTENSION', extraWeeks, riderNote? }
 * Body (RETURN):    { type: 'RETURN', preferredSlotAt, riderNote? }
 *
 * Creates a PENDING request. Nothing about the rental moves until staff
 * approve it — approval is the only thing that shifts `expectedReturnAt`.
 */
export async function createRentalRequest(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const type = String(req.body?.type || '').toUpperCase();
    if (type !== 'EXTENSION' && type !== 'RETURN') {
      return res
        .status(400)
        .json({ success: false, message: "type must be 'EXTENSION' or 'RETURN'" });
    }

    const rental = await activeRentalFor(userId);
    if (!rental) {
      return res.status(409).json({
        success: false,
        code: 'NO_ACTIVE_RENTAL',
        message: 'You have no bike on rent right now.',
      });
    }

    // One open request of a given type at a time, so staff never see two
    // contradictory asks for the same rental.
    const open = await prisma.rentalRequest.findFirst({
      where: { rentalId: rental.id, type, status: 'PENDING' },
    });
    if (open) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_REQUESTED',
        message: `Your ${type === 'EXTENSION' ? 'extension' : 'return'} request ${open.reference} is still being reviewed.`,
        data: open,
      });
    }

    const data: any = {
      reference: ref('REQ'),
      rentalId: rental.id,
      userId,
      type,
      riderNote: req.body?.riderNote ? String(req.body.riderNote).slice(0, 500) : null,
      status: 'PENDING',
    };

    if (type === 'EXTENSION') {
      const weeks = Math.round(Number(req.body?.extraWeeks));
      if (!Number.isFinite(weeks) || weeks < 1 || weeks > 12) {
        return res
          .status(400)
          .json({ success: false, message: 'extraWeeks must be between 1 and 12' });
      }
      data.extraWeeks = weeks;
      // Quote at the rate the rider is already on, so the number they see in
      // the app is the number they will be invoiced.
      data.quotedAmount = (rental.booking?.rentAmount ?? 0) * weeks;
    } else {
      const slot = new Date(req.body?.preferredSlotAt);
      if (Number.isNaN(slot.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: 'preferredSlotAt must be a valid date/time' });
      }
      if (slot.getTime() < Date.now() - 60_000) {
        return res
          .status(400)
          .json({ success: false, message: 'Pick a return slot in the future' });
      }
      data.preferredSlotAt = slot;
      data.hubId = rental.hubId;
    }

    const request = await prisma.rentalRequest.create({
      data,
      include: { hub: { select: { name: true, address: true } } },
    });

    return res.status(201).json({
      success: true,
      data: request,
      message:
        type === 'EXTENSION'
          ? `Extension request ${request.reference} sent. We'll confirm shortly.`
          : `Return slot requested (${request.reference}). We'll confirm shortly.`,
    });
  } catch (error: any) {
    console.error('createRentalRequest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit the request' });
  }
}

/** GET /rental/requests — my extension/return requests, newest first. */
export async function listMyRentalRequests(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const requests = await prisma.rentalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { hub: { select: { name: true, address: true } } },
    });

    return res.json({ success: true, data: requests });
  } catch (error: any) {
    console.error('listMyRentalRequests error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load requests' });
  }
}

/** POST /rental/requests/:id/cancel — withdraw one still awaiting a decision. */
export async function cancelMyRentalRequest(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const result = await prisma.rentalRequest.updateMany({
      where: { id, userId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    if (result.count === 0) {
      return res.status(409).json({
        success: false,
        message: 'That request is no longer pending, so it cannot be withdrawn.',
      });
    }

    const request = await prisma.rentalRequest.findUnique({ where: { id } });
    return res.json({ success: true, data: request, message: 'Request withdrawn' });
  } catch (error: any) {
    console.error('cancelMyRentalRequest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to withdraw the request' });
  }
}

/* =========================================================================
   RIDER DAMAGE REPORT
   ========================================================================= */

/**
 * POST /rental/damage  (multipart: files[] + fields)
 * Body: { severity, description }
 *
 * Lands in the same DamageReport queue staff already work, with
 * `reportedBy` set to the rider. `estimatedCost` stays 0 and `chargeStatus`
 * PENDING — a rider self-report must never price itself.
 */
export async function reportDamage(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const severity = String(req.body?.severity || '').toUpperCase();
    const description = String(req.body?.description || '').trim();

    if (!['MINOR', 'MODERATE', 'MAJOR'].includes(severity)) {
      return res.status(400).json({
        success: false,
        message: 'severity must be MINOR, MODERATE or MAJOR',
      });
    }
    if (description.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please describe what happened in at least 10 characters',
      });
    }

    const rental = await activeRentalFor(userId);
    if (!rental) {
      return res.status(409).json({
        success: false,
        code: 'NO_ACTIVE_RENTAL',
        message: 'Damage can only be reported against a bike you currently have.',
      });
    }

    const files = ((req as any).files ?? []) as UploadedFile[];
    const photoKeys: string[] = [];
    for (const file of files.slice(0, 5)) {
      photoKeys.push(await putImage('damage', userId, file));
    }

    const report = await prisma.damageReport.create({
      data: {
        rentalId: rental.id,
        bikeId: rental.bikeId,
        reportedById: userId,
        severity,
        description: description.slice(0, 1000),
        photoKeys,
        estimatedCost: 0,
        chargeStatus: 'PENDING',
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        ...report,
        photoUrls: await Promise.all(photoKeys.map((k) => presignGet(k))),
      },
      message: 'Reported. Our team will inspect the bike and get back to you.',
    });
  } catch (error: any) {
    const status = error?.status ?? 500;
    console.error('reportDamage error:', error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? 'Failed to submit the report' : error.message,
    });
  }
}

/* =========================================================================
   ADMIN — the queue behind rider requests
   ========================================================================= */

/** GET /admin/api/rental-requests?status=&type= */
export async function adminListRentalRequests(req: AuthRequest, res: Response) {
  try {
    const { status, type } = req.query;
    const where: any = {};
    if (status) where.status = String(status);
    if (type) where.type = String(type);

    const requests = await prisma.rentalRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        hub: { select: { name: true } },
        rental: {
          select: {
            id: true,
            expectedReturnAt: true,
            status: true,
            bike: { select: { registrationNumber: true } },
            booking: { select: { reference: true, rentAmount: true } },
          },
        },
      },
    });

    const pendingCount = await prisma.rentalRequest.count({ where: { status: 'PENDING' } });

    return res.json({ success: true, data: { requests, pendingCount } });
  } catch (error: any) {
    console.error('adminListRentalRequests error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list requests' });
  }
}

/**
 * POST /admin/api/rental-requests/:id/decide
 * Body: { approve: boolean, decisionNote? }
 *
 * Approving an EXTENSION is what actually moves the rental's return date —
 * the weekly billing job then keeps invoicing for the extra weeks on its own,
 * because it bills against `expectedReturnAt`.
 */
export async function adminDecideRentalRequest(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const approve = req.body?.approve === true || req.body?.approve === 'true';
    const decisionNote = req.body?.decisionNote ? String(req.body.decisionNote).slice(0, 500) : null;

    const request = await prisma.rentalRequest.findUnique({
      where: { id },
      include: { rental: { select: { id: true, expectedReturnAt: true, status: true } } },
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'PENDING') {
      return res.status(409).json({
        success: false,
        message: `This request was already ${request.status.toLowerCase()}.`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (approve && request.type === 'EXTENSION' && request.extraWeeks) {
        const from = new Date(request.rental.expectedReturnAt);
        await tx.rental.update({
          where: { id: request.rentalId },
          data: {
            expectedReturnAt: new Date(from.getTime() + request.extraWeeks * 7 * DAY_MS),
          },
        });
      }

      return tx.rentalRequest.update({
        where: { id },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          decidedById: req.user?.id ?? null,
          decidedAt: new Date(),
          decisionNote,
        },
      });
    });

    const detail = approve
      ? request.type === 'EXTENSION'
        ? `Your rental now runs ${request.extraWeeks} more week${request.extraWeeks === 1 ? '' : 's'}.`
        : 'Bring the bike to your hub at the time you picked.'
      : decisionNote || 'Please contact support for details.';

    void notify.rentalRequestDecided(
      request.userId,
      request.type as 'EXTENSION' | 'RETURN',
      approve,
      detail,
    );

    return res.json({
      success: true,
      data: updated,
      message: approve ? 'Request approved' : 'Request rejected',
    });
  } catch (error: any) {
    console.error('adminDecideRentalRequest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record the decision' });
  }
}

/** GET /admin/api/swaps — recent battery swaps across the fleet. */
export async function adminListSwaps(req: AuthRequest, res: Response) {
  try {
    const swaps = await prisma.batterySwap.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        bike: { select: { registrationNumber: true } },
        station: { select: { name: true } },
        hub: { select: { name: true } },
      },
    });

    const since = new Date(Date.now() - 7 * DAY_MS);
    const last7Days = await prisma.batterySwap.count({ where: { createdAt: { gte: since } } });

    return res.json({ success: true, data: { swaps, last7Days } });
  } catch (error: any) {
    console.error('adminListSwaps error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list swaps' });
  }
}
