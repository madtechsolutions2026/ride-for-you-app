import React from 'react';
import { RefreshCw } from 'lucide-react';
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
    <header className="h-16 bg-white border-b border-[#EDF2F1] px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      <div>
        <h2 className="text-base font-extrabold text-[#172B3A] tracking-tight">{title}</h2>
        <p className="text-xs font-semibold text-[#8A97A0]">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Live System Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E9F7F1] border border-[#DCF0E6]">
          <span className="w-2 h-2 rounded-full bg-[#18B878] animate-pulse"></span>
          <span className="text-[11px] font-bold text-[#129461]">
            Postgres & R2 Active
          </span>
        </div>

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-[#8A97A0] hover:text-[#172B3A] hover:bg-[#F3FAF6] transition border border-[#EDF2F1]"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#18B878]' : ''}`} />
          </button>
        )}

        {/* Admin Session Badge */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-[#EDF2F1]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#18B878] to-[#129461] flex items-center justify-center text-white font-bold text-xs shadow-sm">
            AD
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-[#172B3A]">{user?.fullName || 'Administrator'}</p>
            <p className="text-[10px] text-[#8A97A0] font-mono">{user?.phone || '+91 7095682464'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
