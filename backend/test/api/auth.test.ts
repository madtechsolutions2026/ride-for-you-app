/**
 * Module: Login & Authentication (LOG-001 .. LOG-008)
 *
 * The dashboard has no password store — staff sign in with the same phone + OTP
 * flow as riders (see auth.controller.ts). "Credentials" below therefore means
 * "a phone that resolves to a staff role". OTP `123456` is a hard-coded dev
 * bypass accepted by verifyOtp.
 */
import jwt from 'jsonwebtoken';
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { makeUser, uniquePhone, bearer } from '../helpers/factories';

const JWT_SECRET = process.env.JWT_SECRET as string;

describe('Login & Authentication', () => {
  it('LOG-001 issues tokens for a valid phone + OTP and maps the seeded admin phone to ADMIN', async () => {
    const phone = '+917095682464'; // ADMIN_PHONES in auth.controller.ts
    const reqRes = await api().post('/auth/otp/request').send({ phone });
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.challengeId).toEqual(expect.any(String));

    const verify = await api()
      .post('/auth/otp/verify')
      .send({ challengeId: reqRes.body.challengeId, otp: '123456' });

    expect(verify.status).toBe(200);
    expect(verify.body.tokens.accessToken).toEqual(expect.any(String));
    expect(verify.body.user.role).toBe('ADMIN');

    const decoded = jwt.verify(verify.body.tokens.accessToken, JWT_SECRET) as any;
    expect(decoded.role).toBe('ADMIN');
  });

  it('LOG-001b a normal phone resolves to a RIDER account', async () => {
    const phone = uniquePhone();
    const { body } = await api().post('/auth/otp/request').send({ phone });
    const verify = await api().post('/auth/otp/verify').send({ challengeId: body.challengeId, otp: '123456' });
    expect(verify.status).toBe(200);
    expect(verify.body.user.role).toBe('RIDER');
  });

  it('LOG-002 rejects an incorrect OTP', async () => {
    const { body } = await api().post('/auth/otp/request').send({ phone: uniquePhone() });
    const verify = await api()
      .post('/auth/otp/verify')
      .send({ challengeId: body.challengeId, otp: '000000' });
    expect(verify.status).toBe(400);
    expect(verify.body.error).toMatch(/incorrect otp/i);
  });

  it('LOG-002b rejects a verify against an unknown challenge', async () => {
    const verify = await api()
      .post('/auth/otp/verify')
      .send({ challengeId: 'otp_ch_does_not_exist', otp: '123456' });
    expect(verify.status).toBe(400);
    expect(verify.body.error).toMatch(/invalid or expired/i);
  });

  it('LOG-003 rejects an OTP request with no phone', async () => {
    const res = await api().post('/auth/otp/request').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phone/i);
  });

  it('LOG-003b rejects a verify with no OTP code', async () => {
    const { body } = await api().post('/auth/otp/request').send({ phone: uniquePhone() });
    const res = await api().post('/auth/otp/verify').send({ challengeId: body.challengeId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/otp code is required/i);
  });

  it('LOG-004 logout revokes every active session for the user', async () => {
    const user = await makeUser({ role: 'ADMIN' });
    await prisma.session.create({
      data: { userId: user.id, refreshToken: 'rt-logout-test', expiresAt: new Date(Date.now() + 86400_000) },
    });

    const res = await api().post('/auth/logout').set(bearer(user.id, user.role)).send({});
    expect(res.status).toBe(200);

    const live = await prisma.session.count({ where: { userId: user.id, revoked: false } });
    expect(live).toBe(0);
  });

  it('LOG-004b logout without a token is rejected', async () => {
    const res = await api().post('/auth/logout').send({});
    expect(res.status).toBe(401);
  });

  it('LOG-005 an expired access token is refused on a protected route', async () => {
    const user = await makeUser({ role: 'ADMIN' });
    const expired = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: -10 });
    const res = await api().get('/admin/api/stats').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('LOG-005b a refresh token renews the session and returns a fresh access token', async () => {
    const user = await makeUser({ role: 'ADMIN' });
    const refreshToken = jwt.sign({ id: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
    await prisma.session.create({
      data: { userId: user.id, refreshToken, expiresAt: new Date(Date.now() + 30 * 86400_000) },
    });

    const res = await api().post('/auth/token/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const decoded = jwt.verify(res.body.accessToken, JWT_SECRET) as any;
    expect(decoded.id).toBe(user.id);

    // A revoked / unknown refresh token is rejected.
    await prisma.session.updateMany({ where: { userId: user.id }, data: { revoked: true } });
    const stale = await api().post('/auth/token/refresh').send({ refreshToken });
    expect(stale.status).toBe(401);
  });

  it('LOG-006 a protected dashboard route requires a token', async () => {
    const res = await api().get('/admin/api/stats');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/access token required/i);
  });

  it('LOG-007 repeated wrong OTPs keep returning 400 (NOTE: no lockout / attempt cap is implemented)', async () => {
    const { body } = await api().post('/auth/otp/request').send({ phone: uniquePhone() });
    for (let i = 0; i < 6; i++) {
      const res = await api()
        .post('/auth/otp/verify')
        .send({ challengeId: body.challengeId, otp: '000001' });
      expect(res.status).toBe(400);
    }
    // A correct OTP still works afterwards — there is no attempt-based lock.
    const ok = await api().post('/auth/otp/verify').send({ challengeId: body.challengeId, otp: '123456' });
    expect(ok.status).toBe(200);
  });

  it.skip('LOG-008 password reset — N/A: OTP-only auth, there is no password to reset', () => {});
});
