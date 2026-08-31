import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { delCache } from '../utils/cache';
import { presignGet, PRESIGNED_URL_TTL_SECONDS } from '../utils/r2';

/**
 * Enterprise Admin Controller
 */

// 1. GET /admin/stats - High level overview KPI metrics
export async function getAdminStats(_req: Request, res: Response) {
  try {
    const [
      totalRiders,
      verifiedRiders,
      pendingKyc,
      totalBikes,
      availableBikes,
      rentedBikes,
      maintenanceBikes,
      totalHubs,
      totalSwapStations,
      totalModels,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'RIDER' } }),
      prisma.user.count({ where: { role: 'RIDER', kycStatus: 'APPROVED' } }),
      prisma.kycVerification.count({ where: { status: 'SUBMITTED' } }),
      prisma.bike.count(),
      prisma.bike.count({ where: { status: 'AVAILABLE' } }),
      prisma.bike.count({ where: { status: 'RENTED' } }),
      prisma.bike.count({ where: { status: 'MAINTENANCE' } }),
      prisma.hub.count({ where: { status: 'ACTIVE' } }),
      prisma.swapStation.count({ where: { status: 'ACTIVE' } }),
      prisma.bikeModel.count({ where: { status: 'ACTIVE' } }),
    ]);

    const now = new Date();
    const [
      activeRentals,
      overdueRentals,
      pendingBookings,
      staffCount,
      openRecovery,
      pendingDamage,
      collectedAgg,
      overdueAgg,
      pendingInvoiceAgg,
    ] = await Promise.all([
      prisma.rental.count({ where: { status: 'ACTIVE' } }),
      prisma.rental.count({ where: { status: 'ACTIVE', expectedReturnAt: { lt: now } } }),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { role: { in: ['ADMIN', 'EXECUTIVE', 'SUPPORT'] } } }),
      prisma.recoveryJob.count({ where: { status: { in: ['OPEN', 'DISPATCHED', 'IN_PROGRESS'] } } }),
      prisma.damageReport.count({ where: { chargeStatus: 'PENDING' } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'SUCCESS' } }),
      prisma.weeklyInvoice.aggregate({
        _sum: { amount: true },
        where: { status: { in: ['PENDING', 'OVERDUE'] }, dueAt: { lt: now } },
      }),
      prisma.weeklyInvoice.aggregate({ _sum: { amount: true }, where: { status: 'PENDING' } }),
    ]);

    const fleetUtilization =
      totalBikes > 0 ? Math.round(((totalBikes - availableBikes) / totalBikes) * 100) : 0;

    return res.json({
      riders: { total: totalRiders, verified: verifiedRiders, pendingKyc },
      fleet: {
        totalBikes,
        availableBikes,
        rentedBikes,
        maintenanceBikes,
        totalModels,
        utilizationRate: fleetUtilization,
      },
      infrastructure: { hubs: totalHubs, swapStations: totalSwapStations },
      operations: {
        activeRentals,
        overdueRentals,
        pendingBookings,
        staffCount,
        openRecovery,
        pendingDamage,
      },
      finance: {
        collectedRevenue: collectedAgg._sum.amount ?? 0,
        overdueAmount: overdueAgg._sum.amount ?? 0,
        pendingInvoiceAmount: pendingInvoiceAgg._sum.amount ?? 0,
      },
    });
  } catch (error: any) {
    console.error('Error in getAdminStats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 2. GET /admin/users - Riders list with search, filter, pagination
export async function getAllUsers(req: Request, res: Response) {
  try {
    const search = String(req.query.search || '').trim();
    const kycFilter = String(req.query.kycStatus || '').trim();
    const roleFilter = String(req.query.role || '').trim();

    const where: any = {};
    if (roleFilter) where.role = roleFilter;
    if (kycFilter) where.kycStatus = kycFilter;

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        fullName: true,
        email: true,
        city: true,
        role: true,
        accountStatus: true,
        kycStatus: true,
        createdAt: true,
      },
    });

    return res.json({
      count: users.length,
      users,
    });
  } catch (error: any) {
    console.error('Error in getAllUsers:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 3. PUT /admin/users/:id/status - Block or activate a rider
export async function updateUserStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { accountStatus, role } = req.body;

    const data: any = {};
    if (accountStatus) data.accountStatus = accountStatus;
    if (role) data.role = role;

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    await delCache(`user:profile:${id}`);
    await delCache(`auth:me:${id}`);

    return res.json({ message: 'User status updated successfully', user });
  } catch (error: any) {
    console.error('Error in updateUserStatus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 4. GET /admin/fleet - Complete fleet overview with models, physical bikes, and hubs
export async function getFleet(_req: Request, res: Response) {
  try {
    const [models, bikes, hubs] = await Promise.all([
      prisma.bikeModel.findMany({
        include: {
          plans: true,
          _count: { select: { bikes: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bike.findMany({
        include: {
          model: { select: { name: true, category: true, rangeKm: true, topSpeedKmph: true } },
          hub: { select: { name: true, city: true } },
        },
        orderBy: { registrationNumber: 'asc' },
      }),
      prisma.hub.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, city: true },
      }),
    ]);

    return res.json({
      modelsCount: models.length,
      bikesCount: bikes.length,
      models,
      bikes,
      hubs,
    });
  } catch (error: any) {
    console.error('Error in getFleet:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 5. POST /admin/fleet/bikes - Add a physical bike to fleet
export async function createBike(req: Request, res: Response) {
  try {
    const { modelId, hubId, registrationNumber, colour, batteryPercent, status } = req.body;

    if (!modelId || !hubId || !registrationNumber) {
      return res.status(400).json({ error: 'modelId, hubId, and registrationNumber are required' });
    }

    const bike = await prisma.bike.create({
      data: {
        modelId,
        hubId,
        registrationNumber: registrationNumber.toUpperCase().trim(),
        colour: colour || 'Graphite',
        batteryPercent: batteryPercent ?? 100,
        status: status || 'AVAILABLE',
      },
    });

    await delCache('rental:hub');

    return res.status(201).json({ message: 'Bike added to fleet successfully', bike });
  } catch (error: any) {
    console.error('Error in createBike:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A bike with this registration number already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 6. PUT /admin/fleet/bikes/:id - Update bike status, hub assignment, or battery %
export async function updateBike(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, batteryPercent, hubId, colour } = req.body;

    const data: any = {};
    if (status) data.status = status;
    if (typeof batteryPercent === 'number') data.batteryPercent = batteryPercent;
    if (hubId) data.hubId = hubId;
    if (colour) data.colour = colour;

    const bike = await prisma.bike.update({
      where: { id },
      data,
    });

    await delCache('rental:hub');

    return res.json({ message: 'Bike updated successfully', bike });
  } catch (error: any) {
    console.error('Error in updateBike:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 7. GET /admin/hubs - List all Hubs and Swap Stations
export async function getHubsAndStations(_req: Request, res: Response) {
  try {
    const [hubs, swapStations] = await Promise.all([
      prisma.hub.findMany({
        include: {
          _count: { select: { bikes: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.swapStation.findMany({
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return res.json({ hubs, swapStations });
  } catch (error: any) {
    console.error('Error in getHubsAndStations:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 8. POST /admin/hubs - Create a new EV Hub
export async function createHub(req: Request, res: Response) {
  try {
    const { name, address, lat, lng, city, openTime, closeTime, contactPhone } = req.body;

    if (!name || !address || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'name, address, lat, and lng are required' });
    }

    const hub = await prisma.hub.create({
      data: {
        name,
        address,
        lat,
        lng,
        city: city || 'Hyderabad',
        openTime: openTime || '09:00',
        closeTime: closeTime || '21:00',
        contactPhone: contactPhone || '+914012345678',
      },
    });

    await delCache('rental:hub');

    return res.status(201).json({ message: 'Hub created successfully', hub });
  } catch (error: any) {
    console.error('Error in createHub:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 9. POST /admin/swap-stations - Create a new Swap Station
export async function createSwapStation(req: Request, res: Response) {
  try {
    const { name, address, lat, lng, openTime, closeTime } = req.body;

    if (!name || !address || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'name, address, lat, and lng are required' });
    }

    const station = await prisma.swapStation.create({
      data: {
        name,
        address,
        lat,
        lng,
        openTime: openTime || '06:00',
        closeTime: closeTime || '23:00',
      },
    });

    await delCache('rental:swap-stations');

    return res.status(201).json({ message: 'Swap station created successfully', station });
  } catch (error: any) {
    console.error('Error in createSwapStation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 10. GET /admin/kyc/submissions - Full KYC list with presigned document URLs
export async function getKycSubmissions(req: Request, res: Response) {
  try {
    const status = String(req.query.status || '').trim();
    const where = status ? { status } : {};

    const submissions = await prisma.kycVerification.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            fullName: true,
            email: true,
            city: true,
            avatarUrl: true,
            kycStatus: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const serialized = await Promise.all(
      submissions.map(async (v) => {
        const [aadhaarFrontUrl, aadhaarBackUrl, panCardUrl, selfieUrl, addressProofUrl] =
          await Promise.all([
            presignGet(v.aadhaarFrontKey),
            presignGet(v.aadhaarBackKey),
            presignGet(v.panCardKey),
            presignGet(v.selfieKey),
            presignGet(v.addressProofKey),
          ]);

        return {
          id: v.id,
          userId: v.userId,
          status: v.status,
          fullName: v.fullName || v.user.fullName,
          phone: v.user.phone,
          email: v.user.email,
          city: v.user.city,
          address: v.address,
          aadhaarNumber: v.aadhaarNumber,
          panNumber: v.panNumber,
          aadhaarFrontUrl,
          aadhaarBackUrl,
          panCardUrl,
          selfieUrl,
          addressProofUrl,
          rejectReason: v.rejectReason,
          reviewedBy: v.reviewedBy,
          reviewedAt: v.reviewedAt,
          submittedAt: v.submittedAt,
        };
      })
    );

    return res.json({ count: serialized.length, submissions: serialized });
  } catch (error: any) {
    console.error('Error in getKycSubmissions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* -------------------------------------------------------------------------- */
/* Catalogue: bike models & pricing plans                                      */
/* -------------------------------------------------------------------------- */

// POST /admin/api/fleet/models
export async function createBikeModel(req: Request, res: Response) {
  try {
    const { name, category, topSpeedKmph, rangeKm, requiresLicense, chargerIncluded, status } =
      req.body ?? {};
    if (!name || !category || typeof topSpeedKmph !== 'number' || typeof rangeKm !== 'number') {
      return res
        .status(400)
        .json({ error: 'name, category, numeric topSpeedKmph and rangeKm are required' });
    }
    const model = await prisma.bikeModel.create({
      data: {
        name: String(name).trim(),
        category,
        topSpeedKmph,
        rangeKm,
        requiresLicense: Boolean(requiresLicense),
        chargerIncluded: Boolean(chargerIncluded),
        status: status || 'ACTIVE',
      },
    });
    await delCache('rental:models');
    return res.status(201).json({ message: 'Model added to catalogue', model });
  } catch (error: any) {
    console.error('Error in createBikeModel:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /admin/api/fleet/models/:id
export async function updateBikeModel(req: Request, res: Response) {
  try {
    const { name, category, topSpeedKmph, rangeKm, requiresLicense, chargerIncluded, status } =
      req.body ?? {};
    const data: any = {};
    if (name !== undefined) data.name = String(name).trim();
    if (category !== undefined) data.category = category;
    if (typeof topSpeedKmph === 'number') data.topSpeedKmph = topSpeedKmph;
    if (typeof rangeKm === 'number') data.rangeKm = rangeKm;
    if (requiresLicense !== undefined) data.requiresLicense = Boolean(requiresLicense);
    if (chargerIncluded !== undefined) data.chargerIncluded = Boolean(chargerIncluded);
    if (status !== undefined) data.status = status;

    const model = await prisma.bikeModel.update({ where: { id: req.params.id }, data });
    await delCache('rental:models');
    return res.json({ message: 'Model updated', model });
  } catch (error: any) {
    console.error('Error in updateBikeModel:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /admin/api/fleet/plans  — create or update the (model, duration) plan
export async function upsertRentalPlan(req: Request, res: Response) {
  try {
    const { modelId, duration, price, deposit, kmLimit, status } = req.body ?? {};
    if (!modelId || !duration || typeof price !== 'number') {
      return res.status(400).json({ error: 'modelId, duration and numeric price are required' });
    }
    const plan = await prisma.rentalPlan.upsert({
      where: { modelId_duration: { modelId, duration } },
      create: {
        modelId,
        duration,
        price,
        deposit: typeof deposit === 'number' ? deposit : 0,
        kmLimit: typeof kmLimit === 'number' ? kmLimit : null,
        status: status || 'ACTIVE',
      },
      update: {
        price,
        ...(typeof deposit === 'number' ? { deposit } : {}),
        ...(kmLimit !== undefined ? { kmLimit: typeof kmLimit === 'number' ? kmLimit : null } : {}),
        ...(status ? { status } : {}),
      },
    });
    await delCache('rental:models');
    return res.json({ message: 'Plan saved', plan });
  } catch (error: any) {
    console.error('Error in upsertRentalPlan:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /admin/api/hubs/:id  — edit a hub (address, hours, status, coordinates)
export async function updateHub(req: Request, res: Response) {
  try {
    const { name, address, lat, lng, city, status, openTime, closeTime, contactPhone } =
      req.body ?? {};
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (address !== undefined) data.address = address;
    if (typeof lat === 'number') data.lat = lat;
    if (typeof lng === 'number') data.lng = lng;
    if (city !== undefined) data.city = city;
    if (status !== undefined) data.status = status;
    if (openTime !== undefined) data.openTime = openTime;
    if (closeTime !== undefined) data.closeTime = closeTime;
    if (contactPhone !== undefined) data.contactPhone = contactPhone;

    const hub = await prisma.hub.update({ where: { id: req.params.id }, data });
    await delCache('rental:hub');
    return res.json({ message: 'Hub updated', hub });
  } catch (error: any) {
    console.error('Error in updateHub:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /admin/api/fleet/map  — everything the live operations map needs
export async function getFleetMap(_req: Request, res: Response) {
  try {
    const [hubs, swapStations, bikes] = await Promise.all([
      prisma.hub.findMany({
        select: {
          id: true,
          name: true,
          address: true,
          lat: true,
          lng: true,
          city: true,
          status: true,
          _count: { select: { bikes: true } },
        },
      }),
      prisma.swapStation.findMany({
        select: { id: true, name: true, address: true, lat: true, lng: true, status: true },
      }),
      prisma.bike.findMany({
        select: {
          id: true,
          registrationNumber: true,
          status: true,
          batteryPercent: true,
          colour: true,
          lastLat: true,
          lastLng: true,
          lastSeenAt: true,
          model: { select: { name: true, category: true } },
          hub: { select: { id: true, name: true, lat: true, lng: true } },
        },
      }),
    ]);

    // A bike with no GPS ping yet is shown at its home hub with a small jitter
    // so multiple bikes at one hub don't stack on a single pixel.
    const positioned = bikes.map((b, i) => {
      const hasFix = typeof b.lastLat === 'number' && typeof b.lastLng === 'number';
      const jitter = (n: number) => n + ((i % 7) - 3) * 0.0006;
      return {
        id: b.id,
        registrationNumber: b.registrationNumber,
        status: b.status,
        batteryPercent: b.batteryPercent,
        colour: b.colour,
        model: b.model?.name,
        category: b.model?.category,
        hubName: b.hub?.name,
        lat: hasFix ? b.lastLat : jitter(b.hub.lat),
        lng: hasFix ? b.lastLng : jitter(b.hub.lng),
        hasLiveFix: hasFix,
        lastSeenAt: b.lastSeenAt,
      };
    });

    return res.json({ hubs, swapStations, bikes: positioned });
  } catch (error: any) {
    console.error('Error in getFleetMap:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
