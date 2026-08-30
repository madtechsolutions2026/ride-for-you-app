import React from 'react';
import {
  Users,
  Bike,
  FileCheck2,
  Receipt,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import { ActiveTab } from '../components/Sidebar';

interface OverviewProps {
  stats: any;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Overview: React.FC<OverviewProps> = ({ stats, setActiveTab }) => {
  const riders = stats?.riders || { total: 1, verified: 1, pendingKyc: 0 };
  const fleet = stats?.fleet || { totalBikes: 54, availableBikes: 42, rentedBikes: 12, utilizationRate: 22 };
  const infra = stats?.infrastructure || { hubs: 3, swapStations: 3 };
  const finance = stats?.finance || { estimatedWeeklyRevenue: 23100, totalRevenue: 104500 };

  const cards = [
    {
      title: 'Active Riders',
      value: riders.total,
      sub: `${riders.verified} KYC Approved`,
      icon: Users,
      color: 'from-blue-600 to-indigo-600',
      badge: '+12% this week',
      onClick: () => setActiveTab('riders'),
    },
    {
      title: 'Fleet Vehicles',
      value: fleet.totalBikes,
      sub: `${fleet.availableBikes} Ready • ${fleet.rentedBikes} on Road`,
      icon: Bike,
      color: 'from-emerald-600 to-teal-600',
      badge: `${fleet.utilizationRate}% Utilization`,
      onClick: () => setActiveTab('fleet'),
    },
    {
      title: 'Pending KYC Review',
      value: riders.pendingKyc,
      sub: riders.pendingKyc > 0 ? 'Requires immediate action' : 'All clear',
      icon: FileCheck2,
      color: riders.pendingKyc > 0 ? 'from-amber-500 to-orange-600' : 'from-slate-600 to-slate-800',
      badge: riders.pendingKyc > 0 ? 'Action Needed' : '0 Queue',
      onClick: () => setActiveTab('kyc'),
    },
    {
      title: 'Est. Monthly MRR',
      value: `₹${(finance.totalRevenue || 104500).toLocaleString()}`,
      sub: `₹${(finance.estimatedWeeklyRevenue || 23100).toLocaleString()} / week active`,
      icon: Receipt,
      color: 'from-purple-600 to-pink-600',
      badge: 'Live Run-Rate',
      onClick: () => setActiveTab('finance'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <div
              key={idx}
              onClick={c.onClick}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-slate-300"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500">{c.title}</span>
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white shadow-sm`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-slate-900">{c.value}</span>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {c.badge}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Operational Highlights & Fleet Hubs Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Fleet Health & Active Hubs */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Active EV Hubs & Deployment</h3>
              <p className="text-xs text-slate-500">Live operational deployment across Telangana & Hyderabad</p>
            </div>
            <button
              onClick={() => setActiveTab('infrastructure')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Manage Hubs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">Kondapur Main Hub</span>
              </div>
              <p className="text-xs text-slate-500">Botanical Garden Rd</p>
              <div className="mt-3 flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">18 Bikes</span>
                <span className="text-slate-500">09:00 - 21:00</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">Hitech City Station</span>
              </div>
              <p className="text-xs text-slate-500">Cyber Towers Junction</p>
              <div className="mt-3 flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">18 Bikes</span>
                <span className="text-slate-500">08:00 - 22:00</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">Gachibowli Hub</span>
              </div>
              <p className="text-xs text-slate-500">Near DLF Cybercity</p>
              <div className="mt-3 flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">18 Bikes</span>
                <span className="text-slate-500">09:00 - 21:00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Quick Actions & KYC Queue */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Quick Action Center</h3>
            <p className="text-xs text-slate-500 mb-4">Immediate management shortcuts</p>

            <div className="space-y-2.5">
              <button
                onClick={() => setActiveTab('kyc')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 text-amber-700" />
                  <div>
                    <p className="text-xs font-bold">Review KYC Submissions</p>
                    <p className="text-[11px] text-amber-700">{riders.pendingKyc} in queue</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-amber-700" />
              </button>

              <button
                onClick={() => setActiveTab('fleet')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Bike className="w-4 h-4 text-emerald-700" />
                  <div>
                    <p className="text-xs font-bold">Add Vehicle Unit</p>
                    <p className="text-[11px] text-emerald-700">Assign plate & hub</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-emerald-700" />
              </button>

              <button
                onClick={() => setActiveTab('infrastructure')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 hover:bg-blue-100 transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-700" />
                  <div>
                    <p className="text-xs font-bold">Add Swap Station</p>
                    <p className="text-[11px] text-blue-700">Set geo coordinates</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-blue-700" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>System: Production Render</span>
            <span>Cloudflare R2: Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
