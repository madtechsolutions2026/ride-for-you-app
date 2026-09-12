import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setTokens,
  getAccessToken,
  getRefreshToken,
  setStoredUser,
  getStoredUser,
  clearTokens,
} from './tokenStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('tokens', () => {
  it('round-trips the access and refresh tokens', async () => {
    await setTokens('access-abc', 'refresh-xyz');
    expect(await getAccessToken()).toBe('access-abc');
    expect(await getRefreshToken()).toBe('refresh-xyz');
  });

  it('returns null before anything is stored', async () => {
    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('overwrites a previous session on re-login', async () => {
    await setTokens('old', 'old-r');
    await setTokens('new', 'new-r');
    expect(await getAccessToken()).toBe('new');
    expect(await getRefreshToken()).toBe('new-r');
  });
});

describe('stored user', () => {
  it('round-trips a profile', async () => {
    await setStoredUser({ id: 'usr_1', phone: '+919550661981', fullName: 'Test Rider' });
    expect(await getStoredUser()).toMatchObject({ id: 'usr_1', fullName: 'Test Rider' });
  });

  /* The screens call setStoredUser with partial patches, so a later write
     must not drop fields an earlier one set — that is what keeps the Home
     greeting from flickering back to a blank name. */
  it('merges a partial update into the existing profile', async () => {
    await setStoredUser({ id: 'usr_1', phone: '+919550661981', fullName: 'Test Rider' });
    await setStoredUser({ kycStatus: 'APPROVED' });

    const user = await getStoredUser();
    expect(user).toMatchObject({
      id: 'usr_1',
      phone: '+919550661981',
      fullName: 'Test Rider',
      kycStatus: 'APPROVED',
    });
  });

  it('lets a later write overwrite an earlier value for the same field', async () => {
    await setStoredUser({ id: 'usr_1', kycStatus: 'PENDING' });
    await setStoredUser({ kycStatus: 'APPROVED' });
    expect((await getStoredUser())?.kycStatus).toBe('APPROVED');
  });

  it('returns null when nothing is stored', async () => {
    expect(await getStoredUser()).toBeNull();
  });

  it('returns null instead of throwing when the stored JSON is corrupt', async () => {
    await AsyncStorage.setItem('user_profile', '{not valid json');
    expect(await getStoredUser()).toBeNull();
  });
});

describe('clearTokens', () => {
  it('removes both tokens and the cached profile on sign out', async () => {
    await setTokens('access-abc', 'refresh-xyz');
    await setStoredUser({ id: 'usr_1', fullName: 'Test Rider' });

    await clearTokens();

    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
    expect(await getStoredUser()).toBeNull();
  });
});
