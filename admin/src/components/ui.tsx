import React from 'react';
import { NavLink } from 'react-router-dom';

/* Editorial Classic primitives. Ink on paper, hairline rules, no shadows.
   Every data page imports from here, so this file is the theme. */

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '',
  children,
}) => (
  <div className={`bg-surface border border-rule rounded-md ${className}`}>{children}</div>
);

export const SectionHeader: React.FC<{
  title: string;
  hint?: string;
  actions?: React.ReactNode;
}> = ({ title, hint, actions }) => (
  <div className="flex items-end justify-between gap-4 pb-3 mb-4 border-b border-rule">
    <div>
      <h3 className="u-title text-[17px] text-ink leading-tight">{title}</h3>
      {hint && <p className="text-[12px] text-ink-soft mt-0.5">{hint}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'green' | 'amber' | 'red' | 'slate';
}> = ({ label, value, hint, tone = 'slate' }) => {
  const hintTone = {
    green: 'text-accent',
    amber: 'text-signal-amber',
    red: 'text-signal-red',
    slate: 'text-ink-soft',
  }[tone];
  return (
    <Card className="p-4">
      <span className="u-label">{label}</span>
      <h3 className="u-title text-[26px] leading-none text-ink mt-2 mb-1 u-num">{value}</h3>
      {hint && <p className={`text-[11.5px] ${hintTone}`}>{hint}</p>}
    </Card>
  );
};

const PILL: Record<string, string> = {
  green: 'bg-accent-soft text-accent-deep border-accent-line',
  amber: 'bg-signal-amberSoft text-signal-amber border-signal-amberLine',
  red: 'bg-signal-redSoft text-signal-red border-signal-redLine',
  blue: 'bg-signal-blueSoft text-signal-blue border-signal-blueLine',
  slate: 'bg-rule-soft text-ink-muted border-rule',
};

export const Pill: React.FC<{ tone?: keyof typeof PILL; children: React.ReactNode }> = ({
  tone = 'slate',
  children,
}) => (
  <span
    className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-label px-1.5 py-0.5 rounded-sm border ${PILL[tone]}`}
  >
    {children}
  </span>
);

export const toneFor = (status: string): keyof typeof PILL => {
  const s = (status || '').toUpperCase();
  if (['PAID', 'SUCCESS', 'APPROVED', 'ACTIVE', 'COMPLETED', 'RESOLVED', 'CLOSED', 'CONFIRMED', 'READY', 'CHARGED'].includes(s))
    return 'green';
  if (['PENDING', 'SUBMITTED', 'INITIATED', 'OPEN', 'DISPATCHED', 'IN_PROGRESS', 'RETURNED', 'HANDED_OVER'].includes(s))
    return 'amber';
  if (['OVERDUE', 'FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'DISPUTED', 'RECOVERED', 'TOTAL_LOSS', 'MAJOR', 'CRITICAL'].includes(s))
    return 'red';
  if (['WAIVED', 'REFUNDED', 'INACTIVE', 'SUSPENDED'].includes(s)) return 'slate';
  return 'blue';
};

export const rupees = (n: number | null | undefined) =>
  `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export const Amount: React.FC<{ value: number | null | undefined; className?: string }> = ({
  value,
  className = '',
}) => <span className={`u-num ${className}`}>{rupees(value)}</span>;

export const Btn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }
> = ({ variant = 'ghost', className = '', ...rest }) => {
  const base =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-accent text-white border border-accent hover:bg-accent-deep hover:border-accent-deep',
    ghost: 'bg-surface text-ink-muted border border-rule-strong hover:bg-rule-soft hover:text-ink',
    danger: 'bg-surface text-signal-red border border-signal-redLine hover:bg-signal-redSoft',
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
};

export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 bg-ink/25 flex items-start justify-center p-6 overflow-y-auto">
    <div
      className={`bg-surface border border-rule-strong rounded-md shadow-overlay w-full mt-12 ${
        wide ? 'max-w-3xl' : 'max-w-lg'
      }`}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-rule">
        <h3 className="u-title text-[16px] text-ink">{title}</h3>
        <button
          onClick={onClose}
          className="text-ink-faint hover:text-ink text-xl leading-none px-1"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>
    </div>
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <label className="block space-y-1">
    <span className="u-label">{label}</span>
    {children}
  </label>
);

export const input =
  'w-full rounded-sm border border-rule-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent';

/* ---- Tables: the default presentation for ops data ---- */

export const Table: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className="overflow-x-auto">
    <table className={`w-full border-collapse text-[13px] ${className}`}>{children}</table>
  </div>
);

/* Written out in full so Tailwind's scanner can see them. */
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export const TH: React.FC<{
  children: React.ReactNode;
  align?: keyof typeof ALIGN;
  className?: string;
}> = ({ children, align = 'left', className = '' }) => (
  <th
    className={`u-label border-b border-rule-strong px-3 py-2 whitespace-nowrap ${ALIGN[align]} ${className}`}
  >
    {children}
  </th>
);

export const TD: React.FC<{
  children: React.ReactNode;
  align?: keyof typeof ALIGN;
  className?: string;
  colSpan?: number;
}> = ({ children, align = 'left', className = '', colSpan }) => (
  <td
    colSpan={colSpan}
    className={`border-b border-rule px-3 py-2 align-middle ${ALIGN[align]} ${className}`}
  >
    {children}
  </td>
);

export const TR: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({
  children,
  onClick,
}) => (
  <tr
    onClick={onClick}
    className={onClick ? 'cursor-pointer hover:bg-rule-soft transition-colors' : ''}
  >
    {children}
  </tr>
);

/* ---- Route-driven sub-tabs ---- */

export const Tabs: React.FC<{ tabs: { label: string; path: string }[] }> = ({ tabs }) => (
  <nav className="flex items-center gap-5 -mb-px">
    {tabs.map((t) => (
      <NavLink
        key={t.path}
        to={t.path}
        className={({ isActive }) =>
          `pb-2 text-[13px] border-b-2 transition-colors ${
            isActive
              ? 'border-accent text-ink font-medium'
              : 'border-transparent text-ink-soft hover:text-ink'
          }`
        }
      >
        {t.label}
      </NavLink>
    ))}
  </nav>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; hint?: string }> = ({
  icon,
  title,
  hint,
}) => (
  <div className="py-16 text-center">
    {icon && <div className="text-2xl mb-2 text-ink-faint">{icon}</div>}
    <p className="u-title text-[15px] text-ink-muted">{title}</p>
    {hint && <p className="text-[12px] text-ink-soft mt-1">{hint}</p>}
  </div>
);

export const Loader: React.FC = () => (
  <div className="py-16 flex justify-center">
    <div className="w-5 h-5 border border-rule-strong border-t-accent rounded-full animate-spin" />
  </div>
);
