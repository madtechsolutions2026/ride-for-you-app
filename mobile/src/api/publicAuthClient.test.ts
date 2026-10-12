import { AxiosError } from 'axios';
import { publicAuthClient } from './client';
import { getAccessToken, getRefreshToken } from './tokenStore';

jest.mock('./tokenStore', () => ({ getAccessToken: jest.fn(), getRefreshToken: jest.fn(), setTokens: jest.fn(), clearTokens: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

it('bounds OTP requests to 15 seconds without waiting on saved-session storage', async () => {
  const adapter = jest.fn(async (config) => ({ config, data: { challengeId: 'ch_1' }, status: 200, statusText: 'OK', headers: {} }));
  await publicAuthClient.post('/auth/otp/request', { phone: '+917095682464' }, { adapter });
  expect(adapter.mock.calls[0][0].timeout).toBe(15000);
  expect(adapter.mock.calls[0][0].headers.Authorization).toBeUndefined();
  expect(getAccessToken).not.toHaveBeenCalled();
});
it('returns invalid OTP errors directly without session-refresh retries', async () => {
  const adapter = jest.fn(async (config) => {
    throw new AxiosError('Invalid OTP', 'ERR_BAD_REQUEST', config, undefined, {
      config, data: { error: 'Invalid OTP' }, status: 401, statusText: 'Unauthorized', headers: {},
    });
  });
  await expect(publicAuthClient.post('/auth/otp/verify', { challengeId: 'ch_1', otp: '000000' }, { adapter })).rejects.toMatchObject({ response: { status: 401 } });
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(getRefreshToken).not.toHaveBeenCalled();
});
