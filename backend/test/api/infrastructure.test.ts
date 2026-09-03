/**
 * Module: Station Management (STA-001 .. STA-011)
 * Endpoints: /admin/api/infrastructure, /admin/api/hubs, /admin/api/swap-stations
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, makeHub, makeModel, makeBike, makeUser, bearer } from '../helpers/factories';

describe('Station Management', () => {
  it('STA-001 creates a pickup station (hub)', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api()
      .post('/admin/api/hubs')
      .set(headers)
      .send({ name: 'Kondapur Hub', address: 'RTO Road, Kondapur', lat: 17.462, lng: 78.356, city: 'Hyderabad' });
    expect(res.status).toBe(201);
    expect(res.body.hub).toMatchObject({ name: 'Kondapur Hub', status: 'ACTIVE' });
  });

  it('STA-001b rejects a hub with non-numeric coordinates', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api()
      .post('/admin/api/hubs')
      .set(headers)
      .send({ name: 'Bad', address: 'x', lat: '17.4', lng: 78.3 });
    expect(res.status).toBe(400);
  });

  it('STA-002 edits station details', async () => {
    const { headers } = await actingAs('ADMIN');
    const hub = await makeHub();
    const res = await api()
      .put(`/admin/api/hubs/${hub.id}`)
      .set(headers)
      .send({ address: 'New Address', openTime: '07:00', contactPhone: '+914099999999' });
    expect(res.status).toBe(200);
    expect(res.body.hub).toMatchObject({ address: 'New Address', openTime: '07:00' });
  });

  it('STA-003 activates / deactivates a station', async () => {
    const { headers } = await actingAs('ADMIN');
    const hub = await makeHub();

    expect((await api().put(`/admin/api/hubs/${hub.id}`).set(headers).send({ status: 'INACTIVE' })).status).toBe(200);
    expect((await prisma.hub.findUnique({ where: { id: hub.id } }))?.status).toBe('INACTIVE');

    await api().put(`/admin/api/hubs/${hub.id}`).set(headers).send({ status: 'ACTIVE' });
    expect((await prisma.hub.findUnique({ where: { id: hub.id } }))?.status).toBe('ACTIVE');
  });

  it('STA-003b a deactivated hub drops out of the active-hub list on the fleet view', async () => {
    const { headers } = await actingAs('ADMIN');
    const active = await makeHub({ name: 'Active Hub' });
    await makeHub({ name: 'Dead Hub', status: 'INACTIVE' });

    const res = await api().get('/admin/api/fleet').set(headers);
    const names = res.body.hubs.map((h: any) => h.name);
    expect(names).toContain('Active Hub');
    expect(names).not.toContain('Dead Hub');
    void active;
  });

  it('STA-004/005/006 station inventory follows bikes as they are assigned and moved', async () => {
    const { headers } = await actingAs('ADMIN');
    const model = await makeModel();
    const hubA = await makeHub({ name: 'A' });
    const hubB = await makeHub({ name: 'B' });
    const bike = await makeBike(model.id, hubA.id);

    let infra = await api().get('/admin/api/infrastructure').set(headers);
    let counts = Object.fromEntries(infra.body.hubs.map((h: any) => [h.name, h._count.bikes]));
    expect(counts).toMatchObject({ A: 1, B: 0 });

    await api().put(`/admin/api/fleet/bikes/${bike.id}`).set(headers).send({ hubId: hubB.id });

    infra = await api().get('/admin/api/infrastructure').set(headers);
    counts = Object.fromEntries(infra.body.hubs.map((h: any) => [h.name, h._count.bikes]));
    expect(counts).toMatchObject({ A: 0, B: 1 });
  });

  it('STA-007 assigns an Executive to a station', async () => {
    const { headers } = await actingAs('ADMIN');
    const hub = await makeHub();
    const exec = await makeUser({ role: 'EXECUTIVE' });

    const res = await api().put(`/admin/api/staff/${exec.id}`).set(headers).send({ assignedHubId: hub.id });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: exec.id } }))?.assignedHubId).toBe(hub.id);

    // and the assignment shows on /auth/me
    const me = await api().get('/auth/me').set(bearer(exec.id, 'EXECUTIVE'));
    expect(me.body.user.assignedHub?.id).toBe(hub.id);
  });

  it('STA creates a swap station', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api()
      .post('/admin/api/swap-stations')
      .set(headers)
      .send({ name: 'Hitech Swap', address: 'Pillar 1240', lat: 17.4435, lng: 78.3772 });
    expect(res.status).toBe(201);
    expect(res.body.station.name).toBe('Hitech Swap');
  });

  it.failing(
    'STA-010 adding a bike to an INACTIVE hub should be rejected (GAP: createBike / updateBike do not check hub.status)',
    async () => {
      const { headers } = await actingAs('ADMIN');
      const model = await makeModel();
      const deadHub = await makeHub({ status: 'INACTIVE' });

      const res = await api()
        .post('/admin/api/fleet/bikes')
        .set(headers)
        .send({ modelId: model.id, hubId: deadHub.id, registrationNumber: 'TS09EA4040' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  );

  it.skip('STA-008 nearest pickup station assignment — rider-side booking logic (rental.controller.createBooking)', () => {});
  it.skip('STA-009 validate station capacity — Hub has no capacity field in the schema', () => {});
  it.skip('STA-011 search & filter stations — no search/filter params on the infrastructure endpoint', () => {});
});
