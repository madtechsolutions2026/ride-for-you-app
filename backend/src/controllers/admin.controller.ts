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

    // Financial estimations based on active fleet & verification pipeline
    const estimatedWeeklyRevenue = rentedBikes * 1925;
    const estimatedPlatformFees = verifiedRiders * 1500;
    const fleetUtilization = totalBikes > 0 ? Math.round(((totalBikes - availableBikes) / totalBikes) * 100) : 0;

    return res.json({
      riders: {
        total: totalRiders,
        verified: verifiedRiders,
        pendingKyc,
      },
      fleet: {
        totalBikes,
        availableBikes,
        rentedBikes,
        maintenanceBikes,
        totalModels,
        utilizationRate: fleetUtilization,
      },
      infrastructure: {
        hubs: totalHubs,
        swapStations: totalSwapStations,
      },
      finance: {
        estimatedWeeklyRevenue,
        estimatedPlatformFees,
        totalRevenue: estimatedWeeklyRevenue * 4 + estimatedPlatformFees,
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
