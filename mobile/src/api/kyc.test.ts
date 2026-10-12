import { apiClient } from './client';
import { loadKyc, submitKyc } from './kyc';

jest.mock('./client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
beforeEach(() => { get.mockReset(); post.mockReset(); });

it('resets under-review display when the server reports no submitted KYC', async () => {
  get.mockResolvedValueOnce({ data: { kycStatus: 'SUBMITTED', latestSubmission: { status: 'SUBMITTED' } } })
    .mockResolvedValueOnce({ data: { kycStatus: 'PENDING', latestSubmission: null } });
  expect((await loadKyc()).displayStatus).toBe('Submitted');
  expect((await loadKyc()).displayStatus).toBe('Pending');
  expect(get).toHaveBeenCalledWith('/kyc/me');
});
it('does not show under review without a saved pending submission', async () => {
  get.mockResolvedValue({ data: { kycStatus: 'SUBMITTED', latestSubmission: null } });
  await expect(loadKyc()).rejects.toThrow('No pending submission');
});
it.each([['APPROVED', 'Verified'], ['REJECTED', 'Rejected']])('reflects an admin %s decision', async (status, display) => {
  get.mockResolvedValue({ data: { kycStatus: status } });
  expect((await loadKyc()).displayStatus).toBe(display);
});
it('reports failed status requests instead of confirming a pending review', async () => {
  get.mockRejectedValue(new Error('offline'));
  await expect(loadKyc()).rejects.toThrow('offline');
});
it('does not submit with failed or missing document uploads', async () => {
  await expect(submitKyc({ fullName: 'Rider' })).rejects.toThrow('Upload Aadhaar');
  expect(post).not.toHaveBeenCalled();
});
const docs = { aadhaarFrontKey: 'kyc/user/front', aadhaarBackKey: 'kyc/user/back', addressProofKey: 'kyc/user/address', selfieKey: 'kyc/user/selfie' };
it('only confirms a submission when the backend saved and returned it', async () => {
  post.mockResolvedValue({ data: { verification: { id: 'kyc_1', status: 'SUBMITTED' } } });
  expect(await submitKyc(docs)).toEqual({ id: 'kyc_1', status: 'SUBMITTED' });
  expect(post).toHaveBeenCalledWith('/kyc/submit', docs);
});
it('rejects successful HTTP responses that did not confirm persistence', async () => {
  post.mockResolvedValue({ data: { message: 'ok' } });
  await expect(submitKyc(docs)).rejects.toThrow('server did not confirm');
});
