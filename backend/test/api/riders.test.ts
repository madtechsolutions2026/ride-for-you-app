/**
 * Module: Customer / Rider Management (CUS-001 .. CUS-012)
 * Endpoints: GET /admin/api/users, PUT /admin/api/users/:id/status,
 *            GET /admin/api/kyc/submissions, GET /admin/api/bookings,
 *            GET /admin/api/rentals
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import {
  actingAs,
  makeUser,
  makeKyc,
  makeActiveRental,
  makeFleetContext,
  makeBooking,
} from '../helpers/factories';

describe('Customer / Rider Management', () => {
  it('CUS-001 lists a rider with the expected profile fields', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER', fullName: 'Anil Kumar', city: 'Hyderabad', email: 'anil@x.com' });

    const res = await api().get('/admin/api/users').set(headers);
    expect(res.status).toBe(200);
    const found = res.body.users.find((u: any) => u.id === rider.id);
    expect(found).toMatchObject({
      fullName: 'Anil Kumar',
      city: 'Hyderabad',
      email: 'anil@x.com',
      role: 'RIDER',
      accountStatus: 'ACTIVE',
      kycStatus: 'PENDING',
    });
  });

  it('CUS-002 searches a rider by name (case-insensitive substring)', async () => {
    const { headers } = await actingAs('ADMIN');
    await makeUser({ role: 'RIDER', fullName: 'Sneha Reddy' });
    await makeUser({ role: 'RIDER', fullName: 'Ravi Teja' });

    const res = await api().get('/admin/api/users').query({ search: 'sneha' }).set(headers);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].fullName).toBe('Sneha Reddy');
  });

  it('CUS-003 searches a rider by mobile number', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER', phone: '+919812345678' });
    await makeUser({ role: 'RIDER', phone: '+919999888877' });

    const res = await api().get('/admin/api/users').query({ search: '9812345678' }).set(headers);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].id).toBe(rider.id);
  });

  it('CUS-004 views a rider booking history by filtering bookings on their phone', async () => {
    const { headers } = await actingAs('ADMIN');
    const ctx = await makeFleetContext();
    await makeBooking({ userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'CONFIRMED' });
    await makeBooking({ userId: ctx.rider.id, modelId: ctx.model.id, planId: ctx.plan.id, hubId: ctx.hub.id, status: 'CANCELLED' });

    const res = await api().get('/admin/api/bookings').query({ search: ctx.rider.phone }).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('CUS-005/006 KYC status and document references are visible to admin', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER', kycStatus: 'SUBMITTED' });
    await makeKyc(rider.id, { status: 'SUBMITTED' });

    const res = await api().get('/admin/api/kyc/submissions').set(headers);
    expect(res.status).toBe(200);
    const sub = res.body.submissions.find((s: any) => s.userId === rider.id);
    expect(sub.status).toBe('SUBMITTED');
    // Document URL fields are present (null here — R2 unconfigured in tests).
    expect(sub).toHaveProperty('aadhaarFrontUrl');
    expect(sub).toHaveProperty('panCardUrl');
    expect(sub).toHaveProperty('selfieUrl');
  });

  it('CUS-009/010 active vs previous rentals are separable by status', async () => {
    const { headers } = await actingAs('ADMIN');
    await makeActiveRental();
    const done = await makeActiveRental();
    await prisma.rental.update({ where: { id: done.rental.id }, data: { status: 'COMPLETED', closedAt: new Date() } });

    const active = await api().get('/admin/api/rentals').query({ status: 'ACTIVE' }).set(headers);
    const completed = await api().get('/admin/api/rentals').query({ status: 'COMPLETED' }).set(headers);
    expect(active.body.count).toBe(1);
    expect(completed.body.count).toBe(1);
  });

  it('CUS-011 account deactivation status is reflected in the list', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER', accountStatus: 'SUSPENDED' });
    const res = await api().get('/admin/api/users').query({ search: rider.phone.slice(-10) }).set(headers);
    expect(res.body.users[0].accountStatus).toBe('SUSPENDED');
  });

  it('CUS block / unblock a rider (ADMIN only)', async () => {
    const { headers } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER' });

    const block = await api().put(`/admin/api/users/${rider.id}/status`).set(headers).send({ accountStatus: 'SUSPENDED' });
    expect(block.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: rider.id } }))?.accountStatus).toBe('SUSPENDED');

    const unblock = await api().put(`/admin/api/users/${rider.id}/status`).set(headers).send({ accountStatus: 'ACTIVE' });
    expect(unblock.status).toBe(200);
  });

  it('CUS-012 a non-admin staff member cannot change a rider account', async () => {
    const { headers } = await actingAs('SUPPORT');
    const rider = await makeUser({ role: 'RIDER' });
    const res = await api().put(`/admin/api/users/${rider.id}/status`).set(headers).send({ accountStatus: 'SUSPENDED' });
    expect(res.status).toBe(403);
  });

  it('CUS filters riders by KYC status', async () => {
    const { headers } = await actingAs('ADMIN');
    await makeUser({ role: 'RIDER', kycStatus: 'APPROVED' });
    await makeUser({ role: 'RIDER', kycStatus: 'PENDING' });

    const res = await api().get('/admin/api/users').query({ role: 'RIDER', kycStatus: 'APPROVED' }).set(headers);
    expect(res.body.users.every((u: any) => u.kycStatus === 'APPROVED')).toBe(true);
    expect(res.body.users).toHaveLength(1);
  });

  it.skip('CUS-007 secure bank-details visibility — no bank-account entity in the schema', () => {});
  it.skip('CUS-008 view attachment details — no attachment entity in the schema', () => {});
});
