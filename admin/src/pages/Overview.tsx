import React from 'react';
import {
  Users,
  Bike,
  FileCheck2,
  Receipt,
  MapPin,
  ArrowUpRight,
  Zap,
} from 'lucide-react';
import { ActiveTab } from '../components/Sidebar';
import { FleetLiveMap } from '../components/FleetLiveMap';

interface OverviewProps {
  stats: any;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Overview: React.FC<OverviewProps> = ({ stats, setActiveTab }) => {
  const riders = stats?.riders || { total: 1, verified: 1, pendingKyc: 0 };
  const fleet = stats?.fleet || { totalBikes: 54, availableBikes: 42, rentedBikes: 12, utilizationRate: 22 };
  const finance = stats?.finance || { estimatedWeeklyRevenue: 23100, totalRevenue: 104500 };

  const cards = [
    {
      title: 'Active Fleet Vehicles',
      value: fleet.totalBikes,
      sub: `${fleet.availableBikes} Ready • ${fleet.rentedBikes} on Road`,
      icon: Bike,
      color: 'from-[#1FAE72] to-[#129461]',
      badge: `${fleet.utilizationRate}% Utilization`,
      onClick: () => setActiveTab('fleet'),
    },
    {
      title: 'Registered Riders',
      value: riders.total,
      sub: `${riders.verified} KYC Approved`,
      icon: Users,
      color: 'from-[#0284C7] to-[#0369A1]',
      badge: '+12% this week',
      onClick: () => setActiveTab('riders'),
    },
    {
      title: 'Pending KYC Review',
      value: riders.pendingKyc,
      sub: riders.pendingKyc > 0 ? 'Requires immediate action' : 'All clear',
      icon: FileCheck2,
      color: riders.pendingKyc > 0 ? 'from-[#D97706] to-[#B45309]' : 'from-[#8A97A0] to-[#6C7D83]',
      badge: riders.pendingKyc > 0 ? 'Action Needed' : '0 Queue',
      onClick: () => setActiveTab('kyc'),
    },
    {
      title: 'Monthly Run-Rate (MRR)',
      value: `₹${(finance.totalRevenue || 104500).toLocaleString()}`,
      sub: `₹${(finance.estimatedWeeklyRevenue || 23100).toLocaleString()} / week active`,
      icon: Receipt,
      color: 'from-[#7E22CE] to-[#6B21A8]',
      badge: 'Live Run-Rate',
      onClick: () => setActiveTab('finance'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Metric Cards Grid matching Mobile Neumorphism */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <div
              key={idx}
              onClick={c.onClick}
              className="bg-white rounded-3xl p-5 border border-[#EDF2F1] shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-[#CBD6D6]"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#8A97A0]">{c.title}</span>
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white shadow-sm`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-[#172B3A]">{c.value}</span>
                <span className="text-[11px] font-bold text-[#129461] bg-[#E9F7F1] px-2.5 py-0.5 rounded-full border border-[#DCF0E6]">
                  {c.badge}
                </span>
              </div>
              <p className="text-xs text-[#8A97A0] font-medium mt-1">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* 2. Big Live GPS Fleet & IoT Battery Map */}
      <FleetLiveMap />

      {/* 3. Operational Highlights & Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: EV Hubs & Deployment Summary */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-[#EDF2F1] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#172B3A]">Active EV Hubs & Deployment</h3>
              <p className="text-xs text-[#8A97A0] font-medium">Physical pick-up points and maintenance stations across Hyderabad</p>
            </div>
            <button
              onClick={() => setActiveTab('infrastructure')}
              className="text-xs font-bold text-[#18B878] hover:text-[#129461] flex items-center gap-1"
            >
              <span>Manage Hubs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[#FBFBFD] border border-[#EDF2F1]">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className="w-4 h-4 text-[#18B878]" />
                <span className="text-xs font-bold text-[#172B3A]">Kondapur Main Hub</span>
              </div>
              <p className="text-xs text-[#8A97A0]">Botanical Garden Rd</p>
              <div className="mt-3 flex items-center justify-between text-xs font-bold">
                <span className="text-[#129461] bg-[#E9F7F1] px-2 py-0.5 rounded-lg">18 Bikes</span>
                <span className="text-[#8A97A0]">09:00 - 21:00</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FBFBFD] border border-[#EDF2F1]">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className="w-4 h-4 text-[#18B878]" />
                <span className="text-xs font-bold text-[#172B3A]">Hitech City Station</span>
              </div>
              <p className="text-xs text-[#8A97A0]">Cyber Towers Junction</p>
              <div className="mt-3 flex items-center justify-between text-xs font-bold">
                <span className="text-[#129461] bg-[#E9F7F1] px-2 py-0.5 rounded-lg">14 Bikes</span>
                <span className="text-[#8A97A0]">08:00 - 22:00</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FBFBFD] border border-[#EDF2F1]">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className="w-4 h-4 text-[#18B878]" />
                <span className="text-xs font-bold text-[#172B3A]">Gachibowli Hub</span>
              </div>
              <p className="text-xs text-[#8A97A0]">Near DLF Cybercity</p>
              <div className="mt-3 flex items-center justify-between text-xs font-bold">
                <span className="text-[#129461] bg-[#E9F7F1] px-2 py-0.5 rounded-lg">10 Bikes</span>
                <span className="text-[#8A97A0]">09:00 - 21:00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Quick Actions */}
        <div className="bg-white rounded-3xl p-6 border border-[#EDF2F1] shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-[#172B3A] mb-1">Quick Action Center</h3>
            <p className="text-xs text-[#8A97A0] mb-4">Operations & fleet shortcuts</p>

            <div className="space-y-2.5">
              <button
                onClick={() => setActiveTab('kyc')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] hover:bg-[#FDE68A]/60 transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 text-[#D97706]" />
                  <div>
                    <p className="text-xs font-bold">Review KYC Submissions</p>
                    <p className="text-[11px] text-[#D97706] font-medium">{riders.pendingKyc} in queue</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#D97706]" />
              </button>

              <button
                onClick={() => setActiveTab('fleet')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#E9F7F1] border border-[#DCF0E6] text-[#129461] hover:bg-[#DCF0E6] transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Bike className="w-4 h-4 text-[#18B878]" />
                  <div>
                    <p className="text-xs font-bold">Add Vehicle Unit</p>
                    <p className="text-[11px] text-[#129461] font-medium">Assign plate & hub</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#18B878]" />
              </button>

              <button
                onClick={() => setActiveTab('infrastructure')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#E0F2FE] border border-[#BAE6FD] text-[#0369A1] hover:bg-[#BAE6FD] transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-[#0284C7]" />
                  <div>
                    <p className="text-xs font-bold">Add Swap Station</p>
                    <p className="text-[11px] text-[#0284C7] font-medium">Set geo coordinates</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#0284C7]" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#EDF2F1] flex items-center justify-between text-[11px] text-[#8A97A0] font-medium">
            <span>System: Production Render</span>
            <span>Cloudflare R2: Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
