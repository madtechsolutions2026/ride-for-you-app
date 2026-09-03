/**
 * Test data builders. Every helper inserts straight through Prisma (no HTTP) and
 * returns the created row so tests can stay short and declarative.
 */
import crypto from 'crypto';
import { prisma } from '../../src/utils/prisma';
import { generateAccessToken } from '../../src/middleware/auth';

let seq = 0;
const next = () => (seq += 1);

const genId = (prefix: string) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

/** A phone in +91XXXXXXXXXX form, unique per call. */
export function uniquePhone(): string {
  return `+9190000${String(10000 + next()).slice(-5)}`;
}

type UserRole = 'RIDER' | 'ADMIN' | 'EXECUTIVE' | 'SUPPORT';

export async function makeUser(
  overrides: Partial<{
    role: UserRole;
    phone: string;
    fullName: string;
    email: string;
    city: string;
    accountStatus: string;
    kycStatus: string;
    assignedHubId: string | null;
    permissions: string[];
  }> = {}
) {
  const role = overrides.role ?? 'RIDER';
  return prisma.user.create({
    data: {
      id: genId('usr'),
      phone: overrides.phone ?? uniquePhone(),
      fullName: overrides.fullName ?? `${role} ${next()}`,
      email: overrides.email,
      city: overrides.city,
      role,
      accountStatus: overrides.accountStatus ?? 'ACTIVE',
      kycStatus: overrides.kycStatus ?? (role === 'RIDER' ? 'PENDING' : 'PENDING'),
      assignedHubId: overrides.assignedHubId ?? null,
      permissions: overrides.permissions ?? [],
    },
  });
}

/** { user, token, headers } for a freshly created account of the given role. */
export async function actingAs(role: UserRole, overrides = {}) {
  const user = await makeUser({ role, ...overrides });
  const token = generateAccessToken(user.id, user.role);
  return { user, token, headers: { Authorization: `Bearer ${token}` } };
}

/** A bare bearer header for an id/role that need not exist in the DB. */
export function bearer(userId: string, role: string) {
  return { Authorization: `Bearer ${generateAccessToken(userId, role)}` };
}

export async function makeHub(overrides: Partial<{ name: string; status: string; city: string }> = {}) {
  return prisma.hub.create({
    data: {
      name: overrides.name ?? `Hub ${next()}`,
      address: 'Test Address, Hyderabad',
      lat: 17.44,
      lng: 78.37,
      city: overrides.city ?? 'Hyderabad',
      status: overrides.status ?? 'ACTIVE',
      openTime: '09:00',
      closeTime: '21:00',
      contactPhone: '+914012345678',
    },
  });
}

export async function makeSwapStation(overrides: Partial<{ name: string; status: string }> = {}) {
  return prisma.swapStation.create({
    data: {
      name: overrides.name ?? `Swap ${next()}`,
      address: 'Test Swap Point, Hyderabad',
      lat: 17.45,
      lng: 78.38,
      status: overrides.status ?? 'ACTIVE',
    },
  });
}

export async function makeModel(
  overrides: Partial<{
    name: string;
    category: string;
    topSpeedKmph: number;
    rangeKm: number;
    requiresLicense: boolean;
    status: string;
  }> = {}
) {
  return prisma.bikeModel.create({
    data: {
      name: overrides.name ?? `Model ${next()}`,
      category: overrides.category ?? 'SWAP',
      topSpeedKmph: overrides.topSpeedKmph ?? 45,
      rangeKm: overrides.rangeKm ?? 90,
      requiresLicense: overrides.requiresLicense ?? false,
      chargerIncluded: false,
      status: overrides.status ?? 'ACTIVE',
    },
  });
}

export async function makePlan(
  modelId: string,
  overrides: Partial<{ duration: string; price: number; deposit: number; kmLimit: number | null; status: string }> = {}
) {
  return prisma.rentalPlan.create({
    data: {
      modelId,
      duration: overrides.duration ?? 'WEEK',
      price: overrides.price ?? 1645,
      deposit: overrides.deposit ?? 1500,
      kmLimit: overrides.kmLimit ?? null,
      status: overrides.status ?? 'ACTIVE',
    },
  });
}

