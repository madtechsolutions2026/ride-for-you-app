import React from 'react';

/* Shared building blocks so the data pages stay short and on-theme. */

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '',
  children,
}) => (
  <div className={`bg-white rounded-2xl border border-[#EDF2F1] shadow-neo-sm ${className}`}>
    {children}
  </div>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: 'green' | 'amber' | 'red' | 'slate' }> = ({
  label,
  value,
  hint,
  tone = 'slate',
}) => {
  const hintTone = {
    green: 'text-[#38A169]',
    amber: 'text-[#D97706]',
    red: 'text-[#EF4444]',
    slate: 'text-[#8A97A0]',
  }[tone];
  return (
    <Card className="p-5">
      <span className="text-[11px] font-bold text-[#8A97A0] uppercase tracking-wide">{label}</span>
      <h3 className="text-2xl font-extrabold text-[#172B3A] mt-1">{value}</h3>
      {hint && <p className={`text-xs font-semibold mt-1 ${hintTone}`}>{hint}</p>}
    </Card>
  );
};

const PILL: Record<string, string> = {
  green: 'bg-[#EAF8F1] text-[#38A169]',
  amber: 'bg-[#FEF3C7] text-[#D97706]',
  red: 'bg-[#FEE2E2] text-[#DC2626]',
  blue: 'bg-[#E0F2FE] text-[#0369A1]',
  slate: 'bg-[#F1F5F9] text-[#475569]',
};

export const Pill: React.FC<{ tone?: keyof typeof PILL; children: React.ReactNode }> = ({
  tone = 'slate',
  children,
}) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${PILL[tone]}`}>
    {children}
  </span>
);

// Map any status string to a pill tone.
export const toneFor = (status: string): keyof typeof PILL => {
  const s = status.toUpperCase();
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

export const Btn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }
> = ({ variant = 'ghost', className = '', ...rest }) => {
  const base =
    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn hover:opacity-95',
    ghost: 'bg-white text-[#475569] border border-[#EDF2F1] shadow-neo-sm hover:bg-[#F8F7FD]',
    danger: 'bg-white text-[#DC2626] border border-[#FECACA] shadow-neo-sm hover:bg-[#FEE2E2]',
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
};

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({
  title,
  onClose,
  children,
  wide,
}) => (
  <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
    <div className={`bg-white rounded-3xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-6 max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-extrabold text-[#172B3A]">{title}</h3>
        <button onClick={onClose} className="text-[#8A97A0] hover:text-[#172B3A] text-xl leading-none">
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="text-[11px] font-extrabold text-[#475569] uppercase tracking-wide">{label}</span>
    {children}
  </label>
);

export const input =
  'w-full rounded-xl border border-[#EDF2F1] bg-[#F8FAFB] px-3 py-2.5 text-sm font-semibold text-[#172B3A] outline-none focus:border-[#62CE90]';

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; hint?: string }> = ({
  icon,
  title,
  hint,
}) => (
  <div className="py-16 text-center">
    <div className="text-3xl mb-2">{icon || '—'}</div>
    <p className="text-sm font-extrabold text-[#475569]">{title}</p>
    {hint && <p className="text-xs text-[#8A97A0] mt-1">{hint}</p>}
  </div>
);

export const Loader: React.FC = () => (
  <div className="py-16 flex justify-center">
    <div className="w-7 h-7 border-2 border-[#62CE90] border-t-transparent rounded-full animate-spin" />
  </div>
);
