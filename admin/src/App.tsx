import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Riders } from './pages/Riders';
import { Fleet } from './pages/Fleet';
import { KycReview } from './pages/KycReview';
import { Infrastructure } from './pages/Infrastructure';
import { Finance } from './pages/Finance';
import { ServiceRecovery } from './pages/ServiceRecovery';
import { apiClient } from './api/client';

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async () => {
    setIsRefreshing(true);
    try {
      const res = await apiClient.get('/admin/stats');
      setStats(res.data);
    } catch (e) {
      console.error('Error fetching admin stats:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#090D16] flex items-center justify-center text-emerald-400 font-semibold text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Enterprise Security Gateway...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const getPageMeta = () => {
    switch (activeTab) {
      case 'overview':
        return { title: 'Operational Overview', subtitle: 'Real-time telemetry, fleet health, and financial run-rate' };
      case 'riders':
        return { title: 'Riders Directory', subtitle: 'Manage onboarding accounts, active riders, and permissions' };
      case 'fleet':
        return { title: 'Vehicles & Physical Fleet', subtitle: 'Track physical bikes, battery levels, models, and hub allocation' };
      case 'kyc':
        return { title: 'KYC Document Approvals', subtitle: 'Inspect Aadhaar, address proofs, selfies, and approve rider verification' };
      case 'infrastructure':
        return { title: 'EV Hubs & Swap Stations', subtitle: 'Manage physical pick-up points and 2-minute battery swap docks' };
      case 'finance':
        return { title: 'Finance & Payments Ledger', subtitle: 'Weekly rental fees, non-refundable platform dues, and collections' };
      case 'service':
      case 'recovery':
        return { title: 'Service & Roadside Recovery Desk', subtitle: 'Technician job cards, repairs, and SOS emergency dispatch logs' };
      case 'reports':
        return { title: 'Reports & MRR Analytics', subtitle: 'Monthly recurring revenue, cohort retention, and cost breakdowns' };
      case 'settings':
        return { title: 'Pricing & Master Data Settings', subtitle: 'Configure weekly rates, platform fees, and system integrations' };
      default:
        return { title: 'Ride For You Admin', subtitle: 'Enterprise Portal' };
    }
  };

  const meta = getPageMeta();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Fixed Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingKycCount={stats?.riders?.pendingKyc || 0}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          onRefresh={fetchStats}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && <Overview stats={stats} setActiveTab={setActiveTab} />}
          {activeTab === 'riders' && <Riders />}
          {activeTab === 'fleet' && <Fleet />}
          {activeTab === 'kyc' && <KycReview />}
          {activeTab === 'infrastructure' && <Infrastructure />}
          {activeTab === 'finance' && <Finance />}
          {(activeTab === 'service' || activeTab === 'recovery') && <ServiceRecovery />}
          {activeTab === 'reports' && <Overview stats={stats} setActiveTab={setActiveTab} />}
          {activeTab === 'settings' && <Infrastructure />}
        </main>
      </div>
    </div>
  );
};
