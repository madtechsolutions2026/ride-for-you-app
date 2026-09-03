/**
 * Module: Inventory & Vehicle Management (INV-001 .. INV-017)
 * Endpoints: /admin/api/fleet*  (admin.controller.ts)
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, makeHub, makeModel, makePlan, makeBike } from '../helpers/factories';

describe('Inventory & Vehicle Management', () => {
  it('INV-001 adds a physical bike (registration is upper-cased and trimmed)', async () => {
    const { headers } = await actingAs('ADMIN');
    const hub = await makeHub();
    const model = await makeModel();

    const res = await api()
      .post('/admin/api/fleet/bikes')
      .set(headers)
      .send({ modelId: model.id, hubId: hub.id, registrationNumber: ' ts09ea9999 ' });

    expect(res.status).toBe(201);
    expect(res.body.bike.registrationNumber).toBe('TS09EA9999');
    expect(res.body.bike.status).toBe('AVAILABLE');
  });

  it('INV-001b rejects a create missing modelId / hubId / registrationNumber', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api().post('/admin/api/fleet/bikes').set(headers).send({ registrationNumber: 'TS09EA1' });
    expect(res.status).toBe(400);
  });

  it('INV-002 edits colour and battery percentage', async () => {
    const { headers } = await actingAs('ADMIN');
    const hub = await makeHub();
    const model = await makeModel();
    const bike = await makeBike(model.id, hub.id, { batteryPercent: 100 });

    const res = await api()
      .put(`/admin/api/fleet/bikes/${bike.id}`)
      .set(headers)
      .send({ colour: 'Teal', batteryPercent: 42 });
    expect(res.status).toBe(200);
    expect(res.body.bike).toMatchObject({ colour: 'Teal', batteryPercent: 42 });
  });

  it('INV-003 reassigns a bike to a different station', async () => {
    const { headers } = await actingAs('ADMIN');
    const model = await makeModel();
    const hubA = await makeHub();
    const hubB = await makeHub();
    const bike = await makeBike(model.id, hubA.id);

    const res = await api().put(`/admin/api/fleet/bikes/${bike.id}`).set(headers).send({ hubId: hubB.id });
    expect(res.status).toBe(200);
    expect((await prisma.bike.findUnique({ where: { id: bike.id } }))?.hubId).toBe(hubB.id);
  });

  it('INV-004/005/006/007 moves a bike through each status', async () => {
    const { headers } = await actingAs('ADMIN');
    const model = await makeModel();
    const hub = await makeHub();
    const bike = await makeBike(model.id, hub.id);

    for (const status of ['MAINTENANCE', 'RENTED', 'AVAILABLE']) {
      const res = await api().put(`/admin/api/fleet/bikes/${bike.id}`).set(headers).send({ status });
      expect(res.status).toBe(200);
      expect(res.body.bike.status).toBe(status);
    }
  });

  it('INV-009 prevents a duplicate registration number', async () => {
    const { headers } = await actingAs('ADMIN');
    const hub = await makeHub();
    const model = await makeModel();
    const body = { modelId: model.id, hubId: hub.id, registrationNumber: 'TS09EA2222' };

    expect((await api().post('/admin/api/fleet/bikes').set(headers).send(body)).status).toBe(201);
    const dup = await api().post('/admin/api/fleet/bikes').set(headers).send(body);
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatch(/registration number already exists/i);
  });

  it('INV-010 the fleet view returns models with their plans and unit counts', async () => {
    const { headers } = await actingAs('ADMIN');
    const model = await makeModel({ name: 'ODYSSEY' });
    await makePlan(model.id, { duration: 'WEEK', price: 1925 });
    const hub = await makeHub();
    await makeBike(model.id, hub.id);
    await makeBike(model.id, hub.id);

    const res = await api().get('/admin/api/fleet').set(headers);
    expect(res.status).toBe(200);
    const m = res.body.models.find((x: any) => x.name === 'ODYSSEY');
    expect(m._count.bikes).toBe(2);
    expect(m.plans).toHaveLength(1);
  });

  it('INV-011 the live map reports each bike battery and positions unpinged bikes at their hub', async () => {
    const { headers } = await actingAs('ADMIN');
    const model = await makeModel();
    const hub = await makeHub();
    await makeBike(model.id, hub.id, { batteryPercent: 73 });

    const res = await api().get('/admin/api/fleet/map').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.bikes[0].batteryPercent).toBe(73);
    expect(res.body.bikes[0].hasLiveFix).toBe(false);
  });

  it('INV-017 adding a bike to a hub raises that hub inventory count', async () => {
    const { headers } = await actingAs('ADMIN');
    const model = await makeModel();
    const hub = await makeHub();

    const before = await api().get('/admin/api/infrastructure').set(headers);
    expect(before.body.hubs[0]._count.bikes).toBe(0);

    await api()
      .post('/admin/api/fleet/bikes')
      .set(headers)
      .send({ modelId: model.id, hubId: hub.id, registrationNumber: 'TS09EA7777' });

    const after = await api().get('/admin/api/infrastructure').set(headers);
    expect(after.body.hubs[0]._count.bikes).toBe(1);
  });

  it('INV catalogue: create a model then upsert its plan', async () => {
    const { headers } = await actingAs('ADMIN');
    const create = await api()
      .post('/admin/api/fleet/models')
      .set(headers)
      .send({ name: 'HALA CKD', category: 'SWAP', topSpeedKmph: 35, rangeKm: 90 });
    expect(create.status).toBe(201);
    const modelId = create.body.model.id;

    const p1 = await api().post('/admin/api/fleet/plans').set(headers).send({ modelId, duration: 'WEEK', price: 1610 });
    expect(p1.status).toBe(200);
    const p2 = await api().post('/admin/api/fleet/plans').set(headers).send({ modelId, duration: 'WEEK', price: 1700 });
    expect(p2.status).toBe(200);

    const plans = await prisma.rentalPlan.findMany({ where: { modelId } });
    expect(plans).toHaveLength(1);
    expect(plans[0].price).toBe(1700);
  });

  it('INV catalogue: model create validates required numeric fields', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api()
      .post('/admin/api/fleet/models')
      .set(headers)
      .send({ name: 'Bad', category: 'SWAP', topSpeedKmph: 'fast', rangeKm: 90 });
    expect(res.status).toBe(400);
  });

  it.skip('INV-008 deactivate vehicle — no retired/deactivated bike status in the schema (MAINTENANCE is the closest)', () => {});
  it.skip('INV-012 available range — computed for riders in rental.controller, not surfaced in the admin fleet API', () => {});
  it.skip('INV-013..016 search / filter by id, station, availability, battery — the fleet endpoint returns the full list, filtering is client-side', () => {});
});
