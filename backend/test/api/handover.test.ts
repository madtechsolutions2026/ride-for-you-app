/**
 * Module: Vehicle Handover (VEH-001 .. VEH-010)
 * Endpoint: POST /admin/api/bookings/:id/handover  (ops.controller.handoverBike)
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, makeFleetContext, makeBooking, makeHub } from '../helpers/factories';

async function confirmedBooking(opts: Parameters<typeof makeFleetContext>[0] = {}) {
  const ctx = await makeFleetContext(opts);
  const booking = await makeBooking({
    userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'CONFIRMED',
  });
  return { ...ctx, booking };
}

describe('Vehicle Handover', () => {
  it('VEH-003..006 an Executive hands over a bike and the whole state transitions', async () => {
    const { headers, user } = await actingAs('EXECUTIVE');
    const { booking, bike } = await confirmedBooking();

    const res = await api()
      .post(`/admin/api/bookings/${booking.id}/handover`)
      .set(headers)
      .send({ bikeId: bike.id, odometerStart: 1200 });

    expect(res.status).toBe(201);
    const rental = await prisma.rental.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(rental.status).toBe('ACTIVE');
    expect(rental.handoverById).toBe(user.id);          // VEH-010 audit
    expect(rental.handoverAt).toBeInstanceOf(Date);     // VEH-005 timestamp
    expect(rental.odometerStart).toBe(1200);

    expect((await prisma.bike.findUnique({ where: { id: bike.id } }))?.status).toBe('RENTED'); // VEH-006
    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe('HANDED_OVER'); // VEH-004
    expect(await prisma.weeklyInvoice.count({ where: { rentalId: rental.id, weekNumber: 1 } })).toBe(1);
  });

  it('VEH handover requires a bikeId', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    const { booking } = await confirmedBooking();
    const res = await api().post(`/admin/api/bookings/${booking.id}/handover`).set(headers).send({});
    expect(res.status).toBe(400);
  });

  it('VEH-009 a cancelled booking cannot be handed over', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    const ctx = await makeFleetContext();
    const booking = await makeBooking({
      userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'CANCELLED',
    });
    const res = await api()
      .post(`/admin/api/bookings/${booking.id}/handover`)
      .set(headers)
      .send({ bikeId: ctx.bike.id });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/CONFIRMED\/READY/);
  });

  it('VEH a non-AVAILABLE bike cannot be handed over', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    const { booking, bike } = await confirmedBooking({ bikeStatus: 'MAINTENANCE' });
    const res = await api()
      .post(`/admin/api/bookings/${booking.id}/handover`)
      .set(headers)
      .send({ bikeId: bike.id });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/not AVAILABLE/);
  });

  it('VEH a booking already handed over cannot be handed over again', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    const { booking, bike } = await confirmedBooking();
    await api().post(`/admin/api/bookings/${booking.id}/handover`).set(headers).send({ bikeId: bike.id });

    const again = await api()
      .post(`/admin/api/bookings/${booking.id}/handover`)
      .set(headers)
      .send({ bikeId: bike.id });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/already handed over/i);
  });

  it('VEH-002 an Executive can read the rider detail needed for handover', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    const { booking } = await confirmedBooking({ riderKyc: 'APPROVED' });
    const res = await api().get(`/admin/api/bookings/${booking.id}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.booking.user).toHaveProperty('kycStatus');
    expect(res.body.booking.user).toHaveProperty('phone');
  });

  it.failing(
    'VEH-008 handover should be blocked when the rider KYC is not APPROVED (GAP: handoverBike never checks rider.kycStatus)',
    async () => {
      const { headers } = await actingAs('EXECUTIVE');
      const { booking, bike } = await confirmedBooking({ riderKyc: 'REJECTED' });
      const res = await api()
        .post(`/admin/api/bookings/${booking.id}/handover`)
        .set(headers)
        .send({ bikeId: bike.id });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  );

  it.failing(
    'VEH-001/007 an Executive should only see / act on bookings at their assigned hub (GAP: bookings + handover are not hub-scoped)',
    async () => {
      const hubA = await makeHub();
      const { headers } = await actingAs('EXECUTIVE', { assignedHubId: hubA.id });
      const other = await confirmedBooking(); // booking sits at a different hub

      const list = await api().get('/admin/api/bookings').set(headers);
      expect(list.body.bookings.some((b: any) => b.id === other.booking.id)).toBe(false);
    }
  );
});
