import React, { useEffect, useState } from 'react';
import { Receipt, Bell } from 'lucide-react';
import { apiClient } from '../api/client';
import { Card, Stat, Pill, toneFor, Btn, rupees, Loader, EmptyState } from '../components/ui';

type Tab = 'invoices' | 'payments';

export const Finance: React.FC = () => {
  const [tab, setTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invSummary, setInvSummary] = useState<any>({});
  const [payments, setPayments] = useState<any[]>([]);
  const [payTotals, setPayTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [inv, pay] = await Promise.all([
        apiClient.get('/admin/api/invoices'),
        apiClient.get('/admin/api/payments'),
      ]);
      setInvoices(inv.data.invoices || []);
      setInvSummary(inv.data.summary || {});
      setPayments(pay.data.payments || []);
      setPayTotals(pay.data.totals || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const doAction = async (url: string, body: any, id: string) => {
    setBusyId(id);
    try {
      await apiClient.post(url, body);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat label="Collected (all time)" value={rupees(payTotals.settled)} tone="green" hint="successful payments" />
        <Stat label="Invoices — pending" value={rupees(invSummary.pending)} tone="amber" />
        <Stat label="Invoices — overdue" value={rupees(invSummary.overdue)} tone="red" hint="past due date" />
        <Stat label="Invoices — collected" value={rupees(invSummary.collected)} tone="green" />
      </div>

      <div className="flex gap-2">
        {(['invoices', 'payments'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold capitalize transition ${
              tab === t
                ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                : 'bg-white text-[#8A97A0] border border-[#EDF2F1] shadow-neo-sm'
            }`}
          >
            {t === 'invoices' ? `Weekly invoices (${invoices.length})` : `Payments ledger (${payments.length})`}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <Card>
          {invoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-8 h-8 mx-auto text-[#CBD5E1]" />}
              title="No weekly invoices yet"
              hint="An invoice is raised for each active rental every week. The 6-hourly billing sweep keeps these current."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase border-b border-[#EDF2F1]">
                  <th className="px-5 py-3">Rider · Bike</th>
                  <th className="px-5 py-3">Week</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Due</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-extrabold text-[#172B3A]">{i.rental?.user?.fullName || '—'}</div>
                      <div className="text-xs text-[#8A97A0]">
                        {i.rental?.user?.phone} · {i.rental?.bike?.registrationNumber}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#475569]">W{i.weekNumber}</td>
                    <td className="px-5 py-3 font-extrabold text-[#172B3A]">{rupees(i.amount)}</td>
                    <td className="px-5 py-3 text-xs text-[#475569]">
                      {new Date(i.dueAt).toLocaleDateString('en-IN')}
                      {i.reminderCount > 0 && (
                        <span className="text-[#94A3B8]"> · {i.reminderCount} reminder(s)</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={toneFor(i.status)}>{i.status}</Pill>
                    </td>
                    <td className="px-5 py-3 text-right space-x-1.5 whitespace-nowrap">
                      {i.status !== 'PAID' && i.status !== 'WAIVED' && (
                        <>
                          <Btn
                            disabled={busyId === i.id}
                            onClick={() => doAction(`/admin/api/invoices/${i.id}/remind`, {}, i.id)}
                          >
                            <Bell className="w-3 h-3" /> Remind
                          </Btn>
                          <Btn
                            variant="primary"
                            disabled={busyId === i.id}
                            onClick={() =>
                              doAction(`/admin/api/invoices/${i.id}/mark-paid`, { provider: 'UPI_MANUAL' }, i.id)
                            }
                          >
                            Mark paid
                          </Btn>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'payments' && (
        <Card>
          {payments.length === 0 ? (
            <EmptyState icon="💳" title="No payments recorded yet" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase border-b border-[#EDF2F1]">
                  <th className="px-5 py-3">Rider</th>
                  <th className="px-5 py-3">Purpose</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-extrabold text-[#172B3A]">{p.user?.fullName || '—'}</div>
                      <div className="text-xs text-[#8A97A0]">{p.user?.phone}</div>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <Pill tone="slate">{p.purpose}</Pill>
                    </td>
                    <td
                      className={`px-5 py-3 font-extrabold ${p.amount < 0 ? 'text-[#DC2626]' : 'text-[#172B3A]'}`}
                    >
                      {rupees(p.amount)}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#475569]">{p.provider}</td>
                    <td className="px-5 py-3">
                      <Pill tone={toneFor(p.status)}>{p.status}</Pill>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#8A97A0]">
                      {new Date(p.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.status === 'SUCCESS' && p.amount > 0 && (
                        <Btn
                          variant="danger"
                          disabled={busyId === p.id}
                          onClick={() => {
                            const note = prompt('Refund reason:');
                            if (note) doAction(`/admin/api/payments/${p.id}/refund`, { note }, p.id);
                          }}
                        >
                          Refund
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
};
