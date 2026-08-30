import React from 'react';
import {
  Users,
  Bike,
  FileCheck2,
  Receipt,
  MapPin,
  ArrowUpRight,
  Zap,
  BatteryCharging,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { ActiveTab } from '../components/Sidebar';
import { FleetLiveMap } from '../components/FleetLiveMap';

interface OverviewProps {
  stats: any;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Overview: React.FC<OverviewProps> = ({ stats, setActiveTab }) => {
  const riders = stats?.riders || { total: 1, verified: 1, pendingKyc: 1 };
  const fleet = stats?.fleet || { totalBikes: 54, availableBikes: 42, rentedBikes: 12, utilizationRate: 22 };
  const finance = stats?.finance || { estimatedWeeklyRevenue: 23100, totalRevenue: 104500 };

  const cards = [
    {
      title: 'Active Fleet Vehicles',
      value: fleet.totalBikes,
      sub: `${fleet.availableBikes} Ready • ${fleet.rentedBikes} on Road`,
      icon: Bike,
      badge: `${fleet.utilizationRate}% In Service`,
      badgeColor: 'bg-[#EAF8F1] text-[#38A169]',
      onClick: () => setActiveTab('fleet'),
    },
    {
      title: 'Registered Riders',
      value: riders.total,
      sub: `${riders.verified} KYC Approved`,
      icon: Users,
      badge: '+18% growth',
      badgeColor: 'bg-[#E0F2FE] text-[#0369A1]',
      onClick: () => setActiveTab('riders'),
    },
    {
      title: 'Pending KYC Queue',
      value: riders.pendingKyc,
      sub: riders.pendingKyc > 0 ? 'Document review waiting' : 'All clear',
      icon: FileCheck2,
      badge: riders.pendingKyc > 0 ? 'Needs Action' : '0 Queue',
      badgeColor: riders.pendingKyc > 0 ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#F8F7FD] text-[#8A97A0]',
      onClick: () => setActiveTab('kyc'),
    },
    {
      title: 'Monthly Run-Rate (MRR)',
      value: `₹${(finance.totalRevenue || 104500).toLocaleString()}`,
      sub: `₹${(finance.estimatedWeeklyRevenue || 23100).toLocaleString()} / week collected`,
      icon: Receipt,
      badge: 'Live Run-Rate',
      badgeColor: 'bg-[#F3E8FF] text-[#7E22CE]',
      onClick: () => setActiveTab('finance'),
    },
  ];

  const featuredModels = [
    {
      name: 'SPRINTO HS',
      category: 'High-Speed Commercial',
      range: '120 km',
      speed: '65 km/h',
      price: '₹1,925/wk',
      image: '/assets/vehicle-s1.png',
      count: 24,
    },
    {
      name: 'AEROFLOW PRO',
      category: 'Dual Battery Long-Range',
      range: '140 km',
      speed: '70 km/h',
      price: '₹2,200/wk',
      image: '/assets/vehiclex1.png',
      count: 18,
    },
    {
      name: 'ODYSSEY MAX',
      category: 'Heavy-Duty Cargo Carrier',
      range: '110 km',
      speed: '55 km/h',
      price: '₹1,750/wk',
      image: '/assets/vehiclez1.png',
      count: 12,
    },
  ];

  return (
    <div className="space-y-7 font-sans">
      {/* 1. Neumorphic KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <div
              key={idx}
              onClick={c.onClick}
              className="bg-white rounded-3xl p-5 border border-[#EDF2F1] shadow-neo hover:scale-[1.01] transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#8A97A0]">{c.title}</span>
                <div className="w-10 h-10 rounded-2xl bg-[#F8F7FD] border border-[#EDF2F1] flex items-center justify-center text-[#62CE90] shadow-neo-sm group-hover:bg-[#62CE90] group-hover:text-white transition">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-[#172B3A]">{c.value}</span>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${c.badgeColor}`}>
                  {c.badge}
                </span>
              </div>
              <p className="text-xs text-[#8A97A0] font-medium mt-1">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* 2. Big Live GPS Fleet & IoT Battery Map with #62CE90 Neumorphism */}
      <FleetLiveMap />

      {/* 3. Featured Vehicle Models Showcase with Real Assets */}
      <div className="bg-white rounded-3xl p-6 border border-[#EDF2F1] shadow-neo">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-extrabold text-[#172B3A] flex items-center gap-2">
              <span>Fleet Vehicle Models & Specifications</span>
              <span className="text-[10px] font-extrabold text-[#38A169] bg-[#EAF8F1] px-2.5 py-0.5 rounded-full">
                3 Certified EV Lines
              </span>
            </h3>
            <p className="text-xs text-[#8A97A0] font-medium mt-0.5">
              Available commercial 2-wheelers with smart IoT battery swapping compatibility.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('fleet')}
            className="text-xs font-extrabold text-[#62CE90] hover:text-[#38A169] flex items-center gap-1 bg-[#F8F7FD] px-3.5 py-2 rounded-2xl border border-[#EDF2F1] shadow-neo-sm transition"
          >
            <span>View Full Fleet</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {featuredModels.map((m, idx) => (
            <div
              key={idx}
              className="bg-[#F8F7FD] rounded-3xl p-4 border border-[#EDF2F1] shadow-neo-sm hover:shadow-neo transition flex flex-col justify-between"
            >
              <div>
                <div className="w-full h-40 bg-white rounded-2xl p-3 border border-[#EDF2F1] flex items-center justify-center overflow-hidden mb-3 shadow-neo-inset">
                  <img
                    src={m.image}
                    alt={m.name}
                    className="max-h-full max-w-full object-contain hover:scale-105 transition duration-300"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-[#172B3A]">{m.name}</h4>
                  <span className="text-xs font-extrabold text-[#62CE90] bg-white px-2.5 py-1 rounded-xl shadow-neo-sm border border-[#EDF2F1]">
                    {m.price}
                  </span>
                </div>
                <p className="text-[11px] text-[#8A97A0] font-medium mt-0.5">{m.category}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#EDF2F1] flex items-center justify-between text-xs font-bold text-[#172B3A]">
                <span className="flex items-center gap-1 text-[#8A97A0]">
                  <BatteryCharging className="w-3.5 h-3.5 text-[#62CE90]" />
                  <span>{m.range}</span>
                </span>
                <span className="text-[#8A97A0]">Top: <strong className="text-[#172B3A]">{m.speed}</strong></span>
                <span className="text-[11px] text-[#38A169] bg-[#EAF8F1] px-2 py-0.5 rounded-lg">
                  {m.count} Active
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Operational Highlights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: EV Hubs & Deployment */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-[#EDF2F1] shadow-neo">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#172B3A]">Operations Hubs & Deployment Points</h3>
              <p className="text-xs text-[#8A97A0] font-medium">Physical EV distribution points across Hyderabad</p>
            </div>
            <button
              onClick={() => setActiveTab('infrastructure')}
              className="text-xs font-extrabold text-[#62CE90] hover:text-[#38A169] flex items-center gap-1"
            >
              <span>Manage Hubs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-3xl bg-[#F8F7FD] border border-[#EDF2F1] shadow-neo-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className="w-4 h-4 text-[#62CE90]" />
                <span className="text-xs font-extrabold text-[#172B3A]">Kondapur Main Hub</span>
              </div>
              <p className="text-xs text-[#8A97A0]">Botanical Garden Rd</p>
              <div className="mt-3 flex items-center justify-between text-xs font-bold">
                <span className="text-[#38A169] bg-[#EAF8F1] px-2.5 py-0.5 rounded-xl">18 Bikes</span>
                <span className="text-[#8A97A0]">09:00 - 21:00</span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-[#F8F7FD] border border-[#EDF2F1] shadow-neo-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className="w-4 h-4 text-[#62CE90]" />
                <span className="text-xs font-extrabold text-[#172B3A]">Hitech City Station</span>
              </div>
              <p className="text-xs text-[#8A97A0]">Cyber Towers Junction</p>
              <div className="mt-3 flex items-center justify-between text-xs font-bold">
                <span className="text-[#38A169] bg-[#EAF8F1] px-2.5 py-0.5 rounded-xl">14 Bikes</span>
                <span className="text-[#8A97A0]">08:00 - 22:00</span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-[#F8F7FD] border border-[#EDF2F1] shadow-neo-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className="w-4 h-4 text-[#62CE90]" />
                <span className="text-xs font-extrabold text-[#172B3A]">Gachibowli Hub</span>
              </div>
              <p className="text-xs text-[#8A97A0]">Near DLF Cybercity</p>
              <div className="mt-3 flex items-center justify-between text-xs font-bold">
                <span className="text-[#38A169] bg-[#EAF8F1] px-2.5 py-0.5 rounded-xl">10 Bikes</span>
                <span className="text-[#8A97A0]">09:00 - 21:00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Quick Actions */}
        <div className="bg-white rounded-3xl p-6 border border-[#EDF2F1] shadow-neo flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-[#172B3A] mb-1">Operations Action Center</h3>
            <p className="text-xs text-[#8A97A0] mb-4">Fast shortcuts for daily fleet management</p>

            <div className="space-y-2.5">
              <button
                onClick={() => setActiveTab('kyc')}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] hover:bg-[#FDE68A]/60 transition text-left shadow-neo-sm"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 text-[#D97706]" />
                  <div>
                    <p className="text-xs font-extrabold">Review KYC Submissions</p>
                    <p className="text-[11px] text-[#D97706] font-semibold">{riders.pendingKyc} in review queue</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#D97706]" />
              </button>

              <button
                onClick={() => setActiveTab('fleet')}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#EAF8F1] border border-[#C8F0DC] text-[#38A169] hover:bg-[#D9F5E6] transition text-left shadow-neo-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Bike className="w-4 h-4 text-[#62CE90]" />
                  <div>
                    <p className="text-xs font-extrabold">Add New Bike to Fleet</p>
                    <p className="text-[11px] text-[#38A169] font-semibold">Assign model & hub</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#62CE90]" />
              </button>

              <button
                onClick={() => setActiveTab('infrastructure')}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#E0F2FE] border border-[#BAE6FD] text-[#0369A1] hover:bg-[#BAE6FD] transition text-left shadow-neo-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-[#0284C7]" />
                  <div>
                    <p className="text-xs font-extrabold">Add 2-Min Swap Dock</p>
                    <p className="text-[11px] text-[#0284C7] font-semibold">Install IoT battery station</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#0284C7]" />
              </button>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#EDF2F1] flex items-center justify-between text-[11px] text-[#8A97A0] font-bold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#62CE90]" />
              <span>Cloudflare R2 Vault</span>
            </span>
            <span>v2.5.0 Production</span>
          </div>
        </div>
      </div>
    </div>
  );
};
