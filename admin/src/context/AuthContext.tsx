import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface AdminUser {
  id: string;
  phone: string;
  role: 'ADMIN' | 'RIDER';
  fullName?: string;
  email?: string;
}

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  loginWithOtp: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  requestOtp: (phone: string) => Promise<{ success: boolean; challengeId?: string; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('rfy_admin_token');
    const savedUser = localStorage.getItem('rfy_admin_user');

    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.role === 'ADMIN') {
          setToken(savedToken);
          setUser(parsed);
        } else {
          localStorage.removeItem('rfy_admin_token');
          localStorage.removeItem('rfy_admin_user');
        }
      } catch (e) {
        localStorage.removeItem('rfy_admin_token');
        localStorage.removeItem('rfy_admin_user');
      }
    }
    setIsLoading(false);
  }, []);

  const requestOtp = async (phone: string) => {
    try {
      let res;
      try {
        res = await apiClient.post('/auth/otp/request', { phone });
      } catch {
        res = await apiClient.post('/auth/request-otp', { phone });
      }

      if (res?.data?.challengeId) {
        setChallengeId(res.data.challengeId);
      }
      return { success: true, challengeId: res?.data?.challengeId };
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to send OTP. Please check the phone number.';
      return { success: false, error: msg };
    }
  };

  const loginWithOtp = async (phone: string, otp: string) => {
    try {
      const payload: any = { phone, otp };
      if (challengeId) {
        payload.challengeId = challengeId;
      }

      let res;
      try {
        res = await apiClient.post('/auth/otp/verify', payload);
      } catch {
        res = await apiClient.post('/auth/verify-otp', payload);
      }

      const { user: authUser, tokens } = res.data;

      if (!authUser || authUser.role !== 'ADMIN') {
        return {
          success: false,
          error: 'Access Denied: This account does not possess Administrator privileges.',
        };
      }

      const adminUser: AdminUser = {
        id: authUser.id,
        phone,
        role: 'ADMIN',
        fullName: authUser.fullName || 'Operations Admin',
      };

      setToken(tokens.accessToken);
      setUser(adminUser);
      localStorage.setItem('rfy_admin_token', tokens.accessToken);
      localStorage.setItem('rfy_admin_user', JSON.stringify(adminUser));

      return { success: true };
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Invalid OTP code. Please try again.';
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setChallengeId(null);
    localStorage.removeItem('rfy_admin_token');
    localStorage.removeItem('rfy_admin_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        requestOtp,
        loginWithOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
