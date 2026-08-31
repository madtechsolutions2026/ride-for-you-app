import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
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
import { apiClient } from './api/client';

const META: Record<ActiveTab, { title: string; subtitle: string }> = {
  overview: { title: 'Operational Overview', subtitle: 'Live fleet, rentals, billing and verification at a glance' },
  riders: { title: 'Riders Directory', subtitle: 'Onboarding accounts, active riders and account status' },
  bookings: { title: 'Bookings & Rentals', subtitle: 'Confirm bookings, hand over bikes, take returns' },
  fleet: { title: 'Vehicles & Physical Fleet', subtitle: 'Models, pricing plans, physical bikes and battery levels' },
  kyc: { title: 'KYC Document Approvals', subtitle: 'Inspect Aadhaar, address proofs and selfies; approve or reject' },
  infrastructure: { title: 'EV Hubs & Swap Stations', subtitle: 'Pick-up points and battery-swap docks' },
  finance: { title: 'Payments & Weekly Billing', subtitle: 'Weekly rental invoices, collections and the payments ledger' },
  service: { title: 'Damage & Parts', subtitle: 'Damage logged at return, charges and waivers' },
  recovery: { title: 'Roadside & Police Recovery', subtitle: 'Breakdown dispatch, theft and police-hold jobs' },
  employees: { title: 'Employees & Roles', subtitle: 'Add staff, set their role, home hub and screen access' },
  reports: { title: 'Reports & MRR', subtitle: 'Recurring revenue and operational trends' },
  settings: { title: 'Pricing & System', subtitle: 'Master data and integrations' },
};

export const App: React.FC = () => {
  const { user, isLoading, can } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async () => {
    setIsRefreshing(true);
    try {
      const res = await apiClient.get('/admin/api/stats');
      setStats(res.data);
    } catch (e) {
      console.error('Error fetching admin stats:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  // If the current tab isn't allowed for this role, fall back to overview.
  useEffect(() => {
    if (user && !can(activeTab)) setActiveTab('overview');
  }, [user, activeTab]); // eslint-disable-line

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center text-[#38A169] font-semibold text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#62CE90] border-t-transparent rounded-full animate-spin" />
          <span>Loading Operations Hub…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const meta = META[activeTab] || META.overview;
  const allowed = can(activeTab);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingKycCount={stats?.riders?.pendingKyc || 0}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          onRefresh={fetchStats}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {!allowed ? (
            <div className="py-24 text-center text-sm font-bold text-[#8A97A0]">
              Your role doesn’t have access to this screen.
            </div>
          ) : (
            <>
              {activeTab === 'overview' && <Overview stats={stats} setActiveTab={setActiveTab} />}
              {activeTab === 'riders' && <Riders />}
              {activeTab === 'bookings' && <Bookings />}
              {activeTab === 'fleet' && <Fleet />}
              {activeTab === 'kyc' && <KycReview />}
              {activeTab === 'infrastructure' && <Infrastructure />}
              {activeTab === 'finance' && <Finance />}
              {activeTab === 'service' && <ServiceRecovery />}
              {activeTab === 'recovery' && <ServiceRecovery />}
              {activeTab === 'employees' && <Employees />}
              {activeTab === 'reports' && <Overview stats={stats} setActiveTab={setActiveTab} />}
              {activeTab === 'settings' && <Infrastructure />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
