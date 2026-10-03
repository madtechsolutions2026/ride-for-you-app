import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { itemForPath, pathForScreen } from './nav';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Riders } from './pages/Riders';
import { Fleet } from './pages/Fleet';
import { Bookings } from './pages/Bookings';
import { KycReview } from './pages/KycReview';
import { Infrastructure } from './pages/Infrastructure';
import { Finance } from './pages/Finance';
import { ServiceRecovery } from './pages/ServiceRecovery';
import { Employees } from './pages/Employees';
import { SupportTickets } from './pages/SupportTickets';
import { Settings } from './pages/Settings';
import { Reports } from './pages/Reports';
import { RiderRequests } from './pages/RiderRequests';
import { Collections } from './pages/Collections';
import { apiClient } from './api/client';
import { RefreshProvider, useRefresh } from './context/RefreshContext';

/** Redirects instead of rendering a screen this role can't open. */
const Guard: React.FC<{ screen: string; children: React.ReactNode }> = ({ screen, children }) => {
  const { can } = useAuth();
  if (!can(screen)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [statsError, setStatsError] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/api/stats');
      setStats(res.data);
      setStatsError(false);
    } catch (e) {
      console.error('Error fetching admin stats:', e);
      // Leave `stats` null rather than substituting numbers. Overview renders
      // a waiting state; it must never invent a fleet.
      setStatsError(true);
    }
  }, []);

  useEffect(() => {
    if (user) void fetchStats();
  }, [user, fetchStats]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-paper flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border border-rule-strong border-t-accent rounded-full animate-spin" />
          <span className="text-[12px] text-ink-soft">Loading Operations…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <RefreshProvider globalReload={fetchStats}>
      <Shell stats={stats} statsError={statsError} navigate={navigate} pathname={location.pathname} />
    </RefreshProvider>
  );
};

/**
 * Split out so the header can read `useRefresh()` — a hook cannot be called in
 * the same component that renders the provider.
 */
const Shell: React.FC<{
  stats: any;
  statsError: boolean;
  navigate: ReturnType<typeof useNavigate>;
  pathname: string;
}> = ({ stats, statsError, navigate, pathname }) => {
  const { refresh, isRefreshing } = useRefresh();
  const item = itemForPath(pathname);

  return (
    <div className="min-h-screen bg-paper flex">
      <Sidebar
        pendingKycCount={stats?.riders?.pendingKyc || 0}
        openTicketCount={stats?.queues?.openTickets || 0}
        pendingRequestCount={stats?.queues?.pendingRentalRequests || 0}
        openCollectionsCount={stats?.queues?.openCollections || 0}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={item?.title || 'Dashboard'}
          subtitle={item?.subtitle || ''}
          tabs={item?.tabs}
          onRefresh={refresh}
          isRefreshing={isRefreshing}
          statsError={statsError}
        />

        <main className="flex-1 px-7 py-6 min-w-0">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route
              path="/dashboard"
              element={
                <Guard screen="overview">
                  <Overview stats={stats} setActiveTab={(s) => navigate(pathForScreen(s))} />
                </Guard>
              }
            />

            <Route path="/riders/*" element={<Guard screen="riders"><Riders /></Guard>} />
            <Route path="/bookings" element={<Navigate to="/bookings/list" replace />} />
            <Route
              path="/bookings/requests"
              element={<Guard screen="bookings"><RiderRequests /></Guard>}
            />
            <Route path="/bookings/*" element={<Guard screen="bookings"><Bookings /></Guard>} />
            <Route path="/fleet/*" element={<Guard screen="fleet"><Fleet /></Guard>} />
            <Route path="/kyc/*" element={<Guard screen="kyc"><KycReview /></Guard>} />

            <Route path="/network" element={<Navigate to="/network/hubs" replace />} />
            <Route
              path="/network/hubs"
              element={<Guard screen="infrastructure"><Infrastructure tab="hubs" /></Guard>}
            />
            <Route
              path="/network/swap-stations"
              element={<Guard screen="infrastructure"><Infrastructure tab="stations" /></Guard>}
            />

            <Route path="/finance/*" element={<Guard screen="finance"><Finance /></Guard>} />

            <Route path="/service" element={<Navigate to="/service/tickets" replace />} />
            <Route
              path="/service/tickets"
              element={<Guard screen="service"><ServiceRecovery tab="tickets" /></Guard>}
            />
            <Route
              path="/service/technicians"
              element={<Guard screen="service"><ServiceRecovery tab="technicians" /></Guard>}
            />
            <Route
              path="/service/damage"
              element={<Guard screen="service"><ServiceRecovery tab="damage" /></Guard>}
            />
            <Route path="/recovery" element={<Navigate to="/recovery/collections" replace />} />
            <Route
              path="/recovery/collections"
              element={<Guard screen="recovery"><Collections /></Guard>}
            />
            <Route
              path="/recovery/roadside"
              element={<Guard screen="recovery"><ServiceRecovery tab="recovery" /></Guard>}
            />

            <Route path="/support/*" element={<Guard screen="support"><SupportTickets /></Guard>} />
            <Route path="/people/*" element={<Guard screen="employees"><Employees /></Guard>} />
            <Route path="/reports" element={<Guard screen="reports"><Reports /></Guard>} />

            <Route path="/settings" element={<Navigate to="/settings/pricing" replace />} />
            <Route
              path="/settings/pricing"
              element={<Guard screen="settings"><Settings tab="pricing" /></Guard>}
            />
            <Route
              path="/settings/integrations"
              element={<Guard screen="settings"><Settings tab="integrations" /></Guard>}
            />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};
