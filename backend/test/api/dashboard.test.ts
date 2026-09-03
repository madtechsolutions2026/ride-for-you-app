/**
 * Module: Dashboard Overview (DAS-001 .. DAS-012)
 * Endpoint: GET /admin/api/stats  (admin.controller.getAdminStats)
 *
 * The KPI payload is normally cached for 30s; the test harness mocks utils/cache
 * to always-miss so every request recomputes from the DB.
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import {
  actingAs,
  makeUser,
  makeHub,
  makeModel,
  makeBike,
  makeSwapStation,
  makeKyc,
  makeActiveRental,
  makeBooking,
  makeFleetContext,
} from '../helpers/factories';

async function stats(headers: Record<string, string>) {
  const res = await api().get('/admin/api/stats').set(headers);
  expect(res.status).toBe(200);
  return res.body;
}

describe('Dashboard Overview', () => {
  it('DAS-001/002/003/004 fleet counts reflect bike status', async () => {
    const { headers } = await actingAs('ADMIN');
    const hub = await makeHub();
    const model = await makeModel();
    await makeBike(model.id, hub.id, { status: 'AVAILABLE' });
    await makeBike(model.id, hub.id, { status: 'AVAILABLE' });
    await makeBike(model.id, hub.id, { status: 'RENTED' });
    await makeBike(model.id, hub.id, { status: 'MAINTENANCE' });

    const body = await stats(headers);
    expect(body.fleet.totalBikes).toBe(4);
    expect(body.fleet.availableBikes).toBe(2);
    expect(body.fleet.rentedBikes).toBe(1);
    expect(body.fleet.maintenanceBikes).toBe(1);
    expect(body.fleet.utilizationRate).toBe(50); // (4-2)/4
  });

  it('DAS-005 pending KYC count = KycVerification rows in SUBMITTED', async () => {
    const { headers } = await actingAs('ADMIN');
    const r1 = await makeUser({ role: 'RIDER' });
    const r2 = await makeUser({ role: 'RIDER' });
    await makeKyc(r1.id, { status: 'SUBMITTED' });
    await makeKyc(r2.id, { status: 'APPROVED' });

    const body = await stats(headers);
    expect(body.riders.pendingKyc).toBe(1);
  });

  it('DAS-007 active bookings vs active rentals are counted separately', async () => {
    const { headers } = await actingAs('ADMIN');
    const ctx = await makeFleetContext();
    await makeBooking({ userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'PENDING' });
    await makeActiveRental();

    const body = await stats(headers);
    expect(body.operations.pendingBookings).toBe(1);
    expect(body.operations.activeRentals).toBe(1);
  });

  it('DAS-008 "damaged vehicles" = damage reports still PENDING a charge decision', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rental, bike } = await makeActiveRental();
    await prisma.damageReport.create({
      data: { rentalId: rental.id, bikeId: bike.id, severity: 'MINOR', description: 'scratch', chargeStatus: 'PENDING' },
    });
    await prisma.damageReport.create({
      data: { rentalId: rental.id, bikeId: bike.id, severity: 'MAJOR', description: 'dent', chargeStatus: 'CHARGED' },
    });

    const body = await stats(headers);
    expect(body.operations.pendingDamage).toBe(1);
  });

  it('DAS-009 station-wise summary — each hub reports its bike count', async () => {
    const { headers } = await actingAs('ADMIN');
    const hubA = await makeHub({ name: 'Hub A' });
    const hubB = await makeHub({ name: 'Hub B' });
    const model = await makeModel();
    await makeBike(model.id, hubA.id);
    await makeBike(model.id, hubA.id);
    await makeBike(model.id, hubB.id);

    const res = await api().get('/admin/api/infrastructure').set(headers);
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.hubs.map((h: any) => [h.name, h._count.bikes]));
    expect(byName['Hub A']).toBe(2);
    expect(byName['Hub B']).toBe(1);
  });

  it('DAS-010 repeated refreshes return consistent numbers', async () => {
    const { headers } = await actingAs('ADMIN');
    await makeSwapStation();
    const a = await stats(headers);
    const b = await stats(headers);
    expect(a).toEqual(b);
  });

  it('DAS-012 every stat matches a direct DB query', async () => {
    const { headers } = await actingAs('ADMIN');
    const hub = await makeHub();
    const model = await makeModel();
    await makeBike(model.id, hub.id, { status: 'AVAILABLE' });
    await makeBike(model.id, hub.id, { status: 'RENTED' });
    await makeSwapStation();
    await makeSwapStation({ status: 'INACTIVE' });
    const rider = await makeUser({ role: 'RIDER', kycStatus: 'APPROVED' });
    await makeUser({ role: 'RIDER' });

    const body = await stats(headers);

    expect(body.riders.total).toBe(await prisma.user.count({ where: { role: 'RIDER' } }));
    expect(body.riders.verified).toBe(
      await prisma.user.count({ where: { role: 'RIDER', kycStatus: 'APPROVED' } })
    );
    expect(body.fleet.totalBikes).toBe(await prisma.bike.count());
    expect(body.infrastructure.hubs).toBe(await prisma.hub.count({ where: { status: 'ACTIVE' } }));
    expect(body.infrastructure.swapStations).toBe(
      await prisma.swapStation.count({ where: { status: 'ACTIVE' } })
    );
    expect(body.operations.staffCount).toBe(
      await prisma.user.count({ where: { role: { in: ['ADMIN', 'EXECUTIVE', 'SUPPORT'] } } })
    );
    void rider;
  });

  it('DAS finance.collectedRevenue sums only SUCCESS payments', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });
    await prisma.payment.create({ data: { userId: rider.id, purpose: 'RENT', amount: 1000, provider: 'CASH', status: 'SUCCESS' } });
    await prisma.payment.create({ data: { userId: rider.id, purpose: 'RENT', amount: 500, provider: 'CASH', status: 'INITIATED' } });

    const body = await stats(headers);
    expect(body.finance.collectedRevenue).toBe(1000);
  });

  it('DAS-005b overdue rentals are flagged by expectedReturnAt in the past', async () => {
    const { headers } = await actingAs('ADMIN');
    await makeActiveRental({ expectedReturnAt: new Date(Date.now() - 86400_000) });
    const body = await stats(headers);
    expect(body.operations.overdueRentals).toBe(1);
  });

  it.skip('DAS-006 pending refunds count — no refund-request entity; refunds are ADJUSTMENT payments (see payments.test.ts)', () => {});
  it.skip('DAS-011 summary card navigation — front-end routing concern, not an API test', () => {});
});
