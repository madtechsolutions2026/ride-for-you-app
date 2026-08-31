import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export type StaffRole = 'ADMIN' | 'EXECUTIVE' | 'SUPPORT';

// Which screens each role can open by default (mirrors the backend
// staff.controller ROLE_DEFAULT_SCREENS). `permissions` grants extras on top.
export const ROLE_DEFAULT_SCREENS: Record<StaffRole, string[]> = {
  ADMIN: [
    'overview', 'riders', 'fleet', 'bookings', 'kyc', 'infrastructure',
    'finance', 'service', 'recovery', 'employees', 'reports', 'settings',
  ],
  EXECUTIVE: ['overview', 'fleet', 'bookings', 'kyc', 'infrastructure', 'service', 'recovery'],
  SUPPORT: ['overview', 'riders', 'bookings', 'finance', 'recovery'],
};

interface AdminUser {
  id: string;
  phone: string;
  role: StaffRole;
  fullName?: string;
  email?: string;
  permissions: string[];
  assignedHub?: { id: string; name: string; city?: string } | null;
  /** role defaults ∪ permissions */
  screens: string[];
}

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  can: (screen: string) => boolean;
  loginWithOtp: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  requestOtp: (phone: string) => Promise<{ success: boolean; challengeId?: string; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STAFF_ROLES: StaffRole[] = ['ADMIN', 'EXECUTIVE', 'SUPPORT'];

function buildUser(raw: any, phone: string): AdminUser | null {
  if (!raw || !STAFF_ROLES.includes(raw.role)) return null;
  const permissions: string[] = Array.isArray(raw.permissions) ? raw.permissions : [];
  const base = ROLE_DEFAULT_SCREENS[raw.role as StaffRole] || [];
  return {
    id: raw.id,
    phone: raw.phone || phone,
    role: raw.role,
    fullName: raw.fullName || 'Operations Staff',
    email: raw.email,
    permissions,
    assignedHub: raw.assignedHub ?? null,
    screens: Array.from(new Set([...base, ...permissions])),
  };
}

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
        if (STAFF_ROLES.includes(parsed.role)) {
          setToken(savedToken);
          setUser(parsed);
          // Re-validate + refresh permissions in the background.
          apiClient
            .get('/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
            .then((res) => {
              const fresh = buildUser(res.data?.user, parsed.phone);
              if (fresh) {
                setUser(fresh);
                localStorage.setItem('rfy_admin_user', JSON.stringify(fresh));
              } else {
                logout();
              }
            })
            .catch(() => {});
        } else {
          localStorage.removeItem('rfy_admin_token');
          localStorage.removeItem('rfy_admin_user');
        }
      } catch {
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
      if (res?.data?.challengeId) setChallengeId(res.data.challengeId);
      return { success: true, challengeId: res?.data?.challengeId };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to send OTP. Check the phone number.',
      };
    }
  };

  const loginWithOtp = async (phone: string, otp: string) => {
    try {
      const payload: any = { phone, otp };
      if (challengeId) payload.challengeId = challengeId;

      let res;
      try {
        res = await apiClient.post('/auth/otp/verify', payload);
      } catch {
        res = await apiClient.post('/auth/verify-otp', payload);
      }

      const { user: authUser, tokens } = res.data;
      const staff = buildUser(authUser, phone);
      if (!staff) {
        return {
          success: false,
          error: 'Access denied — this number has no staff role. Ask an admin to add you.',
        };
      }

      setToken(tokens.accessToken);
      setUser(staff);
      localStorage.setItem('rfy_admin_token', tokens.accessToken);
      localStorage.setItem('rfy_admin_user', JSON.stringify(staff));
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || 'Invalid OTP code. Please try again.',
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setChallengeId(null);
    localStorage.removeItem('rfy_admin_token');
    localStorage.removeItem('rfy_admin_user');
  };

  const can = (screen: string) => !!user && user.screens.includes(screen);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, can, requestOtp, loginWithOtp, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
