import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Tabs } from './ui';
import type { NavTab } from '../nav';

interface HeaderProps {
  title: string;
  subtitle: string;
  tabs?: NavTab[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** True when the last dashboard stats fetch failed. */
  statsError?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  tabs,
  onRefresh,
  isRefreshing,
  statsError,
}) => (
  <header className="bg-paper border-b border-rule px-7 sticky top-0 z-10">
    <div className="flex items-start justify-between gap-6 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="u-title text-[21px] text-ink leading-tight">{title}</h2>
        <p className="text-[12px] text-ink-soft mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0 pt-1">
        {/* The old version showed a green dot and "PostgreSQL & R2" whether or
            not anything had actually been reached. It now reports what the
            last fetch did. */}
        {statsError ? (
          <span className="flex items-center gap-1.5 text-[11px] text-signal-red">
            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
            Live figures unavailable
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Connected
          </span>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Reload this page and the dashboard figures"
            aria-label="Refresh"
            className="p-1.5 rounded-sm border border-rule-strong bg-surface text-ink-soft hover:text-ink hover:bg-rule-soft transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-accent' : ''}`}
              strokeWidth={1.75}
            />
          </button>
        )}
      </div>
    </div>

    {tabs && tabs.length > 0 && <Tabs tabs={tabs} />}
  </header>
);
