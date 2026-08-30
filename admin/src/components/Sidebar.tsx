import React from 'react';
import {
  LayoutDashboard,
  Users,
  Bike,
  KeyRound,
  FileCheck2,
  Receipt,
  Wrench,
  Truck,
  BarChart3,
  MapPin,
  Settings,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab =
  | 'overview'
  | 'riders'
  | 'fleet'
  | 'kyc'
  | 'finance'
  | 'service'
  | 'recovery'
  | 'infrastructure'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingKycCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, pendingKycCount }) => {
  const { logout } = useAuth();

  const navGroups = [
    {
      title: 'CORE',
      items: [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { id: 'riders', label: 'Riders Directory', icon: Users },
        { id: 'fleet', label: 'Vehicles & Fleet', icon: Bike },
        {
          id: 'kyc',
          label: 'KYC Approvals',
          icon: FileCheck2,
          badge: pendingKycCount > 0 ? pendingKycCount : undefined,
          badgeColor: 'bg-amber-500 text-slate-950 font-bold',
        },
        { id: 'infrastructure', label: 'Hubs & Stations', icon: MapPin },
      ],
    },
    {
      title: 'FINANCE & BILLING',
      items: [
        { id: 'finance', label: 'Payments & Revenue', icon: Receipt },
      ],
    },
    {
      title: 'SERVICE & RECOVERY',
      items: [
        { id: 'service', label: 'Maintenance & Parts', icon: Wrench },
        { id: 'recovery', label: 'Roadside Recovery', icon: Truck },
      ],
    },
    {
      title: 'ANALYTICS & CONFIG',
      items: [
        { id: 'reports', label: 'Reports & MRR', icon: BarChart3 },
        { id: 'settings', label: 'Pricing & System', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[#0F172A] border-r border-slate-800 flex flex-col flex-shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800 bg-[#090D16]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00C9A7] to-[#0B6623] flex items-center justify-center shadow-lg shadow-emerald-950/40">
          <Bike className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold text-base leading-tight tracking-tight">RIDE FOR YOU</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-[#00C9A7] animate-pulse"></span>
            <span className="text-[10px] font-semibold tracking-wider text-[#00C9A7] uppercase">Enterprise Admin</span>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx}>
            <p className="px-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-2">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as ActiveTab)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#0B6623] to-[#00C9A7]/80 text-white shadow-md shadow-emerald-950/50'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${
                          item.badgeColor || 'bg-slate-700 text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-800 bg-[#090D16]/50">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-emerald-900/40 border border-emerald-600/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
            OP
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">Operations Lead</p>
            <p className="text-[10px] text-slate-400 truncate">Super Admin Role</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-xl transition border border-rose-500/20"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Secure Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
