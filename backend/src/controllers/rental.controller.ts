import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { publicUrl } from '../utils/r2';
import { getCache, setCache } from '../utils/cache';
import { notify } from '../utils/notifications';

/**
 * Rental discovery module — RIDER, read-only.
 *
 *   GET /rental/hub            the single pickup point + live availability
 *   GET /rental/swap-stations  battery-swap map pins (SWAP riders)
 *   GET /rental/bikes          the bike list for one category, grouped by model
 *   GET /rental/bikes/:modelId one model, full detail
 *
 * These endpoints only ever READ. `bike.status` is reflected back as an
 * `availableCount`; the rider ↔ bike link (who booked what) belongs to the
 * booking slice, not here.
 *
 * Model images live in the PUBLIC R2 bucket as `imageKey`; responses return a
 * stable CDN URL via publicUrl() (or null when the public bucket is unset / no
 * image — the app falls back to its bundled artwork).
 */

const CATEGORIES = ['SWAP', 'HOME'] as const;
type Category = (typeof CATEGORIES)[number];

const DURATION_ORDER: Record<string, number> = { DAY: 0, WEEK: 1, MONTH: 2 };

/** Great-circle distance in metres. Good enough for a handful of city hubs. */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Current HH:MM in Asia/Kolkata. */
function nowHHMM(): string {
  return new Date()
    .toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })
    .slice(0, 5);
}

/** Is a place with these opening hours open right now? Unknown hours => open. */
function computeIsOpen(openTime?: string | null, closeTime?: string | null): boolean {
  if (!openTime || !closeTime) return true;
  const now = nowHHMM();
  if (closeTime > openTime) return now >= openTime && now < closeTime;
  // Wraps past midnight (e.g. 22:00–06:00)
  return now >= openTime || now < closeTime;
}

function operatingHours(openTime?: string | null, closeTime?: string | null): string | null {
  return openTime && closeTime ? `${openTime}-${closeTime}` : null;
}

function serializePlan(p: any) {
  return {
    duration: p.duration,
    price: p.price,
    deposit: p.deposit,
    kmLimit: p.kmLimit ?? null,
  };
}

/**
 * Shape a BikeModel (with its `plans` and `bikes` included) for an API response.
 * `detail` adds the fields only the model screen needs.
 */
