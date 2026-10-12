import express from 'express';
import request from 'supertest';
import { RECORDS, validateRecordInput } from '../../src/services/adminRecords';

const mockDb: any = {};
jest.mock('../../src/utils/prisma', () => ({ prisma: new Proxy({}, { get: (_target, key) => mockDb[key] }) }));
jest.mock('../../src/utils/cache', () => ({ getCache: jest.fn(), setCache: jest.fn(), delCache: jest.fn(), delCachePrefix: jest.fn() }));
jest.mock('../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../src/middleware/auth');
  return { ...actual, authenticateToken: (req: any, res: any, next: any) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ error: 'Authentication required' });
    req.user = { id: 'admin-1', role }; next();
  } };
});
import router from '../../src/routes/admin.routes';
const app = express();
app.use(express.json());
app.use('/admin/api', router);
const admin = () => ({ 'x-test-role': 'ADMIN' });
beforeEach(() => {
  for (const key of Object.keys(mockDb)) delete mockDb[key];
  for (const spec of Object.values(RECORDS)) {
    const name = spec.model[0].toLowerCase() + spec.model.slice(1);
    mockDb[name] = { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'new', ...data })), update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'existing', ...data })), delete: jest.fn().mockResolvedValue({ id: 'existing' }), deleteMany: jest.fn() };
  }
  mockDb.$transaction = jest.fn(async fn => fn(new Proxy({}, { get: (_target, key) => mockDb[key] })));
});
describe('Admin record permissions', () => {
  it('rejects unauthenticated access', async () => { expect((await request(app).get('/admin/api/records')).status).toBe(401); });
  it.each(['EXECUTIVE', 'SUPPORT', 'RIDER'])('denies %s across management endpoints', async role => {
    for (const method of ['get', 'post', 'put', 'delete'] as const) {
      const url = method === 'get' || method === 'post' ? '/admin/api/records/hubs' : '/admin/api/records/hubs/id';
      expect((await request(app)[method](url).set('x-test-role', role).send({})).status).toBe(403);
    }
  });
  it('gives Admin an explicit catalog and rejects unknown entities', async () => {
    expect((await request(app).get('/admin/api/records').set(admin())).body.data.hubs).toBeDefined();
    expect((await request(app).get('/admin/api/records/session').set(admin())).status).toBe(404);
    expect((await request(app).get('/admin/api/records/constructor').set(admin())).status).toBe(404);
  });
});
describe('Admin record integrity', () => {
  it('creates a valid hub with geographic coordinates', async () => {
    const res = await request(app).post('/admin/api/records/hubs').set(admin()).send({ name: 'South', address: 'Main road', lat: -17.2, lng: 78.3 });
    expect(res.status).toBe(201); expect(mockDb.hub.create).toHaveBeenCalled();
  });
  it('rejects unknown fields instead of allowing lifecycle or identity changes', async () => {
    const res = await request(app).post('/admin/api/records/riders').set(admin()).send({ phone: '+919123456789', role: 'ADMIN' });
    expect(res.status).toBe(400); expect(mockDb.user.create).not.toHaveBeenCalled();
  });
  it('rejects negative expense and manual payment amounts', async () => {
    for (const entity of ['expenses', 'payments']) {
      const res = await request(app).post(`/admin/api/records/${entity}`).set(admin()).send(entity === 'expenses' ? { category: 'MISC', amount: -1, date: '2026-10-01' } : { userId: 'rider', purpose: 'RENT', amount: -1, provider: 'CASH' });
      expect(res.status).toBe(400);
    }
  });
  it('does not accept changes to booking price snapshots', async () => {
    expect((await request(app).put('/admin/api/records/bookings/b1').set(admin()).send({ totalAmount: 0 })).status).toBe(400);
  });
  it('blocks changing a rented vehicle', async () => {
    mockDb.bike.findFirst.mockResolvedValue({ id: 'b1', status: 'RENTED' });
    expect((await request(app).put('/admin/api/records/bikes/b1').set(admin()).send({ batteryPercent: 90 })).status).toBe(409);
    expect(mockDb.bike.update).not.toHaveBeenCalled();
  });
  it('blocks editing paid payroll', async () => {
    mockDb.salary.findFirst.mockResolvedValue({ id: 's1', status: 'PAID' });
    expect((await request(app).put('/admin/api/records/salaries/s1').set(admin()).send({ bonuses: 10 })).status).toBe(409);
  });
  it('recalculates draft payroll when bonuses change', async () => {
    mockDb.salary.findFirst.mockResolvedValue({ id: 's1', status: 'PENDING', baseSalary: 10000, bonuses: 0, deductions: 500 });
    expect((await request(app).put('/admin/api/records/salaries/s1').set(admin()).send({ bonuses: 100 })).status).toBe(200);
    expect(mockDb.salary.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { bonuses: 100, netPaid: 9600 } });
  });
  it('protects ledgers and derived histories from mutation', async () => {
    expect((await request(app).post('/admin/api/records/wallet').set(admin()).send({ amount: 50 })).status).toBe(409);
    expect((await request(app).delete('/admin/api/records/deployments/d1').set(admin()).send({ reason: 'mistake' })).status).toBe(409);
  });
  it('requires a reason for deletion', async () => {
    expect((await request(app).delete('/admin/api/records/hubs/h1').set(admin()).send({})).status).toBe(400);
  });
  it('deletes an unused expense', async () => {
    mockDb.expense.findFirst.mockResolvedValue({ id: 'e1', amount: 500 });
    expect((await request(app).delete('/admin/api/records/expenses/e1').set(admin()).send({ reason: 'Duplicate entry' })).status).toBe(200);
    expect(mockDb.expense.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
  });
  it('normalizes rider phones before creating an account', async () => {
    expect((await request(app).post('/admin/api/records/riders').set(admin()).send({ phone: '9123456789' })).status).toBe(201);
    expect(mockDb.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ phone: '+919123456789', role: 'RIDER' }) });
  });
  it('rejects deletion when cascade-linked vehicles exist', async () => {
    mockDb.hub.findFirst.mockResolvedValue({ id: 'h1' });
    mockDb.bike.count.mockResolvedValue(1);
    expect((await request(app).delete('/admin/api/records/hubs/h1').set(admin()).send({ reason: 'duplicate' })).status).toBe(409);
    expect(mockDb.hub.delete).not.toHaveBeenCalled();
  });
  it('updates an editable expense and returns a missing-record error', async () => {
    mockDb.expense.findFirst.mockResolvedValue({ id: 'e1' });
    expect((await request(app).put('/admin/api/records/expenses/e1').set(admin()).send({ amount: 500 })).status).toBe(200);
    mockDb.expense.findFirst.mockResolvedValue(null);
    expect((await request(app).put('/admin/api/records/expenses/missing').set(admin()).send({ amount: 500 })).status).toBe(404);
  });
});
describe('Form input validation', () => {
  it.each([NaN, Infinity, 0.5, 2147483648])('rejects invalid integer money %s', amount => {
    expect(() => validateRecordInput(RECORDS.expenses, { amount }, false)).toThrow();
  });
  it('rejects invalid dates, email and enum values', () => {
    expect(() => validateRecordInput(RECORDS.expenses, { date: 'broken' }, false)).toThrow();
    expect(() => validateRecordInput(RECORDS.riders, { email: 'broken' }, false)).toThrow();
    expect(() => validateRecordInput(RECORDS.bikes, { status: 'RENTED' }, false)).toThrow();
  });
});
