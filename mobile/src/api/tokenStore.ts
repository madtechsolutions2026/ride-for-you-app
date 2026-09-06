import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_PROFILE_KEY = 'user_profile';

export interface StoredUserProfile {
  id: string;
  phone: string;
  fullName?: string | null;
  email?: string | null;
  role?: string;
  accountStatus?: string;
  kycStatus?: string;
  avatarUrl?: string | null;
  city?: string | null;
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, accessToken],
      [REFRESH_TOKEN_KEY, refreshToken],
    ]);
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
}

export async function setStoredUser(user: Partial<StoredUserProfile>): Promise<void> {
  try {
    const existing = await getStoredUser();
    const merged = { ...(existing || {}), ...user };
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error('Error saving stored user:', error);
  }
}

export async function getStoredUser(): Promise<StoredUserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Error getting stored user:', error);
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_PROFILE_KEY]);
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
}

