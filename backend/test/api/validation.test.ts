/**
 * Module: Data Validation & Error Handling (DAT-001 .. DAT-015)
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, bearer, makeUser, makeHub, makeModel } from '../helpers/factories';

describe('Data Validation & Error Handling', () => {
  it('DAT-001 mandatory-field validation across create endpoints', async () => {
    const { headers } = await actingAs('ADMIN');
    expect((await api().post('/admin/api/hubs').set(headers).send({ name: 'Only name' })).status).toBe(400);
    expect((await api().post('/admin/api/staff').set(headers).send({ fullName: 'x' })).status).toBe(400);
    expect((await api().post('/admin/api/fleet/models').set(headers).send({ name: 'x' })).status).toBe(400);
  });

  it('DAT-008 duplicate records are rejected at the unique constraint', async () => {
    const { headers } = await actingAs('ADMIN');
    const hub = await makeHub();
    const model = await makeModel();
    const body = { modelId: model.id, hubId: hub.id, registrationNumber: 'TS09EA1234' };
    expect((await api().post('/admin/api/fleet/bikes').set(headers).send(body)).status).toBe(201);
    expect((await api().post('/admin/api/fleet/bikes').set(headers).send(body)).status).toBe(409);
  });

  it('DAT-011/013 an unknown API route returns a JSON 404, not an HTML page', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api().get('/admin/api/this-route-does-not-exist').set(headers);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Not Found' });
  });

  it('DAT-011b a malformed JSON body is handled without a stack trace leak', async () => {
    const { headers } = await actingAs('ADMIN');
    const res = await api()
      .post('/admin/api/hubs')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send('{ "name": '); // invalid JSON
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('DAT-009 an over-size KYC document upload is rejected with 413', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const tooBig = Buffer.alloc(9 * 1024 * 1024, 1);

    const res = await api()
      .post('/kyc/documents')
      .set(bearer(rider.id, 'RIDER'))
      .field('docType', 'aadhaar_front')
      .attach('file', tooBig, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(413);
  });

  it('DAT KYC upload rejects an unknown docType', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const res = await api()
      .post('/kyc/documents')
      .set(bearer(rider.id, 'RIDER'))
      .field('docType', 'passport')
      .attach('file', Buffer.from('x'), { filename: 'p.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  it('DAT-004 a KYC submit with a forged document key (wrong owner prefix) is rejected', async () => {
    const rider = await makeUser({ role: 'RIDER' });
    const res = await api()
      .post('/kyc/submit')
      .set(bearer(rider.id, 'RIDER'))
      .send({ fullName: 'X', aadhaarFrontKey: 'kyc/someone-else/aadhaar_front.jpg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a valid document reference/i);
  });

  it('DAT the staff last-admin guard prevents an inconsistent state', async () => {
    const admin = await makeUser({ role: 'ADMIN' });
    const res = await api().delete(`/admin/api/staff/${admin.id}`).set(bearer(admin.id, 'ADMIN'));
    expect(res.status).toBe(409);
  });

  it.failing(
    'DAT-003 an invalid email format should be rejected on staff create (GAP: no email format validation)',
    async () => {
      const { headers } = await actingAs('ADMIN');
      const res = await api()
        .post('/admin/api/staff')
        .set(headers)
        .send({ phone: '+919777000111', fullName: 'Bad Email', role: 'SUPPORT', email: 'not-an-email' });
      expect(res.status).toBe(400);
    }
  );

  it.failing(
    'DAT-006 a negative payment amount should be rejected (GAP: recordManualPayment accepts any number)',
    async () => {
      const { headers } = await actingAs('ADMIN');
      const rider = await makeUser({ role: 'RIDER' });
      const res = await api()
        .post('/admin/api/payments')
        .set(headers)
        .send({ userId: rider.id, purpose: 'RENT', amount: -5000 });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await prisma.payment.count()).toBe(0);
    }
  );

  it.failing(
    'DAT-010 an unsupported file type should be rejected by the KYC upload (GAP: ALLOWED_MIME silently falls back to png)',
    async () => {
      const rider = await makeUser({ role: 'RIDER' });
      const res = await api()
        .post('/kyc/documents')
        .set(bearer(rider.id, 'RIDER'))
        .field('docType', 'aadhaar_front')
        .attach('file', Buffer.from('plain text, not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  );

  it.skip('DAT-002 invalid mobile number — normalisePhone coerces any input; there is no format rejection', () => {});
  it.skip('DAT-005 invalid date range — no admin endpoint takes a date range', () => {});
  it.skip('DAT-012/014 network-interruption / refresh-during-submit — client-side concerns', () => {});
});
