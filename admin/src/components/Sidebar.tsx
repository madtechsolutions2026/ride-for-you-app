import React from 'react';
import {
  LayoutDashboard,
  Users,
  Bike,
  FileCheck2,
  Receipt,
  Wrench,
  Truck,
  BarChart3,
  MapPin,
  Settings,
  LogOut,
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
  const { logout, user } = useAuth();

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
          badgeColor: 'bg-[#FEF3C7] text-[#D97706] font-bold',
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
    <aside className="w-64 bg-white border-r border-[#EDF2F1] flex flex-col flex-shrink-0 min-h-screen shadow-sm font-sans">
      {/* Brand Header */}
      <div className="h-20 px-6 flex items-center gap-3 border-b border-[#EDF2F1] bg-white">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1FAE72] to-[#129461] flex items-center justify-center shadow-md shadow-emerald-600/25 ring-2 ring-[#E9F7F1]">
          <Bike className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-[#172B3A] font-extrabold text-base leading-tight tracking-tight">
            RIDE FOR <span className="text-[#18B878]">YOU</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-[#18B878] animate-pulse"></span>
            <span className="text-[10px] font-bold tracking-wider text-[#18B878] uppercase">Admin Portal</span>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 px-3.5 py-5 space-y-6 overflow-y-auto bg-white">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx}>
            <p className="px-3 text-[10px] font-extrabold tracking-widest text-[#8A97A0] uppercase mb-2">
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
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#1FAE72] via-[#5FD9A4] to-[#9EE7C4] text-white shadow-md shadow-emerald-500/20'
                        : 'text-[#8A97A0] hover:text-[#172B3A] hover:bg-[#F3FAF6]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#8A97A0]'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold shadow-sm ${
                          item.badgeColor || 'bg-[#E9F7F1] text-[#129461]'
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

      {/* Clean Neumorphic User Profile & Logout */}
      <div className="p-4 border-t border-[#EDF2F1] bg-[#FBFBFD]">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-9 h-9 rounded-2xl bg-[#E9F7F1] border border-[#DCF0E6] flex items-center justify-center text-[#18B878] font-extrabold text-xs shadow-sm">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-[#172B3A] truncate">{user?.fullName || 'Super Admin'}</p>
            <p className="text-[10px] font-medium text-[#8A97A0] truncate">{user?.phone || '+91 7095682464'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-[#EF4444] bg-white hover:bg-[#FEE2E2] rounded-2xl transition border border-[#EDF2F1] shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
