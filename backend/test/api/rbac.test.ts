/**
 * Module: Role-Based Access (ROL-001 .. ROL-009)
 *
 * Guards live in middleware/auth.ts (`authenticateToken`, `requireRole`) and
 * admin.routes.ts. Any staff role reaches `/admin/api/*`; an inline
 * `requireRole('ADMIN')` protects the sensitive mutations.
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, bearer, makeUser } from '../helpers/factories';
import { generateAccessToken } from '../../src/middleware/auth';

describe('Role-Based Access', () => {
  it('ROL-001 ADMIN reaches every dashboard area', async () => {
    const { headers } = await actingAs('ADMIN');
    for (const path of ['/admin/api/stats', '/admin/api/users', '/admin/api/staff', '/admin/api/fleet', '/admin/api/bookings']) {
      const res = await api().get(path).set(headers);
      expect(res.status).toBe(200);
    }
  });

  it('ROL-002 EXECUTIVE reaches shared screens but not ADMIN-only ones', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    expect((await api().get('/admin/api/stats').set(headers)).status).toBe(200);
    expect((await api().get('/admin/api/fleet').set(headers)).status).toBe(200);

    const staff = await api().get('/admin/api/staff').set(headers);
    expect(staff.status).toBe(403);
    expect(staff.body.error).toMatch(/insufficient permissions/i);
  });

  it('ROL-003 SUPPORT reaches shared screens but not ADMIN-only ones', async () => {
    const { headers } = await actingAs('SUPPORT');
    expect((await api().get('/admin/api/stats').set(headers)).status).toBe(200);
    expect((await api().get('/admin/api/staff').set(headers)).status).toBe(403);
  });

  it('ROL-004 a RIDER token cannot open any dashboard endpoint', async () => {
    const { headers } = await actingAs('RIDER');
    const res = await api().get('/admin/api/stats').set(headers);
    expect(res.status).toBe(403);
  });

  it('ROL-005 direct URL access is blocked without the right role / token', async () => {
    // no token
    expect((await api().post('/admin/api/hubs').send({})).status).toBe(401);
    // wrong role
    const { headers } = await actingAs('EXECUTIVE');
    expect((await api().post('/admin/api/hubs').set(headers).send({})).status).toBe(403);
  });

  it('ROL-006 a role change takes effect on the next token (JWT carries the role)', async () => {
    const user = await makeUser({ role: 'RIDER' });
    expect((await api().get('/admin/api/stats').set(bearer(user.id, 'RIDER'))).status).toBe(403);

    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    const fresh = generateAccessToken(user.id, 'ADMIN');
    expect((await api().get('/admin/api/stats').set('Authorization', `Bearer ${fresh}`)).status).toBe(200);
  });

  it('ROL-008 a non-ADMIN staff member cannot perform ADMIN-only mutations', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    const res = await api()
      .post('/admin/api/fleet/models')
      .set(headers)
      .send({ name: 'X', category: 'SWAP', topSpeedKmph: 25, rangeKm: 60 });
    expect(res.status).toBe(403);
    expect(await prisma.bikeModel.count()).toBe(0);
  });

  it.failing(
    'ROL-007 a SUSPENDED staff account should lose dashboard access immediately (GAP: authenticateToken ignores accountStatus)',
    async () => {
      const staff = await makeUser({ role: 'ADMIN', accountStatus: 'SUSPENDED' });
      const res = await api().get('/admin/api/stats').set(bearer(staff.id, 'ADMIN'));
      expect(res.status).toBe(403);
    }
  );

  it.skip('ROL-009 role changes recorded in audit logs — no audit-log table/endpoint exists yet', () => {});
});
