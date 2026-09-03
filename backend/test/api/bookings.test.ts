/**
 * Module: Booking Management (BOO-001 .. BOO-014)
 * Endpoints: GET /admin/api/bookings, GET /admin/api/bookings/:id,
 *            POST /admin/api/bookings/:id/confirm, POST /admin/api/bookings/:id/cancel
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, makeFleetContext, makeBooking, makeActiveRental } from '../helpers/factories';

async function seedBookingSet() {
  const ctx = await makeFleetContext();
  const mk = (status: string) =>
    makeBooking({ userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status });
  await mk('PENDING');
  await mk('CONFIRMED');
  await mk('CANCELLED');
  return ctx;
}

describe('Booking Management', () => {
  it('BOO-001 lists every booking', async () => {
    const { headers } = await actingAs('ADMIN');
    await seedBookingSet();
    const res = await api().get('/admin/api/bookings').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  it('BOO-002..006 filters bookings by status', async () => {
    const { headers } = await actingAs('ADMIN');
    await seedBookingSet();
    for (const [status, n] of [['PENDING', 1], ['CONFIRMED', 1], ['CANCELLED', 1], ['EXPIRED', 0]] as const) {
      const res = await api().get('/admin/api/bookings').query({ status }).set(headers);
      expect(res.body.count).toBe(n);
    }
  });

  it('BOO-004 active rentals surface through the bookings list with a rental link', async () => {
    const { headers } = await actingAs('ADMIN');
    await makeActiveRental();
    const res = await api().get('/admin/api/bookings').query({ status: 'HANDED_OVER' }).set(headers);
    expect(res.body.bookings[0].rental).toMatchObject({ status: 'ACTIVE' });
  });

  it('BOO-007..010 the detail view returns vehicle, plan, station and rider', async () => {
    const { headers } = await actingAs('ADMIN');
    const ctx = await makeFleetContext();
    const booking = await makeBooking({
      userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'CONFIRMED',
    });

    const res = await api().get(`/admin/api/bookings/${booking.id}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.booking.model.id).toBe(ctx.model.id);
    expect(res.body.booking.plan.duration).toBe(ctx.plan.duration);
    expect(res.body.booking.hub.id).toBe(ctx.hub.id);
    expect(res.body.booking.user.id).toBe(ctx.rider.id);
    expect(res.body.finance).toMatchObject({ billed: booking.totalAmount });
  });

  it('BOO-011 confirms a pending booking', async () => {
    const { headers } = await actingAs('ADMIN');
    const ctx = await makeFleetContext();
    const booking = await makeBooking({
      userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'PENDING',
    });

    const res = await api().post(`/admin/api/bookings/${booking.id}/confirm`).set(headers).send({});
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CONFIRMED');
  });

  it('BOO-011b confirming a non-pending booking is refused', async () => {
    const { headers } = await actingAs('ADMIN');
    const ctx = await makeFleetContext();
    const booking = await makeBooking({
      userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'CONFIRMED',
    });
    const res = await api().post(`/admin/api/bookings/${booking.id}/confirm`).set(headers).send({});
    expect(res.status).toBe(409);
  });

  it('BOO-011c cancels a booking with a reason', async () => {
    const { headers } = await actingAs('ADMIN');
    const ctx = await makeFleetContext();
    const booking = await makeBooking({
      userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'PENDING',
    });

    const res = await api()
      .post(`/admin/api/bookings/${booking.id}/cancel`)
      .set(headers)
      .send({ reason: 'Rider no-show' });
    expect(res.status).toBe(200);
    const row = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(row?.status).toBe('CANCELLED');
    expect(row?.cancelReason).toBe('Rider no-show');
    expect(row?.cancelledAt).toBeInstanceOf(Date);
  });

  it('BOO-011d a handed-over booking cannot be cancelled', async () => {
    const { headers } = await actingAs('ADMIN');
    const { booking } = await makeActiveRental();
    const res = await api().post(`/admin/api/bookings/${booking.id}/cancel`).set(headers).send({ reason: 'x' });
    expect(res.status).toBe(409);
  });

  it('BOO-012 searches by booking reference', async () => {
    const { headers } = await actingAs('ADMIN');
    const ctx = await makeFleetContext();
    const booking = await makeBooking({
      userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'PENDING',
    });
    await makeBooking({ userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'PENDING' });

    const res = await api().get('/admin/api/bookings').query({ search: booking.reference }).set(headers);
    expect(res.body.count).toBe(1);
    expect(res.body.bookings[0].id).toBe(booking.id);
  });

  it('BOO-013 filters by status combined with a rider search', async () => {
    const { headers } = await actingAs('ADMIN');
    const ctx = await seedBookingSet();
    const res = await api()
      .get('/admin/api/bookings')
      .query({ status: 'PENDING', search: ctx.rider.phone })
      .set(headers);
    expect(res.body.count).toBe(1);
  });

  it('BOO detail returns 404 for an unknown id', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api().get('/admin/api/bookings/does-not-exist').set(headers);
    expect(res.status).toBe(404);
  });

  it.skip('BOO-013b filter by date / station — listBookings accepts only status + search', () => {});
  it.skip('BOO-014 prevent duplicate booking — dedup lives in the rider createBooking flow, not the admin API', () => {});
});
