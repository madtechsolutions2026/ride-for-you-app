import React from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAV } from '../nav';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Super Admin',
  HUB_MANAGER: 'Hub Manager',
  EXECUTIVE: 'Hub Executive',
  SUPPORT: 'Support Manager',
  STAFF: 'Staff Executive',
};

export const Sidebar: React.FC<{
  pendingKycCount: number;
  openTicketCount?: number;
  pendingRequestCount?: number;
  openCollectionsCount?: number;
}> = ({
  pendingKycCount,
  openTicketCount = 0,
  pendingRequestCount = 0,
  openCollectionsCount = 0,
}) => {
  const { logout, user, can } = useAuth();

  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.id)) })).filter(
    (g) => g.items.length > 0,
  );

  const initials = (user?.fullName || 'ST')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="w-[236px] bg-shell border-r border-rule flex flex-col flex-shrink-0 h-screen sticky top-0 z-20">
      <div className="h-[60px] px-5 flex items-center gap-2.5 border-b border-rule">
        <img src="/assets/icon.png" alt="" className="w-7 h-7 object-contain" />
        <div className="min-w-0">
          <h1 className="u-title text-[15px] text-ink leading-none tracking-tight">
            Ride For You
          </h1>
          <span className="u-label text-[9.5px] leading-none">Operations</span>
        </div>
      </div>

      <div className="flex-1 py-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="u-label px-5 mb-1.5">{group.title}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const BADGE_COUNTS: Record<string, number> = {
                pendingKyc: pendingKycCount,
                openTickets: openTicketCount,
                pendingRequests: pendingRequestCount,
                openCollections: openCollectionsCount,
              };
              const badge = item.badge ? (BADGE_COUNTS[item.badge] ?? 0) : 0;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    `w-full flex items-center justify-between pl-[18px] pr-4 py-[7px] text-[13px] border-l-2 transition-colors ${
                      isActive
                        ? 'border-accent bg-accent-soft text-ink font-medium'
                        : 'border-transparent text-ink-muted hover:text-ink hover:bg-rule-soft'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-[15px] h-[15px] shrink-0 ${
                            isActive ? 'text-accent' : 'text-ink-faint'
                          }`}
                          strokeWidth={1.75}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {badge > 0 && (
                        <span className="u-num text-[10px] px-1.5 rounded-sm border border-signal-amberLine bg-signal-amberSoft text-signal-amber">
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-rule px-4 py-3">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-7 h-7 rounded-sm bg-surface border border-rule-strong flex items-center justify-center text-ink-muted text-[10px] font-medium shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-ink truncate leading-tight">{user?.fullName}</p>
            <p className="text-[11px] text-ink-soft truncate leading-tight">
              {ROLE_LABEL[user?.role || ''] || user?.role}
              {user?.assignedHub ? ` · ${user.assignedHub.name}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[12px] text-ink-muted bg-surface border border-rule-strong rounded-sm hover:text-signal-red hover:border-signal-redLine hover:bg-signal-redSoft transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </aside>
  );
};
