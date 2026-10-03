import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, Gift } from 'lucide-react';
import { apiClient } from '../api/client';
import { errMsg } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  SectionHeader,
  Table,
  TH,
  TD,
  TR,
  Pill,
  Amount,
  Btn,
  Modal,
  Field,
  input,
  EmptyState,
  Loader,
  rupees,
} from './ui';

/**
 * One rider's wallet: balance, ledger, and the grant form.
 *
 * Credit here is company-issued only — there is no top-up path for riders and
 * no debit control for staff. Credit is spent by the billing code when the
 * next weekly invoice is paid, so the ledger always explains where it went.
 *
 * Granting is ADMIN-only on the server; the button is hidden for other roles
 * rather than shown and then rejected.
 */

interface WalletTransaction {
  id: string;
  direction: 'CREDIT' | 'DEBIT';
  reason: string;
  amount: number;
  balanceAfter: number;
  note?: string | null;
  createdAt: string;
}

interface WalletSummary {
  balance: number;
  lifetimeCredited: number;
  lifetimeSpent: number;
  transactions: WalletTransaction[];
}

const REASONS = [
  { value: 'REFUND', label: 'Refund — money we owe back' },
  { value: 'DAMAGE_REVERSAL', label: 'Damage charge reversed' },
  { value: 'DEPOSIT_RETURN', label: 'Deposit returned as credit' },
  { value: 'GOODWILL', label: 'Goodwill — service failure' },
  { value: 'PROMO', label: 'Promo / offer credit' },
];

const REASON_LABEL: Record<string, string> = {
  REFUND: 'Refund',
  DAMAGE_REVERSAL: 'Damage reversed',
  DEPOSIT_RETURN: 'Deposit returned',
  PROMO: 'Promo credit',
  GOODWILL: 'Goodwill',
  INVOICE_APPLIED: 'Used for weekly rent',
  ADJUSTMENT: 'Adjustment',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const WalletPanel: React.FC<{ riderId: string; riderName: string }> = ({
  riderId,
  riderName,
}) => {
  const { user } = useAuth();
  // Matches the server: POST /admin/api/wallet/:id/credit is adminOnly.
  const canGrant = user?.role === 'ADMIN';

  const [data, setData] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/admin/api/wallet/${riderId}`);
      setData(res.data?.data ?? null);
      setError(null);
    } catch (e) {
      setError(errMsg(e, 'Could not load this wallet'));
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/admin/api/wallet/${riderId}/credit`, {
        amount: Number(form.get('amount')),
        reason: String(form.get('reason')),
        note: String(form.get('note') || '').trim() || undefined,
      });
      setGranting(false);
      await load();
    } catch (err) {
      setError(errMsg(err, 'Could not credit this wallet'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <span className="u-label">Available credit</span>
          <h3 className="u-title text-[24px] leading-none text-ink mt-2 u-num">
            {rupees(data?.balance)}
          </h3>
          <p className="text-[11px] text-ink-soft mt-1">Comes off their next weekly rent</p>
        </Card>
        <Card className="p-4">
          <span className="u-label">Total granted</span>
          <h3 className="u-title text-[24px] leading-none text-ink mt-2 u-num">
            {rupees(data?.lifetimeCredited)}
          </h3>
        </Card>
        <Card className="p-4">
          <span className="u-label">Total used</span>
          <h3 className="u-title text-[24px] leading-none text-ink mt-2 u-num">
            {rupees(data?.lifetimeSpent)}
          </h3>
        </Card>
      </div>

      {error && <p className="text-[12.5px] text-signal-red">{error}</p>}

      <Card className="p-5">
        <SectionHeader
          title="Credit ledger"
          hint="Every grant and every rupee of it spent, in order."
          actions={
            canGrant ? (
              <Btn variant="primary" onClick={() => setGranting(true)}>
                <Gift className="w-3.5 h-3.5" strokeWidth={1.75} /> Grant credit
              </Btn>
            ) : undefined
          }
        />

        {!data?.transactions?.length ? (
          <EmptyState
            icon={<Wallet className="w-6 h-6 mx-auto" strokeWidth={1.25} />}
            title="No credit yet"
            hint={
              canGrant
                ? 'Grant credit when we owe a refund or want to make good on a service failure.'
                : 'An admin can grant credit from this screen.'
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <TH>When</TH>
                <TH>Reason</TH>
                <TH>Note</TH>
                <TH align="right">Amount</TH>
                <TH align="right">Balance after</TH>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <TR key={t.id}>
                  <TD className="u-num text-ink-soft whitespace-nowrap">{when(t.createdAt)}</TD>
                  <TD>
                    <Pill tone={t.direction === 'CREDIT' ? 'green' : 'slate'}>
                      {REASON_LABEL[t.reason] ?? t.reason}
                    </Pill>
                  </TD>
                  <TD className="text-ink-soft">{t.note || '—'}</TD>
                  <TD
                    align="right"
                    className={t.direction === 'CREDIT' ? 'text-accent-deep' : 'text-ink-muted'}
                  >
                    {t.direction === 'CREDIT' ? '+' : '−'}
                    <Amount value={t.amount} />
                  </TD>
                  <TD align="right" className="text-ink-muted">
                    <Amount value={t.balanceAfter} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {granting && (
        <Modal title={`Grant credit to ${riderName}`} onClose={() => !saving && setGranting(false)}>
          <form onSubmit={grant} className="space-y-4">
            <p className="text-[12.5px] text-ink-soft">
              The rider is told immediately and the amount comes off their next weekly invoice
              automatically. Credit cannot be withdrawn once granted, so check the amount.
            </p>

            <Field label="Amount (₹)">
              <input name="amount" type="number" min="1" required className={input} />
            </Field>

            <Field label="Reason">
              <select name="reason" required defaultValue="" className={input}>
                <option value="" disabled>
                  Choose a reason…
                </option>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Note (shown in the ledger, not to the rider)">
              <textarea
                name="note"
                rows={2}
                className={input}
                placeholder="e.g. Bike unavailable at handover on 8 Sep; two days' rent credited."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Btn type="button" onClick={() => setGranting(false)} disabled={saving}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={saving}>
                {saving ? 'Granting…' : 'Grant credit'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
