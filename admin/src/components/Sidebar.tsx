import React from 'react';
import {
  LayoutDashboard,
  Users,
  Bike,
  ClipboardList,
  FileCheck2,
  Receipt,
  Wrench,
  Truck,
  BarChart3,
  MapPin,
  Settings,
  UserCog,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab =
  | 'overview'
  | 'riders'
  | 'fleet'
  | 'bookings'
  | 'kyc'
  | 'finance'
  | 'service'
  | 'recovery'
  | 'infrastructure'
  | 'employees'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingKycCount: number;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Super Admin',
  EXECUTIVE: 'Hub Executive',
  SUPPORT: 'Support Manager',
};

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, pendingKycCount }) => {
  const { logout, user, can } = useAuth();

  const navGroups = [
    {
      title: 'CORE',
      items: [{ id: 'overview', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      title: 'OPERATIONS',
      items: [
        { id: 'riders', label: 'Riders Directory', icon: Users },
        { id: 'bookings', label: 'Bookings & Rentals', icon: ClipboardList },
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
      items: [{ id: 'finance', label: 'Payments & Revenue', icon: Receipt }],
    },
    {
      title: 'SERVICE & RECOVERY',
      items: [
        { id: 'service', label: 'Damage & Parts', icon: Wrench },
        { id: 'recovery', label: 'Roadside & Police', icon: Truck },
      ],
    },
    {
      title: 'ORGANISATION',
      items: [
        { id: 'employees', label: 'Employees & Roles', icon: UserCog },
        { id: 'reports', label: 'Reports & MRR', icon: BarChart3 },
        { id: 'settings', label: 'Pricing & System', icon: Settings },
      ],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => can(i.id)) }))
    .filter((g) => g.items.length > 0);

  const initials = (user?.fullName || 'ST')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="w-64 bg-white border-r border-[#EDF2F1] flex flex-col flex-shrink-0 min-h-screen shadow-neo-sm font-sans z-20">
      <div className="h-20 px-6 flex items-center gap-3 border-b border-[#EDF2F1] bg-white">
        <div className="w-11 h-11 rounded-2xl bg-white p-1 border border-[#EAF8F1] shadow-neo-sm flex items-center justify-center">
          <img src="/assets/icon.png" alt="Ride For You" className="w-9 h-9 rounded-xl object-contain" />
        </div>
        <div>
          <h1 className="text-[#172B3A] font-extrabold text-base leading-tight tracking-tight">
            RIDE FOR <span className="text-[#62CE90]">YOU</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-[#62CE90] animate-pulse"></span>
            <span className="text-[10px] font-extrabold tracking-wider text-[#38A169] uppercase">
              Operations Hub
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-3.5 py-5 space-y-6 overflow-y-auto bg-white">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx}>
            <p className="px-3 text-[10px] font-extrabold tracking-widest text-[#8A97A0] uppercase mb-2">
              {group.title}
            </p>
            <div className="space-y-1.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as ActiveTab)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                        : 'text-[#8A97A0] hover:text-[#172B3A] hover:bg-[#F8F7FD]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#8A97A0]'}`} />
                      <span>{item.label}</span>
                    </div>
                    {'badge' in item && item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold shadow-sm ${
                          (item as any).badgeColor || 'bg-[#EAF8F1] text-[#38A169]'
                        }`}
                      >
                        {(item as any).badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-[#EDF2F1] bg-[#F8F7FD]">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-10 h-10 rounded-2xl bg-white border border-[#EAF8F1] flex items-center justify-center text-[#62CE90] font-extrabold text-xs shadow-neo-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-[#172B3A] truncate">{user?.fullName}</p>
            <p className="text-[10px] font-medium text-[#8A97A0] truncate">
              {ROLE_LABEL[user?.role || ''] || user?.role}
              {user?.assignedHub ? ` · ${user.assignedHub.name}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-extrabold text-[#EF4444] bg-white hover:bg-[#FEE2E2] rounded-2xl transition border border-[#EDF2F1] shadow-neo-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
