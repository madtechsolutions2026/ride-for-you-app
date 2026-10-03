/**
 * Module: Live-rental rider actions (SWP / REQ / RDM)
 * Endpoints: POST+GET /rental/swaps, POST+GET /rental/requests,
 *            POST /rental/requests/:id/cancel, POST /rental/damage,
 *            GET /admin/api/rental-requests, POST .../:id/decide,
 *            GET /admin/api/swaps
 *
 * Everything here is scoped to the caller's own live rental, resolved
 * server-side — the client never names a rental id. The tests below lean on
 * that: the interesting failures are "no active rental" and "someone else's".
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, bearer, makeActiveRental, makeSwapStation } from '../helpers/factories';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Battery swap', () => {
  it('SWP-001 logs a swap at a station and updates the bike battery', async () => {
    const { rider, bike, rental } = await makeActiveRental();
    await prisma.bike.update({ where: { id: bike.id }, data: { batteryPercent: 12 } });
    const station = await makeSwapStation();

    const res = await api()
      .post('/rental/swaps')
      .set(bearer(rider.id, 'RIDER'))
      .send({ code: station.id, batteryOutPercent: 12, batteryInPercent: 96 });

    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^SWP-/);
    expect(res.body.data.batteryInPercent).toBe(96);
    expect(res.body.data.rentalId).toBe(rental.id);

    const after = await prisma.bike.findUniqueOrThrow({ where: { id: bike.id } });
    expect(after.batteryPercent).toBe(96);
  });

  it('SWP-002 accepts the rfy:swap:<id> QR scheme', async () => {
    const { rider } = await makeActiveRental();
    const station = await makeSwapStation();

    const res = await api()
      .post('/rental/swaps')
      .set(bearer(rider.id, 'RIDER'))
      .send({ code: `rfy:swap:${station.id}` });

    expect(res.status).toBe(201);
    expect(res.body.data.stationId).toBe(station.id);
  });

  it('SWP-003 rejects an unknown dock code', async () => {
    const { rider } = await makeActiveRental();

    const res = await api()
      .post('/rental/swaps')
      .set(bearer(rider.id, 'RIDER'))
      .send({ code: 'not-a-real-dock' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('UNKNOWN_DOCK');
  });

  it('SWP-004 refuses a swap with no bike on rent', async () => {
    const { headers } = await actingAs('RIDER');
    const station = await makeSwapStation();

    const res = await api().post('/rental/swaps').set(headers).send({ code: station.id });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_ACTIVE_RENTAL');
  });

  it('SWP-005 refuses a swap at a closed station', async () => {
    const { rider } = await makeActiveRental();
    const station = await makeSwapStation({ status: 'INACTIVE' });

    const res = await api()
      .post('/rental/swaps')
      .set(bearer(rider.id, 'RIDER'))
      .send({ code: station.id });

    expect(res.status).toBe(409);
  });

  it('SWP-006 clamps a nonsense battery percentage into 0..100', async () => {
    const { rider, bike } = await makeActiveRental();
    const station = await makeSwapStation();

    const res = await api()
      .post('/rental/swaps')
      .set(bearer(rider.id, 'RIDER'))
      .send({ code: station.id, batteryOutPercent: -40, batteryInPercent: 250 });

    expect(res.status).toBe(201);
    expect(res.body.data.batteryOutPercent).toBe(0);
    expect(res.body.data.batteryInPercent).toBe(100);

    const after = await prisma.bike.findUniqueOrThrow({ where: { id: bike.id } });
    expect(after.batteryPercent).toBe(100);
  });

  it('SWP-007 lists my swaps newest first and nobody else’s', async () => {
    const mine = await makeActiveRental();
    const theirs = await makeActiveRental();
    const station = await makeSwapStation();

    await api()
      .post('/rental/swaps')
      .set(bearer(mine.rider.id, 'RIDER'))
      .send({ code: station.id });
    await api()
      .post('/rental/swaps')
      .set(bearer(theirs.rider.id, 'RIDER'))
      .send({ code: station.id });

    const res = await api().get('/rental/swaps').set(bearer(mine.rider.id, 'RIDER'));

    expect(res.status).toBe(200);
    expect(res.body.data.swaps).toHaveLength(1);
    expect(res.body.data.swaps[0].userId).toBe(mine.rider.id);
  });
});

describe('Extension & return requests', () => {
  it('REQ-001 creates an extension request quoted at the rider’s own rate', async () => {
    const { rider, booking } = await makeActiveRental();

    const res = await api()
      .post('/rental/requests')
      .set(bearer(rider.id, 'RIDER'))
      .send({ type: 'EXTENSION', extraWeeks: 2, riderNote: 'Need it a bit longer' });

    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^REQ-/);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.quotedAmount).toBe(booking.rentAmount * 2);
  });

  it('REQ-002 rejects an extension outside 1..12 weeks', async () => {
    const { rider } = await makeActiveRental();
    const auth = bearer(rider.id, 'RIDER');

    const zero = await api()
      .post('/rental/requests')
      .set(auth)
      .send({ type: 'EXTENSION', extraWeeks: 0 });
    expect(zero.status).toBe(400);

    const tooMany = await api()
      .post('/rental/requests')
      .set(auth)
      .send({ type: 'EXTENSION', extraWeeks: 99 });
    expect(tooMany.status).toBe(400);
  });

  it('REQ-003 books a return slot in the future and pins it to the rental hub', async () => {
    const { rider, hub } = await makeActiveRental();
    const slot = new Date(Date.now() + 2 * DAY_MS);

    const res = await api()
      .post('/rental/requests')
      .set(bearer(rider.id, 'RIDER'))
      .send({ type: 'RETURN', preferredSlotAt: slot.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.data.hubId).toBe(hub.id);
    expect(new Date(res.body.data.preferredSlotAt).getTime()).toBe(slot.getTime());
  });

  it('REQ-004 refuses a return slot in the past', async () => {
    const { rider } = await makeActiveRental();

    const res = await api()
      .post('/rental/requests')
      .set(bearer(rider.id, 'RIDER'))
      .send({ type: 'RETURN', preferredSlotAt: new Date(Date.now() - DAY_MS).toISOString() });

    expect(res.status).toBe(400);
  });

  it('REQ-005 allows only one open request of a type at a time', async () => {
    const { rider } = await makeActiveRental();
    const auth = bearer(rider.id, 'RIDER');

    await api().post('/rental/requests').set(auth).send({ type: 'EXTENSION', extraWeeks: 1 });
    const second = await api()
      .post('/rental/requests')
      .set(auth)
      .send({ type: 'EXTENSION', extraWeeks: 3 });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('ALREADY_REQUESTED');

    // A RETURN request is a different type, so it is still allowed.
    const other = await api()
      .post('/rental/requests')
      .set(auth)
      .send({ type: 'RETURN', preferredSlotAt: new Date(Date.now() + DAY_MS).toISOString() });
    expect(other.status).toBe(201);
  });

  it('REQ-006 refuses any request with no bike on rent', async () => {
    const { headers } = await actingAs('RIDER');

    const res = await api()
      .post('/rental/requests')
      .set(headers)
      .send({ type: 'EXTENSION', extraWeeks: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_ACTIVE_RENTAL');
  });

  it('REQ-007 lets the rider withdraw a pending request, once', async () => {
    const { rider } = await makeActiveRental();
    const auth = bearer(rider.id, 'RIDER');
    const created = await api()
      .post('/rental/requests')
      .set(auth)
      .send({ type: 'EXTENSION', extraWeeks: 1 });

    const first = await api()
      .post(`/rental/requests/${created.body.data.id}/cancel`)
      .set(auth)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('CANCELLED');

    const second = await api()
      .post(`/rental/requests/${created.body.data.id}/cancel`)
      .set(auth)
      .send({});
    expect(second.status).toBe(409);
  });

  it('REQ-008 approving an extension moves the rental’s return date', async () => {
    const { rider, rental } = await makeActiveRental();
    const { headers } = await actingAs('ADMIN');

    const created = await api()
      .post('/rental/requests')
      .set(bearer(rider.id, 'RIDER'))
      .send({ type: 'EXTENSION', extraWeeks: 2 });

    const before = await prisma.rental.findUniqueOrThrow({ where: { id: rental.id } });

    const res = await api()
      .post(`/admin/api/rental-requests/${created.body.data.id}/decide`)
      .set(headers)
      .send({ approve: true });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');

    const after = await prisma.rental.findUniqueOrThrow({ where: { id: rental.id } });
    expect(after.expectedReturnAt.getTime()).toBe(
      before.expectedReturnAt.getTime() + 14 * DAY_MS,
    );
  });

  it('REQ-009 rejecting an extension leaves the return date alone', async () => {
    const { rider, rental } = await makeActiveRental();
    const { headers } = await actingAs('ADMIN');

    const created = await api()
      .post('/rental/requests')
      .set(bearer(rider.id, 'RIDER'))
      .send({ type: 'EXTENSION', extraWeeks: 2 });
    const before = await prisma.rental.findUniqueOrThrow({ where: { id: rental.id } });

    const res = await api()
      .post(`/admin/api/rental-requests/${created.body.data.id}/decide`)
      .set(headers)
      .send({ approve: false, decisionNote: 'Bike is due for service' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.decisionNote).toBe('Bike is due for service');

    const after = await prisma.rental.findUniqueOrThrow({ where: { id: rental.id } });
    expect(after.expectedReturnAt.getTime()).toBe(before.expectedReturnAt.getTime());
  });

  it('REQ-010 a request cannot be decided twice', async () => {
    const { rider } = await makeActiveRental();
    const { headers } = await actingAs('ADMIN');

    const created = await api()
      .post('/rental/requests')
      .set(bearer(rider.id, 'RIDER'))
      .send({ type: 'EXTENSION', extraWeeks: 1 });

    await api()
      .post(`/admin/api/rental-requests/${created.body.data.id}/decide`)
      .set(headers)
      .send({ approve: true });

    const again = await api()
      .post(`/admin/api/rental-requests/${created.body.data.id}/decide`)
      .set(headers)
      .send({ approve: false });

    expect(again.status).toBe(409);
  });
});

describe('Rider damage report', () => {
  it('RDM-001 files a report against the rider’s live rental, unpriced', async () => {
    const { rider, rental, bike } = await makeActiveRental();

    const res = await api()
      .post('/rental/damage')
      .set(bearer(rider.id, 'RIDER'))
      .field('severity', 'MODERATE')
      .field('description', 'Front mudguard cracked after hitting a pothole');

    expect(res.status).toBe(201);
    expect(res.body.data.rentalId).toBe(rental.id);
    expect(res.body.data.bikeId).toBe(bike.id);
    expect(res.body.data.reportedById).toBe(rider.id);
    // A rider self-report must never price itself.
    expect(res.body.data.estimatedCost).toBe(0);
    expect(res.body.data.chargeStatus).toBe('PENDING');
  });

  it('RDM-002 rejects an invalid severity or a too-short description', async () => {
    const { rider } = await makeActiveRental();
    const auth = bearer(rider.id, 'RIDER');

    const badSeverity = await api()
      .post('/rental/damage')
      .set(auth)
      .field('severity', 'TOTAL_LOSS')
      .field('description', 'The bike is completely destroyed');
    expect(badSeverity.status).toBe(400);

    const shortDesc = await api()
      .post('/rental/damage')
      .set(auth)
      .field('severity', 'MINOR')
      .field('description', 'scratch');
    expect(shortDesc.status).toBe(400);
  });

  it('RDM-003 refuses a report with no bike on rent', async () => {
    const { headers } = await actingAs('RIDER');

    const res = await api()
      .post('/rental/damage')
      .set(headers)
      .field('severity', 'MINOR')
      .field('description', 'Something looks wrong with the brakes');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_ACTIVE_RENTAL');
  });

  it('RDM-004 the report lands in the admin damage queue', async () => {
    const { rider } = await makeActiveRental();
    const { headers } = await actingAs('ADMIN');

    await api()
      .post('/rental/damage')
      .set(bearer(rider.id, 'RIDER'))
      .field('severity', 'MAJOR')
      .field('description', 'Rear brake cable snapped mid-ride');

    const res = await api().get('/admin/api/damage').set(headers);
    expect(res.status).toBe(200);

    const mine = res.body.reports.find((d: any) => d.reportedById === rider.id);
    expect(mine).toBeTruthy();
    expect(mine.severity).toBe('MAJOR');
    expect(mine.chargeStatus).toBe('PENDING');
  });
});
