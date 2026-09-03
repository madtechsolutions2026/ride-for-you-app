/**
 * Module: Employee Management (EMP-001 .. EMP-012)
 * Endpoints: /admin/api/staff  (staff.controller.ts) — ADMIN only.
 *
 * Staff are User rows with a non-RIDER role; they sign in with phone + OTP.
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, bearer, makeUser, makeHub, uniquePhone } from '../helpers/factories';

describe('Employee Management', () => {
  it('EMP-001 creates a new employee that can then sign in', async () => {
    const { headers } = await actingAs('ADMIN');
    const hub = await makeHub();
    const phone = uniquePhone();

    const res = await api()
      .post('/admin/api/staff')
      .set(headers)
      .send({ phone, fullName: 'Priya Rao', role: 'EXECUTIVE', email: 'Priya@RFY.com', assignedHubId: hub.id });

    expect(res.status).toBe(201);
    const created = await prisma.user.findUnique({ where: { phone } });
    expect(created).toMatchObject({ role: 'EXECUTIVE', fullName: 'Priya Rao', email: 'priya@rfy.com', assignedHubId: hub.id });
  });

  it('EMP-002 rejects a create that is missing mandatory fields', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api().post('/admin/api/staff').set(headers).send({ phone: uniquePhone() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phone, fullName and role/i);
  });

  it('EMP-002b rejects an unknown role', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api()
      .post('/admin/api/staff')
      .set(headers)
      .send({ phone: uniquePhone(), fullName: 'X', role: 'SUPERUSER' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/role must be one of/i);
  });

  it('EMP-003 edits employee information', async () => {
    const { headers } = await actingAs('ADMIN');
    const staff = await makeUser({ role: 'SUPPORT' });
    const res = await api()
      .put(`/admin/api/staff/${staff.id}`)
      .set(headers)
      .send({ fullName: 'Updated Name', email: 'new@rfy.com' });
    expect(res.status).toBe(200);
    expect(res.body.staff).toMatchObject({ fullName: 'Updated Name', email: 'new@rfy.com' });
  });

  it('EMP-004/005 assigns and then changes an employee role', async () => {
    const { headers } = await actingAs('ADMIN');
    const staff = await makeUser({ role: 'SUPPORT' });

    const res = await api().put(`/admin/api/staff/${staff.id}`).set(headers).send({ role: 'EXECUTIVE' });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: staff.id } }))?.role).toBe('EXECUTIVE');
  });

  it('EMP-006 deactivates an employee (another admin still active)', async () => {
    const { headers } = await actingAs('ADMIN'); // admin #1
    const staff = await makeUser({ role: 'EXECUTIVE' });

    const res = await api()
      .put(`/admin/api/staff/${staff.id}`)
      .set(headers)
      .send({ accountStatus: 'SUSPENDED' });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: staff.id } }))?.accountStatus).toBe('SUSPENDED');
  });

  it('EMP-006b refuses to suspend or demote the last active admin', async () => {
    const admin = await makeUser({ role: 'ADMIN' });
    const suspend = await api()
      .put(`/admin/api/staff/${admin.id}`)
      .set(bearer(admin.id, 'ADMIN'))
      .send({ accountStatus: 'SUSPENDED' });
    expect(suspend.status).toBe(409);
    expect(suspend.body.error).toMatch(/last active admin/i);
  });

  it('EMP-007 reactivates a suspended employee', async () => {
    const { headers } = await actingAs('ADMIN');
    const staff = await makeUser({ role: 'EXECUTIVE', accountStatus: 'SUSPENDED' });
    const res = await api().put(`/admin/api/staff/${staff.id}`).set(headers).send({ accountStatus: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: staff.id } }))?.accountStatus).toBe('ACTIVE');
  });

  it('EMP-008 promoting an existing phone updates the account instead of duplicating it', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });

    const res = await api()
      .post('/admin/api/staff')
      .set(headers)
      .send({ phone: rider.phone, fullName: 'Now Staff', role: 'SUPPORT' });

    expect(res.status).toBe(201);
    expect(await prisma.user.count({ where: { phone: rider.phone } })).toBe(1);
    expect((await prisma.user.findUnique({ where: { id: rider.id } }))?.role).toBe('SUPPORT');
  });

  it('EMP-008b will not promote a suspended account to staff', async () => {
    const { headers } = await actingAs('ADMIN');
    const blocked = await makeUser({ role: 'RIDER', accountStatus: 'SUSPENDED' });
    const res = await api()
      .post('/admin/api/staff')
      .set(headers)
      .send({ phone: blocked.phone, fullName: 'X', role: 'SUPPORT' });
    expect(res.status).toBe(409);
  });

  it('EMP-009 an employee can use the dashboard immediately after creation', async () => {
    const { headers } = await actingAs('ADMIN');
    const phone = uniquePhone();
    await api().post('/admin/api/staff').set(headers).send({ phone, fullName: 'E', role: 'EXECUTIVE' });
    const staff = await prisma.user.findUniqueOrThrow({ where: { phone } });

    const res = await api().get('/admin/api/stats').set(bearer(staff.id, staff.role));
    expect(res.status).toBe(200);
  });

  it('EMP revoke reverts a staff member to RIDER and kills their sessions', async () => {
    const { headers } = await actingAs('ADMIN');
    const staff = await makeUser({ role: 'EXECUTIVE' });
    await prisma.session.create({
      data: { userId: staff.id, refreshToken: 'rt-revoke', expiresAt: new Date(Date.now() + 86400_000) },
    });

    const res = await api().delete(`/admin/api/staff/${staff.id}`).set(headers);
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: staff.id } }))?.role).toBe('RIDER');
    expect(await prisma.session.count({ where: { userId: staff.id, revoked: false } })).toBe(0);
  });

  it('EMP revoke refuses to remove your own access', async () => {
    const admin = await makeUser({ role: 'ADMIN' });
    await makeUser({ role: 'ADMIN' }); // keep a second admin so the last-admin guard is not the blocker
    const res = await api().delete(`/admin/api/staff/${admin.id}`).set(bearer(admin.id, 'ADMIN'));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/your own access/i);
  });

  it.failing(
    'EMP-010 a deactivated employee should not be able to obtain fresh tokens (GAP: verifyOtp ignores accountStatus)',
    async () => {
      const staff = await makeUser({ role: 'EXECUTIVE', accountStatus: 'SUSPENDED', phone: uniquePhone() });
      const { body } = await api().post('/auth/otp/request').send({ phone: staff.phone });
      const verify = await api()
        .post('/auth/otp/verify')
        .send({ challengeId: body.challengeId, otp: '123456' });
      expect(verify.status).toBeGreaterThanOrEqual(400);
    }
  );

  it.skip('EMP-011 search employee — listStaff exposes no search param (client-side filter only)', () => {});
  it.skip('EMP-012 filter employees by status — listStaff exposes no status filter param', () => {});
});