export async function makeBike(
  modelId: string,
  hubId: string,
  overrides: Partial<{ registrationNumber: string; status: string; batteryPercent: number; odometerKm: number }> = {}
) {
  return prisma.bike.create({
    data: {
      modelId,
      hubId,
      registrationNumber: overrides.registrationNumber ?? `TS09EA${String(1000 + next())}`,
      colour: 'Graphite',
      batteryPercent: overrides.batteryPercent ?? 100,
      odometerKm: overrides.odometerKm ?? 0,
      status: overrides.status ?? 'AVAILABLE',
    },
  });
}

/**
 * A hub + model + WEEK plan + one available bike, plus a rider. The backbone for
 * booking / handover / rental tests.
 */
export async function makeFleetContext(
  opts: Partial<{ riderKyc: string; bikeStatus: string; planPrice: number; planDeposit: number }> = {}
) {
  const hub = await makeHub();
  const model = await makeModel();
  const plan = await makePlan(model.id, {
    duration: 'WEEK',
    price: opts.planPrice ?? 1645,
    deposit: opts.planDeposit ?? 1500,
  });
  const bike = await makeBike(model.id, hub.id, { status: opts.bikeStatus ?? 'AVAILABLE' });
  const rider = await makeUser({ role: 'RIDER', kycStatus: opts.riderKyc ?? 'APPROVED' });
  return { hub, model, plan, bike, rider };
}

export async function makeBooking(
  args: {
    userId: string;
    modelId: string;
    planId: string;
    hubId: string;
    status?: string;
    rentAmount?: number;
    depositAmount?: number;
    platformFee?: number;
  }
) {
  const rentAmount = args.rentAmount ?? 1645;
  const depositAmount = args.depositAmount ?? 1500;
  const platformFee = args.platformFee ?? 0;
  return prisma.booking.create({
    data: {
      reference: `RFY-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId: args.userId,
      modelId: args.modelId,
      planId: args.planId,
      hubId: args.hubId,
      status: args.status ?? 'PENDING',
      rentAmount,
      depositAmount,
      platformFee,
      totalAmount: rentAmount + depositAmount + platformFee,
    },
  });
}

/** A live ACTIVE rental (booking -> handover), with its week-1 invoice. */
export async function makeActiveRental(opts: Partial<{ expectedReturnAt: Date; weekInvoiceStatus: string }> = {}) {
  const ctx = await makeFleetContext();
  const booking = await makeBooking({
    userId: ctx.rider.id,
    modelId: ctx.model.id,
    planId: ctx.plan.id,
    hubId: ctx.hub.id,
    status: 'HANDED_OVER',
  });
  const rental = await prisma.rental.create({
    data: {
      bookingId: booking.id,
      userId: ctx.rider.id,
      bikeId: ctx.bike.id,
      hubId: ctx.hub.id,
      status: 'ACTIVE',
      expectedReturnAt: opts.expectedReturnAt ?? new Date(Date.now() + 7 * 86400_000),
    },
  });
  await prisma.bike.update({ where: { id: ctx.bike.id }, data: { status: 'RENTED' } });
  const invoice = await prisma.weeklyInvoice.create({
    data: {
      rentalId: rental.id,
      weekNumber: 1,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 7 * 86400_000),
      amount: booking.rentAmount,
      dueAt: new Date(Date.now() + 7 * 86400_000),
      status: opts.weekInvoiceStatus ?? 'PENDING',
    },
  });
  return { ...ctx, booking, rental, invoice };
}

export async function makeKyc(
  userId: string,
  overrides: Partial<{ status: string; fullName: string; aadhaarNumber: string; panNumber: string }> = {}
) {
  return prisma.kycVerification.create({
    data: {
      userId,
      status: overrides.status ?? 'SUBMITTED',
      fullName: overrides.fullName ?? 'Test Rider',
      aadhaarNumber: overrides.aadhaarNumber ?? '1111 2222 3333',
      panNumber: overrides.panNumber ?? 'ABCDE1234F',
      aadhaarFrontKey: `kyc/${userId}/aadhaar_front.jpg`,
      panCardKey: `kyc/${userId}/pan_card.jpg`,
      selfieKey: `kyc/${userId}/selfie.jpg`,
    },
  });
}
