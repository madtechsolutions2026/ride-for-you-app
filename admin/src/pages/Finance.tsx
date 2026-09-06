import React, { useEffect, useState } from 'react';
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  DollarSign,
  PieChart,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Card, Stat, Pill, toneFor, Btn, Modal, Field, input, rupees, Loader, EmptyState } from '../components/ui';

type Tab = 'overview' | 'expenses' | 'invoices' | 'payments';

export const Finance: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, expRes, invRes, payRes, infraRes] = await Promise.all([
        apiClient.get('/admin/api/finance/summary'),
        apiClient.get('/admin/api/finance/expenses'),
        apiClient.get('/admin/api/invoices'),
        apiClient.get('/admin/api/payments'),
        apiClient.get('/admin/api/infrastructure'),
      ]);

      setSummary(sumRes.data.data);
      setExpenses(expRes.data.data?.expenses || []);
      setInvoices(invRes.data.invoices || []);
      setPayments(payRes.data.payments || []);
      setHubs(infraRes.data.hubs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      category: f.get('category'),
      amount: f.get('amount'),
      note: f.get('note'),
      hubId: f.get('hubId') || undefined,
      date: f.get('date') || new Date().toISOString(),
    };

    setBusy(true);
    try {
      await apiClient.post('/admin/api/finance/expenses', body);
      setIsExpenseModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add expense');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    setBusy(true);
    try {
      await apiClient.delete(`/admin/api/finance/expenses/${id}`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete expense');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader />;

  const overview = summary?.overview || {};
  const expensesByCategory = summary?.expensesByCategory || [];
  const monthlyTrends = summary?.monthlyTrends || [];

  const filteredExpenses = categoryFilter === 'ALL'
    ? expenses
    : expenses.filter((e) => e.category === categoryFilter);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat
          label="Total Revenue"
          value={rupees(overview.totalRevenue || 0)}
          tone="green"
          hint="All time collected"
        />
        <Stat
          label="Total Expenses"
          value={rupees(overview.totalExpenses || 0)}
          tone="red"
          hint="Rent, salary & service"
        />
        <Stat
          label="Net Profit / P&L"
          value={rupees(overview.netProfit || 0)}
          tone={overview.netProfit >= 0 ? 'green' : 'red'}
          hint="Lifetime balance"
        />
        <Stat
          label="This Month Rev."
          value={rupees(overview.currentMonthRevenue || 0)}
          tone="green"
        />
        <Stat
          label="This Month Exp."
          value={rupees(overview.currentMonthExpenses || 0)}
          tone="amber"
        />
        <Stat
          label="This Month Net"
          value={rupees(overview.currentMonthNetProfit || 0)}
          tone={overview.currentMonthNetProfit >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { id: 'overview', label: 'Financial Summary & P&L', icon: TrendingUp },
              { id: 'expenses', label: `Expenses Ledger (${expenses.length})`, icon: DollarSign },
              { id: 'invoices', label: `Weekly Invoices (${invoices.length})`, icon: Receipt },
              { id: 'payments', label: `Payments Ledger (${payments.length})`, icon: CreditCard },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold capitalize transition ${
                  tab === t.id
                    ? 'bg-gradient-to-r from-[#62CE90] to-[#48B87A] text-white shadow-neo-btn'
                    : 'bg-white text-[#8A97A0] border border-[#EDF2F1] shadow-neo-sm'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'expenses' && (
          <Btn variant="primary" onClick={() => setIsExpenseModalOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Record Expense
          </Btn>
        )}
      </div>

      {/* 1. FINANCIAL SUMMARY & P&L */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly MoM Trends */}
          <Card className="lg:col-span-2 p-6">
            <h3 className="text-base font-extrabold text-[#172B3A] mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#62CE90]" /> Month-over-Month P&L Performance
            </h3>

            <div className="space-y-4">
              {monthlyTrends.map((trend: any, idx: number) => {
                const maxVal = Math.max(...monthlyTrends.map((t: any) => Math.max(t.revenue, t.expenses, 1000)));
                const revWidth = Math.min(100, Math.round((trend.revenue / maxVal) * 100));
                const expWidth = Math.min(100, Math.round((trend.expenses / maxVal) * 100));

                return (
                  <div key={idx} className="bg-[#F8FAFC] p-4 rounded-xl border border-[#EDF2F1]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-[#172B3A]">
                        {trend.month} {trend.year}
                      </span>
                      <span className={`text-xs font-black ${trend.profit >= 0 ? 'text-[#38A169]' : 'text-[#EF4444]'}`}>
                        Net: {rupees(trend.profit)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] text-[#64748B] mb-0.5">
                          <span>Revenue: {rupees(trend.revenue)}</span>
                        </div>
                        <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#62CE90] rounded-full"
                            style={{ width: `${revWidth}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] text-[#64748B] mb-0.5">
                          <span>Expenses: {rupees(trend.expenses)}</span>
                        </div>
                        <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#F87171] rounded-full"
                            style={{ width: `${expWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Category Breakdown */}
          <Card className="p-6">
            <h3 className="text-base font-extrabold text-[#172B3A] mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[#62CE90]" /> Expenses by Category
            </h3>

            <div className="space-y-3">
              {expensesByCategory.map((cat: any) => (
                <div key={cat.category} className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] border border-[#EDF2F1]">
                  <div>
                    <Pill tone={cat.category === 'RENT' ? 'blue' : cat.category === 'SALARY' ? 'green' : cat.category === 'SERVICE' ? 'amber' : 'slate'}>
                      {cat.category}
                    </Pill>
                    <p className="text-[10px] text-[#8A97A0] mt-1">{cat.count} recorded entries</p>
                  </div>
                  <span className="font-extrabold text-[#172B3A]">{rupees(cat.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 2. EXPENSES LEDGER */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border border-[#EDF2F1]">
            <span className="text-xs font-bold text-[#8A97A0]">Category Filter:</span>
            {['ALL', 'RENT', 'SALARY', 'SERVICE', 'MISC'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  categoryFilter === cat ? 'bg-[#172B3A] text-white' : 'bg-[#F1F5F9] text-[#64748B]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <Card>
            {filteredExpenses.length === 0 ? (
              <EmptyState icon="💰" title="No expenses recorded" hint="Use 'Record Expense' to add rental, service, or salary costs." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase tracking-wide border-b border-[#EDF2F1]">
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Note / Description</th>
                      <th className="px-5 py-3">Hub</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((e) => (
                      <tr key={e.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-5 py-3">
                          <Pill tone={e.category === 'RENT' ? 'blue' : e.category === 'SALARY' ? 'green' : e.category === 'SERVICE' ? 'amber' : 'slate'}>
                            {e.category}
                          </Pill>
                        </td>
                        <td className="px-5 py-3 font-medium text-[#172B3A] max-w-sm">
                          {e.note}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#8A97A0]">
                          {e.hub?.name || 'All / General'}
                        </td>
                        <td className="px-5 py-3 font-extrabold text-[#EF4444]">
                          - {rupees(e.amount)}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#8A97A0]">
                          {new Date(e.date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Btn variant="danger" onClick={() => handleDeleteExpense(e.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 3. WEEKLY INVOICES */}
      {tab === 'invoices' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase border-b border-[#EDF2F1]">
                  <th className="px-5 py-3">Rider · Bike</th>
                  <th className="px-5 py-3">Week</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3">Status</th>
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
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={toneFor(i.status)}>{i.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. PAYMENTS LEDGER */}
      {tab === 'payments' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-extrabold text-[#8A97A0] uppercase border-b border-[#EDF2F1]">
                  <th className="px-5 py-3">Rider</th>
                  <th className="px-5 py-3">Purpose</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">When</th>
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
                    <td className={`px-5 py-3 font-extrabold ${p.amount < 0 ? 'text-[#DC2626]' : 'text-[#172B3A]'}`}>
                      {rupees(p.amount)}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#475569]">{p.provider}</td>
                    <td className="px-5 py-3">
                      <Pill tone={toneFor(p.status)}>{p.status}</Pill>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#8A97A0]">
                      {new Date(p.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <Modal title="Record Operating Expense" onClose={() => setIsExpenseModalOpen(false)}>
          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expense Category">
                <select name="category" required className={input}>
                  <option value="RENT">RENT (Hub lease / electricity)</option>
                  <option value="SALARY">SALARY (Employee pay)</option>
                  <option value="SERVICE">SERVICE (Bike parts / maintenance)</option>
                  <option value="MISC">MISC (Other operations)</option>
                </select>
              </Field>

              <Field label="Amount (₹)">
                <input name="amount" type="number" required min="1" placeholder="e.g. 5000" className={input} />
              </Field>

              <Field label="Associated Hub">
                <select name="hubId" className={input}>
                  <option value="">— All Hubs / General —</option>
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Date">
                <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={input} />
              </Field>
            </div>

            <Field label="Description / Note">
              <textarea name="note" required rows={3} placeholder="Provide details of this expense…" className={input} />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#EDF2F1]">
              <Btn type="button" onClick={() => setIsExpenseModalOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Record Expense'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
