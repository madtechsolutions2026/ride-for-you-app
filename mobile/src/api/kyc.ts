import { apiClient } from './client';

export type KycDisplayStatus = 'Pending' | 'Verified' | 'Submitted' | 'Rejected';

export function kycDisplayStatus(status: unknown): KycDisplayStatus {
  switch (status) {
    case 'APPROVED': return 'Verified';
    case 'SUBMITTED': return 'Submitted';
    case 'REJECTED': return 'Rejected';
    case 'PENDING': return 'Pending';
    default: throw new Error('Unable to confirm KYC status. Please refresh.');
  }
}

export async function loadKyc() {
  const { data } = await apiClient.get('/kyc/me');
  const status = kycDisplayStatus(data?.kycStatus);
  if (status === 'Submitted' && data?.latestSubmission?.status !== 'SUBMITTED') {
    throw new Error('No pending submission was found. Please contact support.');
  }
  return { ...data, displayStatus: status as KycDisplayStatus };
}

export async function submitKyc(details: Record<string, unknown>) {
  for (const field of ['aadhaarFrontKey', 'aadhaarBackKey', 'addressProofKey', 'selfieKey']) {
    if (!details[field]) throw new Error('Upload Aadhaar front and back, address proof and selfie successfully before submitting.');
  }
  const { data } = await apiClient.post('/kyc/submit', details);
  if (!data?.verification?.id || data.verification.status !== 'SUBMITTED') {
    throw new Error('The server did not confirm your submission. Refresh your KYC status before retrying.');
  }
  return data.verification;
}
