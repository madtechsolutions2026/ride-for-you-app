import React from 'react';
import { Receipt, DollarSign, TrendingUp, CreditCard, ArrowUpRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export const Finance: React.FC = () => {
  const transactions = [
    {
      id: 'TXN-9021',
      rider: 'Madhu Kunchala',
      bike: 'SPRINTO HS (TS09EV3001)',
      type: 'Weekly Rental + Platform Fee',
      amount: '₹3,345',
      status: 'PAID',
      date: 'Today, 02:45 PM',
      method: 'UPI / Razorpay',
    },
    {
      id: 'TXN-9020',
      rider: 'Vikram Singh',
      bike: 'NEW Aeroflow (TS09EV3012)',
      type: 'Weekly Rental (Renewal)',
      amount: '₹1,925',
      status: 'PAID',
      date: 'Yesterday, 06:10 PM',
      method: 'UPI / GPay',
    },
    {
      id: 'TXN-9019',
      rider: 'Ramesh Reddy',
      bike: 'ODYSSEY (TS09EV3022)',
      type: 'Weekly Rental + Platform Fee',
      amount: '₹4,625',
      status: 'PAID',
      date: '28 Aug 2026',
      method: 'Credit Card',
    },
    {
      id: 'TXN-9018',
      rider: 'Suresh Kumar',
      bike: 'EVTRIC (TS09EV3008)',
      type: 'Overdue Late Fee',
      amount: '₹450',
      status: 'PENDING',
      date: '27 Aug 2026',
      method: 'Payment Link Sent',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Financial Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Collected Revenue (This Month)</span>
          <h3 className="text-2xl font-extrabold text-slate-900 mt-1">₹1,04,500</h3>
          <p className="text-xs text-emerald-600 font-semibold mt-1">✓ 100% On-Time Weekly Settled</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Platform Non-Refundable Fees</span>
          <h3 className="text-2xl font-extrabold text-slate-900 mt-1">₹36,000</h3>
          <p className="text-xs text-slate-500 font-medium mt-1">24 Active Onboarded Riders</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Pending Dues & Overdue</span>
          <h3 className="text-2xl font-extrabold text-amber-600 mt-1">₹1,650</h3>
          <p className="text-xs text-amber-700 font-medium mt-1">2 Reminders Dispatched</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Recent Payments & Transactions
          </h4>
          <button className="text-xs font-bold text-emerald-700 hover:underline">
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-6">Transaction ID</th>
                <th className="py-3.5 px-6">Rider & Vehicle</th>
                <th className="py-3.5 px-6">Type</th>
                <th className="py-3.5 px-6">Amount</th>
                <th className="py-3.5 px-6">Payment Mode</th>
                <th className="py-3.5 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-6 font-mono font-bold text-slate-900">{t.id}</td>
                  <td className="py-3.5 px-6">
                    <p className="font-bold text-slate-900">{t.rider}</p>
                    <p className="text-[11px] text-slate-500">{t.bike}</p>
                  </td>
                  <td className="py-3.5 px-6 text-slate-600">{t.type}</td>
                  <td className="py-3.5 px-6 font-bold text-slate-900">{t.amount}</td>
                  <td className="py-3.5 px-6 text-slate-500">{t.method}</td>
                  <td className="py-3.5 px-6">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {t.status === 'PAID' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      <span>{t.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
