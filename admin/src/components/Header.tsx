import React from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onRefresh, isRefreshing }) => {
  const { user } = useAuth();

  return (
    <header className="h-20 bg-white border-b border-[#EDF2F1] px-8 flex items-center justify-between sticky top-0 z-10 shadow-neo-sm font-sans">
      <div>
        <h2 className="text-base font-extrabold text-[#172B3A] tracking-tight">{title}</h2>
        <p className="text-xs font-semibold text-[#8A97A0]">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Live Status Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-[#F8F7FD] border border-[#EDF2F1] shadow-neo-sm">
          <span className="w-2 h-2 rounded-full bg-[#62CE90] animate-pulse"></span>
          <span className="text-[11px] font-extrabold text-[#38A169]">
            PostgreSQL & R2 Online
          </span>
        </div>

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-2xl bg-[#F8F7FD] text-[#8A97A0] hover:text-[#172B3A] hover:border-[#62CE90] transition border border-[#EDF2F1] shadow-neo-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#62CE90]' : ''}`} />
          </button>
        )}

        {/* Admin Session Badge */}
        <div className="flex items-center gap-3 pl-3 border-l border-[#EDF2F1]">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#62CE90] to-[#48B87A] flex items-center justify-center text-white font-extrabold text-xs shadow-neo-btn">
            AD
          </div>
          <div className="text-left">
            <p className="text-xs font-extrabold text-[#172B3A]">{user?.fullName || 'Administrator'}</p>
            <p className="text-[10px] text-[#8A97A0] font-mono font-semibold">{user?.phone || '+91 7095682464'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
