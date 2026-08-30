import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { publicUrl } from '../utils/r2';
import { getCache, setCache } from '../utils/cache';

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