async function serializeModel(
  model: any,
  opts: { detail: boolean; swapStationsCount?: number }
) {
  const availableCount = (model.bikes ?? []).filter(
    (b: any) => b.status === 'AVAILABLE'
  ).length;

  const plans = (model.plans ?? [])
    .filter((p: any) => p.status === 'ACTIVE')
    .sort(
      (a: any, b: any) =>
        (DURATION_ORDER[a.duration] ?? 99) - (DURATION_ORDER[b.duration] ?? 99)
    )
    .map(serializePlan);

  const imageUrl = publicUrl(model.imageKey);

  const base: Record<string, any> = {
    modelId: model.id,
    name: model.name,
    category: model.category,
    imageUrl,
    rangeKm: model.rangeKm,
    topSpeedKmph: model.topSpeedKmph,
    requiresLicense: model.requiresLicense,
    chargerIncluded: model.chargerIncluded,
    plans,
    availableCount,
  };

  if (!opts.detail) return base;

  // Every physical unit of this model, healthiest-available first. The rider
  // still gets a specific bike only at handover, but the plates are public
  // info and the list makes `availableCount` transparent on the detail screen.
  const units = [...(model.bikes ?? [])]
    .sort((a: any, b: any) => {
      const rank = (s: string) => (s === 'AVAILABLE' ? 0 : 1);
      return rank(a.status) - rank(b.status) || (b.batteryPercent ?? 0) - (a.batteryPercent ?? 0);
    })
    .map((b: any) => ({
      registrationNumber: b.registrationNumber,
      colour: b.colour ?? null,
      batteryPercent: b.batteryPercent ?? null,
      status: b.status,
    }));

  // Representative unit: the healthiest available one (drives estimated range).
  const repUnit = units.find((u) => u.status === 'AVAILABLE') ?? null;
  const battery = repUnit?.batteryPercent || 100;

  return {
    ...base,
    images: imageUrl ? [imageUrl] : [],
    estimatedRangeKm: Math.round((model.rangeKm * battery) / 100),
    registrationNumber: repUnit?.registrationNumber ?? null, // representative unit; final unit assigned at handover
    units,
    returnPolicy: 'SAME_HUB',
    ...(model.category === 'SWAP'
      ? { swapStationsCount: opts.swapStationsCount ?? 0 }
      : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* GET /rental/hub                                                             */
/* -------------------------------------------------------------------------- */

export async function listHubs(req: AuthRequest, res: Response) {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng);

    const hubs = await prisma.hub.findMany({
      where: { status: 'ACTIVE' },
      include: {
        bikes: {
          where: { status: 'AVAILABLE' },
          select: { model: { select: { category: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let list = hubs.map((h) => {
      const availableByCategory: Record<Category, number> = { SWAP: 0, HOME: 0 };
      for (const b of h.bikes) {
        const c = b.model?.category as Category;
        if (c in availableByCategory) availableByCategory[c] += 1;
      }

      return {
        id: h.id,
        name: h.name,
        address: h.address,
        lat: h.lat,
        lng: h.lng,
        city: h.city,
        isOpen: computeIsOpen(h.openTime, h.closeTime),
        operatingHours: operatingHours(h.openTime, h.closeTime),
        contactPhone: h.contactPhone,
        availableByCategory,
        totalAvailable: availableByCategory.SWAP + availableByCategory.HOME,
        ...(hasOrigin
          ? { distanceMeters: Math.round(haversineMeters(lat, lng, h.lat, h.lng)) }
          : {}),
      };
    });

    if (hasOrigin) {
      list = list.sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);
    }

    return res.json({ count: list.length, hubs: list });
  } catch (error: any) {
    console.error('Error in listHubs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getHub(_req: AuthRequest, res: Response) {
  try {
    const cacheKey = 'rental:hub';
    const cached = await getCache<any>(cacheKey);
    if (cached) return res.json(cached);

    const hub = await prisma.hub.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (!hub) return res.status(404).json({ error: 'No active hub configured' });

    const bikes = await prisma.bike.findMany({
      where: { hubId: hub.id, status: 'AVAILABLE' },
      select: { model: { select: { category: true } } },
    });

    const availableByCategory: Record<Category, number> = { SWAP: 0, HOME: 0 };
    for (const b of bikes) {
      const c = b.model?.category as Category;
      if (c in availableByCategory) availableByCategory[c] += 1;
    }

    const payload = {
      id: hub.id,
      name: hub.name,
      address: hub.address,
      lat: hub.lat,
      lng: hub.lng,
      city: hub.city,
      isOpen: computeIsOpen(hub.openTime, hub.closeTime),
      operatingHours: operatingHours(hub.openTime, hub.closeTime),
      contactPhone: hub.contactPhone,
      availableByCategory,
    };

    await setCache(cacheKey, payload, 60);
    return res.json(payload);
  } catch (error: any) {
    console.error('Error in getHub:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* GET /rental/swap-stations                                                   */
/* -------------------------------------------------------------------------- */

export async function listSwapStations(req: AuthRequest, res: Response) {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng);

    const cacheKey = 'rental:swap-stations';
    let stations = await getCache<any[]>(cacheKey);
    if (!stations) {
      stations = await prisma.swapStation.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      await setCache(cacheKey, stations, 60);
    }

    let list = stations.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      isOpen: computeIsOpen(s.openTime, s.closeTime),
      operatingHours: operatingHours(s.openTime, s.closeTime),
      ...(hasOrigin
        ? { distanceMeters: Math.round(haversineMeters(lat, lng, s.lat, s.lng)) }
        : {}),
    }));

    if (hasOrigin) {
      list = list.sort(
        (a: any, b: any) => a.distanceMeters - b.distanceMeters
      );
    }

    return res.json({ count: list.length, stations: list });
  } catch (error: any) {
    console.error('Error in listSwapStations:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* GET /rental/bikes?category=SWAP|HOME                                        */
/* -------------------------------------------------------------------------- */

export async function listBikes(req: AuthRequest, res: Response) {
  try {
    const category = String(req.query.category || '').toUpperCase() as Category;
    if (!CATEGORIES.includes(category)) {
      return res
        .status(400)
        .json({ error: 'category is required (SWAP or HOME)' });
    }

    const sort = String(req.query.sort || 'priceLow');

    const models = await prisma.bikeModel.findMany({
      where: { category, status: 'ACTIVE' },
      include: {
        plans: true,
        bikes: { select: { status: true, batteryPercent: true } },
      },
    });

    let bikes = await Promise.all(
      models.map((m) => serializeModel(m, { detail: false }))
    );

    const minPrice = (b: any) =>
      b.plans.length ? Math.min(...b.plans.map((p: any) => p.price)) : Infinity;

    if (sort === 'range') {
      bikes.sort((a, b) => b.rangeKm - a.rangeKm);
    } else if (sort === 'topSpeed') {
      bikes.sort((a, b) => b.topSpeedKmph - a.topSpeedKmph);
    } else {
      bikes.sort((a, b) => minPrice(a) - minPrice(b));
    }

    return res.json({
      category,
      count: bikes.length,
      bikes,
    });
  } catch (error: any) {
    console.error('Error in listBikes:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* GET /rental/bikes/:modelId                                                  */
/* -------------------------------------------------------------------------- */

export async function getBikeModel(req: AuthRequest, res: Response) {
  try {
    const model = await prisma.bikeModel.findUnique({
      where: { id: req.params.modelId },
      include: { plans: true, bikes: true },
    });
    if (!model || model.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Model not found' });
    }

    let swapStationsCount = 0;
    if (model.category === 'SWAP') {
      swapStationsCount = await prisma.swapStation.count({
        where: { status: 'ACTIVE' },
      });
    }

    const payload = await serializeModel(model, {
      detail: true,
      swapStationsCount,
    });

    return res.json(payload);
  } catch (error: any) {
    console.error('Error in getBikeModel:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* Rider bookings + payment                                                    */
/*                                                                            */
/*  POST /rental/bookings            create a PENDING booking (KYC-gated)      */
/*  GET  /rental/bookings            my bookings, newest first                 */
/*  GET  /rental/bookings/:id        one booking, full detail + payments       */
/*  POST /rental/bookings/:id/pay    dummy payment -> booking CONFIRMED        */
/*  POST /rental/bookings/:id/cancel rider cancels their own PENDING booking   */
/*                                                                            */
/* A rider may only book once KYC is APPROVED. This is enforced here on the    */
/* server, not just hidden in the app. Payment is a stub for V1 (no real       */
/* gateway) but writes real Payment rows so the admin ledger + weekly billing  */
/* keep working.                                                               */
/* -------------------------------------------------------------------------- */

const PLATFORM_FEE = 1500; // one-time, non-refundable (matches the app + admin)

const bookingRef = () =>
  `RFY-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

// The app sends a friendly method name; we store the canonical provider string.
const PROVIDER_BY_METHOD: Record<string, string> = {
  PHONEPE: 'PHONEPE',
  RAZORPAY: 'RAZORPAY',
  UPI: 'UPI_MANUAL',
  CARD: 'RAZORPAY',
};

const OPEN_BOOKING_STATES = ['PENDING', 'CONFIRMED', 'READY'];

/** How long an unpaid booking keeps its bike off the shelf. */
export const BOOKING_HOLD_MS = 30 * 60 * 1000;

/**
 * Take one AVAILABLE unit of this model out of circulation, atomically.
 *
 * `updateMany` with the status in the WHERE clause is the lock: Postgres
 * serialises the row update, so of two concurrent callers exactly one gets
 * `count: 1` and the other gets `0` and moves to the next candidate.
 */
async function reserveUnitForModel(modelId: string, hubId: string) {
  const candidates = await prisma.bike.findMany({
    where: { modelId, status: 'AVAILABLE' },
    // Same hub first so the rider collects where they expect to.
    orderBy: [{ hubId: hubId ? 'asc' : 'asc' }, { batteryPercent: 'desc' }],
    select: { id: true, hubId: true, registrationNumber: true },
  });

  const ordered = [
    ...candidates.filter((b) => b.hubId === hubId),
    ...candidates.filter((b) => b.hubId !== hubId),
  ];

  for (const bike of ordered) {
    const claimed = await prisma.bike.updateMany({
      where: { id: bike.id, status: 'AVAILABLE' },
      data: { status: 'RESERVED' },
    });
    if (claimed.count === 1) return bike;
  }
  return null;
}

/** Put a reserved unit back on the shelf. Safe to call on an already-free bike. */
async function releaseUnit(bikeId: string | null | undefined) {
  if (!bikeId) return;
  await prisma.bike.updateMany({
    where: { id: bikeId, status: 'RESERVED' },
    data: { status: 'AVAILABLE' },
  });
}

const BOOKING_INCLUDE = {
  model: true,
  plan: true,
  hub: true,
  payments: { orderBy: { createdAt: 'asc' as const } },
  rental: { include: { bike: { select: { registrationNumber: true } } } },
};

/** Shape one booking for the app (rider-facing — no staff-only fields). */
function serializeBooking(b: any) {
  return {
    id: b.id,
    reference: b.reference,
    status: b.status,
    createdAt: b.createdAt,
    startsAt: b.startsAt ?? null,
    cancelledAt: b.cancelledAt ?? null,
    model: b.model
      ? {
          modelId: b.model.id,
          name: b.model.name,
          category: b.model.category,
          imageUrl: publicUrl(b.model.imageKey),
        }
      : null,
    plan: b.plan
      ? {
          duration: b.plan.duration,
          price: b.plan.price,
          deposit: b.plan.deposit,
          kmLimit: b.plan.kmLimit ?? null,
        }
      : null,
    hub: b.hub
      ? {
          id: b.hub.id,
          name: b.hub.name,
          address: b.hub.address,
          lat: b.hub.lat,
          lng: b.hub.lng,
          contactPhone: b.hub.contactPhone ?? null,
          operatingHours: operatingHours(b.hub.openTime, b.hub.closeTime),
        }
      : null,
    charges: {
      rent: b.rentAmount,
      deposit: b.depositAmount,
      platformFee: b.platformFee,
      total: b.totalAmount,
    },
    nominee:
      b.nomineeName || b.nomineePhone
        ? {
            name: b.nomineeName ?? null,
            relation: b.nomineeRelation ?? null,
            phone: b.nomineePhone ?? null,
          }
        : null,
    consent: b.consentAcceptedAt
      ? { acceptedAt: b.consentAcceptedAt, language: b.consentLanguage ?? null }
      : null,
    payments: (b.payments ?? []).map((p: any) => ({
      id: p.id,
      purpose: p.purpose,
      amount: p.amount,
      provider: p.provider,
      status: p.status,
      createdAt: p.createdAt,
    })),
    amountPaid: (b.payments ?? [])
      .filter((p: any) => p.status === 'SUCCESS' && p.amount > 0)
      .reduce((s: number, p: any) => s + p.amount, 0),
    rental: b.rental
      ? {
          id: b.rental.id,
          status: b.rental.status,
          expectedReturnAt: b.rental.expectedReturnAt ?? null,
          bikeRegistration: b.rental.bike?.registrationNumber ?? null,
        }
      : null,
  };
}

// POST /rental/bookings
// Body: { modelId, duration?, nomineeName?, nomineeRelation?, nomineePhone?,
//         consentAccepted?, consentLanguage? }
export async function createBooking(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, accountStatus: true, fullName: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.accountStatus !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Your account is not active. Please contact support.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // --- KYC gate: the whole point of this slice ---
    if (user.kycStatus !== 'APPROVED') {
      const msg =
        user.kycStatus === 'SUBMITTED'
          ? 'Your KYC is under review. You can book a bike once it is approved.'
          : user.kycStatus === 'REJECTED'
          ? 'Your KYC was rejected. Please re-submit your documents to book.'
          : 'Complete your KYC verification to book a bike.';
      return res
        .status(403)
        .json({ error: msg, code: 'KYC_REQUIRED', kycStatus: user.kycStatus });
    }

    const {
      modelId,
      hubId,
      nomineeName,
      nomineeRelation,
      nomineePhone,
      consentAccepted,
      consentLanguage,
    } = req.body ?? {};
    const duration = String(req.body?.duration || 'WEEK').toUpperCase();
    if (!modelId) return res.status(400).json({ error: 'modelId is required' });

    const model = await prisma.bikeModel.findUnique({
      where: { id: modelId },
      include: { plans: true, bikes: { select: { status: true } } },
    });
    if (!model || model.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'That bike is not available' });
    }

    const plan =
      model.plans.find((p) => p.duration === duration && p.status === 'ACTIVE') ||
      model.plans.find((p) => p.status === 'ACTIVE');
    if (!plan) return res.status(409).json({ error: 'No active rental plan for this bike' });

    // Prefer the hub the rider picked; fall back to the first active hub.
    const hub =
      (hubId
        ? await prisma.hub.findFirst({ where: { id: String(hubId), status: 'ACTIVE' } })
        : null) ||
      (await prisma.hub.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }));
    if (!hub) return res.status(409).json({ error: 'No active pickup hub is configured' });

    // One open booking per rider at a time keeps V1 simple.
    const openBooking = await prisma.booking.findFirst({
      where: { userId, status: { in: OPEN_BOOKING_STATES } },
      include: BOOKING_INCLUDE,
    });
    if (openBooking) {
      return res.status(409).json({
        error: 'You already have a booking in progress. Finish or cancel it first.',
        code: 'BOOKING_EXISTS',
        booking: serializeBooking(openBooking),
      });
    }

    // --- reserve an actual unit ------------------------------------------
    // Checking a count is not enough: two riders can both read "1 available"
    // and both get a booking with no bike behind it. Flip one bike's status
    // conditionally instead — updateMany reports how many rows it matched, so
    // only the request that actually won the row proceeds.
    const reserved = await reserveUnitForModel(model.id, hub.id);
    if (!reserved) {
      return res.status(409).json({
        error: 'That bike was just taken. Pick another one — availability updates live.',
        code: 'NO_UNIT_AVAILABLE',
      });
    }

    const rentAmount = plan.price;
    const depositAmount = plan.deposit;
    const totalAmount = rentAmount + depositAmount + PLATFORM_FEE;

    let booking;
    try {
      booking = await prisma.booking.create({
        data: {
          reference: bookingRef(),
          userId,
          modelId: model.id,
          planId: plan.id,
          hubId: hub.id,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + BOOKING_HOLD_MS),
          reservedBikeId: reserved.id,
          rentAmount,
          depositAmount,
          platformFee: PLATFORM_FEE,
          totalAmount,
          nomineeName: nomineeName ? String(nomineeName).trim() : null,
          nomineeRelation: nomineeRelation ? String(nomineeRelation).trim() : null,
          nomineePhone: nomineePhone ? String(nomineePhone).trim() : null,
          consentAcceptedAt: consentAccepted ? new Date() : null,
          consentLanguage: consentAccepted
            ? String(consentLanguage || 'EN').toUpperCase()
            : null,
        },
        include: BOOKING_INCLUDE,
      });
    } catch (e) {
      // Never strand a reserved bike if the booking row failed to write.
      await releaseUnit(reserved.id).catch(() => {});
      throw e;
    }

    return res.status(201).json({
      message: 'Booking created. Complete payment to confirm.',
      booking: serializeBooking(booking),
    });
  } catch (error: any) {
    console.error('Error in createBooking:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /rental/bookings
export async function listMyBookings(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const bookings = await prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: BOOKING_INCLUDE,
    });

    return res.json({
      count: bookings.length,
      bookings: bookings.map(serializeBooking),
    });
  } catch (error: any) {
    console.error('Error in listMyBookings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /rental/bookings/:id
export async function getMyBooking(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    return res.json({ booking: serializeBooking(booking) });
  } catch (error: any) {
    console.error('Error in getMyBooking:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /rental/bookings/:id/pay   Body: { method: 'PHONEPE'|'RAZORPAY'|'UPI'|'CARD' }
//
// Dummy payment for V1. No gateway call — it succeeds immediately, writes the
// RENT / DEPOSIT / PLATFORM_FEE Payment rows, then moves the booking to
// CONFIRMED so an executive can hand the bike over.
export async function payBooking(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const method = String(req.body?.method || 'UPI').toUpperCase();
    const provider = PROVIDER_BY_METHOD[method] || 'UPI_MANUAL';

    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId },
      include: { payments: true },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') {
      return res
        .status(409)
        .json({ error: `This booking is ${booking.status.toLowerCase()}.` });
    }
    if (booking.status !== 'PENDING') {
      // Already paid — treat as an idempotent success.
      const full = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: BOOKING_INCLUDE,
      });
      return res.json({
        message: 'Booking already confirmed',
        booking: serializeBooking(full),
      });
    }

    const txnRef = `DUMMY-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const rows: { purpose: string; amount: number }[] = [
      { purpose: 'RENT', amount: booking.rentAmount },
      ...(booking.depositAmount > 0
        ? [{ purpose: 'DEPOSIT', amount: booking.depositAmount }]
        : []),
      { purpose: 'PLATFORM_FEE', amount: booking.platformFee },
    ];

    await prisma.$transaction([
      ...rows.map((r) =>
        prisma.payment.create({
          data: {
            userId,
            bookingId: booking.id,
            purpose: r.purpose,
            amount: r.amount,
            provider,
            providerPaymentId: txnRef,
            status: 'SUCCESS',
            note: 'Test payment (no gateway wired in V1)',
          },
        })
      ),
      prisma.booking.update({
        where: { id: booking.id },
        // Paid bookings never expire — the hold is now firm until handover.
        data: { status: 'CONFIRMED', expiresAt: null },
      }),
    ]);

    const full = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: BOOKING_INCLUDE,
    });

    if (full) {
      void notify.bookingConfirmed(userId, full.reference, full.hub?.name ?? 'the hub');
    }

    return res.json({
      message: 'Payment successful. Your booking is confirmed.',
      transactionId: txnRef,
      booking: serializeBooking(full),
    });
  } catch (error: any) {
    console.error('Error in payBooking:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /rental/bookings/:id/cancel
export async function cancelMyBooking(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      return res.status(409).json({
        error: `A ${booking.status.toLowerCase()} booking can't be cancelled from the app.`,
      });
    }

    // Hand the reserved unit straight back so the next rider can take it.
    await releaseUnit(booking.reservedBikeId);

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Cancelled by rider',
        reservedBikeId: null,
      },
      include: BOOKING_INCLUDE,
    });
    return res.json({
      message: 'Booking cancelled',
      booking: serializeBooking(updated),
    });
  } catch (error: any) {
    console.error('Error in cancelMyBooking:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* Rider rentals + weekly rent                                                 */
/*                                                                            */
/*  GET  /rental/rentals            every rental I've had, newest first        */
/*  GET  /rental/rentals/active     the live one (or null) — drives Home       */
/*  POST /rental/invoices/:id/pay   settle one week's rent                     */
/*                                                                            */
/* A weekly rental is a recurring obligation, so the rider needs the same      */
/* ledger the dashboard has: what each week cost, what's paid, what's next.    */
/* -------------------------------------------------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

const RENTAL_INCLUDE = {
  bike: {
    select: {
      registrationNumber: true,
      colour: true,
      batteryPercent: true,
      model: { select: { name: true, category: true, imageKey: true } },
    },
  },
  hub: true,
  booking: { select: { reference: true, depositAmount: true, plan: { select: { duration: true } } } },
  weeklyInvoices: { orderBy: { weekNumber: 'asc' as const } },
  damageReports: {
    select: { id: true, severity: true, description: true, estimatedCost: true, chargeStatus: true },
  },
};

/** An invoice past its due date is overdue even if the sweep hasn't run yet. */
function effectiveInvoiceStatus(inv: any, now: number): string {
  if (inv.status === 'PENDING' && new Date(inv.dueAt).getTime() < now) return 'OVERDUE';
  return inv.status;
}

function serializeRental(r: any) {
  const now = Date.now();

  const weeks = (r.weeklyInvoices ?? []).map((w: any) => {
    const status = effectiveInvoiceStatus(w, now);
    const dueMs = new Date(w.dueAt).getTime();
    return {
      id: w.id,
      weekNumber: w.weekNumber,
      periodStart: w.periodStart,
      periodEnd: w.periodEnd,
      amount: w.amount,
      status,
      dueAt: w.dueAt,
      paidAt: w.paidAt ?? null,
      // negative = overdue by that many days
      daysUntilDue: Math.ceil((dueMs - now) / DAY_MS),
      payable: status === 'PENDING' || status === 'OVERDUE',
    };
  });

  const unpaid = weeks.filter((w: any) => w.payable);
  const nextDue = unpaid.sort((a: any, b: any) => a.daysUntilDue - b.daysUntilDue)[0] ?? null;

  const totalBilled = weeks.reduce((s: number, w: any) => s + w.amount, 0);
  const totalPaid = weeks
    .filter((w: any) => w.status === 'PAID')
    .reduce((s: number, w: any) => s + w.amount, 0);
  const outstanding = unpaid.reduce((s: number, w: any) => s + w.amount, 0);

  const expectedMs = r.expectedReturnAt ? new Date(r.expectedReturnAt).getTime() : null;
  const isLive = r.status === 'ACTIVE' || r.status === 'OVERDUE';

  const pendingDamage = (r.damageReports ?? []).filter((d: any) => d.chargeStatus === 'PENDING');

  return {
    id: r.id,
    status: r.status,
    isOverdue:
      isLive && (outstanding > 0 ? unpaid.some((w: any) => w.status === 'OVERDUE') : false),
    reference: r.booking?.reference ?? null,
    plan: r.booking?.plan?.duration ?? null,

    bike: r.bike
      ? {
          registrationNumber: r.bike.registrationNumber,
          colour: r.bike.colour ?? null,
          batteryPercent: r.bike.batteryPercent ?? null,
          modelName: r.bike.model?.name ?? null,
          category: r.bike.model?.category ?? null,
          imageUrl: publicUrl(r.bike.model?.imageKey),
        }
      : null,

    hub: r.hub
      ? {
          id: r.hub.id,
          name: r.hub.name,
          address: r.hub.address,
          lat: r.hub.lat,
          lng: r.hub.lng,
          contactPhone: r.hub.contactPhone ?? null,
          operatingHours: operatingHours(r.hub.openTime, r.hub.closeTime),
        }
      : null,

    handoverAt: r.handoverAt,
    expectedReturnAt: r.expectedReturnAt ?? null,
    returnedAt: r.returnedAt ?? null,
    closedAt: r.closedAt ?? null,
    daysRemaining: expectedMs && isLive ? Math.ceil((expectedMs - now) / DAY_MS) : null,

    weeks,
    summary: {
      weeksBilled: weeks.length,
      totalBilled,
      totalPaid,
      outstanding,
      depositHeld: r.booking?.depositAmount ?? 0,
      nextDue: nextDue
        ? {
            invoiceId: nextDue.id,
            weekNumber: nextDue.weekNumber,
            amount: nextDue.amount,
            dueAt: nextDue.dueAt,
            daysUntilDue: nextDue.daysUntilDue,
            status: nextDue.status,
          }
        : null,
    },

    damage: pendingDamage.map((d: any) => ({
      id: d.id,
      severity: d.severity,
      description: d.description,
      estimatedCost: d.estimatedCost,
    })),
  };
}

// GET /rental/rentals — full history, newest first
export async function listMyRentals(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rentals = await prisma.rental.findMany({
      where: { userId },
      orderBy: { handoverAt: 'desc' },
      include: RENTAL_INCLUDE,
    });

    return res.json({ count: rentals.length, rentals: rentals.map(serializeRental) });
  } catch (error: any) {
    console.error('Error in listMyRentals:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /rental/rentals/active — the one the rider is on right now, or null.
// This is what the Home screen's "Active Ride" card polls.
export async function getActiveRental(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rental = await prisma.rental.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'OVERDUE', 'RETURNED'] } },
      orderBy: { handoverAt: 'desc' },
      include: RENTAL_INCLUDE,
    });

    return res.json({ rental: rental ? serializeRental(rental) : null });
  } catch (error: any) {
    console.error('Error in getActiveRental:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /rental/invoices/:id/pay   Body: { method }
//
// Same stub as booking payment — no gateway yet, but it writes a real
// WEEKLY_RENT Payment row so the admin ledger and collections stay truthful.
export async function payWeeklyInvoice(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const method = String(req.body?.method || 'UPI').toUpperCase();
    const provider = PROVIDER_BY_METHOD[method] || 'UPI_MANUAL';

    const invoice = await prisma.weeklyInvoice.findUnique({
      where: { id: req.params.id },
      include: { rental: { select: { id: true, userId: true, status: true } } },
    });

    if (!invoice || invoice.rental.userId !== userId) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (invoice.status === 'PAID') {
      return res.status(409).json({ error: 'This week is already paid', code: 'ALREADY_PAID' });
    }
    if (invoice.status === 'WAIVED') {
      return res.status(409).json({ error: 'This week was waived — nothing to pay' });
    }

    const txnRef = `DUMMY-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    await prisma.$transaction([
      prisma.weeklyInvoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date() },
      }),
      prisma.payment.create({
        data: {
          userId,
          weeklyInvoiceId: invoice.id,
          purpose: 'WEEKLY_RENT',
          amount: invoice.amount,
          provider,
          providerPaymentId: txnRef,
          status: 'SUCCESS',
          note: `Week ${invoice.weekNumber} rent (test payment — no gateway in V1)`,
        },
      }),
    ]);

    // Lift the rental out of OVERDUE once nothing is actually *late*. A week
    // that simply hasn't fallen due yet must not keep the rider flagged.
    const stillLate = await prisma.weeklyInvoice.count({
      where: {
        rentalId: invoice.rentalId,
        OR: [{ status: 'OVERDUE' }, { status: 'PENDING', dueAt: { lt: new Date() } }],
      },
    });
    if (stillLate === 0 && invoice.rental.status === 'OVERDUE') {
      await prisma.rental.update({ where: { id: invoice.rentalId }, data: { status: 'ACTIVE' } });
    }

    const fresh = await prisma.rental.findUnique({
      where: { id: invoice.rentalId },
      include: RENTAL_INCLUDE,
    });

    void notify.paymentReceived(userId, invoice.amount, `week ${invoice.weekNumber} rent`);

    return res.json({
      message: `Week ${invoice.weekNumber} rent paid`,
      transactionId: txnRef,
      rental: fresh ? serializeRental(fresh) : null,
    });
  } catch (error: any) {
    console.error('Error in payWeeklyInvoice:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
