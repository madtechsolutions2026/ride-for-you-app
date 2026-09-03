/**
 * Module: KYC Approval (KYC-001 .. KYC-016)
 * Endpoints: /admin/api/kyc/*  (admin.controller + kyc.controller)
 */
import { api } from '../helpers/api';
import { prisma } from '../../src/utils/prisma';
import { actingAs, bearer, makeUser, makeKyc } from '../helpers/factories';

async function riderWithPendingKyc() {
  const rider = await makeUser({ role: 'RIDER', kycStatus: 'SUBMITTED' });
  const kyc = await makeKyc(rider.id, { status: 'SUBMITTED' });
  return { rider, kyc };
}

describe('KYC Approval', () => {
  it('KYC-001 lists the pending review queue (oldest first)', async () => {
    const { headers } = await actingAs('ADMIN');
    const { kyc } = await riderWithPendingKyc();
    await makeKyc((await makeUser({ role: 'RIDER' })).id, { status: 'APPROVED' });

    const res = await api().get('/admin/api/kyc/pending').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].id).toBe(kyc.id);
  });

  it('KYC-002 approves a valid submission and mirrors the status onto the rider', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rider, kyc } = await riderWithPendingKyc();

    const res = await api().post(`/admin/api/kyc/review/${kyc.id}`).set(headers).send({ action: 'APPROVE' });
    expect(res.status).toBe(200);
    expect((await prisma.kycVerification.findUnique({ where: { id: kyc.id } }))?.status).toBe('APPROVED');
    expect((await prisma.user.findUnique({ where: { id: rider.id } }))?.kycStatus).toBe('APPROVED');
  });

  it('KYC-003 rejects a submission, stores the reason, and sets the rider to REJECTED', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rider, kyc } = await riderWithPendingKyc();

    const res = await api()
      .post(`/admin/api/kyc/review/${kyc.id}`)
      .set(headers)
      .send({ action: 'REJECT', reason: 'Aadhaar photo blurred' });
    expect(res.status).toBe(200);

    const row = await prisma.kycVerification.findUnique({ where: { id: kyc.id } });
    expect(row?.status).toBe('REJECTED');
    expect(row?.rejectReason).toBe('Aadhaar photo blurred');
    expect((await prisma.user.findUnique({ where: { id: rider.id } }))?.kycStatus).toBe('REJECTED');
  });

  it('KYC-013 a rejection with no reason is refused', async () => {
    const { headers } = await actingAs('ADMIN');
    const { kyc } = await riderWithPendingKyc();
    const res = await api().post(`/admin/api/kyc/review/${kyc.id}`).set(headers).send({ action: 'REJECT' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason is required/i);
  });

  it('KYC review rejects an invalid action', async () => {
    const { headers } = await actingAs('ADMIN');
    const { kyc } = await riderWithPendingKyc();
    const res = await api().post(`/admin/api/kyc/review/${kyc.id}`).set(headers).send({ action: 'MAYBE' });
    expect(res.status).toBe(400);
  });

  it('KYC-004 after a rejection the rider becomes eligible to resubmit', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rider, kyc } = await riderWithPendingKyc();
    await api().post(`/admin/api/kyc/review/${kyc.id}`).set(headers).send({ action: 'REJECT', reason: 'redo' });

    const meAsRider = await api().get('/kyc/me').set(bearer(rider.id, 'RIDER'));
    expect(meAsRider.status).toBe(200);
    expect(meAsRider.body.canSubmit).toBe(true);
  });

  it('KYC-002b cannot review a submission twice', async () => {
    const { headers } = await actingAs('ADMIN');
    const { kyc } = await riderWithPendingKyc();
    await api().post(`/admin/api/kyc/review/${kyc.id}`).set(headers).send({ action: 'APPROVE' });

    const again = await api().post(`/admin/api/kyc/review/${kyc.id}`).set(headers).send({ action: 'REJECT', reason: 'x' });
    expect(again.status).toBe(409);
  });

  it('KYC-005/006/010 the detail view exposes each document reference', async () => {
    const { headers } = await actingAs('ADMIN');
    const { kyc } = await riderWithPendingKyc();

    const res = await api().get(`/admin/api/kyc/${kyc.id}`).set(headers);
    expect(res.status).toBe(200);
    for (const f of ['aadhaarFrontUrl', 'aadhaarBackUrl', 'panCardUrl', 'selfieUrl', 'addressProofUrl']) {
      expect(res.body.verification).toHaveProperty(f);
    }
    expect(res.body.verification.aadhaarNumber).toBeTruthy();
    expect(res.body.verification.panNumber).toBeTruthy();
  });

  it('KYC-015 filters submissions by status', async () => {
    const { headers } = await actingAs('ADMIN');
    await makeKyc((await makeUser({ role: 'RIDER' })).id, { status: 'SUBMITTED' });
    await makeKyc((await makeUser({ role: 'RIDER' })).id, { status: 'APPROVED' });

    const res = await api().get('/admin/api/kyc/submissions').query({ status: 'APPROVED' }).set(headers);
    expect(res.body.submissions.every((s: any) => s.status === 'APPROVED')).toBe(true);
    expect(res.body.count).toBe(1);
  });

  it('KYC-014 legacy review-by-userId resolves the latest pending submission', async () => {
    const { headers } = await actingAs('ADMIN');
    const { rider } = await riderWithPendingKyc();

    const res = await api().post('/admin/api/kyc/review').set(headers).send({ userId: rider.id, action: 'APPROVE' });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: rider.id } }))?.kycStatus).toBe('APPROVED');
  });

  it.failing(
    'KYC-012 approval should be blocked when mandatory documents are missing (GAP: reviewKyc does not validate document keys)',
    async () => {
      const { headers } = await actingAs('ADMIN');
      const rider = await makeUser({ role: 'RIDER', kycStatus: 'SUBMITTED' });
      const empty = await prisma.kycVerification.create({ data: { userId: rider.id, status: 'SUBMITTED' } });

      const res = await api().post(`/admin/api/kyc/review/${empty.id}`).set(headers).send({ action: 'APPROVE' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  );

  it.skip('KYC-007/008 Driving-Licence rules by vehicle category — no DL field in KycVerification', () => {});
  it.skip('KYC-009 selfie/face-match status — only a selfie key is stored, no match result', () => {});
  it.skip('KYC-011 responsibility video review — no such field in the schema', () => {});
  it.skip('KYC-016 search KYC by rider details — no search param on the KYC endpoints', () => {});
});
