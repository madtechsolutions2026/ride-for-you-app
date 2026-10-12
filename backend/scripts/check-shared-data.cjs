// Read-only HTTP checks against the configured database. Never resets or seeds it.
process.env.NODE_ENV = 'test';
require('dotenv').config();
const assert = require('node:assert/strict');
const request = require('supertest');
const { prisma } = require('../dist/utils/prisma');
const { generateAccessToken } = require('../dist/middleware/auth');
const app = require('../dist/app').default;
async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', accountStatus: 'ACTIVE' } });
  assert(admin, 'An existing active admin is required');
  const token = generateAccessToken(admin.id, admin.role);
  const get = async url => {
    const response = await request(app).get(url).set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 200, `${url}: ${response.body.error || response.status}`);
    return response.body;
  };
  const [infra, riderHubs, stations, fleet] = await Promise.all([get('/admin/api/infrastructure'), get('/rental/hubs'), get('/rental/swap-stations'), get('/admin/api/fleet')]);
  const normalize = h => ({ id: h.id, name: h.name, lat: h.lat, lng: h.lng });
  assert.deepEqual(riderHubs.hubs.map(normalize).sort((a,b) => a.id.localeCompare(b.id)), infra.hubs.filter(h => h.status === 'ACTIVE').map(normalize).sort((a,b) => a.id.localeCompare(b.id)));
  assert.equal(stations.stations.length, infra.swapStations.filter(s => s.status === 'ACTIVE').length);
  for (const category of ['SWAP', 'HOME']) {
    const response = await get(`/rental/bikes?category=${category}&hubId=${riderHubs.hubs[0].id}`);
    for (const model of response.bikes) {
      const adminModel = fleet.models.find(m => m.id === model.modelId);
      assert(adminModel, `Model ${model.modelId} missing from admin`);
      for (const plan of model.plans) {
        const expected = adminModel.plans.find(p => p.duration === plan.duration && p.status === 'ACTIVE');
        assert(expected, `Missing plan ${plan.duration}`);
        assert.equal(plan.price, expected.price); assert.equal(plan.deposit, expected.deposit);
      }
    }
  }
  console.log(JSON.stringify({ verified: true, activeHubs: riderHubs.hubs.map(normalize), activeStations: stations.stations.length, pricingMatchesAdmin: true }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
