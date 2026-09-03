/**
 * Module: Security Testing (SEC-001 .. SEC-014) — API-level checks only.
 */
import jwt from 'jsonwebtoken';
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, bearer, makeUser, makeKyc } from '../helpers/factories';

const JWT_SECRET = process.env.JWT_SECRET as string;

describe('Security Testing', () => {
  it('SEC-001 a protected endpoint rejects an anonymous request', async () => {
    expect((await api().get('/admin/api/stats')).status).toBe(401);
  });

  it('SEC-002 a RIDER token is refused by every dashboard endpoint', async () => {
    const { headers } = await actingAs('RIDER');
    expect((await api().get('/admin/api/users').set(headers)).status).toBe(403);
  });

  it('SEC-003 direct URL access to an ADMIN-only route is blocked for other staff', async () => {
    const { headers } = await actingAs('SUPPORT');
    expect((await api().post('/admin/api/fleet/models').set(headers).send({})).status).toBe(403);
  });

  it('SEC-004 an expired token is refused', async () => {
    const u = await makeUser({ role: 'ADMIN' });
    const expired = jwt.sign({ id: u.id, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '-1h' });
    expect((await api().get('/admin/api/stats').set('Authorization', `Bearer ${expired}`)).status).toBe(403);
  });

  it('SEC-010 a token signed with the wrong secret is refused', async () => {
    const u = await makeUser({ role: 'ADMIN' });
    const forged = jwt.sign({ id: u.id, role: 'ADMIN' }, 'not-the-real-secret');
    expect((await api().get('/admin/api/stats').set('Authorization', `Bearer ${forged}`)).status).toBe(403);
  });

  it('SEC-010b a garbage Authorization header is refused', async () => {
    expect((await api().get('/admin/api/stats').set('Authorization', 'Bearer xxxxx')).status).toBe(403);
    // No "Bearer <token>" shape at all -> no token extracted -> 401
    expect((await api().get('/admin/api/stats').set('Authorization', 'GarbageNoSpace')).status).toBe(401);
  });

  it('SEC-005 logout revokes the session so its refresh token stops working', async () => {
    const u = await makeUser({ role: 'ADMIN' });
    const refreshToken = jwt.sign({ id: u.id, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
    await prisma.session.create({
      data: { userId: u.id, refreshToken, expiresAt: new Date(Date.now() + 30 * 86400_000) },
    });

    await api().post('/auth/logout').set(bearer(u.id, 'ADMIN')).send({});
    const res = await api().post('/auth/token/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it('SEC-009 KYC admin endpoints are ADMIN-only (EXECUTIVE is refused)', async () => {
    const { headers } = await actingAs('EXECUTIVE');
    expect((await api().get('/kyc/admin/pending').set(headers)).status).toBe(403);
    expect((await api().get('/kyc/admin').set(headers)).status).toBe(403);
  });

  it('SEC-011 a SQL-injection payload in search is treated as a literal string', async () => {
    const { headers } = await actingAs('ADMIN');
    await makeUser({ role: 'RIDER', fullName: 'Real Rider' });
    const before = await prisma.user.count();

    const res = await api().get('/admin/api/users').query({ search: "'; DROP TABLE \"User\"; --" }).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
    expect(await prisma.user.count()).toBe(before); // table intact
  });

  it('SEC-012 script markup in a text field is stored verbatim (output-escaping is the client contract)', async () => {
    const { headers } = await actingAs('ADMIN');
    const payload = '<script>alert(1)</script>';
    const res = await api()
      .post('/admin/api/hubs')
      .set(headers)
      .send({ name: payload, address: 'x', lat: 17.4, lng: 78.3 });
    expect(res.status).toBe(201);
    expect(res.body.hub.name).toBe(payload); // not executed, not mangled — stored as data
  });

  it('SEC-014 a critical action records who performed it (KYC review -> reviewedBy)', async () => {
    const { headers, user } = await actingAs('ADMIN');
    const rider = await makeUser({ role: 'RIDER', kycStatus: 'SUBMITTED' });
    const kyc = await makeKyc(rider.id, { status: 'SUBMITTED' });

    await api().post(`/admin/api/kyc/review/${kyc.id}`).set(headers).send({ action: 'APPROVE' });
    const row = await prisma.kycVerification.findUniqueOrThrow({ where: { id: kyc.id } });
    expect(row.reviewedBy).toBe(user.id);
    expect(row.reviewedAt).toBeInstanceOf(Date);
  });

  it.skip('SEC-006 password security — OTP-only auth, no passwords are stored', () => {});
  it.skip('SEC-007 sensitive-data masking — staff APIs return full phone / Aadhaar / PAN by design; no masking layer exists', () => {});
  it.skip('SEC-008 bank-details access restriction — no bank-account entity in the schema', () => {});
  it.skip('SEC-013 file-upload security — size guard covered in validation.test.ts (DAT-009); type guard is an open gap (DAT-010)', () => {});
});
